// constants/demoStats.ts
// The fake history behind dev mode on the Stats tab.
//
// WHY THIS EXISTS. A real account two days old shows two lit days and a flat
// chart — which demonstrates nothing about what the app does. Dion records the
// app with dev mode ON for marketing, so dev mode has to produce something
// worth filming: a year of steps, months of logged meals, a weight trend that
// actually trends.
//
// EVERYTHING HERE IS DETERMINISTIC. A seeded generator rather than
// Math.random(), because random numbers change on every re-render — bars would
// jitter as you scrolled, and a screen recording would show the chart
// reshuffling itself mid-take. Same seed, same history, every time.
//
// AND IT'S SHAPED LIKE A REAL PERSON'S DATA, not a smooth curve:
//   - weekends walk more than Tuesdays
//   - some days aren't logged at all
//   - weight goes UP some weeks
// A perfect descending line looks fake on camera and sets an expectation the
// app can't meet.
//
// ⚠️ DELETE THIS FILE, and its uses in stats.tsx, along with Profile's dev
// panel before launch. Nothing outside dev mode should ever import it.
import { DayActivity } from "./health";
import { WeighIn } from "./weight";

/* ---------- deterministic noise ----------
   A tiny hash-based generator. Given the same day it returns the same number
   forever, which is what stops the charts shuffling between renders. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** N days back from today, at midnight local */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/* how far back the demo history runs. A full year, because the Year view is
   the one that looks most impressive on camera and the emptiest without
   data. */
const HISTORY_DAYS = 365;

/* ---------- STEPS, BURN AND ACTIVE MINUTES ----------
   Built to look like a phone that's been in someone's pocket for a year. */
export function demoActivity(): DayActivity[] {
  const out: DayActivity[] = [];

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = daysAgo(i);
    const dow = d.getDay();
    const seed = Math.floor(d.getTime() / 86400000);

    /* WEEKENDS WALK MORE. Saturday and Sunday get a real lift, and Monday
       sags — that weekly rhythm is what makes a step chart look human rather
       than generated. */
    const weekend = dow === 0 || dow === 6;
    const base = weekend ? 11200 : dow === 1 ? 6400 : 8600;

    /* a slow upward drift across the year, so scrolling back shows someone
       who got more active rather than a flat band */
    const drift = Math.round((HISTORY_DAYS - i) * 4);

    /* the day-to-day scatter */
    const swing = Math.round((noise(seed) - 0.5) * 4600);

    /* AND THE OCCASIONAL DEAD DAY — ill, travelling, phone left at home.
       Without these the chart has no floor and every bar looks the same. */
    const dead = noise(seed + 7) > 0.94;

    const steps = dead
      ? Math.round(400 + noise(seed + 11) * 900)
      : Math.max(1200, base + drift + swing);

    out.push({
      date: iso(d),
      steps,
      /* roughly 0.04 calories a step plus a resting share — near enough to
         real that nobody watching a video would question it */
      burnedCalories: Math.round(steps * 0.041 + 180 + noise(seed + 3) * 90),
      activeMinutes: Math.max(4, Math.round(steps / 165 + noise(seed + 5) * 12)),
    });
  }

  /* newest last, matching what loadActivity returns */
  return out.reverse();
}

/** a believable resting heart rate */
export function demoHeartRate(): number {
  return 62;
}

/* ---------- CALORIES LOGGED ----------
   Keyed by date, exactly as loadDayTotals returns. */
export function demoDayTotals(goal: number): Record<string, number> {
  const totals: Record<string, number> = {};
  /* about four months of logging — enough for the weekly history to be worth
     pulling down through, without pretending they've used the app for a
     year */
  const LOGGED_DAYS = 120;

  for (let i = 0; i < LOGGED_DAYS; i++) {
    const d = daysAgo(i);
    const seed = Math.floor(d.getTime() / 86400000);
    const dow = d.getDay();

    /* SOME DAYS AREN'T LOGGED. Roughly one in nine, and more often at
       weekends — which is true of most people and is what makes the "not
       logged" bars in Stats appear at all. */
    const skipChance = dow === 0 || dow === 6 ? 0.22 : 0.08;
    if (noise(seed + 13) < skipChance) continue;

    /* mostly near the goal, drifting over on weekends */
    const weekendPush = dow === 0 || dow === 6 ? 260 : 0;
    const swing = (noise(seed + 17) - 0.42) * 620;

    totals[iso(d)] = Math.max(900, Math.round((goal + weekendPush + swing) / 10) * 10);
  }

  return totals;
}

/** how many days have anything logged — Stats' consistency card reads this */
export function demoDaysLogged(goal: number): number {
  return Object.keys(demoDayTotals(goal)).length;
}

/* ---------- WEIGH-INS ----------
   Every few days rather than daily, which is how MOTION's users actually
   weigh themselves — and it's what makes the chart's gap handling visible. */
export function demoWeighIns(startKg: number): WeighIn[] {
  const out: WeighIn[] = [];
  const SPAN_DAYS = 112;

  /* fall back to something sensible if the profile has no starting weight */
  const from = startKg > 0 ? startKg : 82;

  for (let i = SPAN_DAYS; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const seed = Math.floor(d.getTime() / 86400000);

    /* weigh in every three or four days, not every day */
    if (i % 3 !== 0 && i % 4 !== 0) continue;

    /* THE TREND GOES DOWN, THE WEEKS DON'T ALL GO DOWN. A steady fall looks
       synthetic and, worse, promises something no real diet delivers — so
       there are plateaus and small rises inside an overall loss. */
    const weeks = (SPAN_DAYS - i) / 7;
    const trend = from - weeks * 0.42;
    const plateau = Math.sin(weeks / 2.4) * 0.55;
    const water = (noise(seed + 23) - 0.5) * 0.7;

    out.push({
      id: `demo-w-${i}`,
      measuredOn: iso(d),
      weightKg: Math.round((trend + plateau + water) * 10) / 10,
    } as WeighIn);
  }

  /* oldest first, matching loadWeighIns */
  return out;
}