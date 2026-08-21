// components/WeightChart.tsx
// The weight chart on Stats → Weight, in two sizes.
//
// SMALL — what sits in the card. A glance: your readings, the plan line, the
// newest number. Not interactive beyond opening the big one.
//
// FULL — the whole history, drag to move through time, zoom with the buttons,
// tap any dot to see what you weighed and when. This exists because the year
// view squeezes months of readings into a few hundred pixels, and no amount of
// clever scaling fixes that: the answer is letting people move the window
// themselves.
//
// TWO LINES, deliberately:
//   SOLID GREEN — what you actually weighed. Only real readings, never
//                 interpolated.
//   DASHED GREY — where the plan says you'd be. That's the comparison people
//                 actually want, and it gives even a first reading something
//                 to sit against.
//
// GAPS STAY VISIBLE. Weigh-ins are irregular by nature. Joining two dots a
// fortnight apart with a solid line would draw thirteen days of weight nobody
// measured, so long gaps are faded and dashed.
//
// TAPPING MATCHES ON THE HORIZONTAL ONLY. Requiring the finger to land near
// the dot in BOTH directions made dots almost untappable once zoomed in —
// sideways is easy to aim, height is not, and a 4px dot on a phone is a
// coin-flip. Each reading owns a column of the chart, so a tap anywhere in
// that column picks it. Nobody has ever tapped a chart meaning "the empty
// space above the dot".
//
// GESTURES USE PanResponder, not react-native-gesture-handler. GestureDetector
// needs a GestureHandlerRootView above it, and this component is rendered deep
// inside a Modal — PanResponder has no such requirement.
//
// THE SVG IS pointerEvents="none". Without that, the drawing sits above the
// gesture layer and eats the second finger of a pinch.
import { ChevronLeft, Minus, Plus } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { Dimensions, Modal, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { FONTS } from "../constants/theme";
import { fromKg, WeighIn } from "../constants/weight";

export type ChartRange = "Week" | "Month" | "Year";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const DAY = 86400000;

/* how many days between two readings before the line between them is treated
   as a gap rather than a trend */
const GAP_DAYS = 4;

/* small chart box */
const CHART_H = 168;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 24;

/* the narrowest vertical window. Without it, two readings 0.1 kg apart would
   fill the card and look like a cliff. The full chart uses a tighter floor
   because that's the screen you open to see detail. */
const MIN_SPAN_KG = 2;
const MIN_SPAN_KG_FULL = 1;

/* how far sideways a finger can land from a dot and still pick it. Generous
   on purpose — see the note at the top about matching horizontally only. */
const TAP_RADIUS_X = 46;

/* how much a finger can slide and still count as a tap rather than a drag.
   Nobody taps a phone perfectly still, and the old value of 8 was rejecting
   ordinary taps as drags. */
const TAP_SLOP = 14;

/* roughly how wide a date label prints, plus a little air. Two labels closer
   than this collide — see the date block in FullChart. */
const DATE_LABEL_W = 52;

const MAX_ZOOM = 14;
const ZOOM_STEP = 1.6;

const MSHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DSHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-08-19" → a real local date. Parsed by hand rather than with
    new Date(string), which treats a bare date as UTC and can land on the
    wrong day — the same trap todayLocal() exists to avoid. */
function dayMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${MSHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Tue, Aug 22" — and the year too when it isn't this one, because a reading
    from last March shouldn't look like one from this March */
function longDate(ms: number): string {
  const d = new Date(ms);
  const base = `${DSHORT[d.getDay()]}, ${MSHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** the plan's expected weight at any moment, not just today. Same arithmetic
    as expectedKgToday(), and it CLAMPS at the target — which puts a bend in
    the line the day the plan says you arrive, so it's sampled rather than
    drawn as one straight segment. */
function makeExpectedAt(startKg: number, targetKg: number, paceKgPerWeek: number, signupDate: Date) {
  const losing = targetKg < startKg;
  return (t: number) => {
    const weeks = (t - signupDate.getTime()) / (7 * DAY);
    const moved = paceKgPerWeek * Math.max(0, weeks);
    const projected = losing ? startKg - moved : startKg + moved;
    return losing ? Math.max(targetKg, projected) : Math.min(targetKg, projected);
  };
}

export default function WeightChart({
  T,
  unit,
  entries,
  startKg,
  targetKg,
  paceKgPerWeek,
  signupDate,
  range,
}: {
  T: any;
  unit: "kg" | "lbs";
  /** oldest first, exactly as loadWeighIns returns them */
  entries: WeighIn[];
  startKg: number;
  targetKg: number;
  paceKgPerWeek: number;
  signupDate: Date;
  range: ChartRange;
}) {
  /* the card's width isn't known until it's laid out, and every x position
     depends on it */
  const [w, setW] = useState(0);
  const [fullOpen, setFullOpen] = useState(false);

  const expectedAt = useMemo(
    () => makeExpectedAt(startKg, targetKg, paceKgPerWeek, signupDate),
    [startKg, targetKg, paceKgPerWeek, signupDate]
  );

  const model = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const now = today.getTime();

    const backDays = range === "Week" ? 7 : range === "Month" ? 30 : 365;
    const rangeStart = now - backDays * DAY;

    const all = entries
      .map((e) => ({ t: dayMs(e.measuredOn), kg: e.weightKg }))
      .sort((a, b) => a.t - b.t);

    /* THE RANGE IS A PREFERENCE, NOT A PROMISE. Weight gets logged
       irregularly, so "this week" can easily hold one reading or none. Rather
       than show an empty card, fall back to everything and say so. */
    let points = all.filter((p) => p.t >= rangeStart);
    let widened = false;
    if (points.length < 2 && all.length > points.length) {
      points = all;
      widened = true;
    }

    const oldest = points.length ? points[0].t : rangeStart;
    let xMin = widened ? Math.min(oldest, now - 7 * DAY) : Math.min(rangeStart, oldest);
    const xMax = now;
    if (xMax - xMin < DAY) xMin = xMax - 7 * DAY;

    const SAMPLES = 24;
    const plan = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const t = xMin + ((xMax - xMin) * i) / SAMPLES;
      return { t, kg: expectedAt(t) };
    });

    /* both lines share one scale, or the comparison between them is a lie */
    const kgs = [...points.map((p) => p.kg), ...plan.map((p) => p.kg)];
    let lo = Math.min(...kgs);
    let hi = Math.max(...kgs);

    if (hi - lo < MIN_SPAN_KG) {
      const mid = (hi + lo) / 2;
      lo = mid - MIN_SPAN_KG / 2;
      hi = mid + MIN_SPAN_KG / 2;
    }
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;

    /* the target only earns a line when it's actually in view — a 65 kg target
       drawn on a chart of 78 kg readings would flatten everything else */
    const targetVisible = targetKg > 0 && targetKg >= lo && targetKg <= hi;

    return {
      points,
      plan,
      lo,
      hi,
      xMin,
      xMax,
      widened,
      targetVisible,
      hiddenCount: all.length - points.length,
    };
  }, [entries, targetKg, expectedAt, range]);

  const s = styles(T);

  const plotW = Math.max(1, w - PAD_L - PAD_R);
  const plotH = CHART_H - PAD_T - PAD_B;

  const x = (t: number) =>
    PAD_L + ((t - model.xMin) / Math.max(1, model.xMax - model.xMin)) * plotW;
  const y = (kg: number) =>
    PAD_T + ((model.hi - kg) / Math.max(0.0001, model.hi - model.lo)) * plotH;

  const show = (kg: number) => fromKg(kg, unit);

  const gridKg = [model.hi, (model.hi + model.lo) / 2, model.lo];
  const last = model.points.length ? model.points[model.points.length - 1] : null;

  return (
    <View>
      {/* the whole small chart is one tap target — see the note at the top of
          the file about why the detail lives on its own screen */}
      <Pressable onPress={() => setFullOpen(true)} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={CHART_H}>
            {gridKg.map((kg, i) => (
              <React.Fragment key={`g${i}`}>
                <Line
                  x1={PAD_L}
                  y1={y(kg)}
                  x2={w - PAD_R}
                  y2={y(kg)}
                  stroke={T.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD_L - 6}
                  y={y(kg) + 3}
                  fill={T.micro}
                  fontSize={8.5}
                  fontFamily={FONTS.body}
                  textAnchor="end"
                >
                  {show(kg).toFixed(1)}
                </SvgText>
              </React.Fragment>
            ))}

            {model.targetVisible && (
              <>
                <Line
                  x1={PAD_L}
                  y1={y(targetKg)}
                  x2={w - PAD_R}
                  y2={y(targetKg)}
                  stroke={T.gold}
                  strokeWidth={1}
                  strokeDasharray="1 3"
                  opacity={0.75}
                />
                <SvgText
                  x={w - PAD_R}
                  y={y(targetKg) - 4}
                  fill={T.gold}
                  fontSize={8}
                  fontFamily={FONTS.body}
                  textAnchor="end"
                >
                  target
                </SvgText>
              </>
            )}

            <Polyline
              points={model.plan.map((p) => `${x(p.t)},${y(p.kg)}`).join(" ")}
              fill="none"
              stroke={T.micro}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {model.points.slice(1).map((p, i) => {
              const prev = model.points[i];
              const gap = (p.t - prev.t) / DAY > GAP_DAYS;
              return (
                <Line
                  key={`seg${p.t}`}
                  x1={x(prev.t)}
                  y1={y(prev.kg)}
                  x2={x(p.t)}
                  y2={y(p.kg)}
                  stroke={T.green}
                  strokeWidth={2}
                  opacity={gap ? 0.3 : 1}
                  strokeDasharray={gap ? "3 4" : undefined}
                />
              );
            })}

            {model.points.map((p, i) => {
              const newest = i === model.points.length - 1;
              return (
                <Circle
                  key={`dot${p.t}`}
                  cx={x(p.t)}
                  cy={y(p.kg)}
                  r={newest ? 4.5 : 3}
                  fill={T.green}
                  stroke={newest ? T.bg : undefined}
                  strokeWidth={newest ? 2 : 0}
                />
              );
            })}

            {last && (
              <SvgText
                x={Math.min(x(last.t) + 14, w - PAD_R)}
                y={Math.max(10, y(last.kg) - 9)}
                fill={T.text}
                fontSize={10}
                fontFamily={FONTS.headingMed}
                textAnchor="end"
              >
                {show(last.kg).toFixed(1)}
              </SvgText>
            )}

            <SvgText x={PAD_L} y={CHART_H - 6} fill={T.micro} fontSize={8.5} fontFamily={FONTS.body}>
              {shortDate(model.xMin)}
            </SvgText>
            <SvgText
              x={w - PAD_R}
              y={CHART_H - 6}
              fill={T.micro}
              fontSize={8.5}
              fontFamily={FONTS.body}
              textAnchor="end"
            >
              Today
            </SvgText>
          </Svg>
        )}
      </Pressable>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: T.green }]} />
          <Text style={s.legendText}>Your weigh-ins</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: T.micro }]} />
          <Text style={s.legendText}>Where your plan expects you</Text>
        </View>
      </View>

      {/* the invitation. Without it the big chart is undiscoverable — nothing
          about a small chart says it opens. */}
      <Pressable onPress={() => setFullOpen(true)}>
        <Text style={s.openHint}>
          Tap the chart to explore — zoom in, drag through time, tap any dot to see that weigh-in.
        </Text>
      </Pressable>

      {model.widened && (
        <Text style={s.note}>
          Not enough weigh-ins in this {range.toLowerCase()} — showing everything you've logged.
        </Text>
      )}

      {!model.widened && model.hiddenCount > 0 && (
        <Text style={s.note}>
          {model.hiddenCount} older {model.hiddenCount === 1 ? "weigh-in" : "weigh-ins"} outside this{" "}
          {range.toLowerCase()} — open the chart to see everything.
        </Text>
      )}

      <FullChart
        T={T}
        unit={unit}
        visible={fullOpen}
        onClose={() => setFullOpen(false)}
        entries={entries}
        targetKg={targetKg}
        expectedAt={expectedAt}
      />
    </View>
  );
}

/* ================= THE FULL-SCREEN CHART =================
   Always shows EVERY weigh-in, ignoring the Week/Month/Year buttons. Those
   buttons narrow the card; this screen is where you come to see the lot, and
   hiding readings here would be the opposite of what it's for. */
function FullChart({
  T, unit, visible, onClose, entries, targetKg, expectedAt,
}: {
  T: any;
  unit: "kg" | "lbs";
  visible: boolean;
  onClose: () => void;
  entries: WeighIn[];
  targetKg: number;
  expectedAt: (t: number) => number;
}) {
  const s = styles(T);

  /* zoom and side-to-side position. Refs as well as state because the gesture
     handlers below run outside React's render cycle and need the current
     values without waiting for a re-render. */
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const zoomRef = useRef(1);
  const txRef = useRef(0);
  const startTx = useRef(0);
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const moved = useRef(0);

  /* WHERE THE FINGER FIRST LANDED. Taken at the START of the gesture, not the
     end: by release the finger has drifted, and on some devices the release
     event reports a position relative to a different view entirely — which is
     part of why tapping a dot used to take several goes. */
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const W = SCREEN_W - 24;
  const H = Math.round(SCREEN_H * 0.52);
  const P_L = 44;
  const P_R = 18;
  const P_T = 26;
  const P_B = 34;

  const plotW = W - P_L - P_R;
  const plotH = H - P_T - P_B;

  const model = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const now = today.getTime();

    const points = entries
      .map((e) => ({ t: dayMs(e.measuredOn), kg: e.weightKg }))
      .sort((a, b) => a.t - b.t);

    let xMin = points.length ? points[0].t : now - 30 * DAY;
    const xMax = now;
    /* a little breathing room on the left so the first dot isn't welded to
       the axis */
    xMin -= Math.max(DAY, (xMax - xMin) * 0.04);

    const SAMPLES = 40;
    const plan = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const t = xMin + ((xMax - xMin) * i) / SAMPLES;
      return { t, kg: expectedAt(t) };
    });

    const kgs = [...points.map((p) => p.kg), ...plan.map((p) => p.kg)];
    let lo = kgs.length ? Math.min(...kgs) : 70;
    let hi = kgs.length ? Math.max(...kgs) : 80;

    if (hi - lo < MIN_SPAN_KG_FULL) {
      const mid = (hi + lo) / 2;
      lo = mid - MIN_SPAN_KG_FULL / 2;
      hi = mid + MIN_SPAN_KG_FULL / 2;
    }
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;

    return {
      points,
      plan,
      lo,
      hi,
      xMin,
      xMax,
      targetVisible: targetKg > 0 && targetKg >= lo && targetKg <= hi,
    };
  }, [entries, targetKg, expectedAt]);

  /* x with zoom and drag applied; y never zooms, so the weight scale stays
     readable no matter how far in you go */
  const x = (t: number) =>
    P_L + ((t - model.xMin) / Math.max(1, model.xMax - model.xMin)) * plotW * zoom + tx;
  const y = (kg: number) =>
    P_T + ((model.hi - kg) / Math.max(0.0001, model.hi - model.lo)) * plotH;

  /* the same maths, read straight from the refs. The gesture handlers can't
     use x() above, because that closes over the zoom and tx from the render
     it was created in — stale by the time a finger lifts. */
  const xNow = (t: number) =>
    P_L +
    ((t - model.xMin) / Math.max(1, model.xMax - model.xMin)) * plotW * zoomRef.current +
    txRef.current;

  /* keep the drawing on screen — without this you can fling the chart into
     empty space and have no idea how to get back. At zoom 1 everything fits,
     so this correctly pins it: there is nowhere to scroll to. */
  const clampTx = (v: number, z: number) => {
    const contentW = plotW * z;
    const min = plotW - contentW;
    return Math.max(min, Math.min(0, v));
  };

  /** zoom while keeping whatever is under `anchorX` in place. Zooming about
      the centre would slide the reading you're looking at off screen, which
      is the thing that makes a chart feel like it's fighting you. */
  const applyZoom = (nextZoomRaw: number, anchorX: number) => {
    const z0 = zoomRef.current;
    const z1 = Math.max(1, Math.min(MAX_ZOOM, nextZoomRaw));

    /* where the anchor sits in chart terms, before the zoom */
    const c = (anchorX - P_L - txRef.current) / (plotW * z0);
    const nextTx = clampTx(anchorX - P_L - c * plotW * z1, z1);

    zoomRef.current = z1;
    txRef.current = nextTx;
    setZoom(z1);
    setTx(nextTx);
  };

  /** which reading sits in the column the finger landed in.

      HORIZONTAL DISTANCE ONLY — see the note at the top of the file. */
  const pickAt = (tapX: number) => {
    let bestIndex = -1;
    let bestDist = Infinity;

    model.points.forEach((p, i) => {
      const d = Math.abs(xNow(p.t) - tapX);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });

    return bestIndex >= 0 && bestDist < TAP_RADIUS_X ? bestIndex : null;
  };

  const pan = useRef(
    PanResponder.create({
      /* CAPTURE variants, so the gesture layer claims the touch before any
         child can. Combined with pointerEvents="none" on the Svg, this is
         what lets a two-finger pinch arrive here at all. */
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        startTx.current = txRef.current;
        pinchStart.current = null;
        moved.current = 0;
        downAt.current = {
          x: evt.nativeEvent.locationX,
          y: evt.nativeEvent.locationY,
        };
      },

      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        moved.current = Math.max(moved.current, Math.abs(g.dx) + Math.abs(g.dy));

        /* TWO FINGERS = ZOOM, anchored to the midpoint between them */
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const midX = (touches[0].locationX + touches[1].locationX) / 2;

          if (!pinchStart.current) {
            pinchStart.current = { dist, zoom: zoomRef.current };
            return;
          }

          applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist), midX);
          return;
        }

        /* ONE FINGER = DRAG THROUGH TIME. Does nothing at zoom 1 because the
           whole history already fits — that's why the footer says to zoom in
           first. */
        pinchStart.current = null;
        const next = clampTx(startTx.current + g.dx, zoomRef.current);
        txRef.current = next;
        setTx(next);
      },

      onPanResponderRelease: () => {
        pinchStart.current = null;

        /* a TAP is a gesture that barely moved. TAP_SLOP is generous because
           a real finger always slides a few pixels, and rejecting those as
           drags is what made dots feel unresponsive. */
        const start = downAt.current;
        downAt.current = null;
        if (!start || moved.current > TAP_SLOP) return;

        setPicked(pickAt(start.x));
      },

      onPanResponderTerminate: () => {
        pinchStart.current = null;
        downAt.current = null;
      },
    })
  ).current;

  const showKg = (kg: number) => fromKg(kg, unit);
  const gridKg = [
    model.hi,
    (model.hi * 2 + model.lo) / 3,
    (model.hi + model.lo * 2) / 3,
    model.lo,
  ];
  const chosen = picked != null ? model.points[picked] : null;

  const reset = () => {
    zoomRef.current = 1;
    txRef.current = 0;
    setZoom(1);
    setTx(0);
    setPicked(null);
  };

  /* ---------- WHICH DATES GET A LABEL ----------
     CHOSEN BY SPACE, NOT BY COUNT.

     They used to be picked by position in the list — every Nth reading —
     which says nothing about whether there's room for them: two weigh-ins a
     day apart sit a few pixels apart, both qualified, and both printed on top
     of each other. That's how "Aug 20" and "Aug 21" ended up as one
     unreadable smudge with nothing even selected.

     So this walks left to right and keeps a label only if it clears the last
     one actually placed. Which of two crowded dates survives doesn't matter;
     the axis staying legible does.

     THE TAPPED DATE IS PLACED FIRST and can never be dropped — it's the one
     being read, so it must not be the one that loses.

     A consequence worth knowing: labels are no longer evenly spaced. A dense
     cluster of weigh-ins gets one, a sparse stretch gets several — which is
     honest, because the readings aren't evenly spaced either. */
  const dateLabels = useMemo(() => {
    const out: { i: number; px: number; picked: boolean }[] = [];

    if (picked != null && model.points[picked]) {
      out.push({ i: picked, px: x(model.points[picked].t), picked: true });
    }

    model.points.forEach((p, i) => {
      if (i === picked) return;
      const px = x(p.t);
      /* off the edges — no point measuring something nobody can see */
      if (px < P_L - 20 || px > W - P_R + 20) return;
      if (out.some((l) => Math.abs(l.px - px) < DATE_LABEL_W)) return;
      out.push({ i, px, picked: false });
    });

    return out;
  }, [model.points, picked, zoom, tx]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.fullScreen}>
        <View style={s.fullHead}>
          <Pressable onPress={onClose} hitSlop={14} style={s.fullBack}>
            <ChevronLeft size={22} color={T.text} />
          </Pressable>
          <Text style={s.fullTitle}>Your weigh-ins</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* the reading you tapped, or the instructions when nothing's picked.
            Fixed height so the chart doesn't jump as it appears and clears. */}
        <View style={s.readout}>
          {chosen ? (
            <>
              <Text style={s.readoutWeight}>
                {showKg(chosen.kg).toFixed(1)} <Text style={s.readoutUnit}>{unit}</Text>
              </Text>
              <Text style={s.readoutDate}>{longDate(chosen.t)}</Text>
            </>
          ) : (
            <>
              <Text style={s.readoutIdle}>Tap anywhere above a dot to see that weigh-in</Text>
              <Text style={s.readoutHint}>
                {zoom > 1.05
                  ? "Drag left and right to move through time"
                  : "Use + below to zoom in, then drag"}
              </Text>
            </>
          )}
        </View>

        <View style={s.chartWrap} {...pan.panHandlers}>
          {/* pointerEvents="none" — see the note at the top of the file */}
          <Svg width={W} height={H} pointerEvents="none">
            {gridKg.map((kg, i) => (
              <React.Fragment key={`fg${i}`}>
                <Line x1={P_L} y1={y(kg)} x2={W - P_R} y2={y(kg)} stroke={T.border} strokeWidth={1} />
                <SvgText
                  x={P_L - 8}
                  y={y(kg) + 3.5}
                  fill={T.micro}
                  fontSize={10}
                  fontFamily={FONTS.body}
                  textAnchor="end"
                >
                  {showKg(kg).toFixed(1)}
                </SvgText>
              </React.Fragment>
            ))}

            {/* THE PICKED COLUMN, drawn behind everything. It's what makes
                "tap the column, not the dot" visible rather than a secret. */}
            {picked != null && model.points[picked] && (
              <Rect
                x={x(model.points[picked].t) - 16}
                y={P_T}
                width={32}
                height={plotH}
                fill={T.green}
                opacity={0.08}
                rx={8}
              />
            )}

            {model.targetVisible && (
              <>
                <Line
                  x1={P_L}
                  y1={y(targetKg)}
                  x2={W - P_R}
                  y2={y(targetKg)}
                  stroke={T.gold}
                  strokeWidth={1}
                  strokeDasharray="1 3"
                  opacity={0.8}
                />
                <SvgText
                  x={W - P_R}
                  y={y(targetKg) - 5}
                  fill={T.gold}
                  fontSize={9.5}
                  fontFamily={FONTS.body}
                  textAnchor="end"
                >
                  target {showKg(targetKg).toFixed(1)}
                </SvgText>
              </>
            )}

            <Polyline
              points={model.plan.map((p) => `${x(p.t)},${y(p.kg)}`).join(" ")}
              fill="none"
              stroke={T.micro}
              strokeWidth={1.5}
              strokeDasharray="5 5"
            />

            {model.points.slice(1).map((p, i) => {
              const prev = model.points[i];
              const gap = (p.t - prev.t) / DAY > GAP_DAYS;
              return (
                <Line
                  key={`fseg${p.t}`}
                  x1={x(prev.t)}
                  y1={y(prev.kg)}
                  x2={x(p.t)}
                  y2={y(p.kg)}
                  stroke={T.green}
                  strokeWidth={2.5}
                  opacity={gap ? 0.3 : 1}
                  strokeDasharray={gap ? "4 5" : undefined}
                />
              );
            })}

            {model.points.map((p, i) => {
              const on = i === picked;
              return (
                <React.Fragment key={`fdot${p.t}`}>
                  {on && (
                    <Line
                      x1={x(p.t)}
                      y1={P_T}
                      x2={x(p.t)}
                      y2={P_T + plotH}
                      stroke={T.green}
                      strokeWidth={1}
                      opacity={0.45}
                    />
                  )}
                  <Circle
                    cx={x(p.t)}
                    cy={y(p.kg)}
                    r={on ? 7 : 4.5}
                    fill={T.green}
                    stroke={T.bg}
                    strokeWidth={on ? 3 : 1.5}
                  />
                </React.Fragment>
              );
            })}

            {/* the dates — worked out above, so nothing here can collide */}
            {dateLabels.map(({ i, px, picked: isPicked }) => (
              <SvgText
                key={`fdate${model.points[i].t}`}
                x={px}
                y={H - 12}
                fill={isPicked ? T.green : T.micro}
                fontSize={9.5}
                fontFamily={FONTS.body}
                textAnchor="middle"
              >
                {shortDate(model.points[i].t)}
              </SvgText>
            ))}
          </Svg>
        </View>

        {/* ZOOM BUTTONS. Pinch works on some devices and not others, and a
            chart you can't zoom is a chart you can't read. These always
            work. */}
        <View style={s.zoomRow}>
          <Pressable
            onPress={() => applyZoom(zoomRef.current / ZOOM_STEP, P_L + plotW / 2)}
            style={[s.zoomBtn, zoom <= 1.01 && s.zoomBtnOff]}
            hitSlop={8}
          >
            <Minus size={18} color={zoom <= 1.01 ? T.micro : T.green} />
          </Pressable>

          <Text style={s.zoomLabel}>{zoom > 1.05 ? `${zoom.toFixed(1)}×` : "Full history"}</Text>

          <Pressable
            onPress={() => applyZoom(zoomRef.current * ZOOM_STEP, P_L + plotW / 2)}
            style={[s.zoomBtn, zoom >= MAX_ZOOM - 0.01 && s.zoomBtnOff]}
            hitSlop={8}
          >
            <Plus size={18} color={zoom >= MAX_ZOOM - 0.01 ? T.micro : T.green} />
          </Pressable>
        </View>

        <View style={s.fullFooter}>
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: T.green }]} />
              <Text style={s.legendText}>Your weigh-ins</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: T.micro }]} />
              <Text style={s.legendText}>Where your plan expects you</Text>
            </View>
          </View>

          <Text style={s.fullCount}>
            {model.points.length} {model.points.length === 1 ? "weigh-in" : "weigh-ins"}
          </Text>

          {zoom > 1.05 && (
            <Pressable onPress={reset}>
              <Text style={s.resetText}>Reset the view</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginTop: 10,
      flexWrap: "wrap",
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    swatch: { width: 10, height: 2, borderRadius: 1 },
    legendText: { fontSize: 9.5, color: T.sub, fontFamily: FONTS.body },
    note: {
      fontSize: 10.5,
      color: T.micro,
      fontFamily: FONTS.body,
      marginTop: 8,
      lineHeight: 15,
    },
    openHint: {
      fontSize: 10.5,
      color: T.green,
      fontFamily: FONTS.body,
      marginTop: 10,
      lineHeight: 15,
    },

    /* full screen */
    fullScreen: { flex: 1, backgroundColor: T.bg, paddingTop: 56 },
    fullHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 6 },
    fullBack: {
      width: 34, height: 34, alignItems: "center", justifyContent: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10,
    },
    fullTitle: { flex: 1, textAlign: "center", fontSize: 16, color: T.text, fontFamily: FONTS.heading },

    readout: { height: 62, alignItems: "center", justifyContent: "center" },
    readoutWeight: { fontSize: 30, color: T.text, fontFamily: FONTS.heading },
    readoutUnit: { fontSize: 13, color: T.sub, fontFamily: FONTS.body },
    readoutDate: { fontSize: 11.5, color: T.green, fontFamily: FONTS.headingMed, marginTop: 2 },
    readoutIdle: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
    readoutHint: { fontSize: 10.5, color: T.micro, fontFamily: FONTS.body, marginTop: 4 },

    chartWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },

    zoomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 12 },
    zoomBtn: {
      width: 44, height: 44, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
      backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder,
    },
    zoomBtnOff: { borderColor: T.border, opacity: 0.5 },
    zoomLabel: { fontSize: 12, color: T.sub, fontFamily: FONTS.headingMed, minWidth: 92, textAlign: "center" },

    fullFooter: { paddingHorizontal: 18, paddingTop: 6, alignItems: "center" },
    fullCount: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, marginTop: 10 },
    resetText: { fontSize: 12, color: T.green, fontFamily: FONTS.headingMed, marginTop: 10 },
  });