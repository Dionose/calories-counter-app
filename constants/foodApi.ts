// constants/foodApi.ts
// Real food data. Two sources, because neither covers the whole job:
//
//   USDA FoodData Central — generic foods. "chicken breast", "banana",
//   "white rice". Government data, no branding, and the only sensible answer
//   when someone types a plain food name.
//
//   Open Food Facts — packaged products. Barcodes, brand names, the yogurt
//   with a specific label on it. Community-maintained, so quality varies, but
//   it's the only free source with real barcode coverage.
//
// Both return per-100g figures, which is what FoodDef already expects — so
// what comes back from here drops straight into the existing picker with no
// change to how amounts or editing work.
import { Amount, FoodDef } from "./foods";
import {
  kindFor, liquidPortions, packPortions, pinchPortions,
  Portion,
  powderPortions,
  proteinPortions, scoopPortions, spreadPortions,
} from "./portions";

const USDA_KEY = process.env.EXPO_PUBLIC_USDA_KEY;
const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const OFF_BASE = "https://world.openfoodfacts.org";

/* USDA nutrient ids. The API returns a flat list of nutrients per food and
   these are how you find the four that matter. */
const N_CALORIES = 1008;
const N_PROTEIN = 1003;
const N_FAT = 1004;
const N_CARBS = 1005;

/* ---------- picking a colour ----------
   foodColors.ts keys the bar gradients. A real API returns thousands of foods
   and we can't hand-map them, so the name decides — falling back to a neutral
   key rather than crashing on something unrecognised. */
const COLOR_RULES: [RegExp, string][] = [
  [/egg/i, "eggs"],
  [/yogurt|yoghurt|kefir/i, "yogurt"],
  [/avocado/i, "avocado"],
  [/tomato/i, "tomato"],
  [/rice/i, "rice"],
  [/chicken|turkey|poultry/i, "chicken"],
  [/salmon|tuna|cod|fish|shrimp|prawn/i, "fish"],
  [/bread|toast|bagel|roll|baguette/i, "bread"],
  [/banana/i, "banana"],
  [/almond|nut|cashew|peanut|walnut|pistachio|protein|whey/i, "nuts"],
  [/oil|butter|ghee|margarine/i, "oil"],
  [/coffee|espresso|americano/i, "coffee"],
  [/juice|smoothie/i, "juice"],
  [/salad|lettuce|spinach|kale|greens|broccoli|cauliflower|bean/i, "greens"],
  [/pasta|spaghetti|noodle|macaroni|penne|ramen|oat/i, "pasta"],
  [/beef|steak|pork|lamb|bacon|sausage|mince/i, "chicken"],
  [/milk|cheese|cream/i, "yogurt"],
];

function colorKeyFor(name: string): string {
  for (const [re, key] of COLOR_RULES) if (re.test(name)) return key;
  return "greens";
}

/* ---------- IS THIS EVEN FOOD? ----------
   The barcode scanner will read ANY barcode — and anything you leave open,
   someone will point at a can of bug spray. Open Food Facts is a food
   database, but volunteers add whatever they scan, so it does contain
   cosmetics, cleaning products and pet food in places.

   Two guards, and the first does most of the work: a product with no calories
   is not something anyone eats. */
const NON_FOOD = /pesticide|insecticide|cleaning|detergent|bleach|cosmetic|shampoo|deodorant|toothpaste|soap|perfume|makeup|petfood|pet food|cat food|dog food|litter|battery|tobacco|cigarette|medicine|pharmaceutic/i;

function looksLikeFood(p: any): boolean {
  const kcal = Number(p?.nutriments?.["energy-kcal_100g"]) || 0;
  if (kcal <= 0) return false;
  const text = `${p?.categories || ""} ${p?.product_name || ""} ${p?.brands || ""}`;
  return !NON_FOOD.test(text);
}

/* ---------- turning portions into amounts ----------
   Portion carries the ANCHOR — "your whole thumb", "a tennis ball" — which is
   the whole reason portions.ts exists. It goes into the hint, so every row on
   the amount screen explains itself rather than saying "a normal amount" and
   leaving the user to guess.

   `scale` corrects the grams when the pack tells us the real density. */
