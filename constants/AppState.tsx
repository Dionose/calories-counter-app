// constants/AppState.tsx
// The shared "brain" for the whole app. Holds global state every screen reads:
//   - isPro / freeLocked  (are we a free-after-trial user or Pro?)
//   - theme               (dark / light)
//   - openPaywall()       (any screen can call this to show the paywall)
//   - plan + profile      (the user's calorie target, macros, weight, goal)
//   - photoUrl            (a VIEWABLE url for the stored profile photo)
//   - streakDays          (drives the M colour, the flame, the Home streak chip
//                          and the calendar tiers from one value)
//   - settings            (the Profile toggles)
//   - tabResetKey         (tapping the tab you're already on drops that tab
//                          back to its root view)
//   - devMode             (ONE switch for every piece of fake data in the app)
//
// THE SEAM. Every screen asks THIS file for data and never asks Supabase
// directly. That's what let the backend arrive without rewriting a single
// screen: the shape they read stayed the same, only where it comes from
// changed. Keep it that way — a screen that imports supabase.ts has broken
// the seam and will be painful to change later.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { currentUser } from "./auth";
import { currentStreak } from "./meals";
import { avatarUrl, isStoragePath } from "./photos";
import { loadProfile, saveProfile } from "./profile";
import { supabase } from "./supabase";
import { DARK, LIGHT } from "./theme";

type ThemeMode = "dark" | "light";

// what onboarding works out for this user
export type Plan = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tdee: number;          // what they burn in a day, before the goal adjustment
  addBurned: boolean;    // top the target up on training days?
};

/* NAME vs HANDLE — two different things, and the app was conflating them.
   `name` is what Home greets you by and what the avatar initials come from.
   `handle` is @dion — what the leaderboard and your coach see. Changing one
   must not change the other. */
export type UserProfile = {
  name: string;          // "David" — the greeting

  /* what the leaderboard shows. ⚠️ profiles.handle has a UNIQUE INDEX, so this
     is checked against the database before any write — see
     constants/handles.ts for why that check has to be a database function
     rather than a query. */
  handle: string;

  /* ⚠️ FOR DISPLAY ONLY, and it has no column in the profiles table. The email
     belongs to the AUTH record — Supabase owns it, and duplicating it into the
     profile row would let the two drift apart. Anything writing to the
     database has to strip this first; see forDatabase(). */
  email: string;

  region: string;        // decides which Regional leaderboard they're on
  memberSince: string;

  /* ⚠️ THIS HOLDS A BUCKET PATH, not a URL — "<user-id>/avatar.jpg".

     The storage bucket is private, so the only displayable form is a signed
     URL, and those expire. Storing one here would mean a database full of
     links that stop working, and a profile photo that silently becomes
     initials a week later.

     So the PATH is what persists, and `photoUrl` below is what gets rendered.
     Anything reading this for display is a bug — see Avatar.tsx. */
  photoUri: string | null;

  sex: "male" | "female";    // the BMR formula's constant differs by ~166 cal
  dobDay: number;
  dobMonth: number;      // 0-indexed, matching Date
  dobYear: number;
  goal: "lose" | "maintain" | "gain";
  weightUnit: "kg" | "lbs";
  heightUnit: "cm" | "ft";
  heightCm: number;
  startWeight: number;   // what they weighed at signup
  targetWeight: number;  // what they're aiming for
  paceRate: number;      // kg per week
  goalWeeks: number;     // how long the plan says it takes

  /* ---------- THE FOUR THAT WENT MISSING ----------
     All optional, because a profile can exist without them.

     ⚠️ THESE WERE COLLECTED, SAVED AND UNREADABLE. constants/profile.ts maps
     every one of them to and from the database, and onboarding sends them —
     but they were never declared HERE, so no screen could read them without
     TypeScript objecting. It stayed hidden because every saveProfile call was
     written `next as any`, which switches off exactly the check that would
     have caught it. Those casts are gone. */
  activity?: string;     // low | light | mod | high — the TDEE multiplier
  diet?: string;         // set in Profile → Goals → Diet; nothing reads it yet
  workouts?: string;     // LEGACY — the question is gone from both flows
  heardFrom?: string;    // attribution, asked once after the paywall
};

// the Profile toggles
export type Settings = {
  watch: boolean;        // health/step sync
  notifications: boolean;
  reminders: boolean;
  haptics: boolean;      // every buzz in the app checks this first
};

/* Placeholders only. A signed-in user overwrites all of this from their row
   within a second of launch.

   NOTE the calorie value: 0, deliberately. It used to be 1,980 — a plausible
   number — and that made a failed load INVISIBLE, because a wrong target that
   looks real is indistinguishable from a right one. */
const DEFAULT_PLAN: Plan = { calories: 0, protein: 0, carbs: 0, fat: 0, tdee: 0, addBurned: false };

