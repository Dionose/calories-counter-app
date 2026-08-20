// constants/portions.ts
// How much is "a spoonful"?
//
// THE PROBLEM THIS SOLVES. The app used to offer "a small amount", "a normal
// amount", "a big amount". Those are abstract English: someone pouring hot
// sauce has no idea whether their pour was small or normal, so they pick one
// at random and the calorie count is fiction. A vague word is WORSE than a
// number, because it looks like guidance while giving none.
//
// So every amount here is anchored to something PHYSICAL — a thumb, a fist, a
// tennis ball, a teacup. Two anchors where possible, because a hand is always
// available and a kitchen object is more precise, and between them almost
// everyone can picture at least one.
//
// AND THE LABEL'S OWN NOTATION GOES IN THE NAME. A bottle says "per ¼ cup" or
// "per 2 tsp"; a reader who has to translate that into "a quarter cup" or work
// out whether tsp means teaspoon or tablespoon has already been given a puzzle
// rather than an answer. So the labels carry both: "A quarter cup (¼ cup)",
// "A teaspoon (tsp)".
//
// EVERY LADDER MUST REACH SMALL. A ladder that starts at "a small handful" is
// useless for margarine, where the real answer is two tablespoons — Becel came
// back with 280 calories as its LOWEST option, which is not an approximation,
// it's an unusable screen. Getting the KIND right is what fixes that, so
// kindFor at the bottom matters as much as the ladders themselves.
//
// This does not make portions accurate. A cupped hand varies by maybe 30%.
// What it does is turn a wild guess into a reasonable estimate, which is the
// realistic ceiling for food logging by eye.

export type Portion = {
  /** the name, carrying the label's own notation — "A tablespoon (tbsp)" */
  label: string;
  /** what it looks like in the real world. THE POINT OF THIS FILE. */
  anchor: string;
  ml?: number;
  grams: number;
  /* the SINGULAR unit name for the counter beneath this rung. Absent on rungs
     that are already plural ("Two tablespoons") — counting those would
     produce "2 two tablespoons", which is nonsense. */
  unit?: string;
  unitPlural?: string;
};

/* ---------- LIQUID DENSITY ----------
   ml and grams are NOT interchangeable. Water is 1:1, oil about 0.92, honey
   1.4, so converting properly needs to know the substance. Most everyday
   liquids sit close enough to 1 that the approximation is fine — and where
   it isn't, these adjust it.

   These are only a FALLBACK. When a label states both a volume and a weight,
   foodApi works the real density out from those and overrides whatever's
   guessed here. */
const DENSITY: [RegExp, number][] = [
  [/oil|olive|vegetable oil|coconut oil/i, 0.92],
  [/margarine|\bbutter\b|becel|shortening|lard|ghee/i, 0.91],
  [/honey|syrup|molasses|agave/i, 1.4],
  [/milk|cream|yogurt drink|kefir/i, 1.03],
  [/juice|soda|cola|lemonade|soft drink/i, 1.04],
  [/sauce|ketchup|mayonnaise|dressing/i, 1.1],
  [/alcohol|vodka|whisky|gin|rum|wine|beer/i, 0.95],
];

export function densityFor(name: string): number {
  for (const [re, d] of DENSITY) if (re.test(name)) return d;
  return 1;
}

const g = (ml: number, density: number) => Math.round(ml * density);

/* ---------- DRY DENSITY ----------
   How much a millilitre of a SOLID weighs.

   Used only to say "50 g is roughly ⅓ cup" — NEVER to work out calories.
   That distinction is the whole safety of it: calories come from the grams,
   which the label states exactly, so a density that's somewhat off costs
   nothing that matters. The cup line is advisory, which is why it always
   reads "roughly".

   Open Food Facts often stores a pack's "1/3 cup (50 g)" as bare "50 g",
   losing the cup entirely — this is what lets us say what that 50 g looks
   like anyway.

   THE SPREAD IS REAL. Density shifts with how finely something is chopped,
   whether it's packed down, even humidity. These are middle estimates for the
   loose, as-poured state, and anything unlisted gets NO cup line rather than
   a bad one. */