function toAmounts(portions: Portion[], scale = 1): Amount[] {
  return portions.map((p) => {
    const grams = Math.round(p.grams * scale);
    const measure = p.ml != null ? `${p.ml} ml, about ${grams} g` : `about ${grams} g`;
    return {
      label: p.label,
      hint: `${p.anchor} · ${measure}`,
      grams,
      ml: p.ml,
      unit: p.unit,
      unitPlural: p.unitPlural,
    };
  });
}

/* ---------- THE PACK'S OWN SERVING ----------

   Every branch below builds its ladder from anchored estimates — good, but
   derived. When the record states a serving, that one number was MEASURED by
   the manufacturer, which makes it a different kind of claim, and it goes at
   the top in gold.

   TWO RULES, DELIBERATELY SEPARATE, because mixing them produces nonsense:

   1. WHEN THE RECORD NAMES A MEASURE — "½ cup", "1 1/2 tbsp", "1 scoop" — use
      those words, in the pack's own notation. Works for anything: oats,
      protein powder, sauce.

   2. WHEN IT GIVES ONLY MILLILITRES, add the spoon or cup equivalent by
      arithmetic. Safe ONLY for liquids, where ml is a real volume.

   Rule 2 must never be applied to grams. A label reading "1/2 cup (40 g)" of
   oats does not mean 40 ml — dry oats are about 0.4 g/ml, so that half cup is
   nearer 120 ml. Converting grams to cups needs a density that varies wildly
   between dry goods (oats 0.4, flour 0.53, sugar 0.85), so we don't try. */
function exactRungFrom(
  servingText: string | undefined,
  servingG: number | undefined,
  /* only liquids may have ml inferred; a gram figure for a solid is not a
     volume and must not be treated as one */
  isPourable: boolean
): Amount | null {
  if (!servingG || !servingText) return null;

  const named = servingLabelFrom(servingText);
  const ml = isPourable ? parseServingMl(servingText) : undefined;

  const parts = [servingText.trim()];
  if (ml) parts.push(`${Math.round(ml)} ml, about ${Math.round(servingG)} g`);
  else parts.push(`${Math.round(servingG)} g`);

  let hint = parts.join(" · ");

  /* the equivalent line — only when the label DIDN'T already name a measure,
     since repeating "2 tsp" under a rung already called "2 teaspoons" is noise */
  if (!named && ml) {
    const eq = volumeEquivalent(ml);
    if (eq) hint += ` — roughly ${eq}`;
  }

  return {
    label: named || "One serving",
    hint,
    grams: Math.round(servingG),
    ml: ml ? Math.round(ml) : undefined,
    /* a named measure counts in its own words; an unnamed one counts as
       servings, which is the only honest unit available */
    unit: named ? undefined : "serving",
    unitPlural: named ? undefined : "servings",
    exact: true,
  };
}

/** put the exact rung on top and drop any of ours that duplicates it.
    Two rungs both reading "half a cup" with different calorie counts is
    precisely the confusion this whole system exists to prevent — the user
    would have no way to know which to trust. */
function withExactRung(amounts: Amount[], exact: Amount | null, servingText?: string): Amount[] {
  if (!exact) return amounts;

  return [
    exact,
    ...amounts.filter((a) => {
      const sameSize = exact.ml && a.ml && Math.abs(a.ml - exact.ml) < exact.ml * 0.08;
      const sameGrams = Math.abs(a.grams - exact.grams) < exact.grams * 0.06;
      const sameWords = servingText ? sharesMeasureWord(a.label, servingText) : false;
      return !sameSize && !sameGrams && !sameWords;
    }),
  ];
}

type Ladder = {
  amounts: Amount[];
  defaultIndex: number;
  countUnit?: string;
  countUnitPlural?: string;
  gramsPerUnit?: number;
  /* the ml behind ONE unit, so a counter can show volume too. Only set for
     things that pour — a palm of chicken has no meaningful ml. */
  mlPerUnit?: number;
};

