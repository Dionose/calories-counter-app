// constants/photos.ts
// Uploading photos to Supabase Storage, and getting them back out.
//
// Photos are stored at <user-id>/<name>.jpg — the folder IS the security
// boundary. The storage policy checks that first path segment against the
// requester's id, so a wrong id in the path is refused by the database rather
// than by app code that could be bypassed.
//
// ⚠️ THE BUCKET IS PRIVATE, and that has a consequence for profile photos:
// only YOU can see your own. That's right today, because the leaderboard shows
// handles rather than faces. If photos ever appear next to names there, they
// need a SECOND, PUBLIC bucket — a signed URL can't be handed to another user,
// and making this bucket public would expose every meal photo with it.
//
// NOTE the /legacy import. The new expo-file-system API is still settling and
// dropped EncodingType; the legacy module is the version that reliably reads
// a local file to base64 in this SDK.
import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

const BUCKET = "meal-photos";

/* 1000px on the long edge.

   NOT a compromise on accuracy: vision models downsample internally to around
   768–1024px anyway, so a 4000px photo doesn't help them see more — it just
   costs more tokens and a slower upload on a weak connection.

   Quality stays HIGH at 0.8 for the opposite reason. Heavy compression blurs
   the boundaries between foods, and telling rice from cauliflower is exactly
   the kind of edge the model needs. Resize hard, compress gently. */
const MAX_EDGE = 1000;
const QUALITY = 0.8;

/* A PROFILE PHOTO IS MUCH SMALLER — it renders at 72px at the very largest,
   so 512 is already four times what any screen shows. No model ever looks at
   it, which is why the accuracy reasoning above doesn't apply here: this one
   only has to survive being displayed. */
const AVATAR_EDGE = 512;
const AVATAR_QUALITY = 0.85;

/** Shrink before upload. A phone photo is 3–5MB; this lands around 200KB,
    which is roughly 20× cheaper against a 1GB free tier and indistinguishable
    once it's displayed at 140px in a recap card. */
async function shrink(uri: string, edge = MAX_EDGE, quality = QUALITY): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: edge });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return out.uri;
}

/** the shared upload path — read the file, decode it, put it in the bucket */
async function put(path: string, localUri: string, edge: number, quality: number) {
  const small = await shrink(localUri, edge, quality);

  /* base64 → ArrayBuffer. React Native's fetch(uri).blob() is unreliable for
     local files — it silently produces zero-byte uploads on some Android
     builds, which is a miserable bug to track down because the request
     "succeeds". Reading the file directly avoids it entirely. */
  const b64 = await FileSystem.readAsStringAsync(small, { encoding: "base64" });
  const bytes = decodeBase64(b64);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    /* a retry after a dropped connection should overwrite, not fail — the path
       is derived from an id, so there's only ever one right file there */
    upsert: true,
  });

  return error?.message ?? null;
}

/** Upload one meal's photo. Returns the STORAGE PATH, not a URL — the bucket
    is private, so a URL would expire and storing one would leave dead links
    in the database. The path is permanent; a fresh signed URL is minted from
    it whenever the image is actually displayed. */
export async function uploadMealPhoto(userId: string, mealId: string, localUri: string) {
  try {
    const path = `${userId}/${mealId}.jpg`;
    const error = await put(path, localUri, MAX_EDGE, QUALITY);
    if (error) return { path: null, error };
    return { path, error: null };
  } catch (e: any) {
    return { path: null, error: e?.message || "Couldn't upload that photo." };
  }
}

/* ---------- THE PROFILE PHOTO ----------
   ONE FIXED FILENAME PER USER, unlike meals. A new profile photo REPLACES the
   old one rather than piling up — someone changing their picture five times
   should not leave five files in the bucket, and there's no reason to keep an
   avatar they've deliberately replaced.

   The fixed name has one catch, handled by cacheBustedAvatarUrl below. */
const AVATAR_FILE = "avatar.jpg";

export function avatarPathFor(userId: string) {
  return `${userId}/${AVATAR_FILE}`;
}

/** true if a stored value is a bucket path rather than something displayable.

    A local capture is "file:///…", a signed URL is "https://…", and a stored
    path is neither. Avatar display code needs to tell them apart, because a
    bucket path handed to <Image> silently renders nothing. */
export function isStoragePath(value?: string | null): boolean {
  if (!value) return false;
  return !value.startsWith("file:") && !value.startsWith("http") && !value.startsWith("data:");
}

export async function uploadAvatar(userId: string, localUri: string) {
  try {
    const path = avatarPathFor(userId);
    const error = await put(path, localUri, AVATAR_EDGE, AVATAR_QUALITY);
    if (error) return { path: null, error };
    return { path, error: null };
  } catch (e: any) {
    return { path: null, error: e?.message || "Couldn't upload that photo." };
  }
}

/** A viewable URL for a profile photo.

    SEVEN DAYS, not the hour a meal photo gets. Your own face is on screen from
    the moment the app opens — on Home, in Profile, behind every settings
    screen — so an hour-long URL would expire mid-session and quietly turn into
    initials. Meal photos are looked at deliberately and briefly; this one is
    always there.

    ⚠️ CACHE-BUSTED, and it has to be. The filename never changes, so React
    Native's image cache will happily keep showing the OLD picture after
    someone replaces it — they'd take a new photo, see the previous one, and
    reasonably conclude it didn't work. The timestamp forces a fresh fetch. */
export async function avatarUrl(path: string, bust = false) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (error) return { url: null, error: error.message };

  const url = bust ? `${data.signedUrl}&t=${Date.now()}` : data.signedUrl;
  return { url, error: null };
}

export async function deleteAvatar(userId: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([avatarPathFor(userId)]);
  return { error: error?.message ?? null };
}

/** A temporary URL for displaying a stored photo. The bucket is private, so
    every view needs one of these — they expire, which is the point. */
export async function signedUrl(path: string, seconds = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}

/** Several at once — the calendar recap shows a day's worth of meals, and
    doing these one at a time would mean a visible stagger as each appears. */
export async function signedUrls(paths: string[], seconds = 3600) {
  if (!paths.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, seconds);
  const map: Record<string, string> = {};
  (data || []).forEach((d: any) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

export async function deleteMealPhoto(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return { error: error?.message ?? null };
}

/* base64 → Uint8Array, without pulling in a library for it. atob doesn't
   exist in React Native's runtime, so this does the decode by hand. */
function decodeBase64(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = chars.indexOf(clean[i]);
    const e2 = chars.indexOf(clean[i + 1]);
    const e3 = chars.indexOf(clean[i + 2]);
    const e4 = chars.indexOf(clean[i + 3]);

    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 !== -1) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (e4 !== -1) bytes[p++] = ((e3 & 3) << 6) | e4;
  }

  return bytes.subarray(0, p);
}