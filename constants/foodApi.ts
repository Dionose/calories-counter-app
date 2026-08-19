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
import { Amount, FoodDef, GENERIC_AMOUNTS } from "./foods";

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
  [/almond|nut|cashew|peanut|walnut|pistachio/i, "nuts"],
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

/* ---------- amount ladders ----------
   The whole design of this app is that amounts are WORDS, not multipliers. An
   API gives grams, so the ladder has to be built here.

   Where the product states a serving size we use it — a yogurt pot's own
   "170g" is more truthful than any guess. Otherwise the food's KIND decides:
   a drink comes in glasses, bread in slices, rice in servings. Getting this
   roughly right matters more than getting it precisely right, because the
   user picks from the list and can always correct it. */
type Ladder = { amounts: Amount[]; defaultIndex: number; countUnit?: string; countUnitPlural?: string; gramsPerUnit?: number };

function ladderFor(name: string, servingG?: number): Ladder {
  const n = name.toLowerCase();

  if (/coffee|tea|juice|milk|soda|water|smoothie|drink/.test(n)) {
    return {
      amounts: [
        { label: "A small glass", grams: 150 },
        { label: "A normal glass", grams: 250 },
        { label: "A big glass", grams: 400 },
      ],
      defaultIndex: 1,
      countUnit: "glass", countUnitPlural: "glasses", gramsPerUnit: 250,
    };
  }

  if (/bread|toast|bagel/.test(n)) {
    const per = servingG || 50;
    return {
      amounts: [
        { label: "1 slice", grams: per },
        { label: "2 slices", grams: per * 2 },
        { label: "3 slices", grams: per * 3 },
      ],
      defaultIndex: 0,
      countUnit: "slice", countUnitPlural: "slices", gramsPerUnit: per,
    };
  }

  if (/egg/.test(n)) {
    return {
      amounts: [
        { label: "1 egg", grams: 60 },
        { label: "2 eggs", grams: 120 },
        { label: "3 eggs", grams: 180 },
      ],
      defaultIndex: 1,
      countUnit: "egg", countUnitPlural: "eggs", gramsPerUnit: 60,
    };
  }

  if (/oil|butter|dressing|mayonnaise|sauce/.test(n)) {
    return {
      amounts: [
        { label: "A drizzle", hint: "about a teaspoon", grams: 5 },
        { label: "A spoonful", hint: "a tablespoon", grams: 14 },
        { label: "Two spoonfuls", grams: 28 },
      ],
      defaultIndex: 1,
      countUnit: "spoonful", countUnitPlural: "spoonfuls", gramsPerUnit: 14,
    };
  }

  /* A PACKAGED product with a stated serving. The pack's own number is the
     honest one — someone eating "one pot" means the pot the manufacturer
     defined, not a round number we invented. */
  if (servingG && servingG > 0) {
    return {
      amounts: [
        { label: "Half a serving", grams: Math.round(servingG / 2) },
        { label: "1 serving", hint: `as stated on the pack — ${Math.round(servingG)}g`, grams: servingG },
        { label: "2 servings", grams: servingG * 2 },
        { label: "3 servings", grams: servingG * 3 },
      ],
      defaultIndex: 1,
      countUnit: "serving", countUnitPlural: "servings", gramsPerUnit: servingG,
    };
  }

  return { amounts: GENERIC_AMOUNTS, defaultIndex: 1 };
}

/* ---------- USDA ---------- */

function usdaNutrient(food: any, id: number): number {
  const list = food.foodNutrients || [];
  const hit = list.find((n: any) => (n.nutrientId ?? n.nutrient?.id) === id);
  return Number(hit?.value ?? hit?.amount ?? 0) || 0;
}

/** Search generic foods. Returns FoodDef objects, so the picker doesn't know
    or care that these came off the network. */