/** The amount ladder for a food, chosen by what KIND of thing it is.

    This replaced "a small amount / a normal amount / a big amount", which was
    abstract English pretending to be guidance — someone pouring sauce has no
    idea which of those their pour was, so the number they picked was
    arbitrary and the calorie count downstream was fiction. */
function ladderFor(
  name: string,
  categories = "",
  servingG?: number,
  servingText?: string,
  /* grams per ml, when the label lets us work it out exactly */
  density = 1
): Ladder {
  const kind = kindFor(name, categories, servingText || "");

  /* liquids and spreads pour; everything else is weighed */
  const pourable = kind === "liquid" || kind === "spread" || kind === "pinch";
  const exact = exactRungFrom(servingText, servingG, pourable);

  switch (kind) {
    case "liquid": {
      const ps = liquidPortions(name);
      /* portions.ts already applied ITS density guess, so undo that and apply
         the real one — otherwise the two compound and the grams drift twice */
      const scale = density / guessedDensityOf(ps);
      const base = toAmounts(ps, scale);
      const amounts = withExactRung(base, exact, servingText);

      const idx = exact
        ? 0
        : servingG
          ? amounts.reduce((best, a, i) => (Math.abs(a.grams - servingG) < Math.abs(amounts[best].grams - servingG) ? i : best), 0)
          : 4;

      return {
        amounts,
        defaultIndex: idx,
        countUnit: "tablespoon", countUnitPlural: "tablespoons",
        gramsPerUnit: amounts.find((a) => a.ml === 15)?.grams ?? amounts[1]?.grams ?? amounts[0].grams,
        mlPerUnit: 15,
      };
    }

    case "powder": {
      /* servingG comes straight off the product's own label, so a 33 g scoop
         and a 5 g scoop produce different ladders — which is the whole point,
         since scoops are not a standard measure the way a teaspoon is */
      const ps = powderPortions(servingG);
      const amounts = withExactRung(toAmounts(ps), exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 1,
        countUnit: "scoop", countUnitPlural: "scoops",
        gramsPerUnit: amounts[1]?.grams ?? amounts[0].grams,
      };
    }

    case "spread": {
      const ps = spreadPortions(name);
      const scale = density / guessedDensityOf(ps);
      const amounts = withExactRung(toAmounts(ps, scale), exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 1,
        countUnit: "tablespoon", countUnitPlural: "tablespoons",
        gramsPerUnit: amounts.find((a) => a.ml === 15)?.grams ?? amounts[1]?.grams ?? amounts[0].grams,
        mlPerUnit: 15,
      };
    }

    case "pinch": {
      const ps = pinchPortions(name);
      const scale = density / guessedDensityOf(ps);
      const amounts = withExactRung(toAmounts(ps, scale), exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 1,
        countUnit: "teaspoon", countUnitPlural: "teaspoons",
        gramsPerUnit: amounts.find((a) => a.ml === 5)?.grams ?? amounts[1]?.grams ?? amounts[0].grams,
        mlPerUnit: 5,
      };
    }

    case "protein": {
      const ps = proteinPortions();
      const amounts = withExactRung(toAmounts(ps), exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 1,
        countUnit: "palm-sized piece", countUnitPlural: "palm-sized pieces",
        gramsPerUnit: 100,
      };
    }

    case "scoop": {
      /* oats, rice, cereal, frozen veg. A pack reading "1/2 cup (40 g)" names
         its measure in words, so the exact rung says "Half a cup (½ cup)" —
         but the 40 g is NOT 40 ml and no volume is inferred from it. */
      const ps = scoopPortions();
      const amounts = withExactRung(toAmounts(ps), exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 3,
        countUnit: "handful", countUnitPlural: "handfuls",
        gramsPerUnit: 80,
      };
    }

    case "slice": {
      const per = servingG || 50;
      const base: Amount[] = [
        { label: "1 slice", hint: `one slice as it comes · about ${per} g`, grams: per, unit: "slice", unitPlural: "slices" },
        { label: "2 slices", hint: `about ${per * 2} g`, grams: per * 2 },
        { label: "3 slices", hint: `about ${per * 3} g`, grams: per * 3 },
        { label: "4 slices", hint: `about ${per * 4} g`, grams: per * 4 },
      ];
      const amounts = withExactRung(base, exact, servingText);
      return {
        amounts,
        defaultIndex: 0,
        countUnit: "slice", countUnitPlural: "slices",
        gramsPerUnit: per,
      };
    }

    case "count": {
      /* eggs get their own numbers; everything else countable takes a
         middling whole-item weight */
      const isEgg = /egg/i.test(name);
      const per = isEgg ? 60 : servingG || 120;
      const unit = isEgg ? "egg" : "piece";
      const base: Amount[] = [
        { label: `Half a ${unit}`, hint: `about ${Math.round(per / 2)} g`, grams: Math.round(per / 2) },
        { label: `1 ${unit}`, hint: `one whole one · about ${per} g`, grams: per, unit, unitPlural: `${unit}s` },
        { label: `2 ${unit}s`, hint: `about ${per * 2} g`, grams: per * 2 },
        { label: `3 ${unit}s`, hint: `about ${per * 3} g`, grams: per * 3 },
      ];
      const amounts = withExactRung(base, exact, servingText);
      return {
        amounts,
        defaultIndex: exact ? 0 : 1,
        countUnit: unit, countUnitPlural: `${unit}s`,
        gramsPerUnit: per,
      };
    }

    default: {
      /* a packaged thing with a stated serving — the pack's own number beats
         anything we'd invent */
      if (servingG && servingG > 0) {
        const ps = packPortions(servingG, servingText);
        const amounts = withExactRung(toAmounts(ps), exact, servingText);
        return {
          amounts,
          defaultIndex: 0,
          countUnit: "serving", countUnitPlural: "servings",
          gramsPerUnit: servingG,
        };
      }
      /* nothing to go on at all — the scoop ladder at least has anchors,
         which beats abstract wording even when the food is a mystery */
      const ps = scoopPortions();
      return {
        amounts: toAmounts(ps),
        defaultIndex: 2,
        countUnit: "handful", countUnitPlural: "handfuls",
        gramsPerUnit: 80,
      };
    }
  }
}