const DRY_DENSITY: [RegExp, number][] = [
  /* light and airy */
  [/puffed|corn flakes|cornflakes|rice cake|popcorn/i, 0.15],
  [/bran|muesli|granola/i, 0.35],
  [/rolled oats|oatmeal|\boats\b/i, 0.4],
  [/flour|cocoa|icing sugar|powdered sugar/i, 0.53],

  /* seeds, nuts, small grains */
  [/pumpkin seed|sunflower seed|sesame|chia|flax|\bseeds\b/i, 0.6],
  [/almond|cashew|walnut|pecan|pistachio|peanut|\bnuts\b/i, 0.55],
  [/couscous|bulgur|quinoa/i, 0.7],

  /* cooked and wet solids — checked BEFORE the dry grain rules, since
     "cooked rice" contains "rice" and weighs far less per cup */
  [/cooked rice|cooked pasta|\bbeans\b|chickpea|lentils? cooked/i, 0.75],
  [/frozen|vegetable|broccoli|cauliflower|peas|corn|berries/i, 0.65],
  [/cheese|shredded/i, 0.45],
  [/pasta|macaroni|penne|spaghetti|noodle/i, 0.45],

  /* dense dry grains and sugars */
  [/\brice\b|lentil|split pea/i, 0.85],
  [/\bsugar\b|\bsalt\b/i, 0.9],
];

/** grams per millilitre for a dry or solid food, or null when we've no
    reasonable estimate. NULL IS A LEGITIMATE ANSWER — no cup line at all
    beats a wrong one, and a food we can't place could be anywhere from
    popcorn to sugar, a sixfold range. */
export function dryDensityFor(name: string, categories = ""): number | null {
  const all = `${name} ${categories}`.toLowerCase();
  for (const [re, d] of DRY_DENSITY) if (re.test(all)) return d;
  return null;
}

/* ---------- LIQUIDS ----------
   Sauces, oils, milk, juice, egg whites in a carton. Measured in ML because
   that's what the label says and what a measuring jug shows — nobody pours
   sauce by weight. Grams shown alongside, because some packs use those
   instead and the user should be able to match whichever theirs states.

   THE CUP SIZES RELATE TO EACH OTHER through one object: a small teacup. A
   quarter cup is a teacup's worth, a half fills it, a full cup is a mug. That
   ladder is easier to hold in your head than four unrelated comparisons. */
export function liquidPortions(name: string): Portion[] {
  const d = densityFor(name);
  return [
    {
      label: "A teaspoon (tsp)",
      anchor: "the tip of your thumb — the small spoon in the drawer",
      ml: 5, grams: g(5, d), unit: "teaspoon", unitPlural: "teaspoons",
    },
    {
      label: "A tablespoon (tbsp)",
      anchor: "your whole thumb — the big spoon, three times a teaspoon",
      ml: 15, grams: g(15, d), unit: "tablespoon", unitPlural: "tablespoons",
    },
    {
      label: "A splash",
      anchor: "about two tablespoons",
      ml: 30, grams: g(30, d), unit: "splash", unitPlural: "splashes",
    },
    {
      label: "A shot glass",
      anchor: "the small glass, filled — three tablespoons",
      ml: 45, grams: g(45, d), unit: "shot glass", unitPlural: "shot glasses",
    },
    {
      label: "A quarter cup (¼ cup)",
      anchor: "a golf ball · the small teacup, or a shot glass and a bit more",
      ml: 60, grams: g(60, d), unit: "quarter cup", unitPlural: "quarter cups",
    },
    {
      label: "A third of a cup (⅓ cup)",
      anchor: "a small teacup, not quite full · four tablespoons and a bit",
      ml: 80, grams: g(80, d), unit: "third of a cup", unitPlural: "thirds of a cup",
    },
    {
      label: "Half a cup (½ cup)",
      anchor: "a tennis ball · a small teacup filled, or half a mug",
      ml: 120, grams: g(120, d), unit: "half cup", unitPlural: "half cups",
    },
    {
      label: "A cup (1 cup)",
      anchor: "your closed fist · a small mug filled to the brim",
      ml: 240, grams: g(240, d), unit: "cup", unitPlural: "cups",
    },
    {
      label: "A can",
      anchor: "a standard soft-drink can · about 1⅓ cups",
      ml: 330, grams: g(330, d), unit: "can", unitPlural: "cans",
    },
    {
      label: "A small bottle",
      anchor: "the pocket-size water bottle · about two cups",
      ml: 500, grams: g(500, d), unit: "bottle", unitPlural: "bottles",
    },
  ];
}

