// constants/foods.ts
// The AMOUNTS a food comes in, written the way a person would say them — and
// the small local database that backs instant offline search.
//
// THE FOOD_DB BELOW IS A FALLBACK NOW, not the source of truth. Real search
// hits USDA and Open Food Facts (see foodApi.ts); these eighteen exist so that
// typing "banana" produces a banana instantly, with no network, and so that
// someone on a train with no signal still gets a usable answer.
//
// WHY AMOUNTS ARE WORDS. "×1.5" is a multiplier of something invisible: the
// AI's guess, which the user never saw in a unit they recognise. So every food
// carries a list of AMOUNTS in plain words, each with the grams behind it.
//
// AND WHY EVERY WORD NEEDS AN ANCHOR. "A normal serving" is abstract English
// pretending to be guidance — someone pouring hot sauce has no idea whether
// their pour was normal, so they pick at random and the calorie count is
// fiction. portions.ts builds anchored ladders ("your whole thumb", "a tennis
// ball") for everything that comes off the API; the entries below carry their
// own hints for the same reason.
//
// EVERY MEASURE THE FOOD KNOWS GETS SHOWN, AND SCALED. Three different people
// read the same row: one thinks in cups, one in millilitres, one in grams.
// Dropping any of them makes someone do arithmetic the app could have done.
//
// WORDING: North American English, since that's the launch market — "cup" and
// "tub" for yogurt, not the British "pot".

export type Amount = {
  /** what the user reads — this is the whole point */
  label: string;
  /** the ANCHOR: what this looks like in the real world, plus ml and grams.
      Not decoration — without it the label alone is a guess dressed up as a
      choice. */
  hint?: string;
  grams: number;
  /** the ml behind this rung, where the food pours */
  ml?: number;
  /* the SINGULAR unit for the counter that appears beneath this rung when
     it's selected. A label might say "2 tsp" and the user needs to say
     exactly that, rather than approximating it with a bigger unit. */
  unit?: string;
  unitPlural?: string;
  /* THE PACK'S OWN NUMBER, not our conversion of it.

     Everything else in a ladder is an anchored estimate — good, but derived.
     This one was measured by the manufacturer and printed on the label, which
     makes it a different kind of claim entirely. It's rendered in gold so it
     reads as the one to pick, and our own version of the same measure is
     removed rather than sitting beneath it with a different number. */
  exact?: boolean;
};

export type FoodDef = {
  name: string;
  sub: string;
  key: string;          // colour key — must exist in foodColors.ts
  per100: number;       // calories per 100g
  p: number;            // grams of protein per 100g
  c: number;
  f: number;
  /** the amounts this food realistically comes in, smallest first */
  amounts: Amount[];
  /** which one is selected by default — an index into amounts */
  defaultIndex: number;
  /* For foods that come in countable units, these let the user set an exact
     number when the listed amounts don't cover it. Kept for callers that want
     a single default unit; the per-rung `unit` above is finer-grained. */
  countUnit?: string;
  countUnitPlural?: string;
  gramsPerUnit?: number;
  /* the ml behind ONE unit, so a counter can show volume alongside weight.
     Only set for things that POUR — a palm of chicken has no meaningful ml,
     and inventing one would be worse than omitting it. */
  mlPerUnit?: number;
};

