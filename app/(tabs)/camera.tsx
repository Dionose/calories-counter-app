// app/(tabs)/camera.tsx
import {
    Bookmark,
    Camera as CameraIcon,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Mic,
    Minus,
    Plus,
    ScanBarcode, Search,
    Send,
    Sparkles,
    Utensils,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;
const MEAL = "Lunch"; // placeholder until Home routes a real meal in

function Micro({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.micro, style]}>{children}</Text>;
}
function TopBar({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <Pressable onPress={onBack} style={styles.topBar} hitSlop={10}>
      <ChevronLeft size={22} color={T.text} />
      {title ? <Text style={styles.topTitle}>{title}</Text> : null}
    </Pressable>
  );
}
function FoodImg({ label }: { label?: boolean }) {
  return (
    <View style={styles.foodImg}>
      {!label && <Utensils size={16} color={T.micro} />}
    </View>
  );
}
function Stepper({ value, unitLabel, sub, onDec, onInc }: { value: string; unitLabel: string; sub?: string; onDec: () => void; onInc: () => void }) {
  return (
    <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
      <View style={{ padding: 20, alignItems: "center" }}>
        <Micro>Amount</Micro>
        <View style={styles.stepRow}>
          <Pressable onPress={onDec} style={styles.stepBtn}><Minus size={18} color={T.text} /></Pressable>
          <View style={styles.stepValue}>
            <Text style={styles.stepNum}>{value}</Text>
            <Text style={styles.stepUnit}>{unitLabel}</Text>
          </View>
          <Pressable onPress={onInc} style={styles.stepBtn}><Plus size={18} color={T.text} /></Pressable>
        </View>
        {sub ? <Text style={styles.stepSub}>{sub}</Text> : null}
      </View>
    </TravelBorder>
  );
}

/* ===================== HUB ===================== */
function Hub({ go }: { go: (s: string) => void }) {
  const opts = [
    { I: CameraIcon, t: "Snap a meal", d: "Take a photo, AI estimates it.", g: "AI", s: "snap" },
    { I: ScanBarcode, t: "Scan barcode", d: "Exact facts for packaged food.", g: "Exact", s: "barcode" },
    { I: Search, t: "Search food", d: "Find the exact food + portion.", g: "Exact", s: "search" },
  ];
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.hubTitle}>Log {MEAL.toLowerCase()}</Text>
      <Text style={styles.hubSub}>Adding to <Text style={{ color: T.green }}>{MEAL}</Text>. Choose how:</Text>
      {opts.map((o, i) => (
        <Pressable key={i} onPress={() => go(o.s)} style={styles.hubCard}>
          <View style={styles.hubIcon}><o.I size={24} color={T.green} /></View>
          <View style={{ flex: 1 }}>
            <View style={styles.hubRow}>
              <Text style={styles.hubCardTitle}>{o.t}</Text>
              <View style={styles.tag}><Text style={styles.tagText}>{o.g}</Text></View>
            </View>
            <Text style={styles.hubCardDesc}>{o.d}</Text>
          </View>
          <ChevronRight size={20} color={T.micro} />
        </Pressable>
      ))}
      <Text style={styles.centerHint}>All three work — try each one.</Text>
    </ScrollView>
  );
}

