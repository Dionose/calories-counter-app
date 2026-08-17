// constants/haptics.ts
// Every buzz in the app goes through here so the Profile → Haptics toggle
// actually governs them. Calling expo-haptics directly bypasses the setting
// and leaves the user with a switch that does nothing.
//
// The module-level flag is set by AppState on mount and whenever the toggle
// changes — a plain variable rather than a hook, because these get called from
// scroll handlers and callbacks where hooks aren't available.
import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export function hapticsEnabled() {
  return enabled;
}

/** ruler ticks, wheel snaps — the light repeated one */
export function tick() {
  if (enabled) Haptics.selectionAsync();
}

/** a deliberate action: pull to refresh, opening a sheet */
export function tap() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** something landed: a save, a log */
export function success() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** blocked: hitting a paywall, a limit */
export function warn() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}