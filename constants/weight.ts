// constants/weight.ts
// Weigh-ins: saving them, reading the history, and working out what the trend
// actually means.
//
// EVERYTHING IS KG INSIDE THIS FILE. Conversion happens at the two edges —
// once on the way in, once on the way out — so no other file ever has to ask
// which unit a number is in. That question is where unit bugs come from.
import { supabase } from "./supabase";

export type WeighIn = {
  id?: string;
  measuredOn: string;      // YYYY-MM-DD
  weightKg: number;
  enteredUnit: "kg" | "lbs";
};

const LB_PER_KG = 2.20462;

export const toKg = (v: number, unit: "kg" | "lbs") => (unit === "kg" ? v : v / LB_PER_KG);
export const fromKg = (kg: number, unit: "kg" | "lbs") => (unit === "kg" ? kg : kg * LB_PER_KG);

/** today as YYYY-MM-DD in the DEVICE's timezone — same reasoning as meals.ts:
    toISOString() converts to UTC and would file a late-evening weigh-in under
    tomorrow. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Record a weigh-in. UPSERT on (user, date) because the database only allows
    one per day — weighing yourself twice in a morning should CORRECT the
    entry, not fail with an error the user can't act on. */
export async function saveWeighIn(
  userId: string,
  value: number,
  unit: "kg" | "lbs",
  day: string = todayLocal()
) {
  const kg = toKg(value, unit);

  /* a plausibility check before it reaches the database. A slipped decimal —
     782 instead of 78.2 — would otherwise become a permanent spike that
     wrecks the chart's scale and the trend maths for weeks. */
  if (!isFinite(kg) || kg < 20 || kg > 400) {
    return { error: "That weight doesn't look right. Check the number and try again." };
  }

  const { error } = await supabase
    .from("weigh_ins")
    .upsert(
      {
        user_id: userId,
        measured_on: day,
        weight_kg: Number(kg.toFixed(2)),
        entered_unit: unit,
      },
      { onConflict: "user_id,measured_on" }
    );

  return { error: error?.message ?? null };
}

/** The whole history, oldest first — which is the order a chart wants to draw
    it in, so no screen has to reverse it. */
export async function loadWeighIns(userId: string, limitDays = 400) {
  const from = new Date();
  from.setDate(from.getDate() - limitDays);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("weigh_ins")
    .select("*")
    .eq("user_id", userId)
    .gte("measured_on", fromStr)
    .order("measured_on", { ascending: true });

  if (error) return { entries: [] as WeighIn[], error: error.message };

  const entries: WeighIn[] = (data || []).map((r: any) => ({
    id: r.id,
    measuredOn: r.measured_on,
    weightKg: Number(r.weight_kg),
    enteredUnit: r.entered_unit || "kg",
  }));

  return { entries, error: null };
}

export async function deleteWeighIn(id: string) {
  const { error } = await supabase.from("weigh_ins").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/* ---------- what the numbers MEAN ---------- */

/** Where the plan says they should be by now.
    Straight-line from the starting weight at the promised pace — the same
    maths onboarding used to produce the goal date, so the two can't disagree. */
export function expectedKgToday(
  startKg: number,
  targetKg: number,
  paceKgPerWeek: number,
  signupDate: Date
) {
  const weeks = (Date.now() - signupDate.getTime()) / (7 * 86400000);
  const losing = targetKg < startKg;
  const moved = paceKgPerWeek * Math.max(0, weeks);
  const projected = losing ? startKg - moved : startKg + moved;
  /* never project past the goal — the plan ends when they get there, and a
     line that sails through the target reads as the app not noticing */
  return losing ? Math.max(targetKg, projected) : Math.min(targetKg, projected);
}

/** A SMOOTHED current weight — the average of the last few entries rather
    than the newest one.

    Daily weight swings a kilo or more on water alone, so the latest reading is
    the noisiest possible measure of progress. Someone who weighs in after a
    salty dinner and sees "you're 0.8kg behind" has been told something false
    about their week. The average is closer to the truth of where they are. */
export function smoothedKg(entries: WeighIn[], window = 3) {
  if (!entries.length) return null;
  const recent = entries.slice(-window);
  return recent.reduce((a, e) => a + e.weightKg, 0) / recent.length;
}

/** kg per week, measured from their actual entries rather than the plan.
    Needs two weigh-ins at least a week apart — anything closer together is
    measuring noise and would produce wild rates like "losing 14kg a week". */
export function actualPacePerWeek(entries: WeighIn[]) {
  if (entries.length < 2) return null;

  const first = entries[0];
  const last = entries[entries.length - 1];
  const days =
    (new Date(last.measuredOn).getTime() - new Date(first.measuredOn).getTime()) / 86400000;

  if (days < 7) return null;
  return ((last.weightKg - first.weightKg) / days) * 7;
}