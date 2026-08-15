// constants/AppState.tsx
// The shared "brain" for the whole app. Holds global state every screen reads:
//   - isPro / freeLocked  (the dev toggle: are we a free-after-trial user or Pro?)
//   - theme               (dark / light)
//   - openPaywall()       (any screen can call this to show the paywall)
// Wrap the app in <AppStateProvider> once (in app/_layout.tsx), then any screen
// calls useApp() to read/change this state.

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DARK, LIGHT } from "./theme";

type ThemeMode = "dark" | "light";

type AppStateShape = {
  // --- Pro / free ---
  isPro: boolean;                 // true = full Pro; false = free-after-trial (locked/blurred states)
  freeLocked: boolean;            // convenience: !isPro
  setIsPro: (v: boolean) => void;
  togglePro: () => void;          // dev toggle

  // --- theme ---
  themeMode: ThemeMode;
  T: typeof DARK | typeof LIGHT;  // the active token set (DARK or LIGHT)
  setThemeMode: (m: ThemeMode) => void;
  toggleTheme: () => void;

  // --- paywall ---
  paywallOpen: boolean;
  paywallVariant: "trial" | "subscribe";
  openPaywall: (variant?: "trial" | "subscribe") => void;
  closePaywall: () => void;
};

const AppStateContext = createContext<AppStateShape | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);          // default: free-after-trial, so you see the locks
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallVariant, setPaywallVariant] = useState<"trial" | "subscribe">("subscribe");

  const togglePro = useCallback(() => setIsPro((v) => !v), []);
  const toggleTheme = useCallback(
    () => setThemeMode((m) => (m === "dark" ? "light" : "dark")),
    []
  );
  const openPaywall = useCallback((variant: "trial" | "subscribe" = "subscribe") => {
    setPaywallVariant(variant);
    setPaywallOpen(true);
  }, []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);

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
    }),
    [isPro, themeMode, T, paywallOpen, paywallVariant, togglePro, toggleTheme, openPaywall, closePaywall]
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