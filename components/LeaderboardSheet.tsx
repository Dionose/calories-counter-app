// components/LeaderboardSheet.tsx
// The whole board, however big it gets.
//
// IT FILLS THE SCREEN, like the inline camera — edge-inset and about
// four-fifths tall, with just enough margin for the traveling border to be
// seen going round.
//
// DENSE RANKING. Rank counts DISTINCT SCORES above you, not people: fifty
// players tied on 400 are all #1, and 398 is #2 — not #51. The competition
// alternative meant someone four points off the lead could read as #112, which
// looks like a thrashing when the actual gap is nothing.
//
// WHICH MAKES RANK AND POSITION DIFFERENT NUMBERS. #2 isn't the second row if
// ninety-eight people share first — so "jump to me" uses POSITION, and only
// the rank is ever shown.
//
// EVERY ROW PRINTS ITS OWN RANK, and every row in a tie says how many share
// it. An earlier version printed the number once per group and left the rest
// blank, which looked tidier and answered the wrong question: someone
// forty-ninth in a tied group scrolls to their own name to find out where they
// stand, and a blank margin tells them nothing.
//
// NO REGION SET? The Regional board can't show anything — but it now offers
// the fix rather than only naming the problem. See the empty state below.
import { ChevronLeft, ChevronRight, Crosshair, HelpCircle, MapPin, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import {
  BoardRow, BoardScope, currentSeason, loadBoard, myStanding,
  PAGE_SIZE, pageForPosition, seasonLine, Standing,
} from "../constants/leaderboard";
import { FONTS, TIERS, ULT_COLORS } from "../constants/theme";
import GradientText from "./GradientText";
import { IsoMGlow } from "./IsoM";
import SeasonCrown from "./SeasonCrown";
import Tap from "./Tap";
import TravelBorder from "./TravelBorder";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

const SHEET_H = Math.round(SCREEN_H * 0.78);

/* THE WIDTH IS SET EXPLICITLY rather than left to "100%". A percentage only
   fills whatever the parent offers, and between the centring view's padding
   and TravelBorder's own box the card kept ending up far narrower than the
   screen. */
const SHEET_W = SCREEN_W - 20;

const CROWN_SIZE = 30;
const CROWN_BOX = Math.ceil(CROWN_SIZE * 2.1);
const ROW_MIN_H = CROWN_BOX + 12;

const SCOPES: { key: BoardScope; label: string }[] = [
  { key: "general", label: "General" },
  { key: "regional", label: "Regional" },
  { key: "total", label: "Total" },
];

const TIER_PTS: Record<string, number> = { Spark: 1, Warming: 2, Hot: 3, "Red-hot": 4, Ultimate: 5 };
const TIER_RANGE: Record<string, string> = {
  Spark: "days 1–4",
  Warming: "days 5–8",
  Hot: "days 9–12",
  "Red-hot": "days 13–16",
  Ultimate: "day 17+",
};

/* ---------- DEMO ROWS ----------
   Dev mode only — but built to be RECORDED. Dion films the app with dev mode
   on for marketing, so the demo has to look like a real busy board rather
   than a neat descending list nobody would ever see.

   So the scores are DELIBERATELY CLUSTERED: five people share first, four
   share second, and so on. That's what a real leaderboard looks like once
   points come from a small set of daily values, and it's the only way to see
   dense ranking working — five #1s followed by #2, not by #6.

   Remove alongside Profile's dev panel before launch. */
function demoRows(scope: BoardScope): BoardRow[] {
  const names = [
    "amara_k", "dionj", "kwame.b", "lena.m", "tomiwa",
    "sofia_r", "nate", "yusuf.a", "priya",
    "marcus", "chidera", "hana_s", "olu.a", "mei_l", "jonas",
    "rania", "diego_p", "aisha",
    "ben.w", "zanele", "arjun", "clara_v",
    "ifeoma", "leo.k", "noor",
    "santi", "grace.o", "haruto", "elif", "malik_d",
  ];

  /* how many people share each rank, in order */
  const groups = [5, 4, 6, 3, 4, 3, 5];

  const rows: BoardRow[] = [];
  let i = 0;
  let rank = 1;

  groups.forEach((size) => {
    /* every rank steps down by a believable amount — a few points, not a
       chasm, which is the whole reason dense ranking matters */
    const points = scope === "total" ? 41280 - (rank - 1) * 940 : 412 - (rank - 1) * 6;

    for (let k = 0; k < size && i < names.length; k++, i++) {
      rows.push({
        userId: `demo-${i}`,
        handle: names[i],
        region: "Canada",
        points,
        tier: Math.max(1, 6 - rank),
        seasons: scope === "total" ? Math.max(1, 22 - i) : undefined,
        rank,
        tiedCount: size,
        tied: size > 1,
        me: names[i] === "dionj",
      });
    }
    rank++;
  });

  return rows;
}

export default function LeaderboardSheet({
  visible, scope, onScope, onClose, onSetRegion,
}: {
  visible: boolean;
  scope: BoardScope;
  onScope: (s: BoardScope) => void;
  onClose: () => void;
  /** closes the sheet and lands them on Profile's country picker. Passed in
      rather than routed from here, because this is a component and the tab
      navigation belongs to the screen that owns it. */
  onSetRegion: () => void;
}) {
  const { T, userId, profile, devMode, streakDays, freeLocked } = useApp();
  const s = styles(T);

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [jumped, setJumped] = useState(false);

  /* bumped to replay the crown's build-up — the star that spins into the
     circle and pops the crown out */
  const [crownPlay, setCrownPlay] = useState(0);

  const list = useRef<FlatList<BoardRow>>(null);
  const season = currentSeason();

  /* no region means the Regional board can't exist for them — checked here
     rather than relying on the error string, so the empty state can be
     specific about the fix */
  const noRegion = !devMode && scope === "regional" && !profile.region;

  /* ---------- the first page ---------- */
  const loadFirst = useCallback(async () => {
    setLoading(true);
    setJumped(false);
    setProblem(null);

    /* CLOSING ON THE EXPLAINER USED TO STICK. Reopening the leaderboard landed
       straight back on "How points work", because this flag was never reset —
       the rows were, but not the view. */
    setHowOpen(false);

    /* the crown performs each time the sheet opens or the board changes */
    setCrownPlay((k) => k + 1);

    if (devMode) {
      const demo = demoRows(scope);
      const me = demo.find((r) => r.me);
      setRows(demo);
      setStanding({
        rank: me?.rank ?? 1,
        position: demo.findIndex((r) => r.me) + 1,
        points: me?.points ?? 0,
        tier: me?.tier ?? 5,
        total: demo.length,
        topPercent: 7,
        tiedCount: me?.tiedCount ?? 1,
        tied: !!me?.tied,
      });
      setHasMore(false);
      setOffset(0);
      setLoading(false);
      return;
    }

    /* nothing to fetch without a region — the empty state handles it */
    if (!userId || noRegion) {
      setRows([]);
      setStanding(null);
      setLoading(false);
      return;
    }

    const [{ rows: r, error }, { standing: st }] = await Promise.all([
      loadBoard({ scope, region: profile.region, offset: 0, meId: userId }),
      myStanding(userId, scope, profile.region),
    ]);

    setRows(r);
    setStanding(st);
    setProblem(error);
    setOffset(r.length);
    setHasMore(r.length === PAGE_SIZE);
    setLoading(false);
  }, [scope, userId, profile.region, devMode, noRegion]);

  useEffect(() => {
    if (visible) loadFirst();
  }, [visible, loadFirst]);

  /* ---------- the next page ----------
     The guard matters: FlatList calls onEndReached more than once for the
     same scroll, and without it the same fifty rows arrive twice. */
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || devMode || !userId) return;

    setLoadingMore(true);
    const { rows: more } = await loadBoard({
      scope,
      region: profile.region,
      offset,
      meId: userId,
    });

    setRows((cur) => [...cur, ...more]);
    setOffset((o) => o + more.length);
    setHasMore(more.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, loading, hasMore, devMode, userId, scope, profile.region, offset]);

  /* ---------- jump to me ----------
     USES POSITION, NOT RANK. With dense ranking those are different numbers —
     #2 can be the hundredth row — and jumping by rank would land on page one
     while the user sits two thousand rows down.

     REPLACES the list rather than appending, or someone at position 4,318
     would be holding four thousand rows in memory to see one. */
  const jumpToMe = useCallback(async () => {
    if (!standing || !userId || devMode) return;

    H.tap();
    setLoading(true);

    const start = pageForPosition(standing.position);
    const { rows: r } = await loadBoard({
      scope,
      region: profile.region,
      offset: start,
      meId: userId,
    });

    setRows(r);
    setOffset(start + r.length);
    setHasMore(r.length === PAGE_SIZE);
    setJumped(true);
    setLoading(false);

    setTimeout(() => list.current?.scrollToOffset({ offset: 0, animated: false }), 50);
  }, [standing, userId, devMode, scope, profile.region]);

  const isTotal = scope === "total";

  const boardBorder = freeLocked
    ? { color: T.green }
    : streakDays >= 17
      ? { colors: ULT_COLORS }
      : { color: TIERS[Math.min(4, Math.max(1, Math.ceil(streakDays / 4))) as 1 | 2 | 3 | 4].color };

  const myTier = TIERS[Math.min(5, Math.max(1, standing?.tier ?? 1)) as 1 | 2 | 3 | 4 | 5];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.centre} pointerEvents="box-none">
          <TravelBorder {...boardBorder} cardBg={T.bg} borderColor={T.border} radius={24} strokeWidth={2.5}>
            <View style={s.card}>

              <View style={s.head}>
                {howOpen ? (
                  <Pressable onPress={() => setHowOpen(false)} hitSlop={14} style={s.headBtn}>
                    <ChevronLeft size={18} color={T.text} />
                  </Pressable>
                ) : (
                  <View style={{ width: 34 }} />
                )}
                <Text style={s.title}>{howOpen ? "How points work" : "Leaderboard"}</Text>
                <Pressable onPress={onClose} hitSlop={14} style={s.headBtn}>
                  <X size={18} color={T.sub} />
                </Pressable>
              </View>

              {howOpen ? (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={s.howText}>
                    Every day you log a meal, you earn points. That's the whole game — show up,
                    log, and your score goes up.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    How much a day is worth depends on your streak tier. The longer you keep your
                    streak alive, the higher your tier climbs, and the more each day earns:
                  </Text>

                  <View style={s.tierTable}>
                    {(["Spark", "Warming", "Hot", "Red-hot", "Ultimate"] as const).map((name, i) => {
                      const tt = TIERS[(i + 1) as 1 | 2 | 3 | 4 | 5];
                      const swatch = tt.color === "ultimate" ? "#8B5CF6" : tt.color;
                      const mine = myTier.name === name;
                      return (
                        <View key={name} style={[s.tierRow, mine && s.tierRowMine]}>
                          <View style={[s.tierDot, { backgroundColor: swatch }]} />
                          <Text style={[s.tierName, mine && { color: T.text }]}>{name}</Text>
                          <Text style={s.tierRange}>{TIER_RANGE[name]}</Text>
                          <Text style={[s.tierPts, mine && { color: T.green }]}>+{TIER_PTS[name]}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={[s.howText, { marginTop: 12 }]}>
                    A day at Ultimate is worth five days at Spark. Two people logging the same
                    number of days can end up far apart — consistency is what separates them.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    Miss a day and your streak eases back a tier rather than resetting to zero, so
                    one bad day doesn't undo weeks of work.
                  </Text>

                  <View style={s.howDivider} />

                  <Text style={s.howSmallTitle}>The three boards</Text>
                  <Text style={s.howText}>
                    <Text style={s.howBold}>General</Text> and{" "}
                    <Text style={s.howBold}>Regional</Text> reset at the end of every month, so
                    everyone starts level and a newcomer can reach the top. Regional narrows it to
                    your country, which is usually where you'll place highest.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    <Text style={s.howBold}>Total</Text> never resets — it adds up every season
                    you've ever played, so it rewards sticking around. Your crown there shows the
                    tier you've finished seasons at, and the number is how many times.
                  </Text>

                  <View style={s.howDivider} />

                  <Text style={s.howSmallTitle}>Ties, and how ranks are counted</Text>
                  <Text style={s.howText}>
                    Your rank counts SCORES above you, not people. If fifty players are tied on
                    400 points they're all 1st — every one of them — and the next score down is
                    2nd, not 51st.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    That's deliberate. Someone four points off the lead is four points off the
                    lead; calling them 51st would describe a gap that isn't there.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    So you may see something like <Text style={s.howBold}>2nd · top 51%</Text>.
                    Both are true and they measure different things: you have the second-best
                    score on the board, and about half the players are ahead of you on points.
                  </Text>

                  <Text style={[s.howText, { marginTop: 10 }]}>
                    Within a tie, whoever joined MOTION earliest is listed first — but that's only
                    the order names appear in, not a better rank.
                  </Text>

                  <View style={s.howDivider} />

                  <Text style={s.howSmallTitle}>What doesn't count</Text>
                  <Text style={s.howText}>
                    Nothing you can buy. Your plan, what you paid, how long you've had the app —
                    none of it affects your rank. Points come from logging and streaks only.
                  </Text>
                </ScrollView>
              ) : (
                <>
                  <View style={s.scopeRow}>
                    {SCOPES.map((sc) => (
                      <Pressable
                        key={sc.key}
                        onPress={() => { H.tick(); onScope(sc.key); }}
                        style={[s.scopeBtn, scope === sc.key && { backgroundColor: T.green }]}
                      >
                        <Text style={[s.scopeText, scope === sc.key && { color: T.ink }]}>
                          {sc.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={s.seasonLine}>
                    {isTotal
                      ? "Every season added together · this board never resets"
                      : seasonLine(season)}
                  </Text>

                  {/* WHERE YOU STAND — the rank and the percentile together,
                      because the second is what makes the first bearable. */}
                  {standing && !noRegion && (
                    <View style={s.standing}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.standingRank}>
                          #{standing.rank.toLocaleString()}
                          {standing.tied ? (
                            <Text style={s.standingTied}>
                              {"  "}tied with {standing.tiedCount - 1}
                            </Text>
                          ) : null}
                        </Text>
                        <Text style={s.standingSub}>
                          Top {standing.topPercent}% of {standing.total.toLocaleString()}{" "}
                          {standing.total === 1 ? "player" : "players"} · {standing.points.toLocaleString()} pts
                        </Text>
                      </View>

                      {!devMode && (
                        <Tap onPress={jumpToMe}>
                          <View style={s.jumpBtn}>
                            <Crosshair size={13} color={T.green} />
                            <Text style={s.jumpText}>Jump to me</Text>
                          </View>
                        </Tap>
                      )}
                    </View>
                  )}

                  {jumped && (
                    <Tap onPress={loadFirst}>
                      <Text style={s.backToTop}>← Back to the top of the board</Text>
                    </Tap>
                  )}

                  {loading ? (
                    <View style={s.loadingWrap}>
                      <IsoMGlow size={72} />
                      <Text style={s.loadingText}>Working out the standings…</Text>
                    </View>
                  ) : noRegion ? (
                    /* ---------- NO REGION, AND A WAY OUT ----------
                       This used to say "No region set on your profile yet" and
                       stop there — naming the problem and leaving them to find
                       the fix themselves, in a settings screen they may never
                       have opened. The button closes the sheet and lands them
                       ON the country picker. */
                    <View style={s.loadingWrap}>
                      <View style={s.regionIcon}>
                        <MapPin size={26} color={T.green} />
                      </View>
                      <Text style={s.emptyTitle}>You haven't set your region</Text>
                      <Text style={s.emptyText}>
                        The Regional board ranks you against people in your own country — so MOTION
                        needs to know which one. It takes a second, and your General and Total ranks
                        don't change.
                      </Text>

                      <Tap onPress={() => { H.tap(); onSetRegion(); }} style={{ width: "100%", maxWidth: 260 }}>
                        <View style={s.regionBtn}>
                          <Text style={s.regionBtnText}>Set my region</Text>
                        </View>
                      </Tap>
                    </View>
                  ) : problem ? (
                    <View style={s.loadingWrap}>
                      <Text style={s.emptyText}>{problem}</Text>
                    </View>
                  ) : rows.length === 0 ? (
                    <View style={s.loadingWrap}>
                      <Text style={s.emptyText}>
                        {scope === "regional"
                          ? `Nobody's logged in ${profile.region} yet this season. Log a meal and you're first on the board.`
                          : "Nothing logged yet this season. Log a meal and you're on the board."}
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      ref={list}
                      data={rows}
                      keyExtractor={(r) => r.userId}
                      renderItem={({ item }) => (
                        <Row r={item} isTotal={isTotal} T={T} playKey={crownPlay} />
                      )}
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
                      showsVerticalScrollIndicator={false}
                      onEndReached={loadMore}
                      onEndReachedThreshold={0.4}
                      ListFooterComponent={
                        loadingMore ? (
                          <View style={s.moreWrap}>
                            <IsoMGlow size={44} />
                            <Text style={s.moreText}>Loading more…</Text>
                          </View>
                        ) : !hasMore && rows.length > PAGE_SIZE ? (
                          <Text style={s.endText}>That's everyone.</Text>
                        ) : null
                      }
                    />
                  )}

                  <View style={s.footer}>
                    <Tap onPress={() => setHowOpen(true)}>
                      <View style={s.howRow}>
                        <View style={s.howIcon}>
                          <HelpCircle size={16} color={T.green} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.howRowTitle}>How points work</Text>
                          <Text style={s.howRowSub}>Tap to see how ranking is decided</Text>
                        </View>
                        <ChevronRight size={17} color={T.micro} />
                      </View>
                    </Tap>
                  </View>
                </>
              )}
            </View>
          </TravelBorder>
        </View>
      </View>
    </Modal>
  );
}

/** one row.

    EVERY ROW CARRIES ITS OWN RANK AND ITS OWN TIE COUNT. An earlier version
    printed the rank once per group and left the rest blank — tidier margin,
    wrong answer: someone forty-ninth in a tied group scrolls to their name to
    find out where they stand, and a blank tells them nothing.

    THE NAME GLOWS IN THAT PERSON'S OWN TIER, not their rank's — someone can
    sit high on points and still be Red-hot because they skipped yesterday. */
function Row({
  r, isTotal, T, playKey,
}: {
  r: BoardRow;
  isTotal: boolean;
  T: any;
  playKey?: number;
}) {
  const s = styles(T);
  const t = TIERS[Math.min(5, Math.max(1, r.tier)) as 1 | 2 | 3 | 4 | 5];
  const ult = t.color === "ultimate";

  return (
    <View style={[s.row, r.me && s.rowMe]}>
      <Text style={[s.rank, r.rank <= 3 && { color: T.gold }]}>
        {r.rank.toLocaleString()}
      </Text>

      {isTotal && r.seasons != null && (
        <View style={s.crownBox}>
          <SeasonCrown
            color={t.color}
            count={r.seasons}
            size={CROWN_SIZE}
            /* ONLY YOUR OWN CROWN PERFORMS. Thirty crowns running their
               star-into-crown build at once would be noise. */
            sequence={r.me}
            playKey={r.me ? playKey : undefined}
          />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        {ult ? (
          <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
        ) : (
          <Text style={[s.name, { color: t.color }]} numberOfLines={1}>@{r.handle}</Text>
        )}

        {r.tied && (
          <Text style={s.tiedNote}>{r.tiedCount} players tied here</Text>
        )}
      </View>

      {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}

      <Text style={s.pts}>{r.points.toLocaleString()}</Text>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    centre: { flex: 1, alignItems: "center", justifyContent: "center" },
    card: { width: SHEET_W, height: SHEET_H },

    head: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
    },
    headBtn: {
      width: 34, height: 34, alignItems: "center", justifyContent: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10,
    },
    title: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading },

    scopeRow: {
      flexDirection: "row", alignSelf: "center", gap: 2,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 11, padding: 2, marginBottom: 8,
    },
    scopeBtn: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 9 },
    scopeText: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed },

    seasonLine: {
      fontSize: 10.5, color: T.micro, fontFamily: FONTS.body,
      textAlign: "center", marginBottom: 10, paddingHorizontal: 16,
    },

    standing: {
      flexDirection: "row", alignItems: "center", gap: 10,
      marginHorizontal: 12, marginBottom: 10,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13,
    },
    standingRank: { fontSize: 20, color: T.text, fontFamily: FONTS.heading },
    standingTied: { fontSize: 11, color: T.micro, fontFamily: FONTS.body },
    standingSub: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    jumpBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11,
    },
    jumpText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed },

    backToTop: {
      fontSize: 11, color: T.green, fontFamily: FONTS.headingMed,
      textAlign: "center", marginBottom: 8,
    },

    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 30 },
    loadingText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    emptyTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    emptyText: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, textAlign: "center", lineHeight: 19 },

    /* the no-region state */
    regionIcon: {
      width: 58, height: 58, borderRadius: 19,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    regionBtn: {
      backgroundColor: T.green, borderRadius: 13,
      paddingVertical: 13, alignItems: "center", marginTop: 4,
    },
    regionBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },

    row: {
      flexDirection: "row", alignItems: "center", gap: 9,
      minHeight: ROW_MIN_H,
      paddingVertical: 6, paddingHorizontal: 10,
      borderRadius: 14, marginBottom: 5,
    },
    rowMe: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder },
    rank: { minWidth: 34, fontSize: 13, color: T.sub, fontFamily: FONTS.heading, textAlign: "center" },

    crownBox: {
      width: CROWN_BOX, height: CROWN_BOX,
      alignItems: "center", justifyContent: "center",
    },

    name: { fontSize: 13, fontFamily: FONTS.headingMed },
    tiedNote: { fontSize: 9, color: T.micro, fontFamily: FONTS.body, marginTop: 2 },
    youChip: { backgroundColor: T.greenBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    youChipText: { fontSize: 9, color: T.green, fontFamily: FONTS.heading },
    pts: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },

    moreWrap: { alignItems: "center", paddingVertical: 14, gap: 6 },
    moreText: { fontSize: 11, color: T.micro, fontFamily: FONTS.body },
    endText: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", paddingVertical: 16 },

    footer: {
      paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14,
      borderTopWidth: 1, borderTopColor: T.border,
    },
    howRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 14, padding: 13,
    },
    howIcon: {
      width: 34, height: 34, borderRadius: 11,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center",
    },
    howRowTitle: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    howRowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    howSmallTitle: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 6 },
    howText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },
    howBold: { color: T.text, fontFamily: FONTS.headingMed },
    howDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

    tierTable: {
      marginTop: 11, backgroundColor: T.card,
      borderWidth: 1, borderColor: T.border, borderRadius: 12, overflow: "hidden",
    },
    tierRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingHorizontal: 11 },
    tierRowMine: { backgroundColor: T.greenBg },
    tierDot: { width: 9, height: 9, borderRadius: 3 },
    tierName: { width: 62, fontSize: 11.5, color: T.sub, fontFamily: FONTS.headingMed },
    tierRange: { flex: 1, fontSize: 10.5, color: T.micro, fontFamily: FONTS.body },
    tierPts: { fontSize: 12, color: T.sub, fontFamily: FONTS.heading },
  });