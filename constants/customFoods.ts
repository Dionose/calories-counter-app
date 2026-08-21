// constants/customFoods.ts
// Foods the user added themselves, by photographing a packet MOTION's
// databases don't know about.
//
// WHY THIS EXISTS. Open Food Facts is volunteer-entered and USDA covers
// generic ingredients — between them they miss a lot of real supermarket
// products. A bag of large green lentils has a barcode, a nutrition panel and
// a name on the front, and none of it is in either database. The user is
// standing there holding the answer.
//
// AND WHY IT SAVES. Photographing a panel takes seconds, but doing it every
// week for the same bag of lentils is a chore that would stop them logging it
// at all. Once is reasonable; once a week is not.
//
// SAVING IS SEPARATE FROM LOGGING. Photographing a product is building your
// own food library; logging is saying you ate it. They used to be tangled
// together — the food was only written as a side effect of logging a meal —
// so someone who photographed a carton of almond milk, confirmed the label,
// then backed out without eating it lost the lot. Scanning the same carton
// again found nothing. Confirming the label is now the save.
import { Amount, FoodDef } from "./foods";
import { kindFor, liquidPortions, packPortions, powderPortions, proteinPortions, scoopPortions, spreadPortions } from "./portions";
import { supabase } from "./supabase";

export type CustomFood = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  per100: number;
  protein: number;
  carbs: number;
  fat: number;
  servingText: string | null;
  servingGrams: number | null;
  servingMl: number | null;
  createdAt: string;
};

/** save a food the user photographed, or update it if they've saved this
    barcode before.

    UPDATES RATHER THAN DUPLICATES. Now that confirming a label saves, the same
    packet can easily be scanned and confirmed several times — a second reading
    of the same barcode should REPLACE the first, not sit beside it. Otherwise
    the food list fills with copies and their search results turn to mush.

    A re-read is also usually the BETTER reading: someone rescanning a packet
    they already have is generally doing it because the first attempt was off. */
export async function saveCustomFood(
  userId: string,
  food: {
    name: string;
    brand?: string | null;
    barcode?: string | null;
    per100: number;
    protein: number;
    carbs: number;
    fat: number;
    servingText?: string | null;
    servingGrams?: number | null;
    servingMl?: number | null;
  }
): Promise<{ id: string | null; error: string | null }> {
  const row = {
    user_id: userId,
    name: food.name,
    brand: food.brand || null,
    barcode: food.barcode || null,
    per100: Math.round(food.per100),
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    serving_text: food.servingText || null,
    serving_grams: food.servingGrams ?? null,
    serving_ml: food.servingMl ?? null,
  };

  /* only a BARCODE identifies the same product reliably. Two foods can share a
     name — "protein powder" from different tubs — so a name match would
     overwrite something the user meant to keep. */
  if (food.barcode) {
    const existing = await findCustomByBarcode(userId, food.barcode);

    if (existing) {
      const { error } = await supabase
        .from("custom_foods")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (error) return { id: null, error: error.message };
      return { id: existing.id, error: null };
    }
  }

  const { data, error } = await supabase
    .from("custom_foods")
    .insert(row)
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

/** everything this user has added, newest first */
export async function listCustomFoods(userId: string): Promise<CustomFood[]> {
  const { data, error } = await supabase
    .from("custom_foods")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(rowToCustom);
}

/** search a user's own foods by name — runs alongside the network search, and
    LOCALLY, so their own entries appear instantly while USDA is still
    thinking */
export async function searchCustomFoods(userId: string, query: string): Promise<CustomFood[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("custom_foods")
    .select("*")
    .eq("user_id", userId)
    .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
    .limit(10);

  if (error || !data) return [];
  return data.map(rowToCustom);
}

/** THE POINT OF STORING THE BARCODE. Someone who added a food from a failed
    scan gets their own entry back the next time they scan that packet — no
    photographs, no typing, straight to the amount screen. */
export async function findCustomByBarcode(userId: string, barcode: string): Promise<CustomFood | null> {
  const code = barcode.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("custom_foods")
    .select("*")
    .eq("user_id", userId)
    .eq("barcode", code)
    /* newest first, so if an older duplicate exists from before saves started
       updating in place, the most recent reading is the one that comes back */
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return rowToCustom(data);
}

export async function deleteCustomFood(userId: string, id: string): Promise<string | null> {
  const { error } = await supabase
    .from("custom_foods")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  return error ? error.message : null;
}

function rowToCustom(r: any): CustomFood {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    per100: Number(r.per100) || 0,
    protein: Number(r.protein) || 0,
    carbs: Number(r.carbs) || 0,
    fat: Number(r.fat) || 0,
    servingText: r.serving_text,
    servingGrams: r.serving_grams != null ? Number(r.serving_grams) : null,
    servingMl: r.serving_ml != null ? Number(r.serving_ml) : null,
    createdAt: r.created_at,
  };
}

