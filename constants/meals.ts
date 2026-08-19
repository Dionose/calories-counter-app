// constants/meals.ts
// Saving and loading meals. Every logging route in the app — photo, barcode,
// voice, search, manual — ends up calling saveMeal().
//
// A meal and its items are TWO tables but ONE user action, so the functions
// here always handle both together. No screen should ever write to
// meal_items directly.
import { supabase } from "./supabase";

export type MealItem = {
  id?: string;
  foodName: string;
  /* the plain-English amount the user actually saw: "Half an avocado",
     "1 small cup — the little 4-pack size". Stored as written rather than
     regenerated later, because regenerating would produce something subtly
     different from what they agreed to. */
  amountLabel?: string;
  grams?: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  source?: string;
};

export type Meal = {
  id?: string;
  loggedOn?: string;            // YYYY-MM-DD; defaults to today
  mealType: "breakfast" | "lunch" | "dinner" | "snacks";
  /* the STORAGE PATH, not a URL. The bucket is private, so URLs expire —
     saving one here would leave dead links within the hour. */
  photoUrl?: string | null;
  source: "photo" | "barcode" | "voice" | "search" | "manual";
  items: MealItem[];
};

/** today as YYYY-MM-DD in the DEVICE's timezone. Deliberately not toISOString,
    which converts to UTC — someone logging a late dinner in Edmonton would
    have it filed under tomorrow, breaking their streak for a meal they ate
    before midnight. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Save a meal and its items. The meal row goes first — the items need its id
    — and the totals are summed here rather than trusted from the caller, so
    they can't drift from the items they're meant to summarise. */
export async function saveMeal(userId: string, meal: Meal) {
  const totals = meal.items.reduce(
    (acc, it) => ({
      calories: acc.calories + (it.calories || 0),
      protein: acc.protein + (it.protein || 0),
      carbs: acc.carbs + (it.carbs || 0),
      fat: acc.fat + (it.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const { data, error } = await supabase
    .from("meals")
    .insert({
      user_id: userId,
      logged_on: meal.loggedOn || todayLocal(),
      meal_type: meal.mealType,
      photo_url: meal.photoUrl ?? null,
      source: meal.source,
      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,
    })
    .select("id")
    .single();

  if (error || !data) return { mealId: null, error: error?.message ?? "Couldn't save that meal." };

  if (meal.items.length) {
    const { error: itemErr } = await supabase.from("meal_items").insert(
      meal.items.map((it) => ({
        meal_id: data.id,
        food_name: it.foodName,
        amount_label: it.amountLabel,
        grams: it.grams,
        calories: it.calories,
        protein: it.protein ?? 0,
        carbs: it.carbs ?? 0,
        fat: it.fat ?? 0,
        source: it.source,
      }))
    );

    /* If the items fail, the meal row would be left claiming calories it can't
       account for. Rather than leave that orphan, remove it — a failed save
       the user can retry beats a phantom meal they can't explain. */
    if (itemErr) {
      await supabase.from("meals").delete().eq("id", data.id);
      return { mealId: null, error: itemErr.message };
    }
  }

  return { mealId: data.id as string, error: null };
}

/** Attach a photo to a meal after its upload finishes.
    SEPARATE from saveMeal on purpose: the uploaded file is named after the
    meal's id, so the row has to exist before the photo can go anywhere. That
    ordering also means a failed upload leaves a meal with no picture rather
    than no meal at all. */
export async function setMealPhoto(mealId: string, path: string) {
  const { error } = await supabase.from("meals").update({ photo_url: path }).eq("id", mealId);
  return { error: error?.message ?? null };
}

/** Every meal for one day, with its items. Home and the calendar's day recap
    both use this. */
export async function loadDay(userId: string, day: string) {
  const { data, error } = await supabase
    .from("meals")
    .select("*, meal_items(*)")
    .eq("user_id", userId)
    .eq("logged_on", day)
    .order("created_at", { ascending: true });

  if (error) return { meals: [], error: error.message };

  const meals: Meal[] = (data || []).map((m: any) => ({
    id: m.id,
    loggedOn: m.logged_on,
    mealType: m.meal_type,
    photoUrl: m.photo_url,
    source: m.source,
    items: (m.meal_items || []).map((it: any) => ({
      id: it.id,
      foodName: it.food_name,
      amountLabel: it.amount_label,
      grams: it.grams,
      calories: it.calories,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      source: it.source,
    })),
  }));

  return { meals, error: null };
}

/** One number per day across a range — what the CALENDAR needs to know which
    tiles to light and what the STREAK is.
    Deliberately does NOT fetch items: drawing a month means 30 days, and
    pulling every food from every meal to decide whether a tile is green would
    be hundreds of rows for a yes/no answer. */
export async function loadDayTotals(userId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from("meals")
    .select("logged_on, total_calories")
    .eq("user_id", userId)
    .gte("logged_on", from)
    .lte("logged_on", to);

  if (error) return { totals: {} as Record<string, number>, error: error.message };

  /* several meals share a day, so sum them into one figure per date */
  const totals: Record<string, number> = {};
  (data || []).forEach((r: any) => {
    totals[r.logged_on] = (totals[r.logged_on] || 0) + (r.total_calories || 0);
  });

  return { totals, error: null };
}

/** Remove a meal. Its items go with it — the foreign key cascades, so there's
    no second delete to remember.
    The PHOTO doesn't cascade, though: storage and the database are separate
    systems. Callers that delete a meal should remove its file too, or it sits
    in the bucket forever costing space nobody can see. */
export async function deleteMeal(mealId: string) {
  const { error } = await supabase.from("meals").delete().eq("id", mealId);
  return { error: error?.message ?? null };
}

/** The user's streak: consecutive days ending today (or yesterday, if today
    isn't logged yet) that have at least one meal.

    Computed rather than stored. A stored counter has to be updated correctly
    on every save, every delete, and every timezone edge — and when it's wrong,
    it stays wrong. Deriving it from the data means it cannot disagree with
    the calendar the user is looking at. */
export async function currentStreak(userId: string) {
  const to = todayLocal();
  const from = new Date();
  from.setDate(from.getDate() - 400);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

  const { totals } = await loadDayTotals(userId, fromStr, to);
  const logged = new Set(Object.keys(totals));

  const d = new Date();
  /* Today not being logged yet doesn't break a streak — it's only broken once
     the day is over. Start counting from yesterday in that case. */
  if (!logged.has(todayLocal())) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!logged.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}