/** what density portions.ts already baked in, read back off its own numbers.
    Needed so a corrected density REPLACES the guess rather than compounding
    with it — apply 1.27 on top of an existing 1.4 and you get 1.78, which is
    further from the truth than either. */
function guessedDensityOf(ps: Portion[]): number {
  const withMl = ps.find((p) => p.ml && p.ml > 0);
  if (!withMl || !withMl.ml) return 1;
  return withMl.grams / withMl.ml;
}

/** 1.5 → "1½", 0.5 → "½", 2.25 → "2¼", 3 → "3".

    THE PACK'S OWN NOTATION. A label reads "1 1/2 tbsp"; showing "1.5
    tablespoons" is the same value in a form the reader has to convert. Someone
    who isn't mathematically inclined shouldn't have to recognise that 1.5 and
    one-and-a-half are the same number while standing in their kitchen holding
    a packet — that's work the app can do for them. */
function fractionText(n: number): string {
  const whole = Math.floor(n);
  const rest = n - whole;

  const SYMBOLS: [number, string][] = [
    [0.125, "⅛"],
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
  ];

  for (const [value, symbol] of SYMBOLS) {
    if (Math.abs(rest - value) < 0.02) {
      /* "½" alone when there's no whole part, "1½" when there is — never
         "0½" */
      return whole > 0 ? `${whole}${symbol}` : symbol;
    }
  }

  /* no familiar fraction — round rather than show a long decimal */
  return String(Math.round(n * 10) / 10);
}

/** "125 ml" → "½ cup". "10 ml" → "2 tsp". "45 ml" → "3 tbsp".

    Written as SYMBOLS and abbreviations rather than words, so the reader
    matches what's on the screen to what's printed on the pack without
    translating in their head — "2 tsp" beside "2 tsp" is instant.

    WHICH UNIT depends on the size. Nobody thinks of 10 ml as a fraction of a
    cup, and nobody measures 250 ml in teaspoons — so small volumes get spoons
    and larger ones get cups, which is how the measures are actually used.

    ONLY EVER CALLED WITH MILLILITRES. Passing grams here would be a category
    error: 40 g of oats is about 120 ml, not 40. */
