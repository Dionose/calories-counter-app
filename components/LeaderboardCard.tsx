// components/LeaderboardCard.tsx
// The leaderboard as it appears on Home: three names, and when the season ends.
//
// THE COUNTDOWN IS THE POINT OF THIS CARD. A newcomer's rank is discouraging
// by definition — they joined last week and everyone else has a month of
// points. "Ends in 10 days" reframes that: the board is about to be wiped and
// they'll start level with everyone. Dion's call, and it's what makes a
// leaderboard survivable for someone who joins mid-month.
//
// Seasons are calendar months, so the reset needs no job to run — see
// constants/leaderboard.ts.
//
// THE PREVIEW IS THREE ROWS, not ten. It's a doorway, not the board: enough to
// see the shape of it and want to open it, not so much that opening it adds
// nothing.
import { ChevronRight } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import {
    BoardRow, BoardScope, currentSeason, endsInLabel, loadBoard,
} from "../constants/leaderboard";
import { FONTS, TIERS, ULT_COLORS } from "../constants/theme";
import GradientText from "./GradientText";
import Icon from "./Icon";
import SeasonCrown from "./SeasonCrown";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

/* ---------- DEMO DATA ----------
   Only ever shown in dev mode. A real board on a new install is one row — the
   user, alone — which demonstrates nothing about tiers, ties or what a busy
   season looks like. Remove alongside Profile's dev panel before launch. */
const DEMO_SEASON: BoardRow[] = [
  { userId: "d1", handle: "amara_k", region: "Nigeria", points: 412, tier: 5, rank: 1, tied: false },
  { userId: "d2", handle: "dionj", region: "Canada", points: 388, tier: 5, rank: 2, tied: false, me: true },
  { userId: "d3", handle: "kwame.b", region: "Ghana", points: 356, tier: 4, rank: 3, tied: false },
];

const DEMO_TOTAL: BoardRow[] = [
  { userId: "t1", handle: "kenji_w", region: "Japan", points: 41280, tier: 5, seasons: 14, rank: 1, tied: false },
  { userId: "t2", handle: "amara_k", region: "Nigeria", points: 38940, tier: 5, seasons: 12, rank: 2, tied: false },
  { userId: "t3", handle: "svetlana", region: "Poland", points: 36110, tier: 5, seasons: 11, rank: 3, tied: false },
];

export default function LeaderboardCard({
  scope, onOpen,
}: {
  scope: BoardScope;
  onOpen: () => void;
}) {
  const { T, userId, profile, devMode, freeLocked, streakDays } = useApp();
  const s = styles(T);

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const season = currentSeason();

  const load = useCallback(async () => {
    if (devMode) {
      setRows(scope === "total" ? DEMO_TOTAL : DEMO_SEASON);
      setProblem(null);
      setLoading(false);
      return;
    }

    if (!userId) { setLoading(false); return; }

    setLoading(true);
    const { rows: r, error } = await loadBoard({
      scope,
      region: profile.region,
      limit: 3,
      meId: userId,
    });

    setRows(r);
    setProblem(error);
    setLoading(false);
  }, [scope, userId, profile.region, devMode]);

  useEffect(() => { load(); }, [load]);

  /* the whole card wears the user's own tier colour — the same rule as every
     other bordered widget in the app */
  const tierColor = freeLocked
    ? { color: T.green }
    : streakDays >= 17
      ? { colors: ULT_COLORS }
      : { color: TIERS[Math.min(4, Math.max(1, Math.ceil(streakDays / 4))) as 1 | 2 | 3 | 4].color };

  const caption =
    scope === "general"
      ? "Top players worldwide"
      : scope === "regional"
        ? `Top in ${profile.region || "your country"}`
        : "All-time · never resets";

  return (
    <TravelBorder {...tierColor} cardBg={T.card} borderColor={T.border} radius={18}>
      <View style={{ padding: 14 }}>
        <View style={s.head}>
          <Icon name="trophy" size={17} mode="loop" />
          <Text style={s.headText} numberOfLines={1}>{caption}</Text>

          {/* WHEN IT RESETS. Short here because the row is narrow; the full
              dates live in the sheet, where there's room for them. The TOTAL
              board never resets, so it says so instead. */}
          <Text style={[s.ends, scope === "total" && { color: T.micro }]}>
            {scope === "total" ? "No reset" : endsInLabel(season)}
          </Text>
        </View>

        {loading ? (
          <Text style={s.state}>Loading…</Text>
        ) : problem ? (
          <Text style={s.state}>{problem}</Text>
        ) : rows.length === 0 ? (
          /* AN EMPTY BOARD IS A REAL STATE, especially on a brand-new install
             or a regional board in a country with one user. Saying so beats
             three blank rows. */
          <Text style={s.state}>
            {scope === "regional"
              ? "Nobody's logged in your country yet this season — log a meal and you're first."
              : "Nothing logged yet this season. Log a meal and you're on the board."}
          </Text>
        ) : (
          rows.map((r) => <Row key={r.userId} r={r} isTotal={scope === "total"} T={T} />)
        )}

        <Tap onPress={onOpen} style={{ marginTop: 6 }}>
          <View style={s.seeFull}>
            <Text style={s.seeFullText}>See full leaderboard</Text>
            <ChevronRight size={14} color={T.green} />
          </View>
        </Tap>
      </View>
    </TravelBorder>
  );
}

/** one preview row.

    THE NAME GLOWS IN THAT PERSON'S OWN TIER, not their rank's. Someone can sit
    high on points and still be Red-hot because they skipped yesterday — the
    colour is about their streak, the number is about their season. */
function Row({ r, isTotal, T }: { r: BoardRow; isTotal: boolean; T: any }) {
  const s = styles(T);
  const t = TIERS[Math.min(5, Math.max(1, r.tier)) as 1 | 2 | 3 | 4 | 5];
  const ult = t.color === "ultimate";

  return (
    <View style={[s.row, r.me && s.rowMe]}>
      <Text style={s.rank}>{r.rank}</Text>

      {isTotal && r.seasons != null && (
        <SeasonCrown color={t.color} count={r.seasons} size={30} />
      )}

      {ult ? (
        <View style={{ flex: 1 }}>
          <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
        </View>
      ) : (
        <Text style={[s.name, { color: t.color }]} numberOfLines={1}>@{r.handle}</Text>
      )}

      {r.tied && <Text style={s.tied}>tied</Text>}
      {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}

      <Text style={s.pts}>
        {r.points.toLocaleString()} <Text style={s.ptsUnit}>pts</Text>
      </Text>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    headText: { flex: 1, fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },
    ends: { fontSize: 10.5, color: T.green, fontFamily: FONTS.headingMed },

    state: {
      fontSize: 11.5, color: T.micro, fontFamily: FONTS.body,
      lineHeight: 17, paddingVertical: 14, textAlign: "center",
    },

    row: {
      flexDirection: "row", alignItems: "center", gap: 9,
      paddingVertical: 9, paddingHorizontal: 10,
      borderRadius: 12, marginBottom: 6,
    },
    rowMe: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder },
    rank: { width: 24, fontSize: 14, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    name: { flex: 1, fontSize: 13, fontFamily: FONTS.headingMed },
    tied: { fontSize: 9, color: T.micro, fontFamily: FONTS.body },
    youChip: { backgroundColor: T.greenBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    youChipText: { fontSize: 9, color: T.green, fontFamily: FONTS.heading },
    pts: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },
    ptsUnit: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },

    seeFull: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
      paddingVertical: 9, borderRadius: 11,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
    },
    seeFullText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
  });