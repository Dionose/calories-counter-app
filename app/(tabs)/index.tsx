// app/(tabs)/index.tsx
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { ChevronDown, ChevronLeft, ChevronRight, Flame, HelpCircle, Trophy, X } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import GradientText from "../../components/GradientText";
import PageHeader from "../../components/PageHeader";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { FONTS, TIERS, ULT_COLORS, tierForStreak } from "../../constants/theme";

const CAMERA_ICON = require("../../assets/motion-camera-dark.json");
const SCREEN_H = Dimensions.get("window").height;
// explicit — TravelBorder's card sizes to content and won't stretch to a flexed parent
const SHEET_H = Math.round(SCREEN_H * 0.72);

const MEALS: { name: string; cal: number; typical: number }[] = [
  { name: "Breakfast", cal: 215, typical: 450 },
  { name: "Lunch", cal: 530, typical: 600 },
  { name: "Dinner", cal: 0, typical: 700 },
  { name: "Snacks", cal: 0, typical: 200 },
];

// the leaderboard ranks on EARNED points only — never on plan, never on spend
const BOARD_FULL = [
  { rank: 1, handle: "amara_k", pts: 412, days: 21 },
  { rank: 2, handle: "dionj", pts: 388, days: 14, me: true },
  { rank: 3, handle: "kwame.b", pts: 356, days: 12 },
  { rank: 4, handle: "lena.m", pts: 341, days: 11 },
  { rank: 5, handle: "tomiwa", pts: 318, days: 10 },
  { rank: 6, handle: "sofia_r", pts: 294, days: 9 },
  { rank: 7, handle: "nate", pts: 271, days: 7 },
  { rank: 8, handle: "yusuf.a", pts: 255, days: 6 },
  { rank: 9, handle: "priya", pts: 233, days: 5 },
  { rank: 10, handle: "marcus", pts: 210, days: 3 },
  { rank: 11, handle: "chidera", pts: 204, days: 18 },
  { rank: 12, handle: "hana_s", pts: 198, days: 15 },
  { rank: 13, handle: "olu.a", pts: 191, days: 13 },
  { rank: 14, handle: "mei_l", pts: 186, days: 12 },
  { rank: 15, handle: "jonas", pts: 179, days: 11 },
  { rank: 16, handle: "rania", pts: 172, days: 9 },
  { rank: 17, handle: "diego_p", pts: 165, days: 8 },
  { rank: 18, handle: "aisha", pts: 158, days: 8 },
  { rank: 19, handle: "ben.w", pts: 150, days: 7 },
  { rank: 20, handle: "zanele", pts: 144, days: 6 },
  { rank: 21, handle: "arjun", pts: 137, days: 6 },
  { rank: 22, handle: "clara_v", pts: 129, days: 5 },
  { rank: 23, handle: "ifeoma", pts: 122, days: 5 },
  { rank: 24, handle: "leo.k", pts: 114, days: 4 },
  { rank: 25, handle: "noor", pts: 108, days: 4 },
  { rank: 26, handle: "santi", pts: 101, days: 3 },
  { rank: 27, handle: "grace.o", pts: 94, days: 3 },
  { rank: 28, handle: "haruto", pts: 86, days: 2 },
  { rank: 29, handle: "elif", pts: 79, days: 2 },
  { rank: 30, handle: "malik_d", pts: 71, days: 1 },
];

const BOARD = BOARD_FULL.slice(0, 3);

const TIER_PTS: Record<string, number> = { Spark: 1, Warming: 2, Hot: 3, "Red-hot": 4, Ultimate: 5 };
const TIER_RANGE: Record<string, string> = {
  Spark: "days 1–4",
  Warming: "days 5–8",
  Hot: "days 9–12",
  "Red-hot": "days 13–16",
  Ultimate: "day 17+",
};