function volumeEquivalent(ml: number): string | null {
  /* SPOONS below 50 ml. A teaspoon is 5, a tablespoon 15 — and a pack saying
     "2 tsp" is exactly the case this exists for. */
  if (ml < 50) {
    const tsp = ml / 5;
    const tbsp = ml / 15;

    /* prefer tablespoons once there's at least one, since "3 tbsp" reads
       better than "9 tsp" */
    if (tbsp >= 1) {
      for (const [value, text] of [[1, "1 tbsp"], [1.5, "1½ tbsp"], [2, "2 tbsp"], [3, "3 tbsp"]] as [number, string][]) {
        if (Math.abs(tbsp - value) < value * 0.08) return text;
      }
    }

    for (const [value, text] of [[0.5, "½ tsp"], [1, "1 tsp"], [1.5, "1½ tsp"], [2, "2 tsp"], [3, "3 tsp"], [4, "4 tsp"]] as [number, string][]) {
      if (Math.abs(tsp - value) < value * 0.08) return text;
    }
    return null;
  }

  /* CUPS above that. Canadian labels use a 250 ml cup, American ones 240;
     splitting the difference at 245 keeps both within a couple of percent,
     well inside the tolerance of anyone eyeballing a measuring jug. */
  const CUP = 245;
  const cups = ml / CUP;

  const NAMED: [number, string][] = [
    [1 / 4, "¼ cup"],
    [1 / 3, "⅓ cup"],
    [1 / 2, "½ cup"],
    [2 / 3, "⅔ cup"],
    [3 / 4, "¾ cup"],
    [1, "1 cup"],
    [1.5, "1½ cups"],
    [2, "2 cups"],
    [3, "3 cups"],
  ];

  for (const [value, text] of NAMED) {
    if (Math.abs(cups - value) < value * 0.06) return text;
  }

  /* nothing close to a familiar measure. "Roughly 0.43 cups" would be worse
     than saying nothing — these units exist precisely because people think in
     halves and quarters. */
  return null;
}

/** "1 1/2 tbsp (23 g)" → "1½ tablespoons (1½ tbsp)".
    "1/2 cup (40 g)"    → "Half a cup (½ cup)".
    "1 scoop (33g)"     → "One scoop".

    THE PACK'S OWN WORDS, in the app's wording, with the pack's own notation.
    Fractions stay fractions — a reader holding a packet that says "1 1/2"
    should see "1½", not "1.5", because recognising those as the same number
    is work the app can do for them. */
