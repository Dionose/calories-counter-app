// app/(tabs)/camera.tsx
import LottieView from "lottie-react-native";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Send,
  Sparkles,
  Utensils
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import TravelBorder from "../../components/TravelBorder";
import { useApp } from "../../constants/AppState";
import { DARK, FONTS } from "../../constants/theme";

const T = DARK;
const MEAL = "Lunch"; // placeholder until Home routes a real meal in

// ---- animated Lottie icons (camera + barcode) ----
const ANIM = {
  camera: require("../../assets/motion-camera-green.json"),
  barcode: require("../../assets/motion-barcode-22C55E.json"),
  mic: require("../../assets/motion-mic-dark.json"),
  search: require("../../assets/motion-search-line-green.json"),
  pen: require("../../assets/motion-pen-outline-green.json"),
};
function Anim({ source, size = 26 }: { source: any; size?: number }) {
  return <LottieView source={source} autoPlay loop style={{ width: size, height: size }} />;
}

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

/* ===================== FOOD HISTOGRAM BAR =====================
   Every detected food gets its own left-to-right bar, coloured by the food
   itself, with the macros spelled out inside it. Bar width = share of the
   biggest item's calories (floored so the text always fits). */
type PlateItem = { name: string; color: string; cal: number; p: number; c: number; f: number };

function FoodBar({ item, maxCal }: { item: PlateItem; maxCal: number }) {
  const pct = 62 + (item.cal / maxCal) * 38; // 62%–100%, so macros never clip
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: item.color }]}>
        <View style={styles.barTopRow}>
          <Text style={styles.barName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.barCal}>{item.cal} cal</Text>
        </View>
        <Text style={styles.barMacros} numberOfLines={1}>
          Protein {item.p}g · Carbs {item.c}g · Fat {item.f}g
        </Text>
      </View>
    </View>
  );
}

