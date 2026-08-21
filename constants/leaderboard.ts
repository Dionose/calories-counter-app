// constants/leaderboard.ts
// Reading the standings.
//
// THE POINTS AND THE RANKS ARE NOT WORKED OUT HERE. Both are computed in the
// database — points by a function that runs whenever a meal is logged or
// deleted, ranks by the views. A phone can only see its own user, so it could
// never rank anyone; and anything a phone calculates, someone can lie about.
// This file reads what's already decided.
//
// DENSE RANKING, and it matters. Rank counts DISTINCT SCORES above you, not
// people: fifty players tied on 400 are all #1, and 398 is #2 — not #51. The
// competition-style alternative meant someone four points off the lead could
// show as #112, which reads as a thrashing when the actual gap is nothing.
// Dion's call, and the right one.
//
// SO RANK AND POSITION ARE DIFFERENT NUMBERS NOW, and conflating them breaks
// "jump to me". Being #2 doesn't make you the second row — you might be the
// hundredth, if ninety-eight people share first place. Rank is for SHOWING;
// position is for FINDING. See myStanding().
//
// THE PERCENTILE STILL COUNTS PEOPLE. "#2 · top 51%" looks odd at a glance and
// is two true things: second-best score, and half the board is above you.
// Making the percentile agree with the rank would mean inventing a figure.
//
// SEASONS ARE CALENDAR MONTHS, and they end by themselves. Every row is
// stamped with its month, so when the calendar turns, "this season" simply
// means a different set of rows. There is no reset job — nothing to fail
// overnight and wipe everyone's points. Past months stay, which is what the
// all-time board adds up and what the crowns count.
//
// FIFTY AT A TIME. A board can hold every user, and someone at position 4,318
// can scroll to themselves — but asking for five thousand rows at once is a
// slow screen and a lot of someone's data allowance.
//
// WHAT'S PUBLIC, AND WHAT ISN'T. This is the one place in the app where people
// see each other, and what they see is a handle, points and a tier. Real
// names, emails, weights and food live in other tables that nothing here
// touches — that's the username-privacy rule, and this is the only screen
// where it could leak.
import { supabase } from "./supabase";

export type BoardScope = "general" | "regional" | "total";

export type BoardRow = {
  userId: string;
  handle: string;
  region: string | null;
  points: number;
  /** 1 Spark … 5 Ultimate — their CURRENT tier, not their rank */
  tier: number;
  /** all-time only: how many seasons they've finished. Drives the crown. */
  seasons?: number;
  /** DENSE rank — how many distinct scores are above them, plus one */
  rank: number;
  /** how many people share this exact score */
  tiedCount: number;
  /** shorthand for tiedCount > 1 */
  tied: boolean;
  me?: boolean;
};

export type Standing = {
  /** what to SHOW — dense, so it reads as a position in the race */
  rank: number;
  /** where they actually sit in the list — what "jump to me" needs. 1-based. */
  position: number;
  points: number;
  tier: number;
  /** how many people are on this board at all */
  total: number;
  /** "top 14%" — counted in PEOPLE, so it stays a real measure of standing */
  topPercent: number;
  tiedCount: number;
  tied: boolean;
};

export const PAGE_SIZE = 50;

/* ---------- the season ---------- */

/** 'YYYY-MM' for a date — the same key the database stamps rows with */
export function seasonKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type Season = {
  key: string;
  /** first day of this month */
  start: Date;
  /** last day of this month — the last day points still count */
  end: Date;
  /** first day of next month */
  nextStart: Date;
  /** whole days remaining, today included */
  daysLeft: number;
};

/** Where we are in the season.

    THE COUNTDOWN IS THE POINT. Someone joining on the 28th sees a hopeless
    rank; seeing "3 days left, then everyone starts level" turns that into a
    reason to stay. No leaderboard can be fair to someone who joined
    yesterday, but a monthly reset is the closest thing to it. */
export function currentSeason(now = new Date()): Season {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  /* compare DATES, not moments — otherwise the answer changes through the day
     and someone checking at breakfast and again at dinner sees different
     numbers for the same deadline */
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.max(0, Math.round((end.getTime() - today.getTime()) / 86400000) + 1);

  return { key: seasonKey(now), start, end, nextStart, daysLeft };
}