function servingLabelFrom(raw: string): string | null {
  const r = raw.toLowerCase();

  if (/tbsp|tablespoon/.test(r)) {
    const n = countIn(r);
    if (Math.abs(n - 1) < 0.01) return "A tablespoon (tbsp)";
    if (Math.abs(n - 0.5) < 0.01) return "Half a tablespoon (½ tbsp)";
    return `${fractionText(n)} tablespoons (${fractionText(n)} tbsp)`;
  }

  if (/tsp|teaspoon/.test(r)) {
    const n = countIn(r);
    if (Math.abs(n - 1) < 0.01) return "A teaspoon (tsp)";
    if (Math.abs(n - 0.5) < 0.01) return "Half a teaspoon (½ tsp)";
    return `${fractionText(n)} teaspoons (${fractionText(n)} tsp)`;
  }

  if (/cup/.test(r)) {
    const n = countIn(r);
    if (Math.abs(n - 0.25) < 0.01) return "A quarter cup (¼ cup)";
    if (Math.abs(n - 1 / 3) < 0.02) return "A third of a cup (⅓ cup)";
    if (Math.abs(n - 0.5) < 0.01) return "Half a cup (½ cup)";
    if (Math.abs(n - 2 / 3) < 0.02) return "Two thirds of a cup (⅔ cup)";
    if (Math.abs(n - 0.75) < 0.01) return "Three quarters of a cup (¾ cup)";
    if (Math.abs(n - 1) < 0.01) return "A cup (1 cup)";
    return `${fractionText(n)} cups (${fractionText(n)} cup)`;
  }

  if (/scoop/.test(r)) {
    const n = countIn(r);
    if (Math.abs(n - 1) < 0.01) return "One scoop";
    if (Math.abs(n - 0.5) < 0.01) return "Half a scoop";
    return `${fractionText(n)} scoops`;
  }

  if (/slice/.test(r)) {
    const n = countIn(r);
    return Math.abs(n - 1) < 0.01 ? "1 slice" : `${fractionText(n)} slices`;
  }
  if (/bar\b/.test(r)) {
    const n = countIn(r);
    return Math.abs(n - 1) < 0.01 ? "One bar" : `${fractionText(n)} bars`;
  }
  if (/piece/.test(r)) {
    const n = countIn(r);
    return Math.abs(n - 1) < 0.01 ? "One piece" : `${fractionText(n)} pieces`;
  }
  if (/bottle/.test(r)) return "One bottle";
  if (/\bcan\b/.test(r)) return "One can";
  if (/pouch|packet|sachet/.test(r)) return "One packet";
  if (/\bpot\b|tub/.test(r)) return "One pot";

  return null;
}

/** does our rung name the same measure the pack does?
    "Half a cup (½ cup)" against "1/2 cup (40 g)" — both cups, both a half,
    so ours has to go or the user sees two half-cups with different numbers. */
function sharesMeasureWord(label: string, servingText: string): boolean {
  const l = label.toLowerCase();
  const s = servingText.toLowerCase();

  const unit =
    /cup/.test(s) ? "cup" :
    /tbsp|tablespoon/.test(s) ? "tablespoon" :
    /tsp|teaspoon/.test(s) ? "teaspoon" :
    /scoop/.test(s) ? "scoop" :
    /slice/.test(s) ? "slice" : null;

  if (!unit || !l.includes(unit)) return false;
  return Math.abs(countIn(l) - countIn(s)) < 0.02;
}

/** the number in front of a measure.

    MIXED NUMBERS FIRST. "1 1/2 tbsp" is one and a half tablespoons — checking
    for a plain fraction before the mixed form would match the "1/2", return
    0.5, and silently drop the leading whole. That's a third of the real
    amount, which would be a quiet and serious error. */
function countIn(text: string): number {
  const FRACTIONS: Record<string, number> = {
    "¼": 0.25, "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¾": 0.75, "⅛": 0.125,
  };

  /* "1 1/2" — a whole followed by a written fraction */
  const mixed = text.match(/^\s*(\d+)\s+([\d.]+)\s*\/\s*([\d.]+)/);
  if (mixed) return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3]);

  /* "1½" — a whole followed by a fraction symbol */
  const mixedSymbol = text.match(/^\s*(\d+)\s*([¼½⅓⅔¾⅛])/);
  if (mixedSymbol) return parseFloat(mixedSymbol[1]) + (FRACTIONS[mixedSymbol[2]] ?? 0);

  const frac = text.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);

  const symbol = text.match(/[¼½⅓⅔¾⅛]/);
  if (symbol) return FRACTIONS[symbol[0]] ?? 1;

  if (/\bquarter\b/.test(text)) return 0.25;
  if (/\bthird\b/.test(text)) return 1 / 3;
  if (/\bhalf\b/.test(text)) return 0.5;

  const whole = text.match(/^\s*([\d.]+)/);
  return whole ? parseFloat(whole[1]) : 1;
}

/* ---------- USDA ---------- */

function usdaNutrient(food: any, id: number): number {
  const list = food.foodNutrients || [];
  const hit = list.find((n: any) => (n.nutrientId ?? n.nutrient?.id) === id);
  return Number(hit?.value ?? hit?.amount ?? 0) || 0;
}

