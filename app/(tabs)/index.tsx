// app/(tabs)/index.tsx
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { ChevronLeft, ChevronRight, Flame, HelpCircle, Trophy, X } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BlurLock from "../../components/BlurLock";
import GradientText from "../../components/GradientText";
import PageHeader from "../../components/PageHeader";
import SeasonCrown from "../../components/SeasonCrown";
import Tap from "../../components/Tap";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { FONTS, TIERS, ULT_COLORS, tierForStreak } from "../../constants/theme";

const CAMERA_ICON = require("../../assets/motion-camera-dark.json");
const SCREEN_H = Dimensions.get("window").height;

// Both sheets get an EXPLICIT height — TravelBorder's card sizes to its content.
const SHEET_H = Math.round(SCREEN_H * 0.72);
const HERO_H = Math.round(SCREEN_H * 0.62);

const MEALS: { name: string; cal: number; typical: number }[] = [
  { name: "Breakfast", cal: 215, typical: 450 },
  { name: "Lunch", cal: 530, typical: 600 },
  { name: "Dinner", cal: 0, typical: 700 },
  { name: "Snacks", cal: 0, typical: 200 },
];

/* SEASON boards — General and Regional reset every season */
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

/* TOTAL board — never resets, so it rewards tenure */
const TOTAL_TOP = [
  { rank: 1, handle: "kenji_w", pts: 41280, tier: 5, seasons: 14 },
  { rank: 2, handle: "amara_k", pts: 38940, tier: 5, seasons: 12 },
  { rank: 3, handle: "svetlana", pts: 36110, tier: 5, seasons: 11 },
  { rank: 4, handle: "obi.n", pts: 33470, tier: 5, seasons: 9 },
  { rank: 5, handle: "marta_c", pts: 30820, tier: 4, seasons: 10 },
];

const TOTAL_NEAR = [
  { rank: 4316, handle: "hana_s", pts: 9268, tier: 4, seasons: 3 },
  { rank: 4317, handle: "tomiwa", pts: 9226, tier: 5, seasons: 2 },
  { rank: 4318, handle: "dionj", pts: 9214, tier: 5, seasons: 4, me: true },
  { rank: 4319, handle: "priya", pts: 9188, tier: 3, seasons: 5 },
  { rank: 4320, handle: "ben.w", pts: 9140, tier: 4, seasons: 2 },
];

const TIER_PTS: Record<string, number> = { Spark: 1, Warming: 2, Hot: 3, "Red-hot": 4, Ultimate: 5 };
const TIER_RANGE: Record<string, string> = {
  Spark: "days 1–4",
  Warming: "days 5–8",
  Hot: "days 9–12",
  "Red-hot": "days 13–16",
  Ultimate: "day 17+",
};

type Scope = "General" | "Regional" | "Total";