function MealTotal({ items }: { items: PlateItem[] }) {
  const cal = items.reduce((s, i) => s + i.cal, 0);
  const p = items.reduce((s, i) => s + i.p, 0);
  const c = items.reduce((s, i) => s + i.c, 0);
  const f = items.reduce((s, i) => s + i.f, 0);
  return (
    <TravelBorder color={T.green} cardBg={T.card} borderColor={T.border} radius={18}>
      <View style={{ padding: 18 }}>
        <Micro>Meal total</Micro>
        <Text style={styles.mealTotalCal}>{cal.toLocaleString()} <Text style={styles.mealTotalUnit}>cal</Text></Text>
        <View style={styles.macroTiles}>
          {[["Protein", p, T.green], ["Carbs", c, T.carbs], ["Fat", f, T.fat]].map(([label, v, col]: any, i) => (
            <View key={i} style={styles.macroTile}>
              <Text style={[styles.macroTileNum, { color: col }]}>{v}g</Text>
              <Text style={styles.macroTileLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </TravelBorder>
  );
}

/* ===================== HUB ===================== */
function HubLucide({ icon: Icon }: { icon: any }) {
  if (!Icon) return null;
  return <Icon size={22} color={T.green} />;
}

function Hub({ go }: { go: (s: string) => void }) {
  const opts = [
    { anim: ANIM.camera, icon: null, t: "Snap a meal", d: "Take a photo, AI estimates it.", g: "AI", s: "snap" },
    { anim: ANIM.barcode, icon: null, t: "Scan barcode", d: "Exact facts for packaged food.", g: "Exact", s: "barcode" },
    { anim: ANIM.search, icon: null, t: "Search food", d: "Find the exact food + portion.", g: "Exact", s: "search" },
    { anim: ANIM.pen, icon: null, t: "Log without a photo", d: "Forgot to snap it? We'll estimate it.", g: "Est.", s: "nophoto" },
  ];
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.hubTitle}>Log {MEAL.toLowerCase()}</Text>
      <Text style={styles.hubSub}>Adding to <Text style={{ color: T.green }}>{MEAL}</Text>. Choose how:</Text>
      {opts.map((o, i) => (
        <Pressable key={i} onPress={() => go(o.s)} style={styles.hubCard}>
          <View style={styles.hubIcon}>
            {o.anim ? <Anim source={o.anim} size={o.s === "snap" ? 28 : 26} /> : <HubLucide icon={o.icon} />}
          </View>
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
      <Text style={styles.centerHint}>Every option works — try each one.</Text>
    </ScrollView>
  );
}

/* ===================== SNAP FLOW ===================== */
// What MOTION detected on the plate. Voice refines the numbers, it doesn't
// change the foods — so the same items carry both estimates.
const PLATE_BASE: PlateItem[] = [
  { name: "Scrambled eggs", color: "#FBBF24", cal: 220, p: 18, c: 1, f: 16 },
  { name: "Avocado", color: "#84CC16", cal: 240, p: 3, c: 12, f: 22 },
  { name: "Sourdough toast", color: "#E8C79A", cal: 70, p: 3, c: 13, f: 1 },
];
const PLATE_IMPROVED: PlateItem[] = [
  { name: "Scrambled eggs", color: "#FBBF24", cal: 320, p: 20, c: 1, f: 27 },
  { name: "Avocado", color: "#84CC16", cal: 240, p: 3, c: 12, f: 22 },
  { name: "Sourdough toast", color: "#E8C79A", cal: 130, p: 4, c: 14, f: 7 },
];

function Snap({ back, done }: { back: () => void; done: () => void }) {
  const { freeLocked, openPaywall } = useApp();
  const [step, setStep] = useState<"analyzing" | "result" | "voice" | "improved">("analyzing");

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

  const improved = step === "improved";
  const plate = improved ? PLATE_IMPROVED : PLATE_BASE;
  const maxCal = Math.max(...plate.map((i) => i.cal));

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={back} />

      {/* free-plan snap banner */}
      {freeLocked && (
        <Pressable onPress={() => openPaywall("subscribe")} style={styles.snapBanner}>
          <Text style={styles.snapBannerText}>1 photo left today on the free plan — make it count · Upgrade →</Text>
        </Pressable>
      )}

      <View style={styles.photo}>
        <Text style={styles.photoLabel}>meal photo</Text>
      </View>
      <View style={styles.estRow}>
        <Sparkles size={12} color={T.green} />
        <Text style={[styles.estText, { color: T.green }]}>
          {improved ? "UPDATED WITH YOUR DETAILS" : "MOTION AI ESTIMATE"}
        </Text>
      </View>
      <Text style={styles.foodTitle}>Scrambled eggs & avocado</Text>

      <View style={styles.plateHeader}>
        <Micro>On your plate · {plate.length} items</Micro>
      </View>
      {plate.map((item, i) => (
        <FoodBar key={i} item={item} maxCal={maxCal} />
      ))}

      <View style={{ marginTop: 6 }}>
        <MealTotal items={plate} />
      </View>

      {!improved && (
        <Pressable onPress={() => setStep("voice")} style={[styles.voiceCallout, { marginTop: 14 }]}>
          <View style={styles.voiceIcon}><Anim source={ANIM.mic} size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.voiceTitle}>Make it more accurate</Text>
            <Text style={styles.voiceSub}>Tell Motion how it was made — 20 sec</Text>
          </View>
          <ChevronRight size={18} color={T.green} />
        </Pressable>
      )}

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
            {state === "paused" ? "Got it — add anything else, or send it to Motion." : "Describe what you're eating — the more detail, the more accurate your calories."}
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
          {state === "recording" ? <View style={styles.stopSquare} /> : <Anim source={ANIM.mic} size={36} />}
        </Pressable>
        <Text style={styles.micHint}>
          {state === "recording" ? "Tap to pause" : state === "paused" ? "Tap mic to add more" : "Tap to talk"}
        </Text>
        {state === "paused" && (
          <Pressable onPress={() => setState("sending")} style={styles.sendBtn}>
            <Send size={16} color="#0A0A0A" />
            <Text style={styles.sendText}>Done — send to Motion</Text>
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

  const yogurt: PlateItem = {
    name: "Greek yogurt",
    color: "#F5F0E4",
    cal: Math.round(190 * servings),
    p: Math.round(18 * servings),
    c: Math.round(9 * servings),
    f: 0,
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={back} />
      <View style={styles.estRow}>
        <Check size={13} color={T.green} />
        <Text style={[styles.estText, { color: T.green }]}>EXACT MATCH · FROM BARCODE</Text>
      </View>
      <View style={styles.productRow}>
        <View style={styles.productImg}><Anim source={ANIM.barcode} size={26} /></View>
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

      <View style={{ marginTop: 14 }}>
        <FoodBar item={yogurt} maxCal={yogurt.cal} />
      </View>

      <View style={{ marginTop: 6 }}>
        <MealTotal items={[yogurt]} />
      </View>

      <PrimaryBtn label={`Add to ${MEAL}`} onPress={done} />
    </ScrollView>
  );
}

/* ===================== SEARCH DATA (shared by search + no-photo) ===================== */
const RESULTS = [
  { n: "Basmati rice", sub: "cooked", per: 121, color: "#EFE7CE" },
  { n: "Jasmine rice", sub: "cooked", per: 129, color: "#EFE7CE" },
  { n: "White rice", sub: "cooked", per: 130, color: "#DBCBA0" },
  { n: "Brown rice", sub: "cooked", per: 112, color: "#C9AE7B" },
];
const UNITS = [
  { label: "grams", each: 1, per100: true },
  { label: "piece", each: 50 },
  { label: "cup", each: 158 },
  { label: "scoop", each: 90 },
  { label: "handful", each: 45 },
];

function SearchFlow({ back, done }: { back: () => void; done: () => void }) {
  const [food, setFood] = useState<null | typeof RESULTS[0]>(null);
  const [q, setQ] = useState("rice");
  const [unitIdx, setUnitIdx] = useState(2);
  const [count, setCount] = useState(1);

  if (!food) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TopBar onBack={back} title={`Add to ${MEAL}`} />
        <View style={styles.searchBox}>
          <Anim source={ANIM.search} size={22} />
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
                  <View style={[styles.swatch, { backgroundColor: r.color }]} />
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
  const stepAmt = unit.per100 ? 10 : 1;
  const item: PlateItem = {
    name: food.n,
    color: food.color,
    cal: cals,
    p: Math.round(grams * 0.027),
    c: Math.round(grams * 0.28),
    f: Math.round(grams * 0.003),
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={() => setFood(null)} title="How much?" />
      <View style={styles.foodHeaderRow}>
        <View style={[styles.swatchBig, { backgroundColor: food.color }]} />
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

      <View style={{ marginTop: 14 }}>
        <FoodBar item={item} maxCal={item.cal} />
      </View>

      <View style={{ marginTop: 6 }}>
        <MealTotal items={[item]} />
      </View>

      <PrimaryBtn label={`Add to ${MEAL}`} onPress={done} />
    </ScrollView>
  );
}

/* ===================== NO-PHOTO (log without a photo) ===================== */
// Simple version: search → pick → amount → log. (Running-plate builder comes later.)
function NoPhotoFlow({ back, done }: { back: () => void; done: () => void }) {
  const [food, setFood] = useState<null | typeof RESULTS[0]>(null);
  const [q, setQ] = useState("");
  const [unitIdx, setUnitIdx] = useState(2);
  const [count, setCount] = useState(1);

  if (!food) {
    const shown = q.length === 0 ? RESULTS : RESULTS.filter((r) => r.n.toLowerCase().includes(q.toLowerCase()));
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TopBar onBack={back} title="Log without a photo" />
        <Text style={styles.hubSub}>Forgot to snap it? Log it here and we'll do our best to estimate the calories.</Text>
        <View style={styles.searchBox}>
          <Anim source={ANIM.search} size={22} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="What did you eat?"
            placeholderTextColor={T.micro}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.listCard}>
          {shown.map((r, i) => (
            <Pressable key={i} onPress={() => setFood(r)} style={[styles.libRow, i ? styles.rowBorder : null]}>
              <View style={[styles.swatch, { backgroundColor: r.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{r.n}</Text>
                <Text style={styles.libSub}>{r.sub} · {r.per} cal / 100g</Text>
              </View>
              <ChevronRight size={17} color={T.micro} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  const unit = UNITS[unitIdx];
  const grams = unit.per100 ? count : count * unit.each;
  const cals = Math.round(grams * (food.per / 100));
  const stepAmt = unit.per100 ? 10 : 1;
  const item: PlateItem = {
    name: food.n,
    color: food.color,
    cal: cals,
    p: Math.round(grams * 0.027),
    c: Math.round(grams * 0.28),
    f: Math.round(grams * 0.003),
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <TopBar onBack={() => setFood(null)} title="How much?" />
      <View style={styles.foodHeaderRow}>
        <View style={[styles.swatchBig, { backgroundColor: food.color }]} />
        <View>
          <Text style={styles.productName}>{food.n}</Text>
          <Text style={styles.productSub}>{food.sub} · {food.per} cal / 100g</Text>
        </View>
      </View>

      <Micro>Measure in</Micro>
      <View style={styles.unitRow}>
        {UNITS.map((u, i) => (
          <Pressable key={i} onPress={() => { setUnitIdx(i); setCount(u.per100 ? 100 : 1); }} style={[styles.unitChip, unitIdx === i ? styles.unitChipOn : null]}>
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

      <View style={{ marginTop: 14 }}>
        <FoodBar item={item} maxCal={item.cal} />
      </View>

      <View style={{ marginTop: 6 }}>
        <MealTotal items={[item]} />
      </View>

      <PrimaryBtn label={`Log to ${MEAL}`} onPress={done} />
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
  const [screen, setScreen] = useState<"hub" | "snap" | "barcode" | "search" | "nophoto">("hub");
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
      {screen === "nophoto" && <NoPhotoFlow back={() => setScreen("hub")} done={finish} />}
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
  swatch: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  swatchBig: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },

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

  snapBanner: { backgroundColor: "rgba(251,191,36,0.12)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)", borderRadius: 12, padding: 12, marginBottom: 14 },
  snapBannerText: { fontSize: 11.5, color: "#FBBF24", fontFamily: FONTS.headingMed, textAlign: "center" },

  centerScreen: { flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerBig: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed, marginTop: 18, textAlign: "center" },
  spinner: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: T.greenBg, borderTopColor: T.green },

  photo: { height: 140, borderRadius: 16, backgroundColor: "#2E2419", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  photoLabel: { fontSize: 11, color: T.micro, fontFamily: FONTS.body },
  estRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  estText: { fontSize: 10, letterSpacing: 1.2, fontFamily: FONTS.body },
  foodTitle: { fontSize: 19, color: T.text, fontFamily: FONTS.heading, marginBottom: 6 },

  // food histogram bars
  plateHeader: { marginTop: 10, marginBottom: 10, marginLeft: 2 },
  barTrack: { backgroundColor: T.track, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  barFill: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "center" },
  barTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  barName: { flex: 1, fontSize: 13.5, color: "#0A0A0A", fontFamily: FONTS.headingMed },
  barCal: { fontSize: 12.5, color: "#0A0A0A", fontFamily: FONTS.heading },
  barMacros: { fontSize: 10, color: "rgba(10,10,10,0.72)", fontFamily: FONTS.body, marginTop: 3 },

  mealTotalCal: { fontSize: 30, color: T.text, fontFamily: FONTS.heading, marginTop: 4 },
  mealTotalUnit: { fontSize: 14, color: T.sub, fontFamily: FONTS.body },
  macroTiles: { flexDirection: "row", gap: 8, marginTop: 14 },
  macroTile: { flex: 1, backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  macroTileNum: { fontSize: 16, fontFamily: FONTS.heading },
  macroTileLabel: { fontSize: 9.5, color: T.micro, fontFamily: FONTS.body, marginTop: 2, textTransform: "uppercase" },

  listCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden", marginBottom: 14, marginTop: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  listName: { fontSize: 14, color: T.text, fontFamily: FONTS.headingMed },

  voiceCallout: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 14, padding: 14, marginBottom: 12 },
  voiceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },
  voiceTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
  voiceSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 2 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 },
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

  primaryBtn: { backgroundColor: T.green, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 18 },
  primaryBtnText: { color: "#0A0A0A", fontFamily: FONTS.headingMed, fontSize: 14 },

  successScreen: { flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 14 },
  successCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 16, color: T.text, fontFamily: FONTS.headingMed },
  backToHub: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  backToHubText: { color: T.sub, fontFamily: FONTS.body, fontSize: 12 },
});