export default function Home() {
  const router = useRouter();
  const { T, freeLocked, togglePro, isPro, plan, profile, streakDays } = useApp();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"General" | "Regional">("General");

  const [boardMounted, setBoardMounted] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const board = useRef(new Animated.Value(0)).current;

  const [drawerH, setDrawerH] = useState(0);
  const expand = useRef(new Animated.Value(0)).current;

  const tier = tierForStreak(streakDays);
  const isUlt = tier.color === "ultimate";
  const flameColor = isUlt ? T.orange : tier.color;

  const eaten = MEALS.reduce((sum, m) => sum + m.cal, 0);
  const burned = 320;
  const goal = plan.calories + (plan.addBurned ? burned : 0);
  const remaining = Math.max(0, goal - eaten);
  const over = eaten - goal;
  const pct = Math.min(100, (eaten / goal) * 100);

  const nextMeal = MEALS.find((m) => m.cal === 0);
  const lightMeal = MEALS.find((m) => m.cal > 0 && m.cal < m.typical * 0.6);

  const macros = [
    { label: "Protein", v: Math.round(plan.protein * 0.28), t: plan.protein, c: T.green },
    { label: "Carbs", v: Math.round(plan.carbs * 0.25), t: plan.carbs, c: T.gold },
    { label: "Fat", v: Math.round(plan.fat * 0.28), t: plan.fat, c: T.orange },
  ];

  const toggleHero = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(expand, {
      toValue: next ? 1 : 0,
      duration: next ? 420 : 260,
      easing: next ? Easing.bezier(0.2, 0.8, 0.2, 1) : Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const openBoard = () => {
    setHowOpen(false);
    setBoardMounted(true);
    Animated.timing(board, { toValue: 1, duration: 380, easing: Easing.bezier(0.2, 0.9, 0.25, 1), useNativeDriver: true }).start();
  };

  const closeBoard = () => {
    Animated.timing(board, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => { setBoardMounted(false); setHowOpen(false); });
  };

  const drawerHeight = expand.interpolate({ inputRange: [0, 1], outputRange: [0, drawerH] });
  const contentOpacity = expand.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });
  const contentShift = expand.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  const chevron = expand.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const hintOpacity = expand.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" });

  const boardScale = board.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const boardLift = board.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  const unit = profile.weightUnit;
  const rate = unit === "kg" ? profile.paceRate : profile.paceRate * 2.20462;
  const losing = profile.targetWeight < profile.startWeight;

  const s = styles(T);
  const toCamera = () => router.push("/(tabs)/camera");

  let nudgeTitle: string;
  let nudgeSub: string;
  if (over > 200) {
    nudgeTitle = `${over.toLocaleString()} calories over your goal today`;
    nudgeSub = "It happens — tomorrow's a fresh day. Your streak is safe.";
  } else if (nextMeal) {
    nudgeTitle = `${remaining.toLocaleString()} calories left today — log ${nextMeal.name.toLowerCase()}`;
    nudgeSub = "Your next meal · tap to snap, scan or search";
  } else {
    nudgeTitle = "Every meal logged today";
    nudgeSub = `Nice work — that's day ${streakDays} of your streak.`;
  }

  const boardBorder = freeLocked
    ? { color: T.green }
    : isUlt
      ? { colors: ULT_COLORS }
      : { color: tier.color };

  const BoardRow = ({ r }: { r: typeof BOARD_FULL[0] }) => {
    const rt = tierForStreak(r.days);
    const ult = rt.color === "ultimate";
    return (
      <View style={[s.boardRow, r.me && s.boardRowMe]}>
        <Text style={s.boardRank}>{r.rank}</Text>
        {ult ? (
          <View style={{ flex: 1 }}>
            <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
          </View>
        ) : (
          <Text style={[s.boardName, { color: rt.color }]} numberOfLines={1}>@{r.handle}</Text>
        )}
        {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}
        <Text style={s.boardPts}>{r.pts} <Text style={s.boardPtsUnit}>pts</Text></Text>
      </View>
    );
  };

  const drawerContent = (
    <>
      {macros.map((m) => {
        const target = Math.min(100, (m.v / m.t) * 100);
        const barWidth = expand.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${target}%`] });
        return (
          <View key={m.label} style={{ marginBottom: 11 }}>
            <View style={s.rowBetween}>
              <Text style={s.macroLabel}>{m.label.toUpperCase()}</Text>
              <Text style={s.macroLabel}>{m.v}/{m.t}g</Text>
            </View>
            <View style={s.macroTrack}>
              <Animated.View style={[s.macroFill, { width: barWidth, backgroundColor: m.c }]}>
                <Text style={s.macroInside}>{m.v}g</Text>
              </Animated.View>
            </View>
          </View>
        );
      })}
      <View style={s.statsRow}>
        {[["Eaten", eaten.toLocaleString()], ["Burned", burned.toLocaleString()], ["Goal", goal.toLocaleString()]].map(([l, v]) => (
          <View key={l} style={{ alignItems: "center" }}>
            <Text style={s.statNum}>{v}</Text>
            <Text style={s.statLabel}>{l.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60, paddingBottom: 40 }}>
        <PageHeader
          title="Home"
          right={
            <Tap onPress={() => router.push("/(tabs)/profile")}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{profile.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            </Tap>
          }
        />

        <Text style={s.greeting}>Good evening, {profile.name} · Tue Aug 9</Text>

        {/* CALORIE HERO */}
        <View style={{ marginTop: 16 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
            <Pressable onPress={toggleHero} style={{ padding: 20 }}>
              <View style={s.rowBetween}>
                <Text style={s.micro}>CALORIES LEFT TODAY</Text>
                <Animated.View style={{ transform: [{ rotate: chevron }] }}>
                  <ChevronDown size={16} color={T.micro} />
                </Animated.View>
              </View>

              <View style={s.calRow}>
                <Text style={s.calBig}>{remaining.toLocaleString()}</Text>
                <Text style={s.calSub}>of {goal.toLocaleString()} cal</Text>
              </View>

              <View style={s.track}>
                {over > 0 ? (
                  <View style={[s.fillFlat, { width: `${pct}%`, backgroundColor: over > 200 ? T.red : T.orange }]} />
                ) : (
                  <LinearGradient
                    colors={["#15803D", "#22C55E", "#86EFAC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.fillFlat, { width: `${pct}%` }]}
                  />
                )}
              </View>

              <View style={[s.rowBetween, { marginTop: 8 }]}>
                <Text style={s.eatenLine}>{eaten.toLocaleString()} eaten</Text>
                <Text style={s.toGoLine}>{remaining.toLocaleString()} to go</Text>
              </View>

              <Animated.View style={{ height: drawerHeight, overflow: "hidden" }}>
                <Animated.View
                  style={{ paddingTop: 18, opacity: contentOpacity, transform: [{ translateY: contentShift }] }}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0 && Math.abs(h - drawerH) > 1) setDrawerH(h);
                  }}
                >
                  {drawerContent}
                </Animated.View>
              </Animated.View>

              <Animated.View style={{ opacity: hintOpacity }}>
                <Text style={s.tapHint}>Tap to expand macros</Text>
              </Animated.View>
            </Pressable>
          </TravelBorder>
        </View>

        {/* PRIMARY-ACTION NUDGE */}
        <Tap onPress={toCamera} style={{ marginTop: 14 }}>
          <View style={s.nudge}>
            <View style={s.nudgeIcon}>
              <LottieView source={CAMERA_ICON} autoPlay loop style={{ width: 24, height: 24 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nudgeTitle}>{nudgeTitle}</Text>
              <Text style={s.nudgeSub}>{nudgeSub}</Text>
            </View>
            <ChevronRight size={18} color={T.green} />
          </View>
        </Tap>

        {/* TODAY'S MEALS */}
        <Text style={[s.micro, { marginTop: 22, marginBottom: 10 }]}>TODAY'S MEALS</Text>
        {MEALS.map((m) => {
          const isNext = nextMeal?.name === m.name;
          const isLight = lightMeal?.name === m.name;
          return (
            <Tap key={m.name} onPress={toCamera} style={{ marginBottom: 10 }}>
              <View style={[
                s.meal,
                isNext && { borderColor: T.greenBorder, backgroundColor: T.greenBg },
                isLight && { borderColor: T.goldBorder },
              ]}>
                <View style={{ flex: 1 }}>
                  <View style={s.mealTitleRow}>
                    <Text style={s.mealName}>{m.name}</Text>
                    {isNext && <View style={s.nextTag}><Text style={s.nextTagText}>NEXT</Text></View>}
                  </View>
                  {isLight && <Text style={s.lightNote}>Looks light — add anything you missed?</Text>}
                </View>
                {m.cal > 0 ? (
                  <Text style={[s.mealCal, isLight && { color: T.gold }]}>{m.cal} cal</Text>
                ) : (
                  <View style={s.addWrap}>
                    <View style={s.addBtn}><Text style={{ color: T.green, fontSize: 15 }}>+</Text></View>
                    <Text style={s.addText}>Add {m.name.toLowerCase()}</Text>
                  </View>
                )}
              </View>
            </Tap>
          );
        })}

        {/* LEADERBOARD */}
        <View style={[s.rowBetween, { marginTop: 24, marginBottom: 10 }]}>
          <Text style={s.micro}>LEADERBOARD</Text>
          <View style={s.scopeToggle}>
            {(["General", "Regional"] as const).map((sc) => (
              <Pressable key={sc} onPress={() => setScope(sc)} style={[s.scopeBtn, scope === sc && { backgroundColor: T.green }]}>
                <Text style={[s.scopeText, scope === sc && { color: T.ink }]}>{sc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <BlurLock label="Leaderboard" sub="See where you rank with Pro" locked={freeLocked} radius={18}>
          <TravelBorder {...boardBorder} cardBg={T.card} borderColor={T.border} radius={18}>
            <View style={{ padding: 14 }}>
              <View style={s.boardHead}>
                <Trophy size={13} color={T.text} />
                <Text style={s.boardHeadText}>
                  {scope === "General" ? "Top players worldwide" : "Top in your country"}
                </Text>
              </View>

              {BOARD.map((r) => <BoardRow key={r.rank} r={r} />)}

              <Tap onPress={openBoard} style={{ marginTop: 6 }}>
                <View style={s.seeFull}>
                  <Text style={s.seeFullText}>See full leaderboard</Text>
                </View>
              </Tap>
            </View>
          </TravelBorder>
        </BlurLock>

        {!freeLocked && (
          <View style={s.boardFoot}>
            <Text style={s.boardFootText}>Points come from logging streaks and tiers — nothing else.</Text>
          </View>
        )}

        {/* SECONDARY chips */}
        <View style={s.strip}>
          <Tap onPress={() => router.push("/(tabs)/calendar")} style={{ flex: 1 }}>
            <View style={s.chipCard}>
              <View style={s.rowBetween}>
                <Text style={s.micro}>STREAK</Text>
                <ChevronRight size={13} color={T.micro} />
              </View>
              <View style={s.wRow}>
                <Text style={s.wBig}>{streakDays}</Text>
                <Text style={s.wUnit}>days</Text>
                <Flame size={16} color={flameColor} fill={flameColor} style={{ marginLeft: "auto" }} />
              </View>
              {isUlt ? (
                <View style={{ marginTop: 4 }}>
                  <GradientText text="Ultimate · +5 pts today" colors={ULT_COLORS} fontSize={9.5} fontFamily={FONTS.headingMed} />
                </View>
              ) : (
                <Text style={[s.chipNote, { color: flameColor }]}>
                  {tier.name} · +{TIER_PTS[tier.name] || 1} pts today
                </Text>
              )}
            </View>
          </Tap>

          <View style={{ flex: 1 }}>
            <BlurLock label="Expected weight" locked={freeLocked} radius={14} compact>
              <Tap onPress={() => router.push("/(tabs)/stats")}>
                <View style={s.chipCard}>
                  <View style={s.rowBetween}>
                    <Text style={s.micro}>EXPECTED WEIGHT</Text>
                    <ChevronRight size={13} color={T.micro} />
                  </View>
                  <View style={s.wRow}>
                    <Text style={s.wBig}>{profile.startWeight}</Text>
                    <Text style={s.wUnit}>{unit}</Text>
                    <Text style={s.wTrend}>{losing ? "↓" : "↑"} {rate.toFixed(1)}</Text>
                  </View>
                  <Text style={s.chipNote}>on track · tap to log real weight</Text>
                </View>
              </Tap>
            </BlurLock>
          </View>
        </View>
      </ScrollView>

      {/* LEADERBOARD POP-OUT.
          The backdrop is a SIBLING behind the card, never an ancestor — a
          Pressable wrapping a ScrollView swallows the scroll gesture. */}
      <Modal visible={boardMounted} transparent animationType="fade" onRequestClose={closeBoard}>
        <View style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={closeBoard} />

          <View style={s.sheetCentre} pointerEvents="box-none">
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 380,
                opacity: board,
                transform: [{ scale: boardScale }, { translateY: boardLift }],
              }}
            >
              <TravelBorder {...boardBorder} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
                <View style={{ height: SHEET_H }}>

                  {/* header */}
                  <View style={s.sheetHead}>
                    {howOpen ? (
                      <Pressable onPress={() => setHowOpen(false)} hitSlop={14} style={s.sheetBack}>
                        <ChevronLeft size={18} color={T.text} />
                      </Pressable>
                    ) : (
                      <View style={{ width: 34 }} />
                    )}
                    <Text style={s.sheetTitle}>{howOpen ? "How points work" : "Leaderboard"}</Text>
                    <Pressable onPress={closeBoard} hitSlop={14} style={s.sheetClose}>
                      <X size={18} color={T.sub} />
                    </Pressable>
                  </View>

                  {howOpen ? (
                    /* ---------- PANEL 2 · the explanation ---------- */
                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 22 }}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={s.howText}>
                        Every day you log a meal, you earn points. That's the whole game — show up, log,
                        and your score goes up.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        How much a day is worth depends on your streak tier. The longer you keep your
                        streak alive, the higher your tier climbs, and the more each day earns:
                      </Text>

                      <View style={s.tierTable}>
                        {(["Spark", "Warming", "Hot", "Red-hot", "Ultimate"] as const).map((name, i) => {
                          const tt = TIERS[(i + 1) as 1 | 2 | 3 | 4 | 5];
                          const swatch = tt.color === "ultimate" ? "#8B5CF6" : tt.color;
                          const mine = tier.name === name;
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
                        A day at Ultimate is worth five days at Spark. Two people logging the same number
                        of days can end up far apart — consistency is what separates them.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        Miss a day and your streak eases back a tier rather than resetting to zero, so one
                        bad day doesn't undo weeks of work. Pick it up again and you climb straight back.
                      </Text>

                      <View style={s.howDivider} />

                      <Text style={s.howSmallTitle}>What doesn't count</Text>
                      <Text style={s.howText}>
                        Nothing you can buy. Your plan, what you paid, how long you've had the app — none
                        of it affects your rank. Points come from logging and streaks only, so everyone
                        climbs the same ladder.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        <Text style={s.howBold}>General</Text> ranks you against everyone using MOTION.{" "}
                        <Text style={s.howBold}>Regional</Text> narrows it to your country, which is
                        usually where you'll place highest.
                      </Text>
                    </ScrollView>
                  ) : (
                    /* ---------- PANEL 1 · the players ---------- */
                    <>
                      <View style={s.sheetScopeRow}>
                        <View style={s.scopeToggle}>
                          {(["General", "Regional"] as const).map((sc) => (
                            <Pressable
                              key={sc}
                              onPress={() => setScope(sc)}
                              style={[s.scopeBtn, { paddingHorizontal: 20, paddingVertical: 6 }, scope === sc && { backgroundColor: T.green }]}
                            >
                              <Text style={[s.scopeText, { fontSize: 12 }, scope === sc && { color: T.ink }]}>{sc}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <Text style={s.sheetSub}>
                        {scope === "General" ? "Top players worldwide" : "Top in your country"}
                      </Text>

                      <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
                        showsVerticalScrollIndicator={false}
                      >
                        {BOARD_FULL.map((r) => <BoardRow key={r.rank} r={r} />)}
                      </ScrollView>

                      {/* widget two — pinned below the list, never scrolls with it */}
                      <View style={s.howFooter}>
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
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* DEV toggle — remove before launch. */}
      <Pressable onPress={togglePro} style={s.devChip}>
        <Text style={s.devText}>DEV · {isPro ? "PRO" : "FREE"} · tap to flip</Text>
      </Pressable>
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    devChip: {
      position: "absolute", bottom: 24, right: 14, zIndex: 30,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    devText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body, letterSpacing: 0.5 },

    greeting: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, textAlign: "center" },
    avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
    avatarText: { color: T.green, fontSize: 12, fontFamily: FONTS.headingMed },

    micro: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

    calRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
    calBig: { fontSize: 46, color: T.text, fontFamily: FONTS.heading },
    calSub: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
    track: { marginTop: 14, height: 10, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
    fillFlat: { height: "100%", borderRadius: 99 },
    eatenLine: { fontSize: 11, color: T.green, fontFamily: FONTS.headingMed },
    toGoLine: { fontSize: 11, color: T.sub, fontFamily: FONTS.headingMed },
    tapHint: { fontSize: 10, color: T.micro, marginTop: 10, textAlign: "center", fontFamily: FONTS.body },

    macroLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginBottom: 4 },
    macroTrack: { height: 18, borderRadius: 7, backgroundColor: T.track, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: 7, justifyContent: "center", alignItems: "flex-end", minWidth: 30, paddingRight: 7 },
    macroInside: { fontSize: 10.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border },
    statNum: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    statLabel: { fontSize: 9, color: T.micro, marginTop: 2, fontFamily: FONTS.body, letterSpacing: 0.6 },

    nudge: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 16, padding: 14,
    },
    nudgeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
    nudgeTitle: { fontSize: 14.5, color: T.text, fontFamily: FONTS.headingMed },
    nudgeSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    meal: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
    mealTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    mealName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
    nextTag: { backgroundColor: T.green, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    nextTagText: { fontSize: 8.5, color: T.ink, fontFamily: FONTS.heading, letterSpacing: 0.6 },
    lightNote: { fontSize: 11, color: T.gold, fontFamily: FONTS.body, marginTop: 4 },
    mealCal: { fontSize: 13, color: T.green, fontFamily: FONTS.headingMed },
    addWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    addBtn: { width: 20, height: 20, borderRadius: 7, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
    addText: { color: T.sub, fontSize: 12, fontFamily: FONTS.body },

    scopeToggle: { flexDirection: "row", backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 2 },
    scopeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
    scopeText: { fontSize: 11, color: T.sub, fontFamily: FONTS.headingMed },

    boardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    boardHeadText: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body },
    boardRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6 },
    boardRowMe: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder },
    boardRank: { width: 22, fontSize: 14, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    boardName: { flex: 1, fontSize: 13, fontFamily: FONTS.headingMed },
    youChip: { backgroundColor: T.greenBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    youChipText: { fontSize: 9, color: T.green, fontFamily: FONTS.heading },
    boardPts: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed },
    boardPtsUnit: { fontSize: 10, color: T.micro, fontFamily: FONTS.body },
    seeFull: { alignItems: "center", paddingVertical: 9, borderRadius: 11, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border },
    seeFullText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed },
    boardFoot: { marginTop: 10, paddingHorizontal: 4 },
    boardFootText: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, lineHeight: 15 },

    strip: { flexDirection: "row", gap: 10, marginTop: 16 },
    chipCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13, minHeight: 92 },
    wRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 5 },
    wBig: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    wUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    wTrend: { marginLeft: "auto", color: T.green, fontSize: 10, fontFamily: FONTS.headingMed },
    chipNote: { fontSize: 9.5, color: T.sub, marginTop: 4, fontFamily: FONTS.body },

    // pop-out
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
    sheetCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
    sheetTitle: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading, letterSpacing: 0.3 },
    sheetBack: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    sheetClose: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    sheetScopeRow: { alignItems: "center", paddingBottom: 8 },
    sheetSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, textAlign: "center", marginBottom: 8 },

    howFooter: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: T.border },
    howRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13 },
    howIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
    howRowTitle: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed },
    howRowSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

    howSmallTitle: { fontSize: 12.5, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 6 },
    howText: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },
    howBold: { color: T.text, fontFamily: FONTS.headingMed },
    howDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

    tierTable: { marginTop: 11, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, overflow: "hidden" },
    tierRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9, paddingHorizontal: 11 },
    tierRowMine: { backgroundColor: T.greenBg },
    tierDot: { width: 9, height: 9, borderRadius: 3 },
    tierName: { width: 62, fontSize: 11.5, color: T.sub, fontFamily: FONTS.headingMed },
    tierRange: { flex: 1, fontSize: 10.5, color: T.micro, fontFamily: FONTS.body },
    tierPts: { fontSize: 12, color: T.sub, fontFamily: FONTS.heading },
  });