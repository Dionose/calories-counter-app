// constants/health.ts
// Reading steps, active minutes, heart rate and calories burned from the
// phone's own health store.
//
// MOTION NEVER WRITES HERE, and never estimates these numbers. A guessed step
// count is worse than no step count: it looks identical to a real one, so it
// quietly makes every other figure on the screen untrustworthy.
//
// iOS uses HealthKit, Android uses Health Connect. They're different APIs with
// different shapes, so both live behind the same four functions and no screen
// ever has to know which platform it's on.
//
// THE SIGNATURES BELOW COME FROM QuantityTypeModule.nitro.d.ts IN THIS
// VERSION — not from the docs, which describe an older shape. If a call starts
// throwing "expected N arguments", read that file again rather than guessing:
//   queryStatisticsForQuantity(id, statistics, options?)
//   queryStatisticsCollectionForQuantity(id, statistics, anchorDate,
//                                        intervalComponents, options?)
// The UNIT is not positional — it belongs inside the options object.
//
// NOTHING IN HERE WORKS IN EXPO GO. Both are native modules and need the
// development build.
import { Platform } from "react-native";

/* imported lazily inside each function rather than at the top of the file.
   A top-level import of a native module that doesn't exist on the current
   platform throws at STARTUP — which would take the whole app down on Android
   because of an iOS-only package. */

export type DayActivity = {
  date: string;        // YYYY-MM-DD
  steps: number;
  activeMinutes: number;
  burnedCalories: number;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- what we ask for ----------
   Read-only, and only the four things the app actually shows. Asking for more
   than you use is how permission sheets get declined: someone who sees a
   calorie tracker requesting sleep and blood glucose reasonably wonders why. */
const IOS_READ = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierAppleExerciseTime",
  "HKQuantityTypeIdentifierHeartRate",
];

const ANDROID_READ = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "HeartRate" },
  { accessType: "read", recordType: "ExerciseSession" },
];

/** Is health data available on this device at all?
    False on a simulator, on an Android phone without Health Connect installed,
    and in Expo Go. Screens check this before offering to connect, so nobody
    taps a button that can't do anything. */
export async function isHealthAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      const HealthKit = require("@kingstinct/react-native-healthkit");
      return await HealthKit.isHealthDataAvailable();
    }
    if (Platform.OS === "android") {
      const { getSdkStatus, SdkAvailabilityStatus } = require("react-native-health-connect");
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    }
    return false;
  } catch (e: any) {
    console.log("HEALTH availability THREW:", e?.message || e);
    return false;
  }
}

/** Ask for permission. iOS shows its own sheet listing every type; Android
    opens Health Connect's permission screen.

    Takes ONE object with a `toRead` key in this version.

    ONE iOS QUIRK WORTH KNOWING: HealthKit deliberately does NOT tell you
    whether read permission was granted. Apple treats "this app knows you
    declined" as itself a privacy leak — a fitness app could infer things from
    the refusal. So the honest test is to read some data and see whether
    anything comes back, which is exactly what the screens do. */
export async function requestHealthPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "ios") {
      const HealthKit = require("@kingstinct/react-native-healthkit");
      await HealthKit.requestAuthorization({ toRead: IOS_READ });
      return true;
    }

    if (Platform.OS === "android") {
      const { initialize, requestPermission } = require("react-native-health-connect");
      const ready = await initialize();
      if (!ready) return false;
      const granted = await requestPermission(ANDROID_READ);
      return granted.length > 0;
    }

    return false;
  } catch (e: any) {
    console.log("HEALTH permission THREW:", e?.message || e);
    return false;
  }
}

/* ---------- iOS ---------- */