export const FOOD_DB: FoodDef[] = [
  {
    name: "Scrambled eggs", sub: "with butter", key: "eggs", per100: 149, p: 10, c: 1.6, f: 11,
    defaultIndex: 1,
    countUnit: "egg", countUnitPlural: "eggs", gramsPerUnit: 60,
    amounts: [
      { label: "1 egg", hint: "one medium egg · about 60 g", grams: 60, unit: "egg", unitPlural: "eggs" },
      { label: "2 eggs", hint: "about 120 g", grams: 120 },
      { label: "3 eggs", hint: "about 180 g", grams: 180 },
      { label: "4 eggs", hint: "about 240 g", grams: 240 },
      { label: "5 eggs", hint: "about 300 g", grams: 300 },
    ],
  },
  {
    /* The three sizes on North American shelves: the little 4-pack cups
       (~100g), the single-serve cup (~150–170g), and the big tub you scoop
       from (650g–1.5kg). */
    name: "Greek yogurt", sub: "plain, non-fat", key: "yogurt", per100: 59, p: 10, c: 3.6, f: 0.4,
    defaultIndex: 1,
    countUnit: "small cup", countUnitPlural: "small cups", gramsPerUnit: 100, mlPerUnit: 97,
    amounts: [
      { label: "1 small cup", hint: "the little 4-pack size · about 100 g", grams: 100, unit: "small cup", unitPlural: "small cups" },
      { label: "1 single-serve cup", hint: "the taller one, on its own · about 170 g", grams: 170, unit: "cup", unitPlural: "cups" },
      { label: "2 small cups", hint: "about 200 g", grams: 200 },
      { label: "A few spoons from a tub", hint: "three or four dinner spoons · about 80 g", grams: 80 },
      { label: "A bowl from a tub", hint: "a generous scoop, about a tennis ball · 250 g", grams: 250, unit: "bowl", unitPlural: "bowls" },
      { label: "A big bowl from a tub", hint: "a cereal bowl, most of the way full · 400 g", grams: 400 },
    ],
  },
  {
    name: "Avocado", sub: "raw", key: "avocado", per100: 160, p: 2, c: 9, f: 15,
    defaultIndex: 1,
    countUnit: "avocado", countUnitPlural: "avocados", gramsPerUnit: 150,
    amounts: [
      { label: "A few slices", hint: "three or four slices · about 45 g", grams: 45 },
      { label: "Half an avocado", hint: "one half, scooped out · about 75 g", grams: 75 },
      { label: "A whole avocado", hint: "one medium avocado · about 150 g", grams: 150, unit: "avocado", unitPlural: "avocados" },
      { label: "Two avocados", hint: "about 300 g", grams: 300 },
    ],
  },
  {
    name: "Cherry tomatoes", sub: "raw", key: "tomato", per100: 18, p: 0.9, c: 3.9, f: 0.2,
    defaultIndex: 1,
    countUnit: "tomato", countUnitPlural: "tomatoes", gramsPerUnit: 17,
    amounts: [
      { label: "A few", hint: "three or four · about 60 g", grams: 60 },
      { label: "A small handful", hint: "about six, one cupped hand · 100 g", grams: 100, unit: "small handful", unitPlural: "small handfuls" },
      { label: "A big handful", hint: "about twelve, a full cupped hand · 200 g", grams: 200, unit: "handful", unitPlural: "handfuls" },
    ],
  },
  {
    name: "White rice", sub: "cooked", key: "rice", per100: 130, p: 2.7, c: 28, f: 0.3,
    defaultIndex: 1,
    countUnit: "cup", countUnitPlural: "cups", gramsPerUnit: 180,
    amounts: [
      { label: "Half a cup (½ cup)", hint: "a tennis ball · a small teacup filled, or half a mug · about 90 g", grams: 90, unit: "half cup", unitPlural: "half cups" },
      { label: "A cup (1 cup)", hint: "your closed fist · a small mug filled to the brim · about 180 g", grams: 180, unit: "cup", unitPlural: "cups" },
      { label: "A cup and a half", hint: "a small bowl, half full · about 280 g", grams: 280 },
      { label: "Two cups", hint: "a cereal bowl, filled · about 400 g", grams: 400 },
    ],
  },
  {
    name: "Basmati rice", sub: "cooked", key: "rice", per100: 121, p: 2.7, c: 25, f: 0.4,
    defaultIndex: 1,
    countUnit: "cup", countUnitPlural: "cups", gramsPerUnit: 180,
    amounts: [
      { label: "Half a cup (½ cup)", hint: "a tennis ball · a small teacup filled, or half a mug · about 90 g", grams: 90, unit: "half cup", unitPlural: "half cups" },
      { label: "A cup (1 cup)", hint: "your closed fist · a small mug filled to the brim · about 180 g", grams: 180, unit: "cup", unitPlural: "cups" },
      { label: "A cup and a half", hint: "a small bowl, half full · about 280 g", grams: 280 },
      { label: "Two cups", hint: "a cereal bowl, filled · about 400 g", grams: 400 },
    ],
  },
  {
    name: "Brown rice", sub: "cooked", key: "rice", per100: 112, p: 2.6, c: 24, f: 0.9,
    defaultIndex: 1,
    countUnit: "cup", countUnitPlural: "cups", gramsPerUnit: 180,
    amounts: [
      { label: "Half a cup (½ cup)", hint: "a tennis ball · a small teacup filled, or half a mug · about 90 g", grams: 90, unit: "half cup", unitPlural: "half cups" },
      { label: "A cup (1 cup)", hint: "your closed fist · a small mug filled to the brim · about 180 g", grams: 180, unit: "cup", unitPlural: "cups" },
      { label: "A cup and a half", hint: "a small bowl, half full · about 280 g", grams: 280 },
      { label: "Two cups", hint: "a cereal bowl, filled · about 400 g", grams: 400 },
    ],
  },
  {
    name: "Chicken breast", sub: "grilled, skinless", key: "chicken", per100: 165, p: 31, c: 0, f: 3.6,
    defaultIndex: 1,
    countUnit: "breast", countUnitPlural: "breasts", gramsPerUnit: 174,
    amounts: [
      { label: "Half a breast", hint: "half your palm, or half a deck of cards · about 87 g", grams: 87 },
      { label: "One breast", hint: "your palm without fingers — a deck of cards · about 174 g", grams: 174, unit: "breast", unitPlural: "breasts" },
      { label: "Two breasts", hint: "both palms · about 348 g", grams: 348 },
    ],
  },
  {
    name: "Salmon fillet", sub: "baked", key: "fish", per100: 208, p: 20, c: 0, f: 13,
    defaultIndex: 1,
    countUnit: "fillet", countUnitPlural: "fillets", gramsPerUnit: 150,
    amounts: [
      { label: "A small fillet", hint: "about half your palm · 100 g", grams: 100, unit: "small fillet", unitPlural: "small fillets" },
      { label: "A normal fillet", hint: "your palm without fingers — a deck of cards · 150 g", grams: 150, unit: "fillet", unitPlural: "fillets" },
      { label: "A big fillet", hint: "your whole hand including fingers · about 220 g", grams: 220, unit: "big fillet", unitPlural: "big fillets" },
    ],
  },
  {
    name: "Sourdough bread", sub: "sliced", key: "bread", per100: 264, p: 11, c: 49, f: 1.6,
    defaultIndex: 0,
    countUnit: "slice", countUnitPlural: "slices", gramsPerUnit: 50,
    amounts: [
      { label: "1 slice", hint: "one slice as it comes · about 50 g", grams: 50, unit: "slice", unitPlural: "slices" },
      { label: "2 slices", hint: "about 100 g", grams: 100 },
      { label: "3 slices", hint: "about 150 g", grams: 150 },
      { label: "4 slices", hint: "about 200 g", grams: 200 },
    ],
  },
  {
    name: "Banana", sub: "raw", key: "banana", per100: 89, p: 1.1, c: 23, f: 0.3,
    defaultIndex: 1,
    countUnit: "banana", countUnitPlural: "bananas", gramsPerUnit: 118,
    amounts: [
      { label: "Half a banana", hint: "about 59 g", grams: 59 },
      { label: "One banana", hint: "one medium banana · about 118 g", grams: 118, unit: "banana", unitPlural: "bananas" },
      { label: "Two bananas", hint: "about 236 g", grams: 236 },
    ],
  },
  {
    name: "Almonds", sub: "raw", key: "nuts", per100: 579, p: 21, c: 22, f: 50,
    defaultIndex: 1,
    countUnit: "handful", countUnitPlural: "handfuls", gramsPerUnit: 30,
    amounts: [
      { label: "A few", hint: "five or six nuts · about 8 g", grams: 8 },
      { label: "A small handful", hint: "what fits in one cupped hand, loosely · about 30 g", grams: 30, unit: "small handful", unitPlural: "small handfuls" },
      { label: "A big handful", hint: "one cupped hand, filled · about 60 g", grams: 60, unit: "handful", unitPlural: "handfuls" },
    ],
  },
  {
    name: "Olive oil", sub: "for cooking", key: "oil", per100: 884, p: 0, c: 0, f: 100,
    defaultIndex: 1,
    countUnit: "tablespoon", countUnitPlural: "tablespoons", gramsPerUnit: 14, mlPerUnit: 15,
    amounts: [
      { label: "A teaspoon (tsp)", hint: "the tip of your thumb — the small spoon in the drawer · 5 ml, about 5 g", grams: 5, ml: 5, unit: "teaspoon", unitPlural: "teaspoons" },
      { label: "A tablespoon (tbsp)", hint: "your whole thumb — three times a teaspoon · 15 ml, about 14 g", grams: 14, ml: 15, unit: "tablespoon", unitPlural: "tablespoons" },
      { label: "Two tablespoons", hint: "both thumbs · 30 ml, about 28 g", grams: 28, ml: 30 },
      { label: "Enough to fry in", hint: "a thin layer across the pan · 45 ml, about 42 g", grams: 42, ml: 45 },
    ],
  },
  {
    name: "Black coffee", sub: "no sugar", key: "coffee", per100: 1, p: 0.1, c: 0, f: 0,
    defaultIndex: 0,
    countUnit: "cup", countUnitPlural: "cups", gramsPerUnit: 240, mlPerUnit: 240,
    amounts: [
      { label: "A cup (1 cup)", hint: "a standard mug · 240 ml, about 240 g", grams: 240, ml: 240, unit: "cup", unitPlural: "cups" },
      { label: "A big mug", hint: "the large one you use at home · 350 ml, about 350 g", grams: 350, ml: 350, unit: "big mug", unitPlural: "big mugs" },
      { label: "Two cups", hint: "480 ml, about 480 g", grams: 480, ml: 480 },
    ],
  },
  {
    name: "Orange juice", sub: "from concentrate", key: "juice", per100: 45, p: 0.7, c: 10, f: 0.2,
    defaultIndex: 1,
    countUnit: "glass", countUnitPlural: "glasses", gramsPerUnit: 260, mlPerUnit: 250,
    amounts: [
      { label: "A small glass", hint: "a short tumbler · 150 ml, about 156 g", grams: 156, ml: 150, unit: "small glass", unitPlural: "small glasses" },
      { label: "A normal glass", hint: "a standard drinking glass · 250 ml, about 260 g", grams: 260, ml: 250, unit: "glass", unitPlural: "glasses" },
      { label: "A big glass", hint: "a tall glass, filled · 400 ml, about 416 g", grams: 416, ml: 400, unit: "big glass", unitPlural: "big glasses" },
    ],
  },
  {
    name: "Mixed salad", sub: "with dressing", key: "greens", per100: 84, p: 1.6, c: 5, f: 6.5,
    defaultIndex: 1,
    countUnit: "bowl", countUnitPlural: "bowls", gramsPerUnit: 150,
    amounts: [
      { label: "A side salad", hint: "a small pile beside the main food · about 80 g", grams: 80, unit: "side salad", unitPlural: "side salads" },
      { label: "A normal bowl", hint: "a cereal bowl, half full · about 150 g", grams: 150, unit: "bowl", unitPlural: "bowls" },
      { label: "A big bowl", hint: "a cereal bowl filled — a whole meal · about 280 g", grams: 280, unit: "big bowl", unitPlural: "big bowls" },
    ],
  },
  {
    name: "Chicken curry", sub: "with sauce", key: "chicken", per100: 145, p: 12, c: 6, f: 8,
    defaultIndex: 1,
    countUnit: "serving", countUnitPlural: "servings", gramsPerUnit: 300,
    amounts: [
      { label: "A small serving", hint: "about two ladles · 200 g", grams: 200, unit: "small serving", unitPlural: "small servings" },
      { label: "A normal serving", hint: "one plate, three ladles · about 300 g", grams: 300, unit: "serving", unitPlural: "servings" },
      { label: "A big serving", hint: "a full plate — went back for more · about 450 g", grams: 450, unit: "big serving", unitPlural: "big servings" },
    ],
  },
  {
    name: "Pasta", sub: "cooked, with sauce", key: "pasta", per100: 158, p: 5.8, c: 30, f: 1.3,
    defaultIndex: 1,
    countUnit: "bowl", countUnitPlural: "bowls", gramsPerUnit: 220,
    amounts: [
      { label: "A small bowl", hint: "a pasta bowl, half full · about 150 g", grams: 150, unit: "small bowl", unitPlural: "small bowls" },
      { label: "A normal bowl", hint: "a pasta bowl, comfortably full · about 220 g", grams: 220, unit: "bowl", unitPlural: "bowls" },
      { label: "A big bowl", hint: "a full plate, heaped · about 350 g", grams: 350, unit: "big bowl", unitPlural: "big bowls" },
    ],
  },
];