export default function Home() {
  const router = useRouter();
  const { T, freeLocked, togglePro, isPro, plan, profile, streakDays } = useApp();
  const [scope, setScope] = useState<Scope>("General");

  const [heroOpen, setHeroOpen] = useState(false);
  const hero = useRef(new Animated.Value(0)).current;

  const [boardMounted, setBoardMounted] = useState(false);
  const [boardBody, setBoardBody] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [crownPlay, setCrownPlay] = useState(0);
  const board = useRef(new Animated.Value(0)).current;

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

  const openHero = () => {
    setHeroOpen(true);
    Animated.timing(hero, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeHero = () => {
    Animated.timing(hero, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => setHeroOpen(false));
  };

  const openBoard = () => {
    setHowOpen(false);
    setBoardMounted(true);
    setBoardBody(true);
    setCrownPlay((k) => k + 1);
    Animated.timing(board, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const closeBoard = () => {
    setBoardBody(false);
    Animated.timing(board, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => { setBoardMounted(false); setHowOpen(false); });
  };

  const pickScope = (sc: Scope) => {
    setScope(sc);
    if (sc === "Total") setCrownPlay((k) => k + 1);
  };

  // no scale — only opacity and lift, both native-driven
  const heroLift = hero.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const boardLift = board.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

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

  const isTotal = scope === "Total";

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

  const TotalRow = ({ r }: { r: typeof TOTAL_TOP[0] & { me?: boolean } }) => {
    const rt = TIERS[r.tier as 1 | 2 | 3 | 4 | 5];
    const ult = rt.color === "ultimate";
    return (
      <View style={[s.totalRow, r.me && s.boardRowMe]}>
        <Text style={s.totalRank}>{r.rank.toLocaleString()}</Text>
        <SeasonCrown color={rt.color} count={r.seasons} size={38} />
        {ult ? (
          <View style={{ flex: 1 }}>
            <GradientText text={`@${r.handle}`} colors={ULT_COLORS} fontSize={13} fontFamily={FONTS.headingMed} />
          </View>
        ) : (
          <Text style={[s.boardName, { color: rt.color }]} numberOfLines={1}>@{r.handle}</Text>
        )}
        {r.me && <View style={s.youChip}><Text style={s.youChipText}>YOU</Text></View>}
        <Text style={s.boardPts}>{r.pts.toLocaleString()}</Text>
      </View>
    );
  };

  const CalorieBar = ({ height = 10 }: { height?: number }) => (
    <View style={[s.track, { height }]}>
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
        <Tap onPress={openHero} style={{ marginTop: 16 }}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
            <View style={{ padding: 20 }}>
              <View style={s.rowBetween}>
                <Text style={s.micro}>CALORIES LEFT TODAY</Text>
                <ChevronRight size={16} color={T.micro} />
              </View>

              <View style={s.calRow}>
                <Text style={s.calBig}>{remaining.toLocaleString()}</Text>
                <Text style={s.calSub}>of {goal.toLocaleString()} cal</Text>
              </View>

              <CalorieBar />

              <View style={[s.rowBetween, { marginTop: 8 }]}>
                <Text style={s.eatenLine}>{eaten.toLocaleString()} eaten</Text>
                <Text style={s.toGoLine}>{remaining.toLocaleString()} to go</Text>
              </View>

              <Text style={s.tapHint}>Tap for macros</Text>
            </View>
          </TravelBorder>
        </Tap>

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
            {(["General", "Regional", "Total"] as Scope[]).map((sc) => (
              <Pressable key={sc} onPress={() => pickScope(sc)} style={[s.scopeBtn, scope === sc && { backgroundColor: T.green }]}>
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
                  {scope === "General"
                    ? "Top players worldwide · this season"
                    : scope === "Regional"
                      ? "Top in your country · this season"
                      : "All-time · never resets"}
                </Text>
              </View>

              {isTotal
                ? TOTAL_TOP.slice(0, 3).map((r) => <TotalRow key={r.rank} r={r} />)
                : BOARD_FULL.slice(0, 3).map((r) => <BoardRow key={r.rank} r={r} />)}

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
            <Text style={s.boardFootText}>
              {isTotal
                ? "Every season's points added up. This board never resets."
                : "Points come from logging streaks and tiers — nothing else."}
            </Text>
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

      {/* CALORIE DETAIL POP-OUT */}
      <Modal visible={heroOpen} transparent animationType="none" onRequestClose={closeHero}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[s.backdrop, { opacity: hero }]}>
            <Pressable style={{ flex: 1 }} onPress={closeHero} />
          </Animated.View>

          <View style={s.sheetCentre} pointerEvents="box-none">
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 380,
                opacity: hero,
                transform: [{ translateY: heroLift }],
              }}
            >
              <TravelBorder color={T.green} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
                <View style={{ height: HERO_H }}>
                  <View style={s.sheetHead}>
                    <View style={{ width: 34 }} />
                    <Text style={s.sheetTitle}>Today</Text>
                    <Pressable onPress={closeHero} hitSlop={14} style={s.sheetClose}>
                      <X size={18} color={T.sub} />
                    </Pressable>
                  </View>

                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 10 }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[s.micro, { marginTop: 4 }]}>CALORIES LEFT TODAY</Text>
                    <View style={s.calRow}>
                      <Text style={s.calBig}>{remaining.toLocaleString()}</Text>
                      <Text style={s.calSub}>of {goal.toLocaleString()} cal</Text>
                    </View>

                    <CalorieBar height={12} />

                    <View style={[s.rowBetween, { marginTop: 8, marginBottom: 20 }]}>
                      <Text style={s.eatenLine}>{eaten.toLocaleString()} eaten</Text>
                      <Text style={s.toGoLine}>{remaining.toLocaleString()} to go</Text>
                    </View>

                    {macros.map((m) => (
                      <View key={m.label} style={{ marginBottom: 13 }}>
                        <View style={s.rowBetween}>
                          <Text style={s.macroLabel}>{m.label.toUpperCase()}</Text>
                          <Text style={s.macroLabel}>{m.v}/{m.t}g</Text>
                        </View>
                        <View style={s.macroTrack}>
                          <View style={[s.macroFill, { width: `${Math.min(100, (m.v / m.t) * 100)}%`, backgroundColor: m.c }]}>
                            <Text style={s.macroInside}>{m.v}g</Text>
                          </View>
                        </View>
                      </View>
                    ))}

                    <View style={s.statsRow}>
                      {[["Eaten", eaten.toLocaleString()], ["Burned", burned.toLocaleString()], ["Goal", goal.toLocaleString()]].map(([l, v]) => (
                        <View key={l} style={{ alignItems: "center" }}>
                          <Text style={s.statNum}>{v}</Text>
                          <Text style={s.statLabel}>{l.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>

                    {plan.addBurned && (
                      <Text style={s.burnedNote}>
                        Burned calories are added to your target — that's why today's goal is {goal.toLocaleString()}.
                      </Text>
                    )}
                  </ScrollView>

                  <View style={s.sheetFooter}>
                    <Tap onPress={() => { closeHero(); setTimeout(toCamera, 200); }}>
                      <View style={s.sheetCta}>
                        <Text style={s.sheetCtaText}>Log a meal</Text>
                      </View>
                    </Tap>
                  </View>
                </View>
              </TravelBorder>
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* LEADERBOARD POP-OUT */}
      <Modal visible={boardMounted} transparent animationType="none" onRequestClose={closeBoard}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[s.backdrop, { opacity: board }]}>
            <Pressable style={{ flex: 1 }} onPress={closeBoard} />
          </Animated.View>

          <View style={s.sheetCentre} pointerEvents="box-none">
            <Animated.View
              style={{
                width: "100%",
                maxWidth: 380,
                opacity: board,
                transform: [{ translateY: boardLift }],
              }}
            >
              <TravelBorder {...boardBorder} cardBg={T.bg} borderColor={T.border} radius={26} strokeWidth={2.5}>
                <View style={{ height: SHEET_H }}>

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

                  {!boardBody ? null : howOpen ? (
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

                      <Text style={s.howSmallTitle}>The three boards</Text>
                      <Text style={s.howText}>
                        <Text style={s.howBold}>General</Text> and <Text style={s.howBold}>Regional</Text>{" "}
                        reset every season, so everyone starts level and a newcomer can reach the top.
                        Regional narrows it to your country, which is usually where you'll place highest.
                      </Text>

                      <Text style={[s.howText, { marginTop: 10 }]}>
                        <Text style={s.howBold}>Total</Text> never resets — it adds up every season you've
                        ever played. It rewards sticking around, so people who joined early sit high on it.
                        Your crown there shows the tier you've finished seasons at, and the number is how
                        many times. Finish higher and the crown changes colour, starting the count again.
                      </Text>

                      <View style={s.howDivider} />

                      <Text style={s.howSmallTitle}>What doesn't count</Text>
                      <Text style={s.howText}>
                        Nothing you can buy. Your plan, what you paid, how long you've had the app — none
                        of it affects your rank. Points come from logging and streaks only, so everyone
                        climbs the same ladder.
                      </Text>
                    </ScrollView>
                  ) : (
                    <>
                      <View style={s.sheetScopeRow}>
                        <View style={s.scopeToggle}>
                          {(["General", "Regional", "Total"] as Scope[]).map((sc) => (
                            <Pressable
                              key={sc}
                              onPress={() => pickScope(sc)}
                              style={[s.scopeBtn, { paddingHorizontal: 14, paddingVertical: 6 }, scope === sc && { backgroundColor: T.green }]}
                            >
                              <Text style={[s.scopeText, { fontSize: 12 }, scope === sc && { color: T.ink }]}>{sc}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <Text style={s.sheetSub}>
                        {scope === "General"
                          ? "Top players worldwide · this season"
                          : scope === "Regional"
                            ? "Top in your country · this season"
                            : "All-time · never resets"}
                      </Text>

                      <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8 }}
                        showsVerticalScrollIndicator={false}
                        removeClippedSubviews
                      >
                        {isTotal ? (
                          <>
                            <View style={s.badgeStage}>
                              <SeasonCrown
                                color={isUlt ? "ultimate" : tier.color}
                                count={4}
                                size={92}
                                sequence
                                playKey={crownPlay}
                              />
                              <Text style={s.badgeCaption}>4 seasons finished at {tier.name}</Text>
                            </View>

                            {TOTAL_TOP.map((r) => <TotalRow key={r.rank} r={r} />)}

                            <View style={s.gapRow}>
                              <View style={s.gapLine} />
                              <Text style={s.gapText}>your position</Text>
                              <View style={s.gapLine} />
                            </View>

                            {TOTAL_NEAR.map((r) => <TotalRow key={r.rank} r={r} />)}

                            <Text style={s.chaseText}>
                              12 points behind @tomiwa. That's three days at Ultimate.
                            </Text>
                          </>
                        ) : (
                          BOARD_FULL.map((r) => <BoardRow key={r.rank} r={r} />)
                        )}
                      </ScrollView>

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
    track: { marginTop: 14, borderRadius: 99, backgroundColor: T.track, overflow: "hidden" },
    fillFlat: { height: "100%", borderRadius: 99 },
    eatenLine: { fontSize: 11, color: T.green, fontFamily: FONTS.headingMed },
    toGoLine: { fontSize: 11, color: T.sub, fontFamily: FONTS.headingMed },
    tapHint: { fontSize: 10, color: T.micro, marginTop: 10, textAlign: "center", fontFamily: FONTS.body },

    macroLabel: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.body, marginBottom: 4 },
    macroTrack: { height: 20, borderRadius: 7, backgroundColor: T.track, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: 7, justifyContent: "center", alignItems: "flex-end", minWidth: 30, paddingRight: 7 },
    macroInside: { fontSize: 10.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
    statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
    statNum: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    statLabel: { fontSize: 9, color: T.micro, marginTop: 2, fontFamily: FONTS.body, letterSpacing: 0.6 },
    burnedNote: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 14, lineHeight: 15, textAlign: "center" },

    sheetFooter: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: T.border },
    sheetCta: { backgroundColor: T.green, borderRadius: 14, padding: 14, alignItems: "center" },
    sheetCtaText: { color: T.ink, fontFamily: FONTS.headingMed, fontSize: 14 },

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
    scopeBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
    scopeText: { fontSize: 10.5, color: T.sub, fontFamily: FONTS.headingMed },

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

    totalRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 12, marginBottom: 6 },
    totalRank: { width: 34, fontSize: 12, color: T.sub, fontFamily: FONTS.heading, textAlign: "center" },
    badgeStage: { alignItems: "center", paddingTop: 4, paddingBottom: 10 },
    badgeCaption: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
    gapRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 },
    gapLine: { flex: 1, height: 1, backgroundColor: T.border },
    gapText: { fontSize: 10, color: T.micro, fontFamily: FONTS.body, letterSpacing: 0.6 },
    chaseText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed, textAlign: "center", marginTop: 8 },

    strip: { flexDirection: "row", gap: 10, marginTop: 16 },
    chipCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 13, minHeight: 92 },
    wRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 5 },
    wBig: { fontSize: 19, color: T.text, fontFamily: FONTS.heading },
    wUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    wTrend: { marginLeft: "auto", color: T.green, fontSize: 10, fontFamily: FONTS.headingMed },
    chipNote: { fontSize: 9.5, color: T.sub, marginTop: 4, fontFamily: FONTS.body },

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