const DEFAULT_PROFILE: UserProfile = {
  /* ⚠️ EMPTY, NOT "Dion". These were Dion's own name, handle and a made-up
     email, and all three leaked into real accounts:

       - A new user's profile screen showed dion@motion.app as HER email.
       - The missing-row repair tried to claim the handle "dion", which is a
         REAL user's handle, hit the unique constraint, and failed — the very
         failure it exists to prevent.

     A placeholder that collides with a real row isn't a placeholder, it's a
     landmine. saveProfile strips empty strings, so these can't overwrite
     anything either. */
  name: "",
  handle: "",
  email: "",

  /* EMPTY region for the same reason plus one more: a default country would
     put every user with no region onto Canada's Regional board. */
  region: "",
  memberSince: "",
  photoUri: null,
  sex: "male",
  dobDay: 12,
  dobMonth: 2,
  dobYear: 2001,
  goal: "lose",
  weightUnit: "kg",
  heightUnit: "cm",
  heightCm: 178,
  startWeight: 78.2,
  targetWeight: 72,
  paceRate: 0.5,
  goalWeeks: 12,
};

const DEFAULT_SETTINGS: Settings = {
  watch: true,
  notifications: true,
  reminders: true,
  haptics: true,
};

/* the streak shown while demoing — long enough to reach Ultimate, so every
   tier colour and flame in the app can be seen without logging for a month */
const DEMO_STREAK = 19;

type AppStateShape = {
  userId: string | null;
  loading: boolean;

  devMode: boolean;
  toggleDevMode: () => void;

  isPro: boolean;
  freeLocked: boolean;
  setIsPro: (v: boolean) => void;
  togglePro: () => void;

  themeMode: ThemeMode;
  T: typeof DARK | typeof LIGHT;
  setThemeMode: (m: ThemeMode) => void;
  toggleTheme: () => void;

  paywallOpen: boolean;
  paywallVariant: "trial" | "subscribe";
  openPaywall: (variant?: "trial" | "subscribe") => void;
  closePaywall: () => void;

  streakDays: number;
  setDemoStreak: (n: number) => void;
  refreshStreak: () => void;

  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  tabResetKey: number;
  resetTab: () => void;

  plan: Plan;
  profile: UserProfile;
  /** ⚠️ AWAITABLE. Onboarding MUST await this before navigating away — see the
      note on the function itself. */
  savePlan: (plan: Plan, profile: Partial<UserProfile>, userId?: string) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updatePlanFlag: <K extends keyof Plan>(key: K, value: Plan[K]) => void;
  setDailyCalories: (calories: number) => void;
  resetToRecommended: () => void;
  recommendedCalories: number;

  photoUrl: string | null;
  setAvatar: (path: string, localUri?: string) => void;
  clearAvatar: () => void;
};

const AppStateContext = createContext<AppStateShape | null>(null);

/** Everything the profiles table accepts — i.e. the profile minus the fields
    that live somewhere else.

    ONE PLACE TO STRIP. `email` belongs to the auth record and has no column,
    so passing it through is a type error and would be a database error too.
    Every write path goes through here so the same mistake can't return in one
    of the six call sites. */
