// constants/profile.ts
// Reading and writing the one profile row that belongs to the signed-in user.
//
// The DATABASE uses snake_case (start_weight) because that's Postgres
// convention; the APP uses camelCase (startWeight) because that's TypeScript
// convention. Rather than compromise either, both mappings live here — every
// other file only ever sees app-shaped objects.
import { supabase } from "./supabase";

/* what a profile looks like to the app. Everything optional, because a row
   can be half-filled while onboarding is still in progress. */
export type Profile = {
  handle?: string;
  name?: string;
  photoUri?: string | null;
  region?: string;
  sex?: "male" | "female";
  dobDay?: number;
  dobMonth?: number;
  dobYear?: number;
  heightCm?: number;
  heightUnit?: "cm" | "ft";
  weightUnit?: "kg" | "lbs";
  goal?: "lose" | "maintain" | "gain";
  startWeight?: number;
  targetWeight?: number;
  paceRate?: number;
  goalWeeks?: number;
  diet?: string;
  activity?: string;
  workouts?: string;
  heardFrom?: string;
  isPro?: boolean;
  memberSince?: string;
};

export type Plan = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tdee: number;
  addBurned: boolean;
};

/* The DB stores one `dob` date; the app carries three separate wheel values.
   Splitting and rejoining here keeps that awkwardness in one place instead of
   spread across every screen that touches a birthday. */
function toDbDate(d?: number, m?: number, y?: number) {
  if (d == null || m == null || y == null) return null;
  // month is 0-indexed in the app, 1-indexed in a date string
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fromDbDate(s?: string | null) {
  if (!s) return {};
  const [y, m, d] = s.split("-").map(Number);
  return { dobYear: y, dobMonth: m - 1, dobDay: d };
}

/** Write the profile. Used at the end of onboarding and by every Profile
    edit screen. UPSERT rather than insert: the first call creates the row,
    every later one updates it, and a retry after a dropped connection can't
    create a duplicate. */
export async function saveProfile(userId: string, p: Profile, plan?: Plan) {
  const row: Record<string, any> = {
    id: userId,
    handle: p.handle,
    name: p.name,
    photo_url: p.photoUri ?? null,
    region: p.region,
    sex: p.sex,
    dob: toDbDate(p.dobDay, p.dobMonth, p.dobYear),
    height_cm: p.heightCm,
    height_unit: p.heightUnit,
    weight_unit: p.weightUnit,
    goal: p.goal,
    start_weight: p.startWeight,
    target_weight: p.targetWeight,
    pace_rate: p.paceRate,
    goal_weeks: p.goalWeeks,
    diet: p.diet,
    activity: p.activity,
    workouts: p.workouts,
    heard_from: p.heardFrom,
    is_pro: p.isPro,
  };

  if (plan) {
    row.calories = plan.calories;
    row.protein = plan.protein;
    row.carbs = plan.carbs;
    row.fat = plan.fat;
    row.tdee = plan.tdee;
    row.add_burned = plan.addBurned;
  }

  /* undefined means "not supplied", and sending it would blank a column the
     caller never intended to touch. Stripping it makes partial updates safe —
     changing just the target weight leaves everything else alone. */
  Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);

  const { error } = await supabase.from("profiles").upsert(row);
  return { error: error?.message ?? null };
}

/** Load the profile for whoever is signed in. Returns nulls rather than
    throwing when there's no row — a brand-new account is a normal state, not
    an error. */
export async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { profile: null, plan: null, error: error.message };
  if (!data) return { profile: null, plan: null, error: null };

  const profile: Profile = {
    handle: data.handle ?? undefined,
    name: data.name ?? undefined,
    photoUri: data.photo_url,
    region: data.region ?? undefined,
    sex: data.sex ?? undefined,
    heightCm: data.height_cm ?? undefined,
    heightUnit: data.height_unit ?? undefined,
    weightUnit: data.weight_unit ?? undefined,
    goal: data.goal ?? undefined,
    startWeight: data.start_weight ?? undefined,
    targetWeight: data.target_weight ?? undefined,
    paceRate: data.pace_rate ?? undefined,
    goalWeeks: data.goal_weeks ?? undefined,
    diet: data.diet ?? undefined,
    activity: data.activity ?? undefined,
    workouts: data.workouts ?? undefined,
    heardFrom: data.heard_from ?? undefined,
    isPro: data.is_pro ?? false,
    memberSince: data.signup_date ?? undefined,
    ...fromDbDate(data.dob),
  };

  /* A row can exist with no plan yet — onboarding writes both together, but a
     future signup route might not. Only report a plan when there's a real
     calorie target in it. */
  const plan: Plan | null = data.calories
    ? {
        calories: data.calories,
        protein: data.protein ?? 0,
        carbs: data.carbs ?? 0,
        fat: data.fat ?? 0,
        tdee: data.tdee ?? 0,
        addBurned: data.add_burned ?? false,
      }
    : null;

  return { profile, plan, error: null };
}