/* ---------- LOOSE SOLIDS BY VOLUME ----------
   Rice, pasta, cereal, frozen veg, berries, salad. Things you scoop rather
   than count or slice. Cups and bowls, anchored to hands. */
export function scoopPortions(): Portion[] {
  return [
    {
      label: "A spoonful",
      anchor: "one heaped dinner spoon",
      grams: 15, unit: "spoonful", unitPlural: "spoonfuls",
    },
    {
      label: "A small handful",
      anchor: "what fits in one cupped hand, loosely",
      grams: 40, unit: "small handful", unitPlural: "small handfuls",
    },
    {
      label: "A handful",
      anchor: "one cupped hand, filled",
      grams: 80, unit: "handful", unitPlural: "handfuls",
    },
    {
      label: "Half a cup (½ cup)",
      anchor: "a tennis ball · a small teacup filled, or half a mug",
      grams: 90, unit: "half cup", unitPlural: "half cups",
    },
    {
      label: "A cup (1 cup)",
      anchor: "your closed fist · a small mug filled to the brim",
      grams: 180, unit: "cup", unitPlural: "cups",
    },
    {
      label: "A small bowl",
      anchor: "a cereal bowl about half full · roughly 1½ cups",
      grams: 250, unit: "small bowl", unitPlural: "small bowls",
    },
    {
      label: "A full bowl",
      anchor: "a cereal bowl filled to the top · roughly two cups",
      grams: 400, unit: "bowl", unitPlural: "bowls",
    },
  ];
}

/* ---------- MEAT AND FISH ----------
   The two classic anchors, and they're classics because they work: a palm and
   a deck of cards are both roughly a portion, and everyone has seen both. */
export function proteinPortions(): Portion[] {
  return [
    {
      label: "A few bites",
      anchor: "two or three forkfuls",
      grams: 25, unit: "few bites", unitPlural: "portions",
    },
    {
      label: "A small piece",
      anchor: "about half your palm, or half a deck of cards",
      grams: 50, unit: "small piece", unitPlural: "small pieces",
    },
    {
      label: "A palm-sized piece",
      anchor: "your palm without the fingers — a deck of cards",
      grams: 100, unit: "palm-sized piece", unitPlural: "palm-sized pieces",
    },
    {
      label: "A large piece",
      anchor: "your whole hand including fingers",
      grams: 170, unit: "large piece", unitPlural: "large pieces",
    },
    {
      label: "Two palm-sized pieces",
      anchor: "both palms, or two decks of cards",
      grams: 220,
    },
  ];
}

/* ---------- SPREADABLES ----------
   Margarine, butter, peanut butter, hummus, jam, cream cheese. Scooped with a
   knife or spoon rather than poured.

   STARTS AT A TEASPOON, deliberately. Becel's label says "2 tbsp (10 g)" —
   before this ladder existed for it, margarine routed to the scoop list whose
   smallest rung was a 280-calorie handful. There was literally no way to log
   what the pack described. A ladder has to reach the amounts people actually
   use, and for a spread that means single spoons. */
