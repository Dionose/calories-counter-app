// constants/foods.ts
// The food database, and — more importantly — the AMOUNTS each food comes in,
// written the way a person would say them.
//
// THIS IS A STAND-IN. The shape mirrors what a real nutrition API returns, so
// when the backend lands, findFood() becomes a fetch and nothing in the UI
// changes. Plan: Open Food Facts (packaged goods, barcodes, product photos —
// free) + USDA FoodData Central (generic foods — free). Both carry serving
// sizes, so the `amounts` ladders below come from the product record rather
// than being hand-written.
//
// "×1.5" is a multiplier of something invisible: the AI's guess, which the user
// never saw in a unit they recognise. So every food carries a list of AMOUNTS
// in plain words — "half an avocado", "a small cup", "a big bowl" — each with
// the grams behind it.
//
// A food can mix COUNTABLE and LOOSE amounts in one ladder. Yogurt is the
// clearest case: the little cups are countable (people eat two), but scooping
// from a big tub isn't. Both belong in the same list.
//
// WORDING: North American English, since that's the launch market — "cup" and
// "tub" for yogurt, not the British "pot".
//
// TODO (assets): words alone can't fully settle "what is a normal serving?" —
// one person's normal is another's small. A reference photo beside each option
// is the thing that removes the ambiguity, and it matters most exactly where
// the amounts get vague. Only needed for the dozen or so loose foods; packaged
// products bring their own photos from the API.

export type Amount = {
  /** what the user reads — this is the whole point */
  label: string;
  /** an optional clarifier, for anything that could be misread */
  hint?: string;
  grams: number;
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
  /** which one the AI assumes when it can't tell — an index into amounts */
  defaultIndex: number;
  /* For foods that come in countable units, these let the user set an exact
     number when the listed amounts don't cover it — ten eggs, four cups. */
  countUnit?: string;        // "cup"
  countUnitPlural?: string;  // "cups"
  gramsPerUnit?: number;     // what one weighs
};