const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 31" */
export function shortDate(d: Date): string {
  return `${MSHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Ends in 10 days" — what fits on the Home card */
export function endsInLabel(s: Season): string {
  if (s.daysLeft <= 0) return "Season ends today";
  if (s.daysLeft === 1) return "Ends tomorrow";
  return `Ends in ${s.daysLeft} days`;
}

/** "Season ends Aug 31 · new season starts Sep 1" — what fits in the sheet */
export function seasonLine(s: Season): string {
  return `Season ends ${shortDate(s.end)} · new season starts ${shortDate(s.nextStart)}`;
}

/* ---------- the boards ---------- */

/** which view a scope reads from */
const viewFor = (scope: BoardScope) =>
  scope === "total" ? "leaderboard_alltime" : "leaderboard_current";

/** the regional board ranks within one country, so it reads different columns
    from the same view */
const rankCol = (scope: BoardScope) =>
  scope === "regional" ? "rank_regional" : "rank_general";
const tiedCol = (scope: BoardScope) =>
  scope === "regional" ? "tied_regional" : "tied_general";

/** One page of a board.

    `offset` is a POSITION in the list, not a rank — see the note at the top
    about why those are now different numbers. */
export async function loadBoard(opts: {
  scope: BoardScope;
  /** required for the regional board; ignored otherwise */
  region?: string | null;
  offset?: number;
  limit?: number;
  meId?: string | null;
}): Promise<{ rows: BoardRow[]; error: string | null }> {
  const { scope, region, offset = 0, limit = PAGE_SIZE, meId } = opts;

  if (scope === "regional" && !region) {
    return { rows: [], error: "No region set on your profile yet." };
  }

  const cols = [
    "user_id", "handle", "region", "points", "tier",
    rankCol(scope), tiedCol(scope),
    scope === "total" ? "seasons" : null,
  ].filter(Boolean).join(", ");

  let q = supabase
    .from(viewFor(scope))
    .select(cols)
    .order("points", { ascending: false })
    /* OLDEST ACCOUNT FIRST within a tied group. It decides display order only;
       the rank itself is shared, so nobody is promoted above someone on
       identical points.
       user_id is the final tiebreak: two people could have signed up in the
       same second, and without something stable they'd swap places between
       pages and appear twice, or not at all. */
    .order("joined_at", { ascending: true, nullsFirst: false })
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (scope === "regional") q = q.eq("region", region);

  const { data, error } = await q;

  if (error) return { rows: [], error: error.message };
  if (!data?.length) return { rows: [], error: null };

  const rank = rankCol(scope);
  const tied = tiedCol(scope);

  const rows: BoardRow[] = (data as any[]).map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    region: r.region ?? null,
    points: r.points ?? 0,
    tier: r.tier ?? 1,
    seasons: r.seasons,
    /* straight from the database — no ranking arithmetic on this side */
    rank: r[rank] ?? 1,
    tiedCount: r[tied] ?? 1,
    tied: (r[tied] ?? 1) > 1,
    me: meId ? r.user_id === meId : false,
  }));

  return { rows, error: null };
}

/** Where the user stands, without loading the pages in between.

    RETURNS BOTH NUMBERS. `rank` is dense and is what gets shown; `position` is
    how far down the list they physically are, and is the only thing "jump to
    me" can use. With ninety-eight people tied at first, #2 lives on page two. */
export async function myStanding(
  userId: string,
  scope: BoardScope,
  region?: string | null
): Promise<{ standing: Standing | null; error: string | null }> {
  if (scope === "regional" && !region) {
    return { standing: null, error: "No region set on your profile yet." };
  }

  const view = viewFor(scope);
  const rank = rankCol(scope);
  const tied = tiedCol(scope);

  const { data: mine, error: mineErr } = await supabase
    .from(view)
    .select(`points, tier, ${rank}, ${tied}`)
    .eq("user_id", userId)
    .maybeSingle();

  if (mineErr) return { standing: null, error: mineErr.message };
  /* nothing logged this season yet — not an error, just nothing to rank */
  if (!mine) return { standing: null, error: null };

  const myPoints = (mine as any).points ?? 0;

  /* how many PEOPLE are above them. Two jobs: the percentile, and the
     starting position for "jump to me". */
  let aboveQ = supabase
    .from(view)
    .select("user_id", { count: "exact", head: true })
    .gt("points", myPoints);

  let totalQ = supabase
    .from(view)
    .select("user_id", { count: "exact", head: true });

  if (scope === "regional") {
    aboveQ = aboveQ.eq("region", region);
    totalQ = totalQ.eq("region", region);
  }

  const [{ count: above }, { count: total }] = await Promise.all([aboveQ, totalQ]);

  const peopleAbove = above ?? 0;
  const totalPlayers = total ?? 1;

  return {
    standing: {
      rank: (mine as any)[rank] ?? 1,
      /* 1-based, and it lands them at the TOP of their tied group rather than
         somewhere in the middle of it */
      position: peopleAbove + 1,
      points: myPoints,
      tier: (mine as any).tier ?? 1,
      total: totalPlayers,
      /* rounded UP, so someone at the very top reads "top 1%" rather than
         "top 0%", which would be nonsense */
      topPercent: Math.max(1, Math.ceil(((peopleAbove + 1) / totalPlayers) * 100)),
      tiedCount: (mine as any)[tied] ?? 1,
      tied: ((mine as any)[tied] ?? 1) > 1,
    },
    error: null,
  };
}

/** the page a POSITION falls on — what "jump to me" needs.

    Takes a position, not a rank. Passing a dense rank here would send someone
    to page one when they're actually two thousand rows down. */
export function pageForPosition(position: number, size = PAGE_SIZE): number {
  return Math.max(0, Math.floor((position - 1) / size) * size);
}