export function spreadPortions(name: string): Portion[] {
  const d = densityFor(name);
  return [
    {
      label: "A scrape",
      anchor: "a thin layer on one slice of toast — about half a teaspoon",
      ml: 3, grams: Math.max(1, g(3, d)), unit: "scrape", unitPlural: "scrapes",
    },
    {
      label: "A teaspoon (tsp)",
      anchor: "the tip of your thumb — one small spoon, levelled",
      ml: 5, grams: g(5, d), unit: "teaspoon", unitPlural: "teaspoons",
    },
    {
      label: "A tablespoon (tbsp)",
      anchor: "your whole thumb — a generous layer on toast",
      ml: 15, grams: g(15, d), unit: "tablespoon", unitPlural: "tablespoons",
    },
    {
      label: "Two tablespoons",
      anchor: "both thumbs, or a heaped dinner spoon",
      ml: 30, grams: g(30, d),
    },
    {
      label: "A quarter cup (¼ cup)",
      anchor: "a golf ball · four tablespoons, or a small teacup's worth",
      ml: 60, grams: g(60, d), unit: "quarter cup", unitPlural: "quarter cups",
    },
    {
      label: "A small pot",
      anchor: "a single-serve yogurt pot · about ⅔ of a cup",
      ml: 150, grams: g(150, d), unit: "small pot", unitPlural: "small pots",
    },
  ];
}

/* ---------- SMALL QUANTITIES ----------
   Salt, seeds, dressing, sprinkles. Where a tablespoon would already be
   generous, so the ladder starts smaller still. */
export function pinchPortions(name: string): Portion[] {
  const d = densityFor(name);
  return [
    {
      label: "A pinch",
      anchor: "what you hold between finger and thumb",
      ml: 1, grams: Math.max(1, g(1, d)), unit: "pinch", unitPlural: "pinches",
    },
    {
      label: "A teaspoon (tsp)",
      anchor: "the tip of your thumb — the small spoon in the drawer",
      ml: 5, grams: g(5, d), unit: "teaspoon", unitPlural: "teaspoons",
    },
    {
      label: "A tablespoon (tbsp)",
      anchor: "your whole thumb — three times a teaspoon",
      ml: 15, grams: g(15, d), unit: "tablespoon", unitPlural: "tablespoons",
    },
    {
      label: "Two tablespoons",
      anchor: "both thumbs together",
      ml: 30, grams: g(30, d),
    },
  ];
}

/* ---------- POWDERS ----------
   Protein powder, collagen, drink mixes, formula. The pack says "per scoop"
   and ships its own scoop — but SCOOPS DIFFER BETWEEN BRANDS, so one scoop is
   not a universal measure the way a teaspoon is. The honest reference is the
   grams the label prints beside it, which is what the anchor says rather than
   pretending otherwise. */
export function powderPortions(servingG?: number): Portion[] {
  const scoop = servingG || 30;
  return [
    {
      label: "A tablespoon (tbsp)",
      anchor: "your whole thumb — for when the scoop has gone missing in the tub",
      grams: Math.max(1, Math.round(scoop * 0.5)), unit: "tablespoon", unitPlural: "tablespoons",
    },
    {
      label: "Half a scoop",
      anchor: `the scoop from the tub, half filled · about ${Math.round(scoop / 2)} g`,
      grams: Math.round(scoop / 2),
    },
    {
      label: "One scoop",
      anchor: servingG
        ? `the scoop that came in the tub — your label calls this ${Math.round(scoop)} g`
        : `the scoop that came in the tub · usually about ${scoop} g, but check yours`,
      grams: Math.round(scoop), unit: "scoop", unitPlural: "scoops",
    },
    {
      label: "A heaped scoop",
      anchor: "the scoop, piled rather than levelled — roughly a third more",
      grams: Math.round(scoop * 1.35),
    },
  ];
}

/* ---------- A PACKAGED SERVING ----------
   When the pack states its own serving size, THAT is the honest reference —
   the manufacturer measured it and printed it, which beats any anchor we
   invent. The anchors here just make the multiples legible. */
