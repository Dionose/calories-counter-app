// constants/AppState.tsx
// The shared "brain" for the whole app. Holds global state every screen reads:
//   - isPro / freeLocked  (are we a free-after-trial user or Pro?)
//   - theme               (dark / light)
//   - openPaywall()       (any screen can call this to show the paywall)
//   - plan + profile      (the user's calorie target, macros, weight, goal)
//   - streakDays          (drives the M colour, the flame, the Home streak chip
//                          and the calendar tiers from one value)
//   - settings            (the Profile toggles)
//   - tabResetKey         (tapping the tab you're already on drops that tab
//                          back to its root view)
//
// THE SEAM. Every screen asks THIS file for data and never asks Supabase
// directly. That's what let the backend arrive without rewriting a single
// screen: the shape they read stayed the same, only where it comes from
// changed. Keep it that way — a screen that imports supabase.ts has broken
// the seam and will be painful to change later.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { currentUser } from "./auth";
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
  name: string;          // "Gideon" — the greeting
  handle: string;        // "dion" — the leaderboard
  email: string;
  region: string;        // decides which Regional leaderboard they're on
  memberSince: string;
  photoUri: string | null;   // profile picture, once they set one
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
   looks real is indistinguishable from a right one. Zero is obviously broken,
   which is exactly what a placeholder should be. */
const DEFAULT_PLAN: Plan = { calories: 0, protein: 0, carbs: 0, fat: 0, tdee: 0, addBurned: false };
const DEFAULT_PROFILE: UserProfile = {
  name: "Dion",
  handle: "dion",
  email: "dion@motion.app",
  region: "Canada",
  memberSince: "Aug 2026",
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

type AppStateShape = {
  // --- who's signed in ---
  userId: string | null;
  /* true until the first profile load finishes. index.tsx waits on this so
     nobody sees a placeholder plan flash before their real one arrives. */
  loading: boolean;

  // --- Pro / free ---
  isPro: boolean;
  freeLocked: boolean;
  setIsPro: (v: boolean) => void;
  togglePro: () => void;

  // --- theme ---
  themeMode: ThemeMode;
  T: typeof DARK | typeof LIGHT;
  setThemeMode: (m: ThemeMode) => void;
  toggleTheme: () => void;

  // --- paywall ---
  paywallOpen: boolean;
  paywallVariant: "trial" | "subscribe";
  openPaywall: (variant?: "trial" | "subscribe") => void;
  closePaywall: () => void;

  // --- streak ---
  streakDays: number;
  setStreakDays: (n: number) => void;

  // --- settings ---
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;

  // --- tab reset ---
  tabResetKey: number;
  resetTab: () => void;

  // --- the user's plan ---
  plan: Plan;
  profile: UserProfile;
  savePlan: (plan: Plan, profile: Partial<UserProfile>, userId?: string) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;  // Stats/Profile edits
  updatePlanFlag: <K extends keyof Plan>(key: K, value: Plan[K]) => void;
  setDailyCalories: (calories: number) => void;          // Profile → Daily calories
  resetToRecommended: () => void;                        // Profile → "Reset to recommended"
  recommendedCalories: number;                           // what onboarding worked out
};

const AppStateContext = createContext<AppStateShape | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isPro, setIsPro] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<"trial" | "subscribe">("subscribe");

  // one value drives the M colour, the flame, the streak chip and the calendar
  const [streakDays, setStreakDays] = useState(14);

  /* Bumped when you tap the tab you're already on. Each tab watches this and
     drops back to its root — so Stats leaves its detail view and Profile
     leaves the account screen, the way iOS tabs behave. */
  const [tabResetKey, setTabResetKey] = useState(0);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  // what onboarding originally recommended — so "reset to recommended" can undo edits
  const [recommended, setRecommended] = useState<Plan>(DEFAULT_PLAN);

  /* ---------- LOAD ON LAUNCH ----------
     Ask Supabase who's signed in — the session came back from AsyncStorage, so
     this succeeds without any typing — then pull their row.
     A user with no profile row yet (signed up but abandoned onboarding) is a
     NORMAL state, not an error: they keep the defaults and finish later. */
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
          /* the email lives on the AUTH record, not the profile row — it's
             Supabase's to own, and duplicating it would let the two drift */
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

  /* Keep userId in step with sign-in and sign-out anywhere in the app, so
     nothing has to remember to tell AppState.

     SIGNING IN reloads the profile from scratch. This one is load-bearing and
     was the bug: the effect above only runs ONCE on mount, so after a
     sign-out → sign-in cycle nothing re-fetched, and the app showed
     placeholder numbers while the real row sat in the database.

     SIGNING OUT clears back to defaults — leaving the last user's weight
     visible for whoever signs in next would be a genuine privacy leak. */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      const id = session?.user?.id ?? null;
      setUserId(id);

      if (!id) {
        setProfile(DEFAULT_PROFILE);
        setPlan(DEFAULT_PLAN);
        setRecommended(DEFAULT_PLAN);
        setIsPro(false);
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
        }
        if (pl) {
          setPlan(pl);
          setRecommended(pl);
        }
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

  /* MERGES rather than replaces. Onboarding only knows about the fields it
     asked for, so replacing the whole object wiped everything else — handle,
     email, dob — and the first screen to read one of them crashed.

     Now ALSO writes to Supabase. The local state updates first so the UI never
     waits on the network; the write happens after and is deliberately not
     awaited — onboarding shouldn't stall on a slow connection.

     `explicitId` exists because onboarding calls this in the same moment the
     account is created, before the auth listener above has caught up. */
  const savePlan = useCallback((p: Plan, prof: Partial<UserProfile>, explicitId?: string) => {
    setPlan(p);
    setRecommended(p);
    setProfile((cur) => {
      const next = { ...cur, ...prof };
      const id = explicitId || userId;
      if (id) saveProfile(id, next as any, p);
      return next;
    });
  }, [userId]);

  /* Patch a few profile fields without touching the plan. Weight calibration
     and the Profile edit screens use this — going through savePlan would reset
     the "recommended" baseline and quietly break Reset to recommended. */
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => {
      const next = { ...p, ...patch };
      if (userId) saveProfile(userId, next as any);
      return next;
    });
  }, [userId]);

  /* Toggle a plan flag without touching the calorie target. `addBurned` is the
     only one so far — flipped from Profile → Daily calories, and read by Home
     to decide whether today's goal includes what you burned. */
  const updatePlanFlag = useCallback(<K extends keyof Plan>(key: K, value: Plan[K]) => {
    setPlan((p) => {
      const next = { ...p, [key]: value };
      if (userId) saveProfile(userId, {} as any, next);
      return next;
    });
  }, [userId]);

  const setDailyCalories = useCallback((calories: number) => {
    setPlan((p) => {
      const next = { ...p, calories };
      if (userId) saveProfile(userId, {} as any, next);
      return next;
    });
  }, [userId]);

  const resetToRecommended = useCallback(() => {
    setPlan(recommended);
    if (userId) saveProfile(userId, {} as any, recommended);
  }, [recommended, userId]);

  const T = themeMode === "dark" ? DARK : LIGHT;

  const value = useMemo<AppStateShape>(
    () => ({
      userId,
      loading,
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
      setStreakDays,
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
    }),
    [userId, loading, isPro, themeMode, T, paywallOpen, paywallVariant, streakDays, settings, tabResetKey, plan, profile, recommended, togglePro, toggleTheme, openPaywall, closePaywall, setSetting, resetTab, savePlan, updateProfile, updatePlanFlag, setDailyCalories, resetToRecommended]
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