/** the nutrition for a given amount of a food */
export function nutritionFor(food: FoodDef, grams: number) {
  const factor = grams / 100;
  return {
    cal: Math.round(food.per100 * factor),
    p: Math.round(food.p * factor),
    c: Math.round(food.c * factor),
    f: Math.round(food.f * factor),
    grams: Math.round(grams),
  };
}

/** find a food by name in the local set */
export function findFood(name: string) {
  return FOOD_DB.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/** "4 small cups" — for a food's single default unit */
export function countLabel(food: FoodDef, n: number) {
  const unit = n === 1 ? food.countUnit : food.countUnitPlural;
  return `${n} ${unit}`;
}

/** "3 teaspoons" from a RUNG's own unit, which is what the per-rung counter
    needs — the food's default unit might be tablespoons while the rung the
    user picked is teaspoons, and a label saying "2 tsp" means teaspoons. */
export function rungLabel(a: Amount, n: number) {
  if (!a.unit) return a.label;
  return `${n} ${n === 1 ? a.unit : a.unitPlural || a.unit}`;
}

/** "320 cal · ½ cup · 120 ml, about 120 g" — the detail line under a counter.

    EVERY MEASURE THE RUNG KNOWS, SCALED. Three people read this same line —
    one thinks in cups, one in millilitres, one in grams — and the counter's
    heading only says the unit ("2 servings"), which throws away the cup the
    label printed.

    AND IT MULTIPLIES. Two servings of "¼ cup" is a half cup, and working that
    out is exactly the arithmetic the app exists to spare someone standing in
    their kitchen holding a measuring cup. */
export function rungDetail(a: Amount, n: number, cal: number) {
  const grams = Math.round(a.grams * n);
  const ml = a.ml != null ? Math.round(a.ml * n) : null;

  const measure = ml != null
    ? `${ml} ml, about ${grams} g`
    : `about ${grams} g`;

  const scaled = scaledMeasure(a.label, n);

  return `${cal} cal · ${scaled ? `${scaled} · ` : ""}${measure}`;
}

/** "1/4 cup" × 2 → "½ cup". "2 tbsp" × 3 → "6 tbsp". "1 scoop" × 2 → "2 scoops".

    Reads whatever measure the label named, multiplies it, and writes the
    result in the SAME unit — so someone holding a measuring cup can act on it
    directly rather than converting from millilitres.

    Returns null when the label named nothing measurable, or when the result
    isn't a tidy amount. "0.83 cups" would be worse than saying nothing, and
    the ml and grams beside it already cover that case. */
function scaledMeasure(label: string, n: number): string | null {
  const l = label.toLowerCase();

  const UNITS: [RegExp, string, string][] = [
    [/\btbsp\b|tablespoons?/, "tbsp", "tbsp"],
    [/\btsp\b|teaspoons?/, "tsp", "tsp"],
    [/\bcups?\b/, "cup", "cups"],
    [/\bscoops?\b/, "scoop", "scoops"],
    [/\bslices?\b/, "slice", "slices"],
  ];

  const hit = UNITS.find(([re]) => re.test(l));
  if (!hit) return null;

  const [, single, plural] = hit;
  const total = countInLabel(l) * n;
  if (!isFinite(total) || total <= 0) return null;

  const text = fractionOf(total);
  if (!text) return null;

  /* "1 cup" not "1 cups"; "½ cup" not "½ cups" — anything at or below one
     takes the singular */
  return `${text} ${total <= 1 ? single : plural}`;
}

/** the number in front of a measure inside a label — "1/4 cup" → 0.25 */
function countInLabel(text: string): number {
  const FRACTIONS: Record<string, number> = {
    "¼": 0.25, "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¾": 0.75, "⅛": 0.125,
  };

  /* mixed numbers first — "1 1/2 tbsp" is one and a half, and matching the
     bare fraction would silently drop the leading whole */
  const mixed = text.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3]);

  const mixedSym = text.match(/(\d+)\s*([¼½⅓⅔¾⅛])/);
  if (mixedSym) return parseFloat(mixedSym[1]) + (FRACTIONS[mixedSym[2]] ?? 0);

  const frac = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);

  const sym = text.match(/[¼½⅓⅔¾⅛]/);
  if (sym) return FRACTIONS[sym[0]] ?? 1;

  if (/\bquarter\b/.test(text)) return 0.25;
  if (/\bthird\b/.test(text)) return 1 / 3;
  if (/\bhalf\b/.test(text)) return 0.5;

  const whole = text.match(/(\d+(?:\.\d+)?)/);
  return whole ? parseFloat(whole[1]) : 1;
}

