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
  red: "#EF4444",
  gold: "#FBBF24",
  goldBg: "rgba(251,191,36,0.12)",
  goldBorder: "rgba(251,191,36,0.40)",
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
  red: "#DC2626",
  gold: "#D97706",
  goldBg: "rgba(217,119,6,0.10)",
  goldBorder: "rgba(217,119,6,0.35)",
  carbs: "#0D9488",
  fat: "#65A30D",
  track: "#ECEDEA",
  ink: "#FFFFFF",
  emptyTile: "#EAEBE8",
};

// Streak tier colors (Spark → Warming → Hot → Red-hot → Ultimate)
export const TIERS = {
  1: { name: "Spark", color: "#38BDF8" },
  2: { name: "Warming", color: "#FBBF24" },
  3: { name: "Hot", color: "#FB923C" },
  4: { name: "Red-hot", color: "#EF4444" },
  5: { name: "Ultimate", color: "ultimate" },
};

// The rainbow used for the Ultimate tier (typed so Skia/LinearGradient accept it)
export const ULT_COLORS: [string, string, ...string[]] = [
  "#F43F5E", "#F97316", "#FACC15", "#22C55E", "#3B82F6", "#8B5CF6",
];

// Day thresholds for each tier — Spark 1-4, Warming 5-8, Hot 9-12, Red-hot 13-16, Ultimate 17+
export function tierForStreak(days: number) {
  if (days >= 17) return TIERS[5]; // Ultimate
  if (days >= 13) return TIERS[4]; // Red-hot
  if (days >= 9) return TIERS[3];  // Hot
  if (days >= 5) return TIERS[2];  // Warming
  return TIERS[1];                 // Spark
}

// Font families (loaded in app/_layout.tsx)
export const FONTS = {
  heading: "BricolageGrotesque_500Medium",
  headingMed: "BricolageGrotesque_500Medium",
  body: "Inter_400Regular",
  bodyMed: "Inter_500Medium",
};