/* ===================== SNAP FLOW ===================== */
function Snap({ back, done }: { back: () => void; done: () => void }) {
  const [step, setStep] = useState<"analyzing" | "result" | "voice" | "recipe" | "improved">("analyzing");

  useEffect(() => {
    if (step === "analyzing") {
      const t = setTimeout(() => setStep("result"), 1400);
      return () => clearTimeout(t);
    }
  }, [step]);

  if (step === "analyzing") {
    return (
      <View style={styles.centerScreen}>
        <Spinner />
        <Text style={styles.centerBig}>Reading the plate…</Text>
      </View>
    );
  }

  if (step === "voice") return <Voice back={() => setStep("result")} done={() => setStep("improved")} />;

  if (step === "recipe") {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopBar onBack={() => setStep("result")} title="Build it yourself" />
        <Text style={styles.hubSub}>Add what you used. We'll estimate the calories.</Text>
        <View style={styles.searchBox}>
          <Search size={17} color={T.micro} />
          <Text style={styles.searchPlaceholder}>Search an ingredient…</Text>
        </View>
        <View style={styles.listCard}>
          {[["Eggs", "5 large", 360], ["Avocado", "1 whole", 240]].map((g, i) => (
            <View key={i} style={[styles.listRow, i ? styles.rowBorder : null]}>
              <View>
                <Text style={styles.listName}>{g[0]}</Text>
                <Text style={styles.listCalGreen}>{g[1]} · ~{g[2]} cal</Text>
              </View>
            </View>
          ))}
        </View>
        <PrimaryBtn label={`Log to ${MEAL}`} onPress={done} />
      </ScrollView>
    );
  }

  const improved = step === "improved";
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={back} />
      <View style={styles.photo}>
        <Text style={styles.photoLabel}>meal photo</Text>
      </View>
      <View style={styles.estRow}>
        <Sparkles size={12} color={improved ? T.green : "#FB923C"} />
        <Text style={[styles.estText, { color: improved ? T.green : "#FB923C" }]}>
          ESTIMATED · {improved ? 91 : 62}% CONFIDENCE
        </Text>
      </View>
      <Text style={styles.foodTitle}>Scrambled eggs & avocado</Text>
      {improved && <Text style={styles.updatedText}>↑ Updated from what you said</Text>}

      <View style={styles.listCard}>
        <View style={styles.calorieHeader}>
          <Micro>Calories</Micro>
          <Text style={styles.calorieBig}>{improved ? 690 : 530}</Text>
        </View>
        {[["Protein", improved ? "38g" : "22g"], ["Carbs", improved ? "12g" : "9g"], ["Fat", improved ? "52g" : "40g"]].map((r, i) => (
          <View key={i} style={[styles.listRow, styles.rowBorder]}>
            <Text style={styles.macroKey}>{r[0]}</Text>
            <Text style={styles.macroVal}>{r[1]}</Text>
          </View>
        ))}
      </View>

      {!improved && (
        <Pressable onPress={() => setStep("voice")} style={styles.voiceCallout}>
          <View style={styles.voiceIcon}><Mic size={20} color="#0A0A0A" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceTitle}>Make it more accurate</Text>
            <Text style={styles.voiceSub}>Tell us how you made it — 20 sec</Text>
          </View>
          <ChevronRight size={18} color={T.green} />
        </Pressable>
      )}

      <Pressable onPress={() => setStep("recipe")} style={styles.recipeCallout}>
        <View style={styles.recipeIcon}><Utensils size={16} color={T.green} /></View>
        <Text style={styles.recipeText}>Or build it from ingredients</Text>
        <ChevronRight size={16} color={T.micro} />
      </Pressable>

      <PrimaryBtn label={`Log to ${MEAL}`} onPress={done} />
    </ScrollView>
  );
}

