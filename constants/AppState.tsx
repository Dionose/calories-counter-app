// constants/AppState.tsx
// The shared "brain" for the whole app. Holds global state every screen reads:
//   - isPro / freeLocked  (the dev toggle: are we a free-after-trial user or Pro?)
//   - theme               (dark / light)
//   - openPaywall()       (any screen can call this to show the paywall)
//   - plan + profile      (the user's calorie target, macros, weight, goal —
//                          generated in onboarding, read by Home/Stats/Profile)
// Wrap the app in <AppStateProvider> once (in app/_layout.tsx), then any screen
// calls useApp() to read/change this state.

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

// the answers we keep using after onboarding
export type UserProfile = {
  name: string;
  goal: "lose" | "maintain" | "gain";
  weightUnit: "kg" | "lbs";
  startWeight: number;   // what they weighed at signup
  targetWeight: number;  // what they're aiming for
  paceRate: number;      // kg per week
  goalWeeks: number;     // how long the plan says it takes
};

// used until onboarding fills in the real thing (and for the DEV chip flow)
const DEFAULT_PLAN: Plan = { calories: 1980, protein: 120, carbs: 230, fat: 65, tdee: 2480, addBurned: false };
const DEFAULT_PROFILE: UserProfile = {
  name: "Dion",
  goal: "lose",
  weightUnit: "kg",
  startWeight: 78.2,
  targetWeight: 72,
  paceRate: 0.5,
  goalWeeks: 12,
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

  // --- the user's plan ---
  plan: Plan;
  profile: UserProfile;
  savePlan: (plan: Plan, profile: UserProfile) => void;
  setDailyCalories: (calories: number) => void;  // Profile → Daily calories
  resetToRecommended: () => void;                // Profile → "Reset to recommended"
};

const AppStateContext = createContext<AppStateShape | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<"trial" | "subscribe">("subscribe");

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

  const savePlan = useCallback((p: Plan, prof: UserProfile) => {
    setPlan(p);
    setRecommended(p);
    setProfile(prof);
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
      plan,
      profile,
      savePlan,
      setDailyCalories,
      resetToRecommended,
    }),
    [isPro, themeMode, T, paywallOpen, paywallVariant, plan, profile, togglePro, toggleTheme, openPaywall, closePaywall, savePlan, setDailyCalories, resetToRecommended]
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