/** Search generic foods. Returns FoodDef objects, so the picker doesn't know
    or care that these came off the network.

    THROWS on a network failure rather than swallowing it — searchFoodsChecked
    needs to tell "found nothing" apart from "never reached anyone". */
export async function searchUSDA(query: string, limit = 20): Promise<FoodDef[]> {
  if (!USDA_KEY) return [];

  const url =
    `${USDA_BASE}/foods/search?api_key=${USDA_KEY}` +
    `&query=${encodeURIComponent(query)}` +
    /* SR Legacy, Foundation and Survey are the curated, un-branded datasets.
       SURVEY (FNDDS) carries most everyday prepared foods — without it, plain
       searches like "broccoli" come back empty even though the food obviously
       exists. */
    `&dataType=${encodeURIComponent("SR Legacy,Foundation,Survey (FNDDS)")}` +
    `&pageSize=${limit}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json();

  return (json.foods || []).map((f: any): FoodDef => {
    const name = cleanUSDAName(f.description || "Food");
    const cat = (f.foodCategory || "").toString();
    const ladder = ladderFor(name, cat);
    return {
      name,
      sub: cat.toLowerCase() || "generic",
      key: colorKeyFor(name),
      per100: Math.round(usdaNutrient(f, N_CALORIES)),
      p: round1(usdaNutrient(f, N_PROTEIN)),
      c: round1(usdaNutrient(f, N_CARBS)),
      f: round1(usdaNutrient(f, N_FAT)),
      ...ladder,
    };
  })
  .filter((f: FoodDef) => f.per100 > 0);
}

/* USDA names are SHOUTED and comma-heavy: "CHICKEN, BROILERS OR FRYERS,
   BREAST, MEAT ONLY, COOKED, ROASTED". Unreadable in a list. */
function cleanUSDAName(raw: string): string {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const kept = parts.slice(0, 2).join(", ");
  return kept.charAt(0).toUpperCase() + kept.slice(1).toLowerCase();
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- Open Food Facts ---------- */

/** THE LABEL BEATS OUR ARITHMETIC.

    We hold calories per 100 GRAMS, but a liquid ladder works in ML — so
    turning "a tablespoon" into calories needs a density, and portions.ts
    guesses one from the product's name. Those guesses are fine for most things
    and badly wrong for some: "honey sriracha sauce" matches the honey rule
    (1.4) when it's really about 1.27.

    A serving stated as "1 tbsp (19 g)" gives both a volume and a weight —
    19 g in 15 ml is 1.27 g/ml, measured rather than guessed. */
function trueDensity(servingText: string, servingG?: number): number {
  if (!servingG) return 1;

  const ml = parseServingMl(servingText);
  if (!ml) return 1;

  const d = servingG / ml;

  /* sanity: real foods run roughly 0.5 (puffed cereal) to 1.6 (syrup). Outside
     that, one of the label's numbers is wrong and the guess is safer. */
  return d > 0.4 && d < 2 ? d : 1;
}

function offToFood(p: any): FoodDef | null {
  if (!looksLikeFood(p)) return null;

  const n = p.nutriments || {};
  const per100 = Math.round(Number(n["energy-kcal_100g"]) || 0);

  const name = [p.product_name, p.brands?.split(",")[0]?.trim()]
    .filter(Boolean)
    .join(" · ") || "Product";

  const servingText = p.serving_size || "";
  const servingG = parseServing(servingText);
  const density = trueDensity(servingText, servingG);
  const ladder = ladderFor(name, p.categories || "", servingG, servingText, density);

  return {
    name,
    sub: p.brands?.split(",")[0]?.trim() || "packaged",
    key: colorKeyFor(name + " " + (p.categories || "")),
    per100,
    p: round1(Number(n.proteins_100g) || 0),
    c: round1(Number(n.carbohydrates_100g) || 0),
    f: round1(Number(n.fat_100g) || 0),
    ...ladder,
  };
}

/** the millilitres a stated serving amounts to.

    Reads volume TWO ways, because labels write it both:
      "1 serving (125 ml)"  → 125, straight off the digits
      "1 1/2 tbsp (23 g)"   → 22.5, because a tablespoon IS 15 ml

    CALLERS MUST ONLY USE THIS FOR POURABLE FOODS. "1/2 cup (40 g)" of oats
    would return 120 here from the cup conversion, which is roughly true as a
    volume but useless — the 40 g is what matters. */
function parseServingMl(raw?: string): number | undefined {
  if (!raw) return undefined;

  /* an explicit ml figure wins — that's a measurement, not a conversion */
  const explicit = raw.match(/([\d.]+)\s*ml/i);
  if (explicit) {
    const v = parseFloat(explicit[1]);
    if (isFinite(v) && v > 0 && v < 3000) return v;
  }

  /* otherwise, a spoon or cup measure written in words */
  const UNITS: [RegExp, number][] = [
    [/tbsp|tablespoons?/i, 15],
    [/tsp|teaspoons?/i, 5],
    [/cups?/i, 240],
    [/fl\.?\s*oz/i, 30],
  ];

  for (const [re, ml] of UNITS) {
    if (!re.test(raw)) continue;
    const v = countIn(raw.toLowerCase()) * ml;
    if (isFinite(v) && v > 0 && v < 3000) return v;
  }

  return undefined;
}

/** "170 g", "1 scoop (33g)", "1/2 cup (40 g)", "1 1/2 tbsp (23 g)" → 170 / 33 / 40 / 23

    THIS IS WHAT KEEPS TWO PROTEIN TUBS APART. One says "1 scoop (33g)", another
    says "1 scoop (5g)"; reading the number off each label is the difference
    between a ladder that fits the product and one that's quietly wrong. */
function parseServing(raw?: string): number | undefined {
  if (!raw) return undefined;
  /* prefer a bracketed weight — "1 tbsp (19 g)" — since that's the real
     measurement, and the words before it name the manufacturer's own spoon */
  const bracket = raw.match(/\(\s*([\d.]+)\s*(g|ml)/i);
  const plain = raw.match(/([\d.]+)\s*(g|ml)/i);
  const m = bracket || plain;
  const v = m ? parseFloat(m[1]) : NaN;
  return isFinite(v) && v > 0 && v < 2000 ? v : undefined;
}

/** Look up a packaged product by its barcode.
    Returns null for anything that isn't food — see looksLikeFood. */
export async function lookupBarcode(code: string): Promise<FoodDef | null> {
  try {
    const res = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    return offToFood(json.product);
  } catch {
    return null;
  }
}

/** Search packaged products by name.
    Throws on a network failure, same reasoning as searchUSDA. */
export async function searchOFF(query: string, limit = 12): Promise<FoodDef[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=${limit}` +
    `&fields=product_name,brands,categories,nutriments,serving_size,serving_quantity`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.products || []).map(offToFood).filter(Boolean) as FoodDef[];
}

/** BOTH sources, generic first.
    Order matters: someone typing "banana" wants the fruit, not a branded
    banana-flavoured protein bar. Packaged results still appear, just below. */
export async function searchFoods(query: string): Promise<FoodDef[]> {
  const { foods } = await searchFoodsChecked(query);
  return foods;
}

/** Search, and report whether the network actually worked.

    "Nothing came back" and "the request never arrived" look identical from the
    outside — an empty list either way — but they need OPPOSITE advice. One
    says try a fuller name or add the brand; the other says check your wifi. */
export async function searchFoodsChecked(query: string): Promise<{ foods: FoodDef[]; online: boolean }> {
  const q = query.trim();
  if (q.length < 2) return { foods: [], online: true };

  let online = false;

  const usda = searchUSDA(q, 15)
    .then((r) => { online = true; return r; })
    .catch(() => [] as FoodDef[]);

  const off = searchOFF(q, 10)
    .then((r) => { online = true; return r; })
    .catch(() => [] as FoodDef[]);

  const [generic, packaged] = await Promise.all([usda, off]);

  const seen = new Set<string>();
  const out: FoodDef[] = [];
  [...generic, ...packaged].forEach((f) => {
    const k = f.name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  });

  return { foods: out, online };
}