export const FOOD_DB: FoodDef[] = [
  {
    name: "Scrambled eggs", sub: "with butter", key: "eggs", per100: 149, p: 10, c: 1.6, f: 11,
    defaultIndex: 1,
    countUnit: "egg", countUnitPlural: "eggs", gramsPerUnit: 60,
    amounts: [
      { label: "1 egg", grams: 60 },
      { label: "2 eggs", grams: 120 },
      { label: "3 eggs", grams: 180 },
      { label: "4 eggs", grams: 240 },
      { label: "5 eggs", grams: 300 },
    ],
  },
  {
    /* The three sizes on North American shelves: the little 4-pack cups
       (~100g), the single-serve cup (~150–170g), and the big tub you scoop
       from (650g–1.5kg). "Cup" and "tub" are what people actually say here. */
    name: "Greek yogurt", sub: "plain, non-fat", key: "yogurt", per100: 59, p: 10, c: 3.6, f: 0.4,
    defaultIndex: 1,
    countUnit: "small cup", countUnitPlural: "small cups", gramsPerUnit: 100,
    amounts: [
      { label: "1 small cup", hint: "the little 4-pack size", grams: 100 },
      { label: "1 single-serve cup", hint: "the taller one, on its own", grams: 170 },
      { label: "2 small cups", grams: 200 },
      { label: "A few spoons from a tub", grams: 80 },
      { label: "A bowl from a tub", hint: "a generous scoop", grams: 250 },
      { label: "A big bowl from a tub", grams: 400 },
    ],
  },
  {
    name: "Avocado", sub: "raw", key: "avocado", per100: 160, p: 2, c: 9, f: 15,
    defaultIndex: 1,
    countUnit: "avocado", countUnitPlural: "avocados", gramsPerUnit: 150,
    amounts: [
      { label: "A few slices", hint: "3 or 4 slices", grams: 45 },
      { label: "Half an avocado", grams: 75 },
      { label: "A whole avocado", grams: 150 },
      { label: "Two avocados", grams: 300 },
    ],
  },
  {
    name: "Cherry tomatoes", sub: "raw", key: "tomato", per100: 18, p: 0.9, c: 3.9, f: 0.2,
    defaultIndex: 1,
    countUnit: "tomato", countUnitPlural: "tomatoes", gramsPerUnit: 17,
    amounts: [
      { label: "A few", hint: "3 or 4", grams: 60 },
      { label: "A small handful", hint: "about 6", grams: 100 },
      { label: "A big handful", hint: "about 12", grams: 200 },
    ],
  },
  {
    name: "White rice", sub: "cooked", key: "rice", per100: 130, p: 2.7, c: 28, f: 0.3,
    defaultIndex: 1,
    amounts: [
      { label: "A small serving", hint: "a few spoons", grams: 100 },
      { label: "A normal serving", hint: "what most plates get", grams: 180 },
      { label: "A big serving", hint: "a generous plate", grams: 280 },
      { label: "A very big serving", grams: 400 },
    ],
  },
  {
    name: "Basmati rice", sub: "cooked", key: "rice", per100: 121, p: 2.7, c: 25, f: 0.4,
    defaultIndex: 1,
    amounts: [
      { label: "A small serving", hint: "a few spoons", grams: 100 },
      { label: "A normal serving", hint: "what most plates get", grams: 180 },
      { label: "A big serving", hint: "a generous plate", grams: 280 },
      { label: "A very big serving", grams: 400 },
    ],
  },
  {
    name: "Brown rice", sub: "cooked", key: "rice", per100: 112, p: 2.6, c: 24, f: 0.9,
    defaultIndex: 1,
    amounts: [
      { label: "A small serving", hint: "a few spoons", grams: 100 },
      { label: "A normal serving", grams: 180 },
      { label: "A big serving", grams: 280 },
      { label: "A very big serving", grams: 400 },
    ],
  },
  {
    name: "Chicken breast", sub: "grilled, skinless", key: "chicken", per100: 165, p: 31, c: 0, f: 3.6,
    defaultIndex: 1,
    countUnit: "breast", countUnitPlural: "breasts", gramsPerUnit: 174,
    amounts: [
      { label: "Half a breast", grams: 87 },
      { label: "One breast", hint: "palm-sized", grams: 174 },
      { label: "Two breasts", grams: 348 },
    ],
  },
  {
    name: "Salmon fillet", sub: "baked", key: "fish", per100: 208, p: 20, c: 0, f: 13,
    defaultIndex: 1,
    countUnit: "fillet", countUnitPlural: "fillets", gramsPerUnit: 150,
    amounts: [
      { label: "A small fillet", grams: 100 },
      { label: "A normal fillet", hint: "palm-sized", grams: 150 },
      { label: "A big fillet", grams: 220 },
    ],
  },
  {
    name: "Sourdough bread", sub: "sliced", key: "bread", per100: 264, p: 11, c: 49, f: 1.6,
    defaultIndex: 0,
    countUnit: "slice", countUnitPlural: "slices", gramsPerUnit: 50,
    amounts: [
      { label: "1 slice", grams: 50 },
      { label: "2 slices", grams: 100 },
      { label: "3 slices", grams: 150 },
      { label: "4 slices", grams: 200 },
    ],
  },
  {
    name: "Banana", sub: "raw", key: "banana", per100: 89, p: 1.1, c: 23, f: 0.3,
    defaultIndex: 1,
    countUnit: "banana", countUnitPlural: "bananas", gramsPerUnit: 118,
    amounts: [
      { label: "Half a banana", grams: 59 },
      { label: "One banana", grams: 118 },
      { label: "Two bananas", grams: 236 },
    ],
  },
  {
    name: "Almonds", sub: "raw", key: "nuts", per100: 579, p: 21, c: 22, f: 50,
    defaultIndex: 1,
    amounts: [
      { label: "A few", hint: "5 or 6 nuts", grams: 8 },
      { label: "A small handful", grams: 30 },
      { label: "A big handful", grams: 60 },
    ],
  },
  {
    name: "Olive oil", sub: "for cooking", key: "oil", per100: 884, p: 0, c: 0, f: 100,
    defaultIndex: 1,
    countUnit: "spoonful", countUnitPlural: "spoonfuls", gramsPerUnit: 14,
    amounts: [
      { label: "A drizzle", hint: "about a teaspoon", grams: 5 },
      { label: "A spoonful", hint: "a tablespoon", grams: 14 },
      { label: "Two spoonfuls", grams: 28 },
      { label: "Enough to fry in", grams: 42 },
    ],
  },
  {
    name: "Black coffee", sub: "no sugar", key: "coffee", per100: 1, p: 0.1, c: 0, f: 0,
    defaultIndex: 0,
    countUnit: "cup", countUnitPlural: "cups", gramsPerUnit: 240,
    amounts: [
      { label: "A cup", grams: 240 },
      { label: "A big mug", grams: 350 },
      { label: "Two cups", grams: 480 },
    ],
  },
  {
    name: "Orange juice", sub: "from concentrate", key: "juice", per100: 45, p: 0.7, c: 10, f: 0.2,
    defaultIndex: 1,
    countUnit: "glass", countUnitPlural: "glasses", gramsPerUnit: 250,
    amounts: [
      { label: "A small glass", grams: 150 },
      { label: "A normal glass", grams: 250 },
      { label: "A big glass", grams: 400 },
    ],
  },
  {
    name: "Mixed salad", sub: "with dressing", key: "greens", per100: 84, p: 1.6, c: 5, f: 6.5,
    defaultIndex: 1,
    amounts: [
      { label: "A side salad", hint: "on the side of a plate", grams: 80 },
      { label: "A normal bowl", grams: 150 },
      { label: "A big bowl", hint: "a whole meal", grams: 280 },
    ],
  },
  {
    name: "Chicken curry", sub: "with sauce", key: "chicken", per100: 145, p: 12, c: 6, f: 8,
    defaultIndex: 1,
    amounts: [
      { label: "A small serving", grams: 200 },
      { label: "A normal serving", hint: "one plate", grams: 300 },
      { label: "A big serving", hint: "went back for more", grams: 450 },
    ],
  },
  {
    name: "Pasta", sub: "cooked, with sauce", key: "pasta", per100: 158, p: 5.8, c: 30, f: 1.3,
    defaultIndex: 1,
    amounts: [
      { label: "A small bowl", grams: 150 },
      { label: "A normal bowl", grams: 220 },
      { label: "A big bowl", hint: "a full plate", grams: 350 },
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

/** find a food by name — becomes an API lookup once the backend lands */
export function findFood(name: string) {
  return FOOD_DB.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

/** "4 small cups" — for the exact-number entry */
export function countLabel(food: FoodDef, n: number) {
  const unit = n === 1 ? food.countUnit : food.countUnitPlural;
  return `${n} ${unit}`;
}

/** a generic ladder for anything not in the DB, so editing still works */
export const GENERIC_AMOUNTS: Amount[] = [
  { label: "A small amount", hint: "less than usual", grams: 80 },
  { label: "A normal amount", hint: "a standard serving", grams: 150 },
  { label: "A big amount", hint: "more than usual", grams: 240 },
  { label: "A very big amount", grams: 350 },
];