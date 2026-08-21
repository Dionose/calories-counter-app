// constants/leaderboard.ts
// Reading the standings.
//
// THE POINTS ARE NOT WORKED OUT HERE. They're computed in the database, by a
// function that runs whenever a meal is logged or deleted. A phone can only
// see its own user, so it could never rank anyone — and anything a phone
// calculates, someone can lie about. This file only reads what's already
// decided.
//
// SEASONS ARE CALENDAR MONTHS, and they end by themselves. Every row is
// stamped with its month, so when the calendar turns, "this season" simply
// means a different set of rows. There is no reset job — nothing to fail
// overnight and wipe everyone's points. Past months stay, which is what the
// all-time board adds up and what the crowns count.
//
// FIFTY AT A TIME. A board can hold every user, and someone at rank 4,318 can
// scroll to themselves — but asking for five thousand rows at once is a slow
// screen and a lot of someone's data allowance. It pages, the way the calorie
// history already does.
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
  /** worked out on this side — see rankRows */
  rank: number;
  /** several people on the same points share a rank */
  tied: boolean;
  me?: boolean;
};

export type Standing = {
  rank: number;
  points: number;
  tier: number;
  /** how many people are on this board at all */
  total: number;
  /** "top 14%" — kinder and more meaningful than "4,318th" */
  topPercent: number;
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
    reason to stay. Dion's call, and the right one — no leaderboard can be
    fair to someone who joined yesterday, but a monthly reset is the closest
    thing to it. */
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

/** One page of a board.

    `startRank` is what the first row on this page ranks — the caller doesn't
    have to track it, because a page starting at offset 50 doesn't necessarily
    start at rank 51 once ties are counted. */
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

  let q = supabase
    .from(viewFor(scope))
    .select("user_id, handle, region, points, tier" + (scope === "total" ? ", seasons" : ""))
    .order("points", { ascending: false })
    /* a STABLE second sort. Without one, two people on the same points can
       swap places between pages and appear twice — or not at all. */
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (scope === "regional") q = q.eq("region", region);

  const { data, error } = await q;

  if (error) return { rows: [], error: error.message };
  if (!data?.length) return { rows: [], error: null };

  /* what rank does this page START at? Count everyone with MORE points than
     its first row — that's the number of people above them, whatever the ties
     look like. */
  const first = data[0] as any;
  let above = supabase
    .from(viewFor(scope))
    .select("user_id", { count: "exact", head: true })
    .gt("points", first.points);

  if (scope === "regional") above = above.eq("region", region);

  const { count } = await above;
  const startRank = (count ?? 0) + 1;

  return { rows: rankRows(data as any[], startRank, meId), error: null };
}

/** Turn a page of rows into ranked ones.

    SHARED RANKS. Equal points means equal rank — and the next distinct total
    takes the rank AFTER the whole tied group, so three people tied at #1 are
    followed by #4. Showing one of two identical scores as second would be
    plainly unfair, and points are visible so any other choice would look like
    a bug. */
function rankRows(raw: any[], startRank: number, meId?: string | null): BoardRow[] {
  const rows: BoardRow[] = [];

  let rank = startRank;
  let lastPoints: number | null = null;
  let seen = 0;

  raw.forEach((r) => {
    seen++;
    if (lastPoints != null && r.points !== lastPoints) {
      /* the next distinct score sits below everyone tied above it */
      rank = startRank + seen - 1;
    }
    lastPoints = r.points;

    rows.push({
      userId: r.user_id,
      handle: r.handle,
      region: r.region ?? null,
      points: r.points ?? 0,
      tier: r.tier ?? 1,
      seasons: r.seasons,
      rank,
      tied: false,
      me: meId ? r.user_id === meId : false,
    });
  });

  /* mark the ties once the whole page is built — a row is tied if anything
     next to it shares its rank */
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    row.tied = (!!prev && prev.rank === row.rank) || (!!next && next.rank === row.rank);
  });

  return rows;
}

/** Where the user actually stands, without loading the pages in between.

    Two counts rather than a scan: how many are above them, and how many are on
    the board at all. That's a fast answer at any size, and it's what makes
    "jump to me" possible without walking four thousand rows. */
export async function myStanding(
  userId: string,
  scope: BoardScope,
  region?: string | null
): Promise<{ standing: Standing | null; error: string | null }> {
  if (scope === "regional" && !region) {
    return { standing: null, error: "No region set on your profile yet." };
  }

  const view = viewFor(scope);

  const { data: mine, error: mineErr } = await supabase
    .from(view)
    .select("points, tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (mineErr) return { standing: null, error: mineErr.message };
  /* nothing logged this season yet — not an error, just nothing to rank */
  if (!mine) return { standing: null, error: null };

  let aboveQ = supabase
    .from(view)
    .select("user_id", { count: "exact", head: true })
    .gt("points", mine.points);

  let totalQ = supabase
    .from(view)
    .select("user_id", { count: "exact", head: true });

  let tiedQ = supabase
    .from(view)
    .select("user_id", { count: "exact", head: true })
    .eq("points", mine.points);

  if (scope === "regional") {
    aboveQ = aboveQ.eq("region", region);
    totalQ = totalQ.eq("region", region);
    tiedQ = tiedQ.eq("region", region);
  }

  const [{ count: above }, { count: total }, { count: tiedCount }] = await Promise.all([
    aboveQ, totalQ, tiedQ,
  ]);

  const rank = (above ?? 0) + 1;
  const totalPlayers = total ?? 1;

  return {
    standing: {
      rank,
      points: mine.points ?? 0,
      tier: mine.tier ?? 1,
      total: totalPlayers,
      /* rounded UP, so someone at rank 1 of 100 reads "top 1%" rather than
         "top 0%", which would be nonsense */
      topPercent: Math.max(1, Math.ceil((rank / totalPlayers) * 100)),
      tied: (tiedCount ?? 1) > 1,
    },
    error: null,
  };
}

/** the page a given rank falls on — what "jump to me" needs */
export function pageForRank(rank: number, size = PAGE_SIZE): number {
  return Math.max(0, Math.floor((rank - 1) / size) * size);
}