function forDatabase(p: UserProfile) {
  const { email, ...row } = p;
  return row;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [devMode, setDevMode] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<"trial" | "subscribe">("subscribe");

  /* TWO streak values, and only one is ever shown.

     `realStreak` is computed from logged days and is the truth.
     `demoStreak` is what the dev tier chips set, and it's ignored entirely
     unless dev mode is on.

     Keeping them separate is the whole fix: the dev chips can no longer
     overwrite real data, so switching dev mode off restores the true number
     instantly rather than leaving a fake one behind. */
  const [realStreak, setRealStreak] = useState(0);
  const [demoStreak, setDemoStreak] = useState(DEMO_STREAK);
  const [streakTick, setStreakTick] = useState(0);

  const [tabResetKey, setTabResetKey] = useState(0);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [recommended, setRecommended] = useState<Plan>(DEFAULT_PLAN);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  /* ---------- THE LIVE COPY, FOR REPAIR ----------
     State is async, so a callback firing moments after a write can still see
     the old values. The repair below needs what's true NOW, not what the last
     render captured. */
  const planRef = useRef(plan);
  const profileRef = useRef(profile);
  useEffect(() => { planRef.current = plan; }, [plan]);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  /* ---------- LOAD ON LAUNCH ----------
     Ask Supabase who's signed in — the session came back from AsyncStorage, so
     this succeeds without any typing — then pull their row. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const user = await currentUser();
      if (cancelled) return;

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      const { profile: p, plan: pl } = await loadProfile(user.id);
      if (cancelled) return;

      if (p) {
        setProfile((cur) => ({
          ...cur,
          ...p,
          /* the email lives on the AUTH record, not the profile row */
          email: user.email ?? cur.email,
          photoUri: p.photoUri ?? null,
        }));
        setIsPro(!!p.isPro);
      }
      if (pl) {
        setPlan(pl);
        setRecommended(pl);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  /* ---------- RESOLVE THE PROFILE PHOTO ----------
     A stored bucket path is not displayable; it has to be signed first. A
     value that's ALREADY displayable (a local file straight from the camera)
     passes through untouched, which is what makes a new photo appear
     instantly. */
  useEffect(() => {
    const stored = profile.photoUri;

    if (!stored) { setPhotoUrl(null); return; }
    if (!isStoragePath(stored)) { setPhotoUrl(stored); return; }

    let cancelled = false;
    (async () => {
      /* cache-busted: the filename never changes, so without this a replaced
         photo keeps rendering the old one */
      const { url } = await avatarUrl(stored, true);
      if (!cancelled && url) setPhotoUrl(url);
    })();

    return () => { cancelled = true; };
  }, [profile.photoUri]);

  /* ---------- THE STREAK ----------
     COMPUTED from logged days, never stored. A stored counter has to be
     updated correctly on every save, every delete, and every timezone edge —
     and when it drifts, it stays drifted. Deriving it means it CANNOT
     disagree with the calendar the user is looking at. */
  useEffect(() => {
    if (!userId) { setRealStreak(0); return; }
    let cancelled = false;
    (async () => {
      const n = await currentStreak(userId);
      if (!cancelled) setRealStreak(n);
    })();
    return () => { cancelled = true; };
  }, [userId, streakTick]);

  /* Logging today's first meal takes the streak from 3 to 4 — and possibly
     from Hot to Red-hot. Without this the flame stays wrong until the next
     restart. */
  const refreshStreak = useCallback(() => setStreakTick((k) => k + 1), []);

  const toggleDevMode = useCallback(() => setDevMode((v) => !v), []);

  /* ---------- AUTH CHANGES, AND THE MISSING-PROFILE REPAIR ----------
     ⚠️ THREE AUTH USERS, ONE PROFILE ROW. Signups were reaching the app with no
     profile row at all — no region, no plan, no leaderboard entry, invisible
     to every other user. Two causes, both fixed:

       1. A RACE. savePlan fired its write without being awaited, then
          router.replace() unmounted onboarding on the next line. If the
          request hadn't been sent yet, it died with the component.

       2. A HANDLE COLLISION. Onboarding hardcoded `name: "Dion"`, the handle
          derives from the name, and profiles.handle is UNIQUE — so every
          account after the first was rejected outright by Postgres.

     This is the SAFETY NET for whatever comes third: any sign-in that finds no
     profile row writes one from whatever is in memory. It only ever CREATES —
     a row that exists is never touched, so it can't overwrite real data.

     SIGNING OUT clears back to defaults. Leaving the last user's weight or
     FACE visible for whoever signs in next would be a genuine privacy leak. */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);

      if (!id) {
        setProfile(DEFAULT_PROFILE);
        setPlan(DEFAULT_PLAN);
        setRecommended(DEFAULT_PLAN);
        setPhotoUrl(null);
        setIsPro(false);
        setRealStreak(0);
        return;
      }

      if (event === "SIGNED_IN") {
        const { profile: p, plan: pl } = await loadProfile(id);

        if (p) {
          setProfile((cur) => ({
            ...cur,
            ...p,
            email: session?.user?.email ?? cur.email,
            photoUri: p.photoUri ?? null,
          }));
          setIsPro(!!p.isPro);
          if (pl) {
            setPlan(pl);
            setRecommended(pl);
          }
          return;
        }

        /* NO ROW. Write one rather than leaving them stranded.

           The defaults are EMPTY now, so this writes only what's genuinely
           known — it can no longer try to claim somebody else's handle, which
           is how this repair used to fail with the same constraint error it
           was meant to rescue people from. */
        console.log("PROFILE: no row for this account — writing one now");
        await saveProfile(id, forDatabase(profileRef.current), planRef.current);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const togglePro = useCallback(() => setIsPro((v) => !v), []);
  const toggleTheme = useCallback(() => setThemeMode((m) => (m === "dark" ? "light" : "dark")), []);
  const openPaywall = useCallback((variant: "trial" | "subscribe" = "subscribe") => {
    setPaywallVariant(variant);
    setPaywallOpen(true);
  }, []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  const resetTab = useCallback(() => setTabResetKey((k) => k + 1), []);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  /* ---------- THE END OF ONBOARDING ----------
     ⚠️ THIS IS AWAITED NOW, AND THAT WAS HALF THE BUG.

     It used to update local state and fire the database write WITHOUT waiting,
     deliberately — so a slow connection couldn't stall the last screen. Then
     finish() called router.replace() on the very next line, which unmounts
     onboarding. If the request hadn't left the device yet, it went with it.

     A second or two of waiting on a bad connection is a fine price for knowing
     the account is actually complete. Onboarding shows "Saving your plan…"
     while it happens.

     MERGES rather than replaces — onboarding only knows the fields it asked
     for, and replacing wiped everything else: handle, email, dob. */
  const savePlan = useCallback(
    async (p: Plan, prof: Partial<UserProfile>, explicitId?: string) => {
      const next = { ...profileRef.current, ...prof };

      setPlan(p);
      setRecommended(p);
      setProfile(next);

      /* explicitId exists because onboarding calls this moments after creating
         the account, before the auth listener has caught up */
      const id = explicitId || userId;
      if (!id) return;

      const { error } = await saveProfile(id, forDatabase(next), p);
      if (error) {
        /* the caller can't do much about it, but a silent failure here is what
           produced the missing rows in the first place */
        console.log("PROFILE: save failed —", error);
      }
    },
    [userId]
  );

  /* Patch a few profile fields without touching the plan. Weight calibration
     and the Profile edit screens use this — going through savePlan would reset
     the "recommended" baseline and quietly break Reset to recommended. */
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      if (userId) saveProfile(userId, forDatabase(next));
      return next;
    });
  }, [userId]);

  /* ---------- A NEW PROFILE PHOTO ----------
     The PATH is what's saved; the local file is shown immediately so the face
     appears the instant the camera closes rather than after a round trip. The
     effect above then swaps in the signed URL, which is the same image — so
     there's nothing to see. */
  const setAvatar = useCallback((path: string, localUri?: string) => {
    if (localUri) setPhotoUrl(localUri);
    setProfile((p) => {
      const next = { ...p, photoUri: path };
      if (userId) saveProfile(userId, forDatabase(next));
      return next;
    });
  }, [userId]);

  const clearAvatar = useCallback(() => {
    setPhotoUrl(null);
    setProfile((p) => {
      const next = { ...p, photoUri: null };
      if (userId) saveProfile(userId, forDatabase(next));
      return next;
    });
  }, [userId]);

  /* Toggle a plan flag without touching the calorie target. `addBurned` is the
     only one so far — flipped from Profile → Daily calories, and read by Home.

     The empty profile object is deliberate: saveProfile strips undefined and
     empty fields, so passing {} touches nothing but the plan columns. */
  const updatePlanFlag = useCallback(<K extends keyof Plan>(key: K, value: Plan[K]) => {
    setPlan((p) => {
      const next = { ...p, [key]: value };
      if (userId) saveProfile(userId, {}, next);
      return next;
    });
  }, [userId]);

  const setDailyCalories = useCallback((calories: number) => {
    setPlan((p) => {
      const next = { ...p, calories };
      if (userId) saveProfile(userId, {}, next);
      return next;
    });
  }, [userId]);

  const resetToRecommended = useCallback(() => {
    setPlan(recommended);
    if (userId) saveProfile(userId, {}, recommended);
  }, [recommended, userId]);

  const T = themeMode === "dark" ? DARK : LIGHT;

  /* the single number every screen reads. Which of the two it is depends
     entirely on the dev switch — nothing downstream needs to know. */
  const streakDays = devMode ? demoStreak : realStreak;

  const value = useMemo<AppStateShape>(
    () => ({
      userId,
      loading,
      devMode,
      toggleDevMode,
      isPro,
      freeLocked: !isPro,
      setIsPro,
      togglePro,
      themeMode,
      T,
      setThemeMode,
      toggleTheme,
      paywallOpen,
      paywallVariant,
      openPaywall,
      closePaywall,
      streakDays,
      setDemoStreak,
      refreshStreak,
      settings,
      setSetting,
      tabResetKey,
      resetTab,
      plan,
      profile,
      savePlan,
      updateProfile,
      updatePlanFlag,
      setDailyCalories,
      resetToRecommended,
      recommendedCalories: recommended.calories,
      photoUrl,
      setAvatar,
      clearAvatar,
    }),
    [userId, loading, devMode, toggleDevMode, isPro, themeMode, T, paywallOpen, paywallVariant, streakDays, refreshStreak, settings, tabResetKey, plan, profile, recommended, photoUrl, setAvatar, clearAvatar, togglePro, toggleTheme, openPaywall, closePaywall, setSetting, resetTab, savePlan, updateProfile, updatePlanFlag, setDailyCalories, resetToRecommended]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// Any screen calls this to read/change global state.
export function useApp(): AppStateShape {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useApp() must be used inside <AppStateProvider>. Wrap the app in app/_layout.tsx.");
  }
  return ctx;
}