// constants/foodColors.ts
// A colour per food, so the bars read as a plate rather than a chart.
//
// Two rules that matter:
//   1. Every food needs its own entry. Anything falling through to `default`
//      comes out green, which is how banana, yogurt and coffee all ended up
//      looking identical — the colour-coding failing silently.
//   2. Dark foods can't be dark. Coffee on a near-black background is
//      invisible, so it gets a deep brown with a lighter edge — the bar still
//      reads as coffee without disappearing.
//
// `text` is the colour of the macro line printed inside the bar. Light fills
// take near-black; deep fills take white.

export type FoodColor = { from: string; to: string; text: string };

export const FOOD_COLORS: Record<string, FoodColor> = {
  /* eggs & dairy */
  eggs: { from: "#FDE68A", to: "#FBBF24", text: "#3A2E05" },
  yogurt: { from: "#F8FAFC", to: "#CBD5E1", text: "#1E293B" },
  cheese: { from: "#FDE047", to: "#EAB308", text: "#3A2E05" },
  milk: { from: "#F1F5F9", to: "#CBD5E1", text: "#1E293B" },

  /* fruit */
  banana: { from: "#FEF08A", to: "#FACC15", text: "#3A2E05" },
  berry: { from: "#F0ABFC", to: "#C026D3", text: "#FFFFFF" },
  citrus: { from: "#FDBA74", to: "#F97316", text: "#3A1D05" },
  apple: { from: "#FCA5A5", to: "#DC2626", text: "#FFFFFF" },

  /* veg & greens */
  avocado: { from: "#A3E635", to: "#65A30D", text: "#12240A" },
  greens: { from: "#86EFAC", to: "#22C55E", text: "#0A2312" },
  tomato: { from: "#FCA5A5", to: "#EF4444", text: "#FFFFFF" },

  /* carbs */
  rice: { from: "#EFE7CE", to: "#DBCBA0", text: "#3A3316" },
  bread: { from: "#E7C89B", to: "#C08B4A", text: "#3A2408" },
  pasta: { from: "#FDE4B4", to: "#E0AE5E", text: "#3A2A08" },
  potato: { from: "#F5DEB3", to: "#D2A857", text: "#3A2E08" },

  /* protein */
  chicken: { from: "#FBCFA0", to: "#D98F45", text: "#3A2408" },
  beef: { from: "#C2705C", to: "#8C3D2E", text: "#FFFFFF" },
  fish: { from: "#FBBF9E", to: "#F97362", text: "#3A1408" },
  beans: { from: "#C4A484", to: "#8B6B47", text: "#FFFFFF" },

  /* fats & nuts */
  nuts: { from: "#D9BC94", to: "#A67C52", text: "#2E1C08" },
  oil: { from: "#E8D66B", to: "#B8991F", text: "#2E2705" },

  /* drinks — the dark ones. Deep enough to read as coffee/cola, light enough
     to be visible against the app's near-black background. */
  coffee: { from: "#8B6A4F", to: "#4A3428", text: "#FFFFFF" },
  tea: { from: "#C89B6B", to: "#8A5E33", text: "#FFFFFF" },
  cola: { from: "#7A4A3A", to: "#3D2119", text: "#FFFFFF" },
  juice: { from: "#FDBA74", to: "#EA8C24", text: "#3A1D05" },
  water: { from: "#BAE6FD", to: "#38BDF8", text: "#082F49" },

  /* sweets */
  chocolate: { from: "#A87450", to: "#5C3823", text: "#FFFFFF" },
  sweet: { from: "#F9A8D4", to: "#DB2777", text: "#FFFFFF" },

  default: { from: "#22C55E", to: "#16A34A", text: "#0A0A0A" },
};

export const colorFor = (key?: string): FoodColor =>
  (key && FOOD_COLORS[key]) || FOOD_COLORS.default;