function Voice({ back, done }: { back: () => void; done: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "sending">("idle");
  const [secs, setSecs] = useState(0);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (state === "recording") {
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } else {
      clearInterval(timer.current);
    }
    return () => clearInterval(timer.current);
  }, [state]);

  useEffect(() => {
    if (state === "sending") {
      const t = setTimeout(done, 1300);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state === "sending") {
    return (
      <View style={styles.centerScreen}>
        <Spinner />
        <Text style={styles.centerBig}>Combining photo + description…</Text>
      </View>
    );
  }

  const fmt = `0:${String(secs).padStart(2, "0")}`;
  return (
    <View style={styles.centerScreen}>
      <View style={{ width: "100%", maxWidth: 300, alignItems: "center" }}>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            {state === "paused" ? "Got it! Add anything else, or send?" : "Tell me how you made this dish — the more detail, the better."}
          </Text>
        </View>
        <Text style={[styles.timer, { opacity: state === "idle" ? 0.3 : 1 }]}>{fmt}</Text>
        <Text style={[styles.recStatus, { color: state === "recording" ? T.green : T.micro }]}>
          {state === "recording" ? "● Recording — you can put your phone down" : state === "paused" ? "Paused" : "Tap the mic to start"}
        </Text>
        <Pressable
          onPress={() => setState(state === "recording" ? "paused" : "recording")}
          style={[styles.micBtn, { backgroundColor: state === "recording" ? T.card : T.green, borderWidth: state === "recording" ? 2 : 0, borderColor: T.green }]}
        >
          {state === "recording" ? <View style={styles.stopSquare} /> : <Mic size={30} color="#0A0A0A" />}
        </Pressable>
        <Text style={styles.micHint}>
          {state === "recording" ? "Tap to pause" : state === "paused" ? "Tap mic to add more" : "Tap to talk"}
        </Text>
        {state === "paused" && (
          <Pressable onPress={() => setState("sending")} style={styles.sendBtn}>
            <Send size={16} color="#0A0A0A" />
            <Text style={styles.sendText}>Done — send to AI</Text>
          </Pressable>
        )}
        <Pressable onPress={back} style={{ marginTop: 12 }}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ===================== BARCODE FLOW ===================== */
function Barcode({ back, done }: { back: () => void; done: () => void }) {
  const [phase, setPhase] = useState<"scanning" | "result">("scanning");
  const [servings, setServings] = useState(1);
  const laser = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === "scanning") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laser, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(laser, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
      const t = setTimeout(() => setPhase("result"), 2200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === "scanning") {
    const translateY = laser.interpolate({ inputRange: [0, 1], outputRange: [6, 138] });
    return (
      <View style={styles.scanScreen}>
        <View style={{ paddingTop: 60, paddingHorizontal: 16 }}>
          <Pressable onPress={back} style={styles.scanBack} hitSlop={10}><ChevronLeft size={20} color="#fff" /></Pressable>
        </View>
        <View style={styles.scanCenter}>
          <Text style={styles.scanHint}>Point at the barcode</Text>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
            <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
            <Animated.View style={[styles.laser, { transform: [{ translateY }] }]} />
          </View>
          <Text style={styles.scanningText}>Scanning…</Text>
        </View>
      </View>
    );
  }

  const cals = 190 * servings;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={back} />
      <View style={styles.estRow}>
        <Check size={13} color={T.green} />
        <Text style={[styles.estText, { color: T.green }]}>EXACT MATCH · FROM BARCODE</Text>
      </View>
      <View style={styles.productRow}>
        <View style={styles.productImg}><ScanBarcode size={26} color={T.sub} /></View>
        <View>
          <Text style={styles.productName}>Greek Yogurt</Text>
          <Text style={styles.productSub}>Chobani · Plain, Non-fat</Text>
          <Text style={styles.productMicro}>1 serving = 170g container</Text>
        </View>
      </View>

      <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
        <View style={{ padding: 18, alignItems: "center" }}>
          <Micro>How many servings?</Micro>
          <View style={styles.stepRow}>
            <Pressable onPress={() => setServings((s) => Math.max(0.5, +(s - 0.5).toFixed(1)))} style={styles.stepBtn}><Minus size={18} color={T.text} /></Pressable>
            <Text style={styles.stepNum}>{servings}</Text>
            <Pressable onPress={() => setServings((s) => +(s + 0.5).toFixed(1))} style={styles.stepBtn}><Plus size={18} color={T.text} /></Pressable>
          </View>
        </View>
      </TravelBorder>

      <View style={styles.totalCard}>
        <View>
          <Micro>Total</Micro>
          <Text style={styles.totalCal}>{cals} <Text style={styles.totalCalUnit}>cal</Text></Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.macroSmall}>P {Math.round(18 * servings)}g</Text>
          <Text style={styles.macroSmall}>C {Math.round(9 * servings)}g</Text>
          <Text style={styles.macroSmall}>F {Math.round(0 * servings)}g</Text>
        </View>
      </View>

      <PrimaryBtn label={`Add to ${MEAL}`} onPress={done} />
    </ScrollView>
  );
}

/* ===================== SEARCH FLOW ===================== */
const RESULTS = [
  { n: "Basmati rice", sub: "cooked", per: 121 },
  { n: "Jasmine rice", sub: "cooked", per: 129 },
  { n: "White rice", sub: "cooked", per: 130 },
  { n: "Brown rice", sub: "cooked", per: 112 },
];
const UNITS = [
  { label: "grams", each: 1, per100: true },
  { label: "cup", each: 158 },
  { label: "scoop", each: 90 },
  { label: "handful", each: 45 },
];

function SearchFlow({ back, done }: { back: () => void; done: () => void }) {
  const [food, setFood] = useState<null | typeof RESULTS[0]>(null);
  const [q, setQ] = useState("rice");
  const [unitIdx, setUnitIdx] = useState(1);
  const [count, setCount] = useState(1);

  if (!food) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TopBar onBack={back} title={`Add to ${MEAL}`} />
        <View style={styles.searchBox}>
          <Search size={17} color={T.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search any food…"
            placeholderTextColor={T.micro}
            style={styles.searchInput}
          />
        </View>

        {q.length === 0 ? (
          <>
            <View style={styles.sectionLabel}>
              <Bookmark size={12} color={T.green} />
              <Micro>Your saved meals</Micro>
            </View>
            <View style={styles.listCard}>
              {[["My morning oats", "Oats, banana, PB", 420], ["Chicken & rice bowl", "Grilled chicken, basmati", 610]].map((m, i) => (
                <View key={i} style={[styles.libRow, i ? styles.rowBorder : null]}>
                  <FoodImg label />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{m[0]}</Text>
                    <Text style={styles.libSub}>{m[1]}</Text>
                  </View>
                  <Text style={styles.libCal}>{m[2]}</Text>
                  <View style={styles.addChip}><Plus size={15} color={T.green} /></View>
                </View>
              ))}
            </View>
            <View style={styles.sectionLabel}>
              <Clock size={12} color={T.sub} />
              <Micro>Recent</Micro>
            </View>
            <View style={styles.listCard}>
              {[["Greek yogurt", "1 cup", 130], ["Banana", "1 medium", 105]].map((m, i) => (
                <View key={i} style={[styles.libRow, i ? styles.rowBorder : null]}>
                  <FoodImg label />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{m[0]}</Text>
                    <Text style={styles.libSub}>{m[1]}</Text>
                  </View>
                  <Text style={styles.libCal}>{m[2]}</Text>
                  <View style={styles.addChip}><Plus size={15} color={T.green} /></View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Micro style={{ marginLeft: 2, marginBottom: 10 }}>{RESULTS.length} matches · pick the exact one</Micro>
            <View style={styles.listCard}>
              {RESULTS.map((r, i) => (
                <Pressable key={i} onPress={() => setFood(r)} style={[styles.libRow, i ? styles.rowBorder : null]}>
                  <FoodImg label />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{r.n}</Text>
                    <Text style={styles.libSub}>{r.sub} · {r.per} cal / 100g</Text>
                  </View>
                  <ChevronRight size={17} color={T.micro} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  const unit = UNITS[unitIdx];
  const grams = unit.per100 ? count : count * unit.each;
  const cals = Math.round(grams * (food.per / 100));
  const stepAmt = unit.per100 ? 10 : 0.5;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={() => setFood(null)} title="How much?" />
      <View style={styles.foodHeaderRow}>
        <FoodImg label />
        <View>
          <Text style={styles.productName}>{food.n}</Text>
          <Text style={styles.productSub}>{food.sub} · {food.per} cal / 100g</Text>
        </View>
      </View>

      <Micro>Measure in</Micro>
      <View style={styles.unitRow}>
        {UNITS.map((u, i) => (
          <Pressable
            key={i}
            onPress={() => { setUnitIdx(i); setCount(u.per100 ? 100 : 1); }}
            style={[styles.unitChip, unitIdx === i ? styles.unitChipOn : null]}
          >
            <Text style={[styles.unitChipText, unitIdx === i ? styles.unitChipTextOn : null]}>{u.label}</Text>
          </Pressable>
        ))}
      </View>

      <Stepper
        value={String(count)}
        unitLabel={unit.per100 ? "g" : unit.label + (count !== 1 ? "s" : "")}
        sub={!unit.per100 ? `≈ ${grams} g` : undefined}
        onDec={() => setCount((c) => Math.max(stepAmt, +(c - stepAmt).toFixed(1)))}
        onInc={() => setCount((c) => +(c + stepAmt).toFixed(1))}
      />

      {!unit.per100 && (
        <View style={styles.handHint}>
          <Text style={{ fontSize: 20 }}>🖐️</Text>
          <Text style={styles.handHintText}>
            Not sure? One {unit.label} ≈ a {unit.label === "cup" ? "closed fist" : unit.label === "scoop" ? "ice-cream scoop" : "cupped hand"}.
          </Text>
        </View>
      )}

      <View style={styles.totalCard}>
        <View>
          <Micro>This portion</Micro>
          <Text style={styles.totalCal}>{cals} <Text style={styles.totalCalUnit}>cal</Text></Text>
        </View>
      </View>

      <PrimaryBtn label={`Add to ${MEAL}`} onPress={done} />
    </ScrollView>
  );
}

/* ===================== shared bits ===================== */
function Spinner() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]} />;
}
function PrimaryBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryBtn}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export default function CameraScreen() {
  const [screen, setScreen] = useState<"hub" | "snap" | "barcode" | "search">("hub");
  const [done, setDone] = useState(false);
  const finish = () => setDone(true);

  if (done) {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successCircle}><Check size={30} color={T.green} /></View>
        <Text style={styles.successText}>Added to {MEAL}!</Text>
        <Pressable onPress={() => { setDone(false); setScreen("hub"); }} style={styles.backToHub}>
          <Text style={styles.backToHubText}>Back to hub</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {screen === "hub" && <Hub go={(s) => setScreen(s as any)} />}
      {screen === "snap" && <Snap back={() => setScreen("hub")} done={finish} />}
      {screen === "barcode" && <Barcode back={() => setScreen("hub")} done={finish} />}
      {screen === "search" && <SearchFlow back={() => setScreen("hub")} done={finish} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: 16, paddingTop: 60, paddingBottom: 40 },

  micro: { fontSize: 9.5, letterSpacing: 1, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase" },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginLeft: -6 },
  topTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed, marginLeft: 2 },

  foodImg: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center" },

  hubTitle: { fontSize: 22, color: T.text, fontFamily: FONTS.heading, marginBottom: 6 },
  hubSub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, marginBottom: 20 },
  hubCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 18, padding: 16, marginBottom: 12 },
  hubIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
  hubRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hubCardTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed },
  hubCardDesc: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, marginTop: 4 },
  tag: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 9, color: T.sub, fontFamily: FONTS.body },
  centerHint: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 14 },

  centerScreen: { flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerBig: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, marginTop: 18, textAlign: "center" },
  spinner: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: T.greenBg, borderTopColor: T.green },

  photo: { height: 140, borderRadius: 16, backgroundColor: "#2E2419", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  photoLabel: { fontSize: 11, color: T.micro, fontFamily: FONTS.body },
  estRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  estText: { fontSize: 10, letterSpacing: 1.2, fontFamily: FONTS.body },
  foodTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, marginBottom: 6 },
  updatedText: { fontSize: 11.5, color: T.green, fontFamily: FONTS.body, marginBottom: 12 },

  listCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden", marginBottom: 14, marginTop: 8 },
  listRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, paddingHorizontal: 15 },
  rowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  listName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },
  listCalGreen: { fontSize: 11, color: T.green, fontFamily: FONTS.heading, marginTop: 3 },
  calorieHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 15 },
  calorieBig: { fontSize: 22, color: T.text, fontFamily: FONTS.heading },
  macroKey: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
  macroVal: { fontSize: 13, color: T.sub, fontFamily: FONTS.heading },

  voiceCallout: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 14, padding: 14, marginBottom: 12 },
  voiceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  voiceTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
  voiceSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  recipeCallout: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderStyle: "dashed", borderRadius: 14, padding: 13, marginBottom: 14 },
  recipeIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
  recipeText: { flex: 1, fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 },
  searchPlaceholder: { fontSize: 13.5, color: T.micro, fontFamily: FONTS.body },
  searchInput: { flex: 1, color: T.text, fontFamily: FONTS.body, fontSize: 14, padding: 0 },

  bubble: { backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 16, padding: 16, marginBottom: 30 },
  bubbleText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 20, textAlign: "center" },
  timer: { fontSize: 30, color: T.text, fontFamily: FONTS.heading, marginBottom: 6 },
  recStatus: { fontSize: 11, fontFamily: FONTS.body, marginBottom: 26, textAlign: "center" },
  micBtn: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  stopSquare: { width: 24, height: 24, borderRadius: 6, backgroundColor: T.green },
  micHint: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 12 },
  sendBtn: { marginTop: 22, width: "100%", backgroundColor: T.green, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sendText: { color: "#0A0A0A", fontFamily: FONTS.headingMed, fontSize: 14 },
  skipText: { fontSize: 12, color: T.micro, fontFamily: FONTS.body },

  scanScreen: { flex: 1, backgroundColor: "#000" },
  scanBack: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, padding: 8 },
  scanCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  scanHint: { color: "rgba(255,255,255,0.7)", fontFamily: FONTS.body, fontSize: 13 },
  scanFrame: { width: 240, height: 150 },
  corner: { position: "absolute", width: 34, height: 34, borderColor: T.green, borderRadius: 4 },
  laser: { position: "absolute", left: 8, right: 8, height: 2, backgroundColor: T.green, shadowColor: T.green, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  scanningText: { color: "rgba(255,255,255,0.4)", fontFamily: FONTS.body, fontSize: 11 },

  productRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
  productImg: { width: 70, height: 70, borderRadius: 14, backgroundColor: "#2E2A3A", alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 17, color: T.text, fontFamily: FONTS.heading },
  productSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },
  productMicro: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 3 },

  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 12 },
  stepBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.cardHi, alignItems: "center", justifyContent: "center" },
  stepValue: { flexDirection: "row", alignItems: "baseline", gap: 6, minWidth: 110, justifyContent: "center" },
  stepNum: { fontSize: 40, color: T.text, fontFamily: FONTS.heading, minWidth: 60, textAlign: "center" },
  stepUnit: { fontSize: 15, color: T.sub, fontFamily: FONTS.body },
  stepSub: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 10 },

  totalCard: { backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 16, padding: 18, marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalCal: { fontSize: 30, color: T.text, fontFamily: FONTS.heading, marginTop: 4 },
  totalCalUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
  macroSmall: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 3 },

  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, marginLeft: 2 },
  libRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  libSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },
  libCal: { fontSize: 12, color: T.green, fontFamily: FONTS.heading, marginRight: 6 },
  addChip: { width: 30, height: 30, borderRadius: 9, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, alignItems: "center", justifyContent: "center" },
  foodHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 20 },
  unitChip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: T.border, backgroundColor: T.card },
  unitChipOn: { borderColor: T.green, backgroundColor: T.greenBg },
  unitChipText: { color: T.sub, fontFamily: FONTS.headingMed, fontSize: 13 },
  unitChipTextOn: { color: T.green },
  handHint: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 13, padding: 12, marginTop: 12 },
  handHintText: { flex: 1, fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 16 },

  primaryBtn: { backgroundColor: T.green, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 18 },
  primaryBtnText: { color: "#0A0A0A", fontFamily: FONTS.headingMed, fontSize: 14 },

  successScreen: { flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 14 },
  successCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed },
  backToHub: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  backToHubText: { color: T.sub, fontFamily: FONTS.body, fontSize: 12 },
});