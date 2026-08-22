// constants/handles.ts
// Is this username free, and what should we suggest if it isn't?
//
// ⚠️ WHY THIS EXISTS. There's a UNIQUE INDEX on profiles.handle — the
// leaderboard needs one, since two people called @dion would be
// indistinguishable on a public board. Postgres enforces it by rejecting the
// entire row, which is correct and brutal:
//
//   PROFILE: save failed — duplicate key value violates unique constraint
//   "profiles_handle_key"
//
// That one line is why two of Dion's accounts had NO PROFILE ROW AT ALL. The
// real fix is asking for a name and a username at signup. This file is what
// makes that safe: check BEFORE writing, so the user sees "taken, try david2"
// while typing rather than losing their account silently.
//
// ⚠️ AND IT MUST GO THROUGH THE DATABASE FUNCTION, NOT A QUERY. The first
// version selected from `profiles` directly and it QUIETLY LIED — it said
// every handle was free, including ones plainly in use. The profiles table has
// a row-level policy of `auth.uid() = id`: you can only ever read your OWN
// row. So "does anyone have handle dion" came back empty for everyone, and an
// empty result read as available.
//
// The dangerous part was my fallback: treating an empty result as free turned
// a security boundary into a green tick. Someone typed a taken username, was
// told it was available, and lost their whole profile row to the constraint.
//
// handle_is_free() is SECURITY DEFINER — it runs with the table owner's rights
// so it can see every row, but it returns a single boolean and nothing else.
// The policy stays exactly as strict; the function just answers yes or no.
// It's granted to `anon` as well as `authenticated`, because at signup there
// is no signed-in user yet — which is precisely the case that broke.
import { supabase } from "./supabase";

/* what a handle is allowed to be. Lowercase because @Dion and @dion being
   different people is a trap, and the leaderboard shows them identically at a
   glance. */
const MIN = 3;
const MAX = 20;
const VALID = /^[a-z0-9._]+$/;

/** Strip a name down to something that could be a handle.

    "David O'Brien" → "davidobrien". Not a guarantee it's FREE — just that
    it's shaped right, so the field can be pre-filled from the name they
    already typed rather than left blank. */
export function handleFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, MAX);
}

/** Is this shaped like a handle? Returns the complaint, or null if it's fine.

    SEPARATE FROM THE AVAILABILITY CHECK on purpose: this is instant and local,
    so a two-character handle is rejected without a round trip. */
export function handleProblem(handle: string): string | null {
  const h = handle.trim().toLowerCase();

  if (h.length < MIN) return `At least ${MIN} characters.`;
  if (h.length > MAX) return `At most ${MAX} characters.`;
  if (!VALID.test(h)) return "Letters, numbers, dots and underscores only.";
  return null;
}

/** Is it free?

    `exceptUserId` matters for the Profile screen: someone opening their own
    username editor and saving without changing it would otherwise be told
    their own handle is taken.

    ⚠️ ON ERROR THIS RETURNS FALSE — "assume taken" — and that's a deliberate
    reversal. The first version returned TRUE on failure, reasoning that a
    network blip shouldn't block a signup. That reasoning was wrong twice over:
    the failure here wasn't a blip but a permanent policy block, and a false
    "available" leads straight to a rejected write and a lost profile. Blocking
    the button is recoverable; a green tick on a taken name is not. */
export async function isHandleFree(handle: string, exceptUserId?: string): Promise<boolean> {
  const h = handle.trim().toLowerCase();
  if (!h) return false;

  const { data, error } = await supabase.rpc("handle_is_free", {
    want: h,
    except_id: exceptUserId ?? null,
  });

  if (error) {
    console.log("HANDLE check failed:", error.message);
    return false;
  }

  return data === true;
}

/** A handle that IS free, near the one they wanted.

    Counts up rather than adding random digits: david2, david3, david4. A
    person can read "david2" and understand exactly what happened; "david_x7q"
    just looks like the app gave up.

    Gives up after ten. If davids 2 through 11 are all taken, the honest
    answer is to let them pick something else rather than offering david47. */
export async function suggestHandle(base: string, exceptUserId?: string): Promise<string | null> {
  const root = handleFromName(base).slice(0, MAX - 2) || "user";

  for (let n = 2; n <= 11; n++) {
    const candidate = `${root}${n}`;
    if (await isHandleFree(candidate, exceptUserId)) return candidate;
  }

  return null;
}