export async function searchUSDA(query: string, limit = 20): Promise<FoodDef[]> {
  if (!USDA_KEY) return [];

  try {
    const url =
      `${USDA_BASE}/foods/search?api_key=${USDA_KEY}` +
      `&query=${encodeURIComponent(query)}` +
      /* SR Legacy, Foundation and Survey are the curated, un-branded datasets.
         SURVEY (FNDDS) is the one that carries most everyday prepared foods —
         without it, plain searches like "broccoli" can come back empty even
         though the food obviously exists.
         Branded stays excluded: Open Food Facts handles packaged goods better,
         and USDA's branded rows are full of near-duplicates that bury the
         plain answer someone was actually looking for. */
      `&dataType=${encodeURIComponent("SR Legacy,Foundation,Survey (FNDDS)")}` +
      `&pageSize=${limit}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const json = await res.json();

    /* TEMPORARY — tells apart "the API returned nothing" from "we filtered
       everything out", which look identical in the UI and need opposite
       fixes. Remove once searches are behaving. */
    console.log("USDA:", query, "→", (json.foods || []).length, "raw results");

    return (json.foods || []).map((f: any): FoodDef => {
      const name = cleanUSDAName(f.description || "Food");
      const ladder = ladderFor(name);
      return {
        name,
        /* the food's category, for the second line in the list — it's what
           tells "chicken breast, raw" apart from "chicken breast, roasted" */
        sub: (f.foodCategory || "").toString().toLowerCase() || "generic",
        key: colorKeyFor(name),
        per100: Math.round(usdaNutrient(f, N_CALORIES)),
        p: round1(usdaNutrient(f, N_PROTEIN)),
        c: round1(usdaNutrient(f, N_CARBS)),
        f: round1(usdaNutrient(f, N_FAT)),
        ...ladder,
      };
    })
    /* a row with no calories is useless — usually a nutrient-analysis entry
       rather than a food anyone eats */
    .filter((f: FoodDef) => f.per100 > 0);
  } catch {
    return [];
  }
}

/* USDA names are SHOUTED and comma-heavy: "CHICKEN, BROILERS OR FRYERS,
   BREAST, MEAT ONLY, COOKED, ROASTED". Unreadable in a list. This trims to
   the first couple of clauses and puts it in sentence case. */
function cleanUSDAName(raw: string): string {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const kept = parts.slice(0, 2).join(", ");
  return kept.charAt(0).toUpperCase() + kept.slice(1).toLowerCase();
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- Open Food Facts ---------- */

function offToFood(p: any): FoodDef | null {
  const n = p.nutriments || {};
  const per100 = Number(n["energy-kcal_100g"]) || 0;
  if (!per100) return null;

  const name = [p.product_name, p.brands?.split(",")[0]?.trim()]
    .filter(Boolean)
    .join(" · ") || "Product";

  /* the pack's own serving size, when it states one in grams */
  const servingG = parseServing(p.serving_size);
  const ladder = ladderFor(name, servingG);

  return {
    name,
    sub: p.brands?.split(",")[0]?.trim() || "packaged",
    key: colorKeyFor(name + " " + (p.categories || "")),
    per100: Math.round(per100),
    p: round1(Number(n.proteins_100g) || 0),
    c: round1(Number(n.carbohydrates_100g) || 0),
    f: round1(Number(n.fat_100g) || 0),
    ...ladder,
  };
}

/** "170 g", "1 pot (150g)", "2 slices (60 g)" → 170 / 150 / 60 */
function parseServing(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/([\d.]+)\s*g/i);
  const v = m ? parseFloat(m[1]) : NaN;
  return isFinite(v) && v > 0 && v < 2000 ? v : undefined;
}

/** Look up a packaged product by its barcode. The exact path for the scanner,
    once there's a development build to run it in. */
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

/** Search packaged products by name. */
export async function searchOFF(query: string, limit = 12): Promise<FoodDef[]> {
  try {
    const url =
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=${limit}` +
      /* asking for only the fields we use — the full product record is
         enormous and most of it is irrelevant on a phone connection */
      `&fields=product_name,brands,categories,nutriments,serving_size`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.products || []).map(offToFood).filter(Boolean) as FoodDef[];
  } catch {
    return [];
  }
}

/** BOTH sources, generic first.
    Order matters: someone typing "banana" wants the fruit, not a branded
    banana-flavoured protein bar. Packaged results still appear, just below. */
export async function searchFoods(query: string): Promise<FoodDef[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  /* in parallel — running them in sequence would double the wait for no
     benefit, since neither depends on the other */
  const [generic, packaged] = await Promise.all([
    searchUSDA(q, 15),
    searchOFF(q, 10),
  ]);

  /* the same food can appear in both. Dedupe on name so the list doesn't
     show "Banana" twice from two sources. */
  const seen = new Set<string>();
  const out: FoodDef[] = [];
  [...generic, ...packaged].forEach((f) => {
    const k = f.name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  });

  return out;
}