// constants/theme.ts
// All of MOTION's design tokens live here. Every screen imports from this
// so colors/spacing stay consistent. Change a color once here, it updates everywhere.

export const DARK = {
  bg: "#0A0A0A",
  card: "#141414",
  cardHi: "#1A1A1A",
  border: "#242424",
  text: "#F5F5F5",
  sub: "#8A8A8A",
  micro: "#6A6A6A",
  green: "#22C55E",
  greenBg: "rgba(34,197,94,0.10)",
  greenBorder: "rgba(34,197,94,0.35)",
  orange: "#FB923C",
  carbs: "#2DD4BF",
  fat: "#A3E635",
  track: "#181818",
  ink: "#0A0A0A",
  emptyTile: "#121212",
};

export const LIGHT = {
  bg: "#F4F5F3",
  card: "#FFFFFF",
  cardHi: "#EFEFEC",
  border: "#E6E7E4",
  text: "#111311",
  sub: "#6B6F6B",
  micro: "#9A9E9A",
  green: "#16A34A",
  greenBg: "rgba(22,163,74,0.10)",
  greenBorder: "rgba(22,163,74,0.30)",
  orange: "#EA7317",
  carbs: "#0D9488",
  fat: "#65A30D",
  track: "#ECEDEA",
  ink: "#FFFFFF",
};

// Streak tier colors (Spark → Warming → Hot → Red-hot → Ultimate)
export const TIERS = {
  1: { name: "Spark", color: "#38BDF8" },
  2: { name: "Warming", color: "#FBBF24" },
  3: { name: "Hot", color: "#FB923C" },
  4: { name: "Red-hot", color: "#EF4444" },
  5: { name: "Ultimate", color: "ultimate" },
};

// Font families (already loaded in your _layout.tsx)
export const FONTS = {
  heading: "SpaceGrotesk_700Bold",
  headingMed: "SpaceGrotesk_600SemiBold",
  body: "Inter_400Regular",
  bodyMed: "Inter_500Medium",
};