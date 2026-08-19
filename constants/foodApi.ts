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
  [/salad|lettuce|spinach|kale|greens|broccoli|cauliflower/i, "greens"],
  [/pasta|spaghetti|noodle|macaroni|penne|ramen/i, "pasta"],
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

   ml AND grams side by side. Labels use one or the other with no consistency —
   an egg-white carton says "⅓ cup, 100g" — so showing both means the user can
   match whichever their pack happens to state.

   `scale` corrects the grams when the pack tells us the real density. See
   trueDensity below: our guesses are good enough for most things and wrong
   enough for some that the label has to win when it speaks. */
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
    arbitrary and the calorie count downstream was fiction.

    NOTE how often `servingG` is threaded through: the pack's own stated
    serving is the one measurement in the whole exchange that somebody
    actually took, so it anchors the ladder wherever it exists. */
function ladderFor(
  name: string,
  categories = "",
  servingG?: number,
  servingText?: string,
  /* grams per ml, when the label lets us work it out exactly */
  density = 1
): Ladder {
  const kind = kindFor(name, categories, servingText || "");

  switch (kind) {
    case "liquid": {
      const ps = liquidPortions(name);
      /* portions.ts already applied ITS density guess, so undo that and apply
         the real one — otherwise the two compound and the grams drift twice */
      const scale = density / guessedDensityOf(ps);

      const idx = servingG
        ? ps.reduce((best, p, i) => {
            const gi = p.grams * scale;
            const gb = ps[best].grams * scale;
            return Math.abs(gi - servingG) < Math.abs(gb - servingG) ? i : best;
          }, 0)
        : 4;

      const amounts = toAmounts(ps, scale);
      return {
        amounts,
        defaultIndex: idx,
        countUnit: "tablespoon", countUnitPlural: "tablespoons",
        gramsPerUnit: amounts[1].grams,
        mlPerUnit: ps[1].ml,
      };
    }

    case "powder": {
      /* servingG comes straight off the product's own label, so a 33 g scoop
         and a 5 g scoop produce different ladders — which is the whole point,
         since scoops are not a standard measure the way a teaspoon is */
      const ps = powderPortions(servingG);
      const amounts = toAmounts(ps);
      return {
        amounts,
        defaultIndex: 1,
        countUnit: "scoop", countUnitPlural: "scoops",
        gramsPerUnit: amounts[1].grams,
      };
    }

    case "spread": {
      const ps = spreadPortions(name);
      const scale = density / guessedDensityOf(ps);
      const amounts = toAmounts(ps, scale);
      return {
        amounts,
        defaultIndex: 1,
        countUnit: "tablespoon", countUnitPlural: "tablespoons",
        gramsPerUnit: amounts[1].grams,
        mlPerUnit: ps[1].ml,
      };
    }

    case "pinch": {
      const ps = pinchPortions(name);
      const scale = density / guessedDensityOf(ps);
      const amounts = toAmounts(ps, scale);
      return {
        amounts,
        defaultIndex: 1,
        countUnit: "teaspoon", countUnitPlural: "teaspoons",
        gramsPerUnit: amounts[1].grams,
        mlPerUnit: ps[1].ml,
      };
    }

    case "protein": {
      const ps = proteinPortions();
      return {
        amounts: toAmounts(ps),
        defaultIndex: 1,
        countUnit: "palm-sized piece", countUnitPlural: "palm-sized pieces",
        gramsPerUnit: 100,
      };
    }

    case "scoop": {
      const ps = scoopPortions();
      return {
        amounts: toAmounts(ps),
        defaultIndex: 3,
        countUnit: "handful", countUnitPlural: "handfuls",
        gramsPerUnit: 80,
      };
    }

    case "slice": {
      const per = servingG || 50;
      return {
        amounts: [
          { label: "1 slice", hint: `one slice as it comes · about ${per} g`, grams: per, unit: "slice", unitPlural: "slices" },
          { label: "2 slices", hint: `about ${per * 2} g`, grams: per * 2 },
          { label: "3 slices", hint: `about ${per * 3} g`, grams: per * 3 },
          { label: "4 slices", hint: `about ${per * 4} g`, grams: per * 4 },
        ],
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
      return {
        amounts: [
          { label: `Half a ${unit}`, hint: `about ${Math.round(per / 2)} g`, grams: Math.round(per / 2) },
          { label: `1 ${unit}`, hint: `one whole one · about ${per} g`, grams: per, unit, unitPlural: `${unit}s` },
          { label: `2 ${unit}s`, hint: `about ${per * 2} g`, grams: per * 2 },
          { label: `3 ${unit}s`, hint: `about ${per * 3} g`, grams: per * 3 },
        ],
        defaultIndex: 1,
        countUnit: unit, countUnitPlural: `${unit}s`,
        gramsPerUnit: per,
      };
    }

    default: {
      /* a packaged thing with a stated serving — the pack's own number beats
         anything we'd invent */
      if (servingG && servingG > 0) {
        const ps = packPortions(servingG, servingText);
        return {
          amounts: toAmounts(ps),
          defaultIndex: 1,
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
    with it — apply 1.1 on top of an existing 1.4 and you get 1.54, which is
    further from the truth than either. */
function guessedDensityOf(ps: Portion[]): number {
  const withMl = ps.find((p) => p.ml && p.ml > 0);
  if (!withMl || !withMl.ml) return 1;
  return withMl.grams / withMl.ml;
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
    needs to tell "found nothing" apart from "never reached anyone", and a
    silent empty array makes those two indistinguishable. */
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

    A bottle says "per ¼ cup (60 ml) — 160 calories". We hold calories per
    100 GRAMS, so turning 60 ml into grams needs a density, and portions.ts
    guesses one from the product's name. Those guesses are fine for most things
    and badly wrong for some: "honey sriracha sauce" matches the honey rule
    (1.4) when it's really a sauce (1.1), and the error lands straight in the
    calorie count — 177 shown against 160 printed.

    But the pack often gives BOTH the serving in ml and the calories in that
    serving, which is enough to work the density out exactly rather than guess.
    Where it does, that wins.

    Returns 1 when the label doesn't say enough, leaving the guess in place —
    a wrong correction would be worse than an honest approximation. */
function trueDensity(p: any, servingText: string, per100: number): number {
  if (!per100) return 1;

  const kcalServing = Number(p?.nutriments?.["energy-kcal_serving"]) || 0;
  if (!kcalServing) return 1;

  /* the serving in MILLILITRES specifically — a serving already in grams
     needs no conversion, so there's nothing to correct */
  const ml = parseServingMl(servingText);
  if (!ml) return 1;

  /* if the label's serving is X ml and contains Y calories, and 100 g contains
     Z calories, then that serving weighs 100·Y/Z grams — and dividing by X
     gives grams per ml */
  const servingGrams = (kcalServing / per100) * 100;
  const d = servingGrams / ml;

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
  const density = trueDensity(p, servingText, per100);
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

/** the millilitres in a stated serving, if it gives any.
    "1/4 cup (60ml)" → 60. "170 g" → undefined, because that's already a
    weight and needs no density to interpret. */
function parseServingMl(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/([\d.]+)\s*ml/i);
  const v = m ? parseFloat(m[1]) : NaN;
  return isFinite(v) && v > 0 && v < 3000 ? v : undefined;
}

/** "170 g", "1 scoop (33g)", "1/4 cup (60ml)", "2 tsp (10ml)" → 170 / 33 / 60 / 10

    THIS IS WHAT KEEPS TWO PROTEIN TUBS APART. One says "1 scoop (33g)", another
    says "1 scoop (5g)"; reading the number off each label is the difference
    between a ladder that fits the product and one that's quietly wrong. */
function parseServing(raw?: string): number | undefined {
  if (!raw) return undefined;
  /* prefer a bracketed weight — "1 scoop (33 g)" — since that's the real
     measurement, and the words before it are the manufacturer's own name for
     their scoop */
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
    /* energy-kcal_serving is what lets trueDensity correct our guesses, so it
       has to be in the field list — without it every liquid falls back to an
       approximation */
    `&fields=product_name,brands,categories,nutriments,serving_size`;

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
    says try a fuller name or add the brand; the other says check your wifi.
    Telling someone with full signal to check their connection is the kind of
    wrong advice that makes people distrust everything else the app says. */
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