export function packPortions(servingG: number, servingText?: string): Portion[] {
  const stated = servingText
    ? `as printed on the pack — ${servingText}`
    : `as printed on the pack — ${Math.round(servingG)}g`;
  return [
    {
      label: "A quarter of a serving",
      anchor: "a small taste — a quarter of what the pack calls one",
      grams: Math.max(1, Math.round(servingG / 4)),
    },
    {
      label: "Half a serving",
      anchor: "half of what the pack calls one serving",
      grams: Math.round(servingG / 2),
    },
    {
      label: "One serving",
      anchor: stated,
      grams: Math.round(servingG), unit: "serving", unitPlural: "servings",
    },
    {
      label: "Two servings",
      anchor: "double what the pack states",
      grams: Math.round(servingG * 2),
    },
    {
      label: "Three servings",
      anchor: "triple what the pack states",
      grams: Math.round(servingG * 3),
    },
  ];
}

/* ---------- WHICH LADDER ----------
   Reads the product's name, category and serving text. The serving TEXT is
   the strongest signal there is: a pack that says "60 ml", "2 tsp" or "¼ cup"
   is telling you plainly that it pours, whatever the product is called.

   GETTING THIS WRONG IS EXPENSIVE. Becel margarine matched none of the spread
   rules and fell through to `scoop`, whose smallest rung is a 280-calorie
   handful — leaving no way at all to log the "2 tbsp" its label describes.
   A misrouted food isn't slightly off; it's unusable. */
export type FoodKind = "liquid" | "scoop" | "protein" | "spread" | "pinch" | "slice" | "count" | "powder" | "pack";

export function kindFor(name: string, categories = "", servingText = ""): FoodKind {
  const all = `${name} ${categories}`.toLowerCase();
  const serving = servingText.toLowerCase();

  /* the pack said "scoop" — that's a powder, whatever else it claims to be */
  if (/scoop/.test(serving)) return "powder";
  if (/protein powder|whey|casein|collagen|creatine|meal replacement|drink mix|formula|\bpowder\b/.test(all)) return "powder";

  /* SPREADS BEFORE LIQUIDS. Margarine and butter are fats that would otherwise
     match the oil rule and get a pouring ladder — close, but a tub of Becel
     isn't poured from a bottle. */
  if (/margarine|\bbutter\b|becel|shortening|lard|\bghee\b|spread/.test(all)) return "spread";
  if (/peanut butter|almond butter|nut butter|hummus|tahini|jam|jelly|marmalade|nutella|cream cheese|yogurt|yoghurt|mayonnaise|guacamole|pesto|tartar/.test(all)) return "spread";

  /* a volume, a spoon measure or a cup fraction means it pours. Labels write
     these every possible way — "60ml", "2 tsp", "1/4 cup", "¼ cup". */
  if (/\d\s*(ml|cl|l\b|fl\.?\s*oz)/.test(serving)) return "liquid";
  if (/[¼½⅓⅔¾]|\d\s*\/\s*\d/.test(serving) && /cup/.test(serving)) return "liquid";

  if (/juice|milk|smoothie|drink|soda|cola|water|tea|coffee|beer|wine|cider|kombucha|broth|stock|egg white/.test(all)) return "liquid";
  if (/sauce|ketchup|vinegar|syrup|\boil\b|honey|marinade|sriracha|soy sauce|dressing/.test(all)) return "liquid";

  if (/\bsalt\b|pepper|spice|seasoning|sprinkle/.test(all)) return "pinch";

  if (/chicken|beef|pork|lamb|turkey|steak|salmon|tuna|cod|fish|shrimp|prawn|bacon|mince|\bmeat\b/.test(all)) return "protein";

  if (/bread|toast|bagel|slice|cheese slice|deli/.test(all)) return "slice";

  if (/banana|apple|orange|egg\b|eggs\b|pear|peach|plum|kiwi|avocado/.test(all)) return "count";

  if (/rice|pasta|noodle|cereal|oats|granola|frozen|vegetable|veg\b|broccoli|cauliflower|peas|corn|beans|lentil|berries|salad|spinach|nuts|almond|cashew|seeds|pumpkin seed|sunflower/.test(all)) return "scoop";

  return "pack";
}