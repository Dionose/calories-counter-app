// app/(tabs)/stats.tsx
import { Activity, Check, ChevronLeft, Flame, Footprints, Lock, TrendingDown, Watch } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;
const CONNECTED = true; // toggle to false to preview the "connect your watch" state

const GOAL = 1960;
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

function Micro({ children }: { children: React.ReactNode }) {
  return <Text style={styles.micro}>{children}</Text>;
}

// A card that blurs + locks its content for free users, with a gold lock overlay.
function LockCard({ label, children, onUnlock }: { label: string; children: React.ReactNode; onUnlock: () => void }) {
  return (
    <View style={{ position: "relative" }}>
      <View style={{ opacity: 0.35 }} pointerEvents="none">{children}</View>
      <Pressable onPress={onUnlock} style={styles.lockVeil}>
        <View style={styles.lockBadge}><Lock size={16} color="#0A0A0A" /></View>
        <Text style={styles.lockLabel}>{label}</Text>
        <Text style={styles.lockSub}>Tap to unlock with Pro</Text>
      </Pressable>
    </View>
  );
}

/* ---------- STATS MAIN ---------- */
function StatsMain({ range, setRange, openWeight }: { range: string; setRange: (r: string) => void; openWeight: () => void }) {
  const { freeLocked, openPaywall } = useApp();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.h1}>Stats</Text>

      {/* range toggle */}
      <View style={styles.toggle}>
        {["Week", "Month", "Year"].map((r) => (
          <Pressable key={r} onPress={() => setRange(r)} style={[styles.toggleBtn, range === r && styles.toggleBtnOn]}>
            <Text style={[styles.toggleText, range === r && styles.toggleTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {/* HERO steps */}
      {CONNECTED ? (
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 18 }}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <Footprints size={15} color={T.green} />
                <Micro>Steps · this {range.toLowerCase()}</Micro>
              </View>
              <View style={styles.rowCenter}>
                <Watch size={11} color={T.sub} />
                <Text style={styles.deviceText}>Garmin</Text>
              </View>
            </View>
            <View style={styles.heroNumRow}>
              <Text style={styles.heroNum}>7,820</Text>
              <Text style={styles.heroNumSub}>avg / day</Text>
            </View>
            <View style={styles.chartRow}>
              {STEP_BARS.map((s, i) => (
                <View key={i} style={styles.chartCol}>
                  <Text style={styles.chartValue}>{shortSteps(s)}</Text>
                  <View style={[styles.chartBar, { height: Math.max(4, (s / STEP_MAX) * 70) }]} />
                  <Text style={styles.chartLabel}>{STEP_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <View style={styles.rowCenter}><Flame size={13} color={T.green} /><Text style={styles.heroStatNum}>2,140</Text></View>
                <Micro>Burned</Micro>
              </View>
              <View style={styles.heroStat}>
                <View style={styles.rowCenter}><Activity size={13} color={T.green} /><Text style={styles.heroStatNum}>52</Text></View>
                <Micro>Active min</Micro>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNum}>68</Text>
                <Micro>Avg BPM</Micro>
              </View>
            </View>
          </View>
        </TravelBorder>
      ) : (
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={20}>
          <View style={{ padding: 22, alignItems: "center" }}>
            <View style={styles.connectIcon}><Watch size={24} color={T.green} /></View>
            <Text style={styles.connectTitle}>Connect your watch</Text>
            <Text style={styles.connectSub}>Sync steps, calories burned & heart rate from Apple Watch, Garmin, Samsung</Text>
            <Pressable style={styles.connectBtn}><Text style={styles.connectBtnText}>Connect health data</Text></Pressable>
          </View>
        </TravelBorder>
      )}

      {/* CALORIES vs GOAL */}
      <View style={{ marginTop: 12 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 16 }}>
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <Micro>Calories vs goal</Micro>
              <View style={styles.rowCenter}>
                <TrendingDown size={12} color={T.green} />
                <Text style={styles.trendText}>180 under avg</Text>
              </View>
            </View>
            {CAL_DAYS.map((day, i) => {
              const over = day.v > GOAL;
              const pct = Math.min(100, (day.v / GOAL) * 100);
              return (
                <View key={i} style={[styles.calRow, { marginBottom: i === CAL_DAYS.length - 1 ? 0 : 9 }]}>
                  <Text style={styles.calDay}>{day.d}</Text>
                  <View style={styles.calTrack}>
                    <View style={[styles.calFill, { width: `${pct}%`, backgroundColor: over ? "rgba(239,68,68,0.9)" : T.green }]}>
                      <Text style={[styles.calValue, { color: over ? "#fff" : "#0A0A0A" }]}>
                        {day.v.toLocaleString()} / {GOAL.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={styles.legendRow}>
              <View style={styles.rowCenter}><View style={[styles.dot, { backgroundColor: T.green }]} /><Text style={styles.legendText}>Under goal</Text></View>
              <View style={styles.rowCenter}><View style={[styles.dot, { backgroundColor: "rgba(239,68,68,0.9)" }]} /><Text style={styles.legendText}>Over goal</Text></View>
            </View>
          </View>
        </TravelBorder>
      </View>

      {/* consistency + weight */}
      <View style={styles.twoUp}>
        {/* CONSISTENCY — Pro-locked for free users (blurred) */}
        <View style={{ flex: 1 }}>
          {freeLocked ? (
            <LockCard label="Consistency" onUnlock={() => openPaywall("subscribe")}>
              <TravelBorder color="#FB923C" cardBg={T.card} borderColor={T.border} radius={16}>
                <View style={{ padding: 14 }}>
                  <Micro>Consistency</Micro>
                  <View style={[styles.rowCenter, { marginTop: 6 }]}>
                    <Text style={styles.cardBig}>18</Text>
                    <Flame size={15} color="#FB923C" fill="#FB923C" style={{ marginLeft: "auto" }} />
                  </View>
                  <Text style={styles.cardCaption}>days logged · Ultimate</Text>
                </View>
              </TravelBorder>
            </LockCard>
          ) : (
            <TravelBorder color="#FB923C" cardBg={T.card} borderColor={T.border} radius={16}>
              <View style={{ padding: 14 }}>
                <Micro>Consistency</Micro>
                <View style={[styles.rowCenter, { marginTop: 6 }]}>
                  <Text style={styles.cardBig}>18</Text>
                  <Flame size={15} color="#FB923C" fill="#FB923C" style={{ marginLeft: "auto" }} />
                </View>
                <Text style={styles.cardCaption}>days logged · Ultimate</Text>
              </View>
            </TravelBorder>
          )}
        </View>

        {/* WEIGHT — open for everyone */}
        <Pressable style={{ flex: 1 }} onPress={openWeight}>
          <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={16}>
            <View style={{ padding: 14 }}>
              <View style={styles.rowBetween}>
                <Micro>Weight</Micro>
                <View style={styles.tapBadge}><Text style={styles.tapBadgeText}>TAP TO EDIT</Text></View>
              </View>
              <View style={[styles.rowBase, { marginTop: 6 }]}>
                <Text style={styles.cardBig}>-2.1</Text>
                <Text style={styles.cardUnit}>kg</Text>
              </View>
              <Text style={[styles.cardCaption, { color: T.green }]}>estimated · on track</Text>
            </View>
          </TravelBorder>
        </Pressable>
      </View>

      {/* typical day — steps column is Pro (needs health sync) for free users */}
      <View style={{ marginTop: 12 }}>
        <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
          <View style={{ padding: 16 }}>
            <Micro>Your typical day</Micro>
            <View style={[styles.rowBetween, { marginTop: 12 }]}>
              {[["1,720", "cal"], ["96g", "protein"], ["7,820", "steps"]].map(([v, l], i) => {
                const stepsLocked = freeLocked && l === "steps";
                return (
                  <View key={i} style={styles.typicalCol}>
                    {stepsLocked ? (
                      <Pressable onPress={() => openPaywall("subscribe")} style={{ alignItems: "center" }}>
                        <Lock size={16} color={T.green} />
                        <Text style={[styles.typicalLabel, { marginTop: 4 }]}>{l} · Pro</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Text style={styles.typicalNum}>{v}</Text>
                        <Text style={styles.typicalLabel}>{l}</Text>
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
  const [val, setVal] = useState(76.1);
  const [saved, setSaved] = useState(false);
  const estimated = 78.2;
  const diff = +(val - estimated).toFixed(1);

  const save = () => { setSaved(true); setTimeout(back, 700); };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={back} style={styles.backRow}>
        <ChevronLeft size={22} color={T.text} />
        <Text style={styles.backTitle}>Log your real weight</Text>
      </Pressable>

      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 18 }}>
          <Micro>What we estimated</Micro>
          <View style={[styles.rowBase, { marginTop: 6 }]}>
            <Text style={styles.estNum}>{estimated}</Text>
            <Text style={styles.estSub}>kg (from your plan)</Text>
          </View>
        </View>
      </TravelBorder>

      <Text style={styles.calibHint}>
        Weighed yourself? Enter your real number and we'll calibrate — tracking continues accurately from here.
      </Text>

      <View style={styles.entryCard}>
        <Micro>Your actual weight</Micro>
        <View style={styles.stepRow}>
          <Pressable onPress={() => setVal((v) => +(v - 0.1).toFixed(1))} style={styles.stepBtn}><Text style={styles.stepBtnText}>–</Text></Pressable>
          <View style={styles.rowBase}>
            <Text style={styles.entryNum}>{val.toFixed(1)}</Text>
            <Text style={styles.entryUnit}>kg</Text>
          </View>
          <Pressable onPress={() => setVal((v) => +(v + 0.1).toFixed(1))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+</Text></Pressable>
        </View>
        <Text style={styles.lbsText}>{(val * 2.20462).toFixed(1)} lbs</Text>
      </View>

      <View style={styles.diffCard}>
        <Text style={styles.diffLabel}>Difference from our estimate</Text>
        <Text style={[styles.diffValue, { color: diff < 0 ? T.green : "#EF4444" }]}>{diff} kg</Text>
      </View>

      <Pressable onPress={save} style={[styles.saveBtn, saved && styles.saveBtnDone]}>
        {saved ? (
          <View style={styles.rowCenter}><Check size={17} color={T.green} /><Text style={styles.saveTextDone}>Saved</Text></View>
        ) : (
          <Text style={styles.saveText}>Save & calibrate tracking</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

export default function Stats() {
  const [screen, setScreen] = useState<"stats" | "weight">("stats");
  const [range, setRange] = useState("Week");

  return (
    <View style={styles.screen}>
      {screen === "stats"
        ? <StatsMain range={range} setRange={setRange} openWeight={() => setScreen("weight")} />
        : <WeightEntry back={() => setScreen("stats")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  h1: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, marginBottom: 14 },

  micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBase: { flexDirection: "row", alignItems: "baseline", gap: 5 },

  lockVeil: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 4 },
  lockBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  lockLabel: { fontSize: 12, color: T.text, fontFamily: FONTS.headingMed, marginTop: 2 },
  lockSub: { fontSize: 9, color: T.green, fontFamily: FONTS.headingMed },

  toggle: { flexDirection: "row", gap: 4, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 11, padding: 4, marginBottom: 14 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  toggleBtnOn: { backgroundColor: T.green },
  toggleText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.headingMed },
  toggleTextOn: { color: "#0A0A0A" },

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
  connectBtnText: { color: "#0A0A0A", fontFamily: FONTS.headingMed, fontSize: 13 },

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
  saveText: { color: "#0A0A0A", fontFamily: FONTS.headingMed, fontSize: 14 },
  saveTextDone: { color: T.green, fontFamily: FONTS.headingMed, fontSize: 14 },
});