/** turn a saved food into the FoodDef the rest of the app speaks.

    The pack's own serving becomes the GOLD rung — same treatment as a label
    read live, because it is one: these figures came off the user's own packet,
    they're just being remembered rather than re-photographed. */
export function customToFoodDef(c: CustomFood): FoodDef {
  const name = c.brand ? `${c.name} · ${c.brand}` : c.name;
  const servingG = c.servingGrams ?? c.servingMl ?? null;

  /* the anchored ladder for this KIND of food, so there's still something
     sensible to pick when they had more or less than one serving */
  const kind = kindFor(name, "", c.servingText || "");
  const base = laddersFor(kind, servingG);

  const amounts: Amount[] = [];

  if (servingG) {
    const measures: string[] = [];
    if (c.servingMl) measures.push(`${Math.round(c.servingMl)} ml`);
    if (c.servingGrams) measures.push(`${Math.round(c.servingGrams)} g`);
    else if (c.servingMl) measures.push(`about ${Math.round(c.servingMl)} g`);

    amounts.push({
      label: c.servingText || "One serving",
      hint: measures.length
        ? `${measures.join(", ")} — from the label you saved`
        : "from the label you saved",
      grams: Math.round(servingG),
      ml: c.servingMl ?? undefined,
      unit: "serving",
      unitPlural: "servings",
      exact: true,
    });
  }

  /* the generic rungs below, minus anything that duplicates the saved
     serving — two rows with the same size and different words is the
     confusion the whole amount system exists to prevent */
  base.forEach((a) => {
    if (servingG && Math.abs(a.grams - servingG) < servingG * 0.08) return;
    amounts.push(a);
  });

  return {
    name,
    sub: "your own",
    key: "greens",
    per100: c.per100,
    p: c.protein,
    c: c.carbs,
    f: c.fat,
    amounts: amounts.length ? amounts : base,
    defaultIndex: 0,
    countUnit: "serving",
    countUnitPlural: "servings",
    gramsPerUnit: servingG || 100,
    mlPerUnit: c.servingMl ?? undefined,
  };
}

/** the anchored ladder for a kind, as plain Amounts */
function laddersFor(kind: string, servingG: number | null): Amount[] {
  const toAmounts = (ps: any[]): Amount[] =>
    ps.map((p) => ({
      label: p.label,
      hint: `${p.anchor} · ${p.ml != null ? `${p.ml} ml, about ${p.grams} g` : `about ${p.grams} g`}`,
      grams: p.grams,
      ml: p.ml,
      unit: p.unit,
      unitPlural: p.unitPlural,
    }));

  switch (kind) {
    case "liquid": return toAmounts(liquidPortions(""));
    case "spread": return toAmounts(spreadPortions(""));
    case "powder": return toAmounts(powderPortions(servingG || undefined));
    case "protein": return toAmounts(proteinPortions());
    case "pack": return servingG ? toAmounts(packPortions(servingG)) : toAmounts(scoopPortions());
    default: return toAmounts(scoopPortions());
  }
}