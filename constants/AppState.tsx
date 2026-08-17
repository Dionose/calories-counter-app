// constants/AppState.tsx
// The shared "brain" for the whole app. Holds global state every screen reads:
//   - isPro / freeLocked  (the dev toggle: are we a free-after-trial user or Pro?)
//   - theme               (dark / light)
//   - openPaywall()       (any screen can call this to show the paywall)
//   - plan + profile      (the user's calorie target, macros, weight, goal —
//                          generated in onboarding, read by Home/Stats/Profile)
//   - streakDays          (drives the M colour, the flame, the Home streak chip
//                          and the calendar tiers from one value)
//   - settings            (the Profile toggles: watch sync, notifications,
//                          reminders, haptics — a switch that changes nothing
//                          is worse than no switch, so these live here and the
//                          rest of the app reads them)
//   - tabResetKey         (tapping the tab you're already on drops that tab
//                          back to its root view)

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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

// used until onboarding fills in the real thing (and for the DEV chip flow)
const DEFAULT_PLAN: Plan = { calories: 1980, protein: 120, carbs: 230, fat: 65, tdee: 2480, addBurned: false };
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
  savePlan: (plan: Plan, profile: Partial<UserProfile>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;  // Stats/Profile edits
  updatePlanFlag: <K extends keyof Plan>(key: K, value: Plan[K]) => void;
  setDailyCalories: (calories: number) => void;          // Profile → Daily calories
  resetToRecommended: () => void;                        // Profile → "Reset to recommended"
  recommendedCalories: number;                           // what onboarding worked out
};

const AppStateContext = createContext<AppStateShape | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<"trial" | "subscribe">("subscribe");

  // one value drives the M colour, the flame, the streak chip and the calendar
  const [streakDays, setStreakDays] = useState(14);

  /* Bumped when you tap the tab you're already on. Each tab watches this and
     drops back to its root — so Stats leaves its detail view and Profile
     leaves the account screen, the way iOS tabs behave. Without it a sub-view
     traps you until you find the back arrow. */
  const [tabResetKey, setTabResetKey] = useState(0);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  // what onboarding originally recommended — so "reset to recommended" can undo edits
  const [recommended, setRecommended] = useState<Plan>(DEFAULT_PLAN);

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
     Merging means adding a profile field later can't break onboarding. */
  const savePlan = useCallback((p: Plan, prof: Partial<UserProfile>) => {
    setPlan(p);
    setRecommended(p);
    setProfile((cur) => ({ ...cur, ...prof }));
  }, []);

  /* Patch a few profile fields without touching the plan. Weight calibration
     and the Profile edit screens use this — going through savePlan would reset
     the "recommended" baseline and quietly break Reset to recommended. */
  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
  }, []);

  /* Toggle a plan flag without touching the calorie target. `addBurned` is the
     only one so far — flipped from Profile → Daily calories, and read by Home
     to decide whether today's goal includes what you burned. */
  const updatePlanFlag = useCallback(<K extends keyof Plan>(key: K, value: Plan[K]) => {
    setPlan((p) => ({ ...p, [key]: value }));
  }, []);

  const setDailyCalories = useCallback((calories: number) => {
    setPlan((p) => ({ ...p, calories }));
  }, []);

  const resetToRecommended = useCallback(() => {
    setPlan(recommended);
  }, [recommended]);

  const T = themeMode === "dark" ? DARK : LIGHT;

  const value = useMemo<AppStateShape>(
    () => ({
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
    [isPro, themeMode, T, paywallOpen, paywallVariant, streakDays, settings, tabResetKey, plan, profile, recommended, togglePro, toggleTheme, openPaywall, closePaywall, setSetting, resetTab, savePlan, updateProfile, updatePlanFlag, setDailyCalories, resetToRecommended]
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