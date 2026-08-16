// app/(tabs)/stats.tsx
import { Activity, Check, ChevronLeft, Flame, Footprints, Lock, TrendingDown, Watch } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { FONTS } from "../../constants/theme";

const CONNECTED = true; // toggle to false to preview the "connect your watch" state

const CAL_DAYS = [
  { d: "Mon", v: 1500 }, { d: "Tue", v: 1820 }, { d: "Wed", v: 1450 },
  { d: "Thu", v: 2100 }, { d: "Fri", v: 1570 }, { d: "Sat", v: 1880 }, { d: "Sun", v: 1340 },
];
const STEP_BARS = [6200, 8400, 7100, 9800, 5400, 11200, 7820];
const STEP_MAX = 12000;
const STEP_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function shortSteps(n: number): string {
  return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
}

/* ---------- STATS MAIN ---------- */
function StatsMain({ range, setRange, openWeight }: { range: string; setRange: (r: string) => void; openWeight: () => void }) {
  const { T, freeLocked, openPaywall, plan } = useApp();
  const s = styles(T);

  // calorie bars are measured against the user's real daily target
  const GOAL = plan.calories;

  const Micro = ({ children }: { children: React.ReactNode }) => <Text style={s.micro}>{children}</Text>;

  // A card that blurs + locks its content for free users, with a lock overlay.
  const LockCard = ({ label, children, onUnlock }: { label: string; children: React.ReactNode; onUnlock: () => void }) => (
    <View style={{ position: "relative" }}>
      <View style={{ opacity: 0.35 }} pointerEvents="none">{children}</View>
      <Pressable onPress={onUnlock} style={s.lockVeil}>
        <View style={s.lockBadge}><Lock size={16} color={T.ink} /></View>
        <Text style={s.lockLabel}>{label}</Text>
        <Text style={s.lockSub}>Tap to unlock with Pro</Text>
      </Pressable>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.h1}>Stats</Text>

      {/* range toggle */}
      <View style={s.toggle}>
        {["Week", "Month", "Year"].map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[s.toggleBtn, range === r && s.toggleBtnOn]}>
            <Text style={[s.toggleText, range === r && s.toggleTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {/* HERO steps */}
      {CONNECTED ? (
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 18 }}>
            <View style={s.rowBetween}>
              <View style={s.rowCenter}>
                <Footprints size={15} color={T.green} />
                <Micro>Steps · this {range.toLowerCase()}</Micro>
              </View>
              <View style={s.rowCenter}>
                <Watch size={11} color={T.sub} />
                <Text style={s.deviceText}>Garmin</Text>
              </View>
            </View>
            <View style={s.heroNumRow}>
              <Text style={s.heroNum}>7,820</Text>
              <Text style={s.heroNumSub}>avg / day</Text>
            </View>
            <View style={s.chartRow}>
              {STEP_BARS.map((st, i) => (
                <View key={i} style={s.chartCol}>
                  <Text style={s.chartValue}>{shortSteps(st)}</Text>
                  <View style={[s.chartBar, { height: Math.max(4, (st / STEP_MAX) * 70) }]} />
                  <Text style={s.chartLabel}>{STEP_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            <View style={s.heroStatsRow}>
              <View style={s.heroStat}>
                <View style={s.rowCenter}><Flame size={13} color={T.green} /><Text style={s.heroStatNum}>2,140</Text></View>
                <Micro>Burned</Micro>
              </View>
              <View style={s.heroStat}>
                <View style={s.rowCenter}><Activity size={13} color={T.green} /><Text style={s.heroStatNum}>52</Text></View>
                <Micro>Active min</Micro>
              </View>
              <View style={s.heroStat}>
                <Text style={s.heroStatNum}>68</Text>
                <Micro>Avg BPM</Micro>
              </View>
            </View>
          </View>
        </TravelBorder>
      ) : (
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 22, alignItems: "center" }}>
            <View style={s.connectIcon}><Watch size={24} color={T.green} /></View>
            <Text style={s.connectTitle}>Connect your watch</Text>
            <Text style={s.connectSub}>Sync steps, calories burned & heart rate from Apple Watch, Garmin, Samsung</Text>
            <Pressable style={s.connectBtn}><Text style={s.connectBtnText}>Connect health data</Text></Pressable>
          </View>
        </TravelBorder>
      )}

      {/* CALORIES vs GOAL — three-tier: under / a bit over / way over */}
      <View style={{ marginTop: 12 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 16 }}>
            <View style={[s.rowBetween, { marginBottom: 12 }]}>
              <Micro>Calories vs goal</Micro>
              <View style={s.rowCenter}>
                <TrendingDown size={12} color={T.green} />
                <Text style={s.trendText}>180 under avg</Text>
              </View>
            </View>
            {CAL_DAYS.map((day, i) => {
              const over = day.v - GOAL;
              const barColor = over <= 0 ? T.green : over <= 200 ? T.orange : T.red;
              const pct = Math.min(100, (day.v / GOAL) * 100);
              return (
                <View key={i} style={[s.calRow, { marginBottom: i === CAL_DAYS.length - 1 ? 0 : 9 }]}>
                  <Text style={s.calDay}>{day.d}</Text>
                  <View style={s.calTrack}>
                    <View style={[s.calFill, { width: `${pct}%`, backgroundColor: barColor }]}>
                      <Text style={[s.calValue, { color: over > 200 ? "#FFFFFF" : T.ink }]}>
                        {day.v.toLocaleString()} / {GOAL.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={s.legendRow}>
              <View style={s.rowCenter}><View style={[s.dot, { backgroundColor: T.green }]} /><Text style={s.legendText}>Under goal</Text></View>
              <View style={s.rowCenter}><View style={[s.dot, { backgroundColor: T.orange }]} /><Text style={s.legendText}>A bit over</Text></View>
              <View style={s.rowCenter}><View style={[s.dot, { backgroundColor: T.red }]} /><Text style={s.legendText}>Way over</Text></View>
            </View>
          </View>
        </TravelBorder>
      </View>

      {/* consistency + weight */}
      <View style={s.twoUp}>
        {/* CONSISTENCY — Pro-locked for free users (blurred) */}
        <View style={{ flex: 1 }}>
          {freeLocked ? (
            <LockCard label="Consistency" onUnlock={() => openPaywall("subscribe")}>
              <TravelBorder color={T.orange} cardBg={T.card} borderColor={T.border} radius={16}>
                <View style={{ padding: 14 }}>
                  <Micro>Consistency</Micro>
                  <View style={[s.rowCenter, { marginTop: 6 }]}>
                    <Text style={s.cardBig}>18</Text>
                    <Flame size={15} color={T.orange} fill={T.orange} style={{ marginLeft: "auto" }} />
                  </View>
                  <Text style={s.cardCaption}>days logged · Ultimate</Text>
                </View>
              </TravelBorder>
            </LockCard>
          ) : (
            <TravelBorder color={T.orange} cardBg={T.card} borderColor={T.border} radius={16}>
              <View style={{ padding: 14 }}>
                <Micro>Consistency</Micro>
                <View style={[s.rowCenter, { marginTop: 6 }]}>
                  <Text style={s.cardBig}>18</Text>
                  <Flame size={15} color={T.orange} fill={T.orange} style={{ marginLeft: "auto" }} />
                </View>
                <Text style={s.cardCaption}>days logged · Ultimate</Text>
              </View>
            </TravelBorder>
          )}
        </View>

        {/* WEIGHT — open for everyone */}
        <Pressable style={{ flex: 1 }} onPress={openWeight}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
            <View style={{ padding: 14 }}>
              <View style={s.rowBetween}>
                <Micro>Weight</Micro>
                <View style={s.tapBadge}><Text style={s.tapBadgeText}>TAP TO EDIT</Text></View>
              </View>
              <View style={[s.rowBase, { marginTop: 6 }]}>
                <Text style={s.cardBig}>-2.1</Text>
                <Text style={s.cardUnit}>kg</Text>
              </View>
              <Text style={[s.cardCaption, { color: T.green }]}>estimated · on track</Text>
            </View>
          </TravelBorder>
        </Pressable>
      </View>

      {/* typical day — steps column is Pro (needs health sync) for free users */}
      <View style={{ marginTop: 12 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 16 }}>
            <Micro>Your typical day</Micro>
            <View style={[s.rowBetween, { marginTop: 12 }]}>
              {[["1,720", "cal"], ["96g", "protein"], ["7,820", "steps"]].map(([v, l], i) => {
                const stepsLocked = freeLocked && l === "steps";
                return (
                  <View key={i} style={s.typicalCol}>
                    {stepsLocked ? (
                      <Pressable onPress={() => openPaywall("subscribe")} style={{ alignItems: "center" }}>
                        <Lock size={16} color={T.green} />
                        <Text style={[s.typicalLabel, { marginTop: 4 }]}>{l} · Pro</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Text style={s.typicalNum}>{v}</Text>
                        <Text style={s.typicalLabel}>{l}</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </TravelBorder>
      </View>
    </ScrollView>
  );
}

/* ---------- WEIGHT CALIBRATION ---------- */
function WeightEntry({ back }: { back: () => void }) {
  const { T, profile } = useApp();
  const s = styles(T);
  const estimated = profile.startWeight;
  const unit = profile.weightUnit;

  const [val, setVal] = useState(estimated);
  const [saved, setSaved] = useState(false);
  const diff = +(val - estimated).toFixed(1);

  const save = () => { setSaved(true); setTimeout(back, 700); };

  const Micro = ({ children }: { children: React.ReactNode }) => <Text style={s.micro}>{children}</Text>;

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Pressable onPress={back} style={s.backRow}>
        <ChevronLeft size={22} color={T.text} />
        <Text style={s.backTitle}>Log your real weight</Text>
      </Pressable>

      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 18 }}>
          <Micro>What we estimated</Micro>
          <View style={[s.rowBase, { marginTop: 6 }]}>
            <Text style={s.estNum}>{estimated}</Text>
            <Text style={s.estSub}>{unit} (from your plan)</Text>
          </View>
        </View>
      </TravelBorder>

      <Text style={s.calibHint}>
        Weighed yourself? Enter your real number and we'll calibrate — tracking continues accurately from here.
      </Text>

      <View style={s.entryCard}>
        <Micro>Your actual weight</Micro>
        <View style={s.stepRow}>
          <Pressable onPress={() => setVal((v) => +(v - 0.1).toFixed(1))} style={s.stepBtn}><Text style={s.stepBtnText}>–</Text></Pressable>
          <View style={s.rowBase}>
            <Text style={s.entryNum}>{val.toFixed(1)}</Text>
            <Text style={s.entryUnit}>{unit}</Text>
          </View>
          <Pressable onPress={() => setVal((v) => +(v + 0.1).toFixed(1))} style={s.stepBtn}><Text style={s.stepBtnText}>+</Text></Pressable>
        </View>
        <Text style={s.lbsText}>
          {unit === "kg" ? `${(val * 2.20462).toFixed(1)} lbs` : `${(val / 2.20462).toFixed(1)} kg`}
        </Text>
      </View>

      <View style={s.diffCard}>
        <Text style={s.diffLabel}>Difference from our estimate</Text>
        <Text style={[s.diffValue, { color: diff <= 0 ? T.green : T.red }]}>{diff > 0 ? "+" : ""}{diff} {unit}</Text>
      </View>

      <Pressable onPress={save} style={[s.saveBtn, saved && s.saveBtnDone]}>
        {saved ? (
          <View style={s.rowCenter}><Check size={17} color={T.green} /><Text style={s.saveTextDone}>Saved</Text></View>
        ) : (
          <Text style={s.saveText}>Save & calibrate tracking</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default function Stats() {
  const { T } = useApp();
  const [screen, setScreen] = useState<"stats" | "weight">("stats");
  const [range, setRange] = useState("Week");
  const s = styles(T);

  return (
    <View style={s.screen}>
      {screen === "stats"
        ? <StatsMain range={range} setRange={setRange} openWeight={() => setScreen("weight")} />
        : <WeightEntry back={() => setScreen("stats")} />}
    </View>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },
    scroll: { padding: 16, paddingTop: 60, paddingBottom: 40 },
    h1: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, marginBottom: 14 },

    micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowBase: { flexDirection: "row", alignItems: "baseline", gap: 5 },

    lockVeil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 4 },
    lockBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
    lockLabel: { fontSize: 12, color: T.text, fontFamily: FONTS.headingMed, marginTop: 2 },
    lockSub: { fontSize: 9, color: T.green, fontFamily: FONTS.headingMed },

    toggle: { flexDirection: "row", gap: 4, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, padding: 4, marginBottom: 14 },
    toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    toggleBtnOn: { backgroundColor: T.green },
    toggleText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },
    toggleTextOn: { color: T.ink },

    deviceText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },
    heroNumRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
    heroNum: { fontSize: 40, color: T.text, fontFamily: FONTS.heading, letterSpacing: -1 },
    heroNumSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },

    chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 104, marginTop: 14 },
    chartCol: { flex: 1, alignItems: "center", gap: 5 },
    chartValue: { fontSize: 9, color: T.sub, fontFamily: FONTS.heading },
    chartBar: { width: 18, borderRadius: 6, backgroundColor: T.green },
    chartLabel: { fontSize: 9, color: T.micro, fontFamily: FONTS.heading },

    heroStatsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
    heroStat: { alignItems: "center", gap: 3 },
    heroStatNum: { fontSize: 18, color: T.text, fontFamily: FONTS.heading },

    connectIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
    connectTitle: { fontSize: 15, color: T.text, fontFamily: FONTS.headingMed, marginBottom: 4, marginTop: 12 },
    connectSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 18, marginBottom: 14 },
    connectBtn: { backgroundColor: T.green, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 20 },
    connectBtnText: { color: T.ink, fontFamily: FONTS.headingMed, fontSize: 13 },

    trendText: { fontSize: 11, color: T.green, fontFamily: FONTS.heading },
    calRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    calDay: { width: 30, fontSize: 10.5, color: T.sub, fontFamily: FONTS.heading },
    calTrack: { flex: 1, height: 26, borderRadius: 8, backgroundColor: T.track, overflow: "hidden" },
    calFill: { height: "100%", borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 },
    calValue: { fontSize: 11, fontFamily: FONTS.heading },
    legendRow: { flexDirection: "row", gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border },
    dot: { width: 9, height: 9, borderRadius: 3 },
    legendText: { fontSize: 10, color: T.sub, fontFamily: FONTS.body },

    twoUp: { flexDirection: "row", gap: 10, marginTop: 12 },
    cardBig: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
    cardUnit: { fontSize: 11, color: T.sub, fontFamily: FONTS.body },
    cardCaption: { fontSize: 10, color: T.sub, fontFamily: FONTS.body, marginTop: 4 },
    tapBadge: { borderWidth: 1, borderColor: T.greenBorder, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
    tapBadgeText: { fontSize: 8, color: T.green, fontFamily: FONTS.body },

    typicalCol: { flex: 1, alignItems: "center" },
    typicalNum: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
    typicalLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2, textTransform: "uppercase" },

    backRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginLeft: -6 },
    backTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginLeft: 2 },
    estNum: { fontSize: 28, color: T.sub, fontFamily: FONTS.heading },
    estSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    calibHint: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, marginTop: 18, marginBottom: 10, lineHeight: 19 },

    entryCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 20, alignItems: "center" },
    stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 12 },
    stepBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
    stepBtnText: { color: T.text, fontSize: 22, fontFamily: FONTS.heading },
    entryNum: { fontSize: 42, color: T.text, fontFamily: FONTS.heading, letterSpacing: -1 },
    entryUnit: { fontSize: 15, color: T.sub, fontFamily: FONTS.body },
    lbsText: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 10 },

    diffCard: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 14, marginTop: 12, alignItems: "center" },
    diffLabel: { fontSize: 12, color: T.sub, fontFamily: FONTS.body },
    diffValue: { fontSize: 14, fontFamily: FONTS.heading, marginTop: 2 },

    saveBtn: { marginTop: 18, backgroundColor: T.green, borderRadius: 14, padding: 15, alignItems: "center" },
    saveBtnDone: { backgroundColor: T.cardHi },
    saveText: { color: T.ink, fontFamily: FONTS.headingMed, fontSize: 14 },
    saveTextDone: { color: T.green, fontFamily: FONTS.headingMed, fontSize: 14 },
  });