async function iosDaily(from: Date, to: Date): Promise<DayActivity[]> {
  const HealthKit = require("@kingstinct/react-native-healthkit");

  /* ANCHOR DATE matters more than it looks. HealthKit buckets intervals
     forward from this instant, so anchoring at midnight makes each bucket a
     real calendar day. Anchoring at, say, 14:32 would produce buckets running
     2:32pm to 2:32pm — which would split every day's steps across two bars. */
  const anchor = new Date(from);
  anchor.setHours(0, 0, 0, 0);

  const collect = (type: string, unit: string) =>
    HealthKit.queryStatisticsCollectionForQuantity(
      type,
      ["cumulativeSum"],
      anchor,
      { day: 1 },
      { filter: { startDate: from, endDate: to }, unit }
    ).catch((e: any) => {
      console.log(`HEALTH ${type}:`, e?.message || e);
      return [];
    });

  const [steps, energy, exercise] = await Promise.all([
    collect("HKQuantityTypeIdentifierStepCount", "count"),
    collect("HKQuantityTypeIdentifierActiveEnergyBurned", "kcal"),
    collect("HKQuantityTypeIdentifierAppleExerciseTime", "min"),
  ]);

  console.log("HEALTH: step buckets →", (steps || []).length);
  if (steps?.[0]) console.log("HEALTH: sample bucket →", JSON.stringify(steps[0]));

  /* three separate series, keyed by day so they can be merged into one row
     per date — a day might have steps but no exercise minutes, and both
     should still appear */
  const byDay: Record<string, DayActivity> = {};

  const add = (rows: any[], field: keyof DayActivity) => {
    (rows || []).forEach((r: any) => {
      const start = r.startDate ? new Date(r.startDate) : null;
      if (!start) return;
      const key = iso(start);
      if (!byDay[key]) {
        byDay[key] = { date: key, steps: 0, activeMinutes: 0, burnedCalories: 0 };
      }
      /* the shape varies: sometimes a nested quantity, sometimes a bare
         number. Reading both means a version bump can't silently zero
         everything out. */
      const v = Number(
        r.sumQuantity?.quantity ?? r.sumQuantity ?? r.cumulativeSum ?? 0
      ) || 0;
      (byDay[key] as any)[field] = Math.round(v);
    });
  };

  add(steps, "steps");
  add(energy, "burnedCalories");
  add(exercise, "activeMinutes");

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Android ---------- */

async function androidDaily(from: Date, to: Date): Promise<DayActivity[]> {
  const { initialize, readRecords } = require("react-native-health-connect");
  await initialize();

  const timeRangeFilter = {
    operator: "between",
    startTime: from.toISOString(),
    endTime: to.toISOString(),
  };

  const [steps, energy, sessions] = await Promise.all([
    readRecords("Steps", { timeRangeFilter }).catch(() => ({ records: [] })),
    readRecords("ActiveCaloriesBurned", { timeRangeFilter }).catch(() => ({ records: [] })),
    readRecords("ExerciseSession", { timeRangeFilter }).catch(() => ({ records: [] })),
  ]);

  const byDay: Record<string, DayActivity> = {};
  const bucket = (t: string) => {
    const key = iso(new Date(t));
    if (!byDay[key]) byDay[key] = { date: key, steps: 0, activeMinutes: 0, burnedCalories: 0 };
    return byDay[key];
  };

  /* Health Connect returns raw records rather than daily buckets, so they get
     summed by day here — an hourly step record and a full-day one both land
     on the right date */
  (steps.records || []).forEach((r: any) => {
    bucket(r.startTime).steps += Number(r.count) || 0;
  });

  (energy.records || []).forEach((r: any) => {
    bucket(r.startTime).burnedCalories += Math.round(Number(r.energy?.inKilocalories) || 0);
  });

  (sessions.records || []).forEach((r: any) => {
    const mins = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60000;
    bucket(r.startTime).activeMinutes += Math.round(mins);
  });

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

/** Daily activity across a date range.

    THIS IS THE ONE THAT READS HISTORY. The phone has been counting steps since
    the day it was bought, whether or not MOTION existed — so a brand-new user
    can see last January the moment they connect. Nothing needs to have been
    logged in this app for it to work. */
export async function loadActivity(from: Date, to: Date): Promise<DayActivity[]> {
  try {
    if (Platform.OS === "ios") return await iosDaily(from, to);
    if (Platform.OS === "android") return await androidDaily(from, to);
    return [];
  } catch (e: any) {
    console.log("HEALTH loadActivity THREW:", e?.message || e);
    return [];
  }
}

/** The most recent resting-ish heart rate, averaged over the last day.
    Separate from the daily series because it's a POINT reading rather than
    something that accumulates — summing heart rates would be meaningless. */
export async function recentHeartRate(): Promise<number | null> {
  try {
    if (Platform.OS === "ios") {
      const HealthKit = require("@kingstinct/react-native-healthkit");
      const from = new Date();
      from.setDate(from.getDate() - 1);

      const stats = await HealthKit.queryStatisticsForQuantity(
        "HKQuantityTypeIdentifierHeartRate",
        ["discreteAverage"],
        { filter: { startDate: from, endDate: new Date() }, unit: "count/min" }
      );

      const v = Number(
        stats?.averageQuantity?.quantity ?? stats?.averageQuantity ?? stats?.discreteAverage ?? 0
      );
      return v > 0 ? Math.round(v) : null;
    }

    if (Platform.OS === "android") {
      const { initialize, readRecords } = require("react-native-health-connect");
      await initialize();
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const res = await readRecords("HeartRate", {
        timeRangeFilter: {
          operator: "between",
          startTime: from.toISOString(),
          endTime: new Date().toISOString(),
        },
      });
      const beats: number[] = [];
      (res.records || []).forEach((r: any) => {
        (r.samples || []).forEach((sm: any) => {
          const bpm = Number(sm.beatsPerMinute) || 0;
          if (bpm > 0) beats.push(bpm);
        });
      });
      if (!beats.length) return null;
      return Math.round(beats.reduce((a, b) => a + b, 0) / beats.length);
    }

    return null;
  } catch (e: any) {
    console.log("HEALTH heart rate THREW:", e?.message || e);
    return null;
  }
}

/** Just today — what Home needs for its burned-calories figure. */
export async function todayActivity(): Promise<DayActivity | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await loadActivity(start, new Date());
  return rows.length ? rows[rows.length - 1] : null;
}