/** 0.5 → "½", 1.5 → "1½", 2 → "2". NULL when it isn't a familiar amount —
    a measuring cup has marks at halves and quarters, so "0.83 cups" is noise
    where "180 ml" beside it is actionable. */
function fractionOf(n: number): string | null {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;

  if (rest < 0.02) return String(whole);

  const SYMBOLS: [number, string][] = [
    [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"],
    [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"],
  ];

  for (const [value, symbol] of SYMBOLS) {
    if (Math.abs(rest - value) < 0.02) {
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }

  return null;
}

/** the last-resort ladder, for a food nothing is known about.
    Anchored rather than abstract — "a normal amount" would be inventing a
    serving size we have no basis for, which is exactly the wording this whole
    system exists to remove. */
export const GENERIC_AMOUNTS: Amount[] = [
  { label: "A small handful", hint: "what fits in one cupped hand, loosely · about 40 g", grams: 40, unit: "small handful", unitPlural: "small handfuls" },
  { label: "A handful", hint: "one cupped hand, filled · about 80 g", grams: 80, unit: "handful", unitPlural: "handfuls" },
  { label: "Half a cup (½ cup)", hint: "a tennis ball · a small teacup filled, or half a mug · about 90 g", grams: 90, unit: "half cup", unitPlural: "half cups" },
  { label: "A cup (1 cup)", hint: "your closed fist · a small mug filled to the brim · about 180 g", grams: 180, unit: "cup", unitPlural: "cups" },
  { label: "A small bowl", hint: "a cereal bowl about half full · about 250 g", grams: 250, unit: "small bowl", unitPlural: "small bowls" },
  { label: "A full bowl", hint: "a cereal bowl filled to the top · about 400 g", grams: 400, unit: "bowl", unitPlural: "bowls" },
];