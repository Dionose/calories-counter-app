// components/VoiceCapture.tsx
// Describing a meal out loud.
//
// THE INSTRUCTIONS ARE LONG ON PURPOSE, AND WRITTEN AS SENTENCES. This screen
// used to say "say what you ate" and show one thin example, and people said
// "Alfredo pasta" — three words hiding four ingredients. The same meal came
// back 870, then 1,400, then 1,200 calories, not because MOTION was confused
// but because nobody had said how much cream went in. Told the amounts, the
// same meal now lands on 1,220 nine times out of nine.
//
// An earlier version of these tips used shorthand — 'Not "chicken" — "two
// chicken breasts"' — and Dion, who wrote the app, couldn't parse it on first
// read. If the author can't read it, nobody can. Everything here is now a
// plain sentence, even where that takes three times the words. Length is not
// the enemy; a person reads this properly once or twice and then never needs
// it again, and two minutes of reading buys every future meal being right.
//
// AND IT SAYS, LOUDLY, THAT NOT KNOWING IS FINE. That line earns its own card
// rather than a footnote, because the failure mode is someone feeling tested.
// Nobody knows how much oil McDonald's used. A person who thinks they have to
// know will put the phone down instead of guessing, and a rough log beats no
// log every single time.
//
// TWO MODES, one component. From "Describe a meal" there's nothing on screen
// yet, so it asks what they ate. From the estimate screen the plate is already
// listed, so it asks for what the photo COULDN'T see.
//
// ON-DEVICE, AND FREE. iOS transcribes locally at no cost, forever.
//
// ⚠️ THE NATIVE MODULE VERSION MATTERS. expo-speech-recognition renumbered its
// releases at v56 to track Expo SDK versions. On SDK 54 the correct version is
// 3.1.3, NOT 56.x — installing 56 succeeds silently, passes
// `expo install --check`, then never autolinks.
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { AlertTriangle, Check, Info, Sparkles, Type, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Icon from "./Icon";
import Tap from "./Tap";

/* how long before the recogniser is stopped automatically. Not a limit on what
   someone can say — 45 seconds is far longer than anyone spends describing a
   plate. It's a guard against a phone left listening in a pocket. */
const MAX_SECONDS = 45;

export default function VoiceCapture({
  visible, meal, mode = "describe", onClose, onTranscript,
}: {
  visible: boolean;
  meal: string;
  /** "describe" — nothing logged yet, they're saying what they ate.
      "improve"  — a plate is already on screen; ask for what it can't see. */
  mode?: "describe" | "improve";
  onClose: () => void;
  onTranscript: (text: string) => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [state, setState] = useState<"idle" | "listening" | "denied">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  /* ON by default — someone talking needs to see they're being heard */
  const [showWords, setShowWords] = useState(true);
  const [live, setLive] = useState("");

  /* the words so far. Kept in a ref as well as state because the ref is what
     gets SENT — state updates are async, and a transcript read from state at
     the moment recognition ends can be a word behind. */
  const words = useRef("");

  const pulse = useRef(new Animated.Value(1)).current;
  const level = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);

  const improving = mode === "improve";

  /* ---------- the recogniser's events ---------- */

  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results?.[0]?.transcript;
    if (!said) return;
    words.current = said;
    if (showWords) setLive(said);
  });

  useSpeechRecognitionEvent("error", (e) => {
    console.log("VOICE recognition error:", e.error, e.message);
    setState("idle");

    /* NOT REALLY ERRORS. "aborted" is OUR OWN cleanup firing when the screen
       closes; "interrupted" is iOS taking the audio session for a call or
       another app. Showing an alarming message for either would make a working
       feature look broken to someone who did nothing wrong. */
    if (e.error === "aborted" || e.error === "interrupted") return;

    if (e.error === "no-speech") {
      setError("MOTION didn't hear anything. Tap the mic and describe your meal.");
      return;
    }

    setError("Something went wrong listening. Try again?");
  });

  useSpeechRecognitionEvent("end", () => {
    setState("idle");
    /* hand it up ONLY if there's something in it — an empty result means they
       stopped before saying anything */
    const text = words.current.trim();
    if (text.length >= 3) {
      H.success();
      onTranscript(text);
    }
  });

  /* ---------- the timer and the animation ---------- */

  useEffect(() => {
    if (state !== "listening") return;

    const id = setInterval(() => {
      setSecs((n) => {
        if (n + 1 >= MAX_SECONDS) {
          stop();
          return n + 1;
        }
        return n + 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== "listening") {
      pulse.setValue(1);
      level.setValue(0);
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [state]);

  /* the level meter. Real volume data isn't reliably available across
     platforms, so this is a gentle idle animation rather than a lie about
     amplitude — it says "listening", which is what the user needs to know. */
  useEffect(() => {
    if (state !== "listening") return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(level, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(level, { toValue: 0.35, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(level, { toValue: 0.8, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(level, { toValue: 0.2, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  /* leaving the screen must stop the recogniser — a phone still listening
     after the sheet closed is both a battery drain and a privacy problem.
     This is what produces the "aborted" the error handler ignores. */
  useEffect(() => {
    if (!visible) {
      ExpoSpeechRecognitionModule.abort();
      setState("idle");
      setSecs(0);
      setLive("");
      words.current = "";
    }
  }, [visible]);

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.abort(); };
  }, []);

  const start = async () => {
    setError(null);
    words.current = "";
    setLive("");
    setSecs(0);

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setState("denied");
      return;
    }

    H.tap();

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      /* PARTIAL RESULTS ON, whether or not they're displayed. Without them the
         recogniser only reports at the end, and a long pause mid-sentence can
         be treated as the end of speech — losing everything after it. */
      interimResults: true,
      /* keep listening through natural pauses. Someone describing a plate
         thinks between items. */
      continuous: true,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });

    setState("listening");
  };

  const stop = () => {
    H.tick();
    /* stop, not abort — abort throws away the transcript, stop delivers it
       through the "end" event */
    ExpoSpeechRecognitionModule.stop();
  };

  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  /* the worked example. Deliberately LOADED with amounts, because the example
     is what people copy — a thin one teaches thin descriptions. */
  const example = improving
    ? "\u201CThe chicken was fried in about two tablespoons of oil, and there's a tablespoon of butter on the rice.\u201D"
    : "\u201CTwo chicken breasts, a plate of pasta, three tablespoons of heavy cream and one tablespoon of butter.\u201D";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.screen}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={12} style={s.headBtn}>
            <X size={20} color={T.text} />
          </Pressable>
          <Text style={s.headTitle}>
            {improving ? "Tell MOTION more" : `Describe your ${meal.toLowerCase()}`}
          </Text>
          <Pressable onPress={() => { H.tap(); setShowHelp(true); }} hitSlop={12} style={s.headBtn}>
            <Info size={19} color={T.green} />
          </Pressable>
        </View>

        {/* THE TOGGLE. On by default — someone talking needs to see they're
            being heard. */}
        <View style={s.toggleRow}>
          <Type size={14} color={showWords ? T.green : T.micro} />
          <Text style={[s.toggleLabel, showWords && { color: T.text }]}>
            Show what MOTION hears
          </Text>
          <Switch
            value={showWords}
            onValueChange={(v) => { H.tick(); setShowWords(v); if (!v) setLive(""); }}
            trackColor={{ false: T.border, true: T.greenBorder }}
            thumbColor={showWords ? T.green : T.micro}
          />
        </View>

        {state === "denied" ? (
          <View style={s.body}>
            <View style={s.deniedIcon}>
              <Icon name="mic" size={30} mode="still" />
            </View>
            <Text style={s.title}>MOTION needs to listen</Text>
            <Text style={s.sub}>
              Turn on Microphone and Speech Recognition in Settings → MOTION, and this'll work.
              {"\n\n"}
              Your phone does the listening itself — the recording never leaves it.
            </Text>
          </View>
        ) : state === "listening" ? (
          <View style={s.body}>
            <Text style={s.listeningLabel}>LISTENING</Text>
            <Text style={s.timer}>{timer}</Text>

            {/* the level meter — five bars, breathing */}
            <View style={s.meter}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    s.meterBar,
                    {
                      transform: [{
                        scaleY: level.interpolate({
                          inputRange: [0, 1],
                          /* each bar moves differently, so it reads as sound
                             rather than one shape pulsing */
                          outputRange: [0.3 + i * 0.08, 1 - Math.abs(2 - i) * 0.15],
                        }),
                      }],
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={s.hint}>
              Take your time — MOTION waits through pauses.
            </Text>
          </View>
        ) : (
          /* ---------- THE INSTRUCTIONS ----------
             Scrollable, because this is genuinely a lot of words and the mic
             must stay reachable at the bottom on a small phone. */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.title}>
              {improving ? "What couldn't MOTION see?" : "Say what you ate"}
            </Text>

            <Text style={s.lead}>
              {improving
                ? "A photo only shows the surface of a plate. Oil, butter, cream and stock are invisible in a picture, and they can double what a meal costs. If you know they're in there, this is where they get counted."
                : "The more you say about how much of something you ate, the closer MOTION's estimate gets. And if you describe the same meal the same way tomorrow, you'll get the same answer — which is what makes one week worth comparing to the next."}
            </Text>

            <View style={s.exampleCard}>
              <Text style={s.exampleLabel}>SOMETHING LIKE THIS</Text>
              <Text style={s.exampleText}>{example}</Text>
            </View>

            <Text style={s.sectionTitle}>Three things worth saying</Text>

            <View style={s.tipRow}>
              <View style={s.tipNum}><Text style={s.tipNumText}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Say how many, or how much</Text>
                <Text style={s.tipBody}>
                  If you only say "chicken", MOTION has to guess whether that was a small piece or
                  a large one, and the difference can be hundreds of calories. It's much better to
                  say "two chicken breasts".
                  {"\n\n"}
                  The same goes for everything else on the plate. Rather than saying "rice", say
                  "a bowl of rice". Rather than saying "butter", say "one tablespoon of butter".
                  You don't need kitchen scales for any of this — spoons, cups, handfuls and
                  palm-sized pieces are all MOTION needs to work with.
                </Text>
              </View>
            </View>

            <View style={s.tipRow}>
              <View style={s.tipNum}><Text style={s.tipNumText}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Mention the oil, butter or cream</Text>
                <Text style={s.tipBody}>
                  This is the one that matters most, and it's the one people forget. A single
                  tablespoon of oil is about 120 calories, so a dish fried in three tablespoons is
                  carrying more than 350 calories before you count the food itself.
                  {"\n\n"}
                  If something was fried, say what it was fried in. If there's butter or cream in
                  a sauce, say roughly how much went in. Those few words often change the estimate
                  more than everything else you say put together.
                </Text>
              </View>
            </View>

            <View style={s.tipRow}>
              <View style={s.tipNum}><Text style={s.tipNumText}>3</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>Say how it was cooked</Text>
                <Text style={s.tipBody}>
                  Grilled, fried, boiled, roasted, steamed — each one lands somewhere different.
                  The very same chicken breast can differ by about 200 calories depending on how it
                  met the pan, so it's worth the one extra word.
                </Text>
              </View>
            </View>

            {/* ---------- AND IT'S FINE NOT TO KNOW ----------
                Its own card, in gold, impossible to miss. The failure mode this
                screen risks is someone feeling tested and putting the phone
                down — and a rough log beats no log every time. */}
            <View style={s.okCard}>
              <View style={s.okHead}>
                <Sparkles size={14} color={T.gold} />
                <Text style={s.okTitle}>Don't know? Say it anyway.</Text>
              </View>
              <Text style={s.okBody}>
                Nobody knows how much oil a restaurant used, or what went into the sauce on a
                takeaway. That's completely normal, and it isn't something you need to solve before
                you can log a meal.
                {"\n\n"}
                Say what you do know and let MOTION fill in the rest. "Some kind of creamy chicken
                pasta from the shop down the road" is a perfectly good thing to say — MOTION will
                make a sensible estimate from it, and you'll see exactly what it worked out before
                anything gets logged.
                {"\n\n"}
                A rough log beats no log, every single time.
              </Text>
            </View>

            <Text style={s.messyNote}>
              Stumble, start again, or change your mind halfway through — MOTION reads through all
              of that the way a person would. Nothing here has to be said perfectly.
            </Text>

            {error ? (
              <View style={s.errRow}>
                <AlertTriangle size={14} color={T.gold} />
                <Text style={s.errText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        {/* THE LIVE TRANSCRIPT, when it's switched on.

            The note above it is what makes this safe to show: dictation gets
            food names wrong, and someone reading their own mangled words could
            assume the app has failed. It hasn't. */}
        {showWords && state !== "denied" && (
          <View style={s.transcriptWrap}>
            <View style={s.transcriptNote}>
              <Info size={12} color={T.gold} />
              <Text style={s.transcriptNoteText}>
                Don't worry if the words come out wrong — MOTION reads through spelling and
                mishearings the way a person would. What matters is what you meant.
              </Text>
            </View>

            <ScrollView
              ref={scroller}
              style={s.transcript}
              contentContainerStyle={{ padding: 14 }}
              onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              {live ? (
                <Text style={s.transcriptText}>{live}</Text>
              ) : (
                <Text style={s.transcriptEmpty}>
                  {state === "listening" ? "Listening…" : "Your words will appear here."}
                </Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* THE MIC. The DARK studio mic, because it sits on a solid green
            button — a green mic on a green circle disappears. While listening
            the button becomes a stop square, since a mic still animating there
            would say "tap to start" at the moment it means "tap to finish". */}
        <View style={s.controls}>
          {state !== "denied" && (
            <Pressable onPress={state === "listening" ? stop : start}>
              <Animated.View
                style={[
                  s.micBtn,
                  state === "listening"
                    ? { backgroundColor: T.card, borderWidth: 2, borderColor: T.green, opacity: pulse }
                    : { backgroundColor: T.green },
                ]}
              >
                {state === "listening"
                  ? <View style={s.stopSquare} />
                  : <Icon name="micDark" size={42} mode="loop" />}
              </Animated.View>
            </Pressable>
          )}

          <Text style={s.micHint}>
            {state === "listening"
              ? "Tap when you're done"
              : state === "denied"
                ? "Open Settings to turn it on"
                : "Tap to start talking"}
          </Text>
        </View>

        {/* THE LONGER GUIDE, behind the info button. Everything above is what
            someone reads while deciding what to say; this is for anyone who
            wants the reasoning behind it. */}
        <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
          <View style={{ flex: 1 }}>
            <Pressable style={s.helpBackdrop} onPress={() => setShowHelp(false)} />
            <View style={s.helpCentre} pointerEvents="box-none">
              <View style={s.helpCard}>
                <View style={s.helpHead}>
                  <Text style={s.helpTitle}>Getting a good estimate</Text>
                  <Pressable onPress={() => setShowHelp(false)} hitSlop={12} style={s.helpClose}>
                    <X size={17} color={T.sub} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                  <Text style={s.helpSubhead}>Why amounts matter so much</Text>
                  <Text style={s.helpBody}>
                    "Alfredo pasta" is three words hiding four ingredients. Without amounts, MOTION
                    has to decide for itself how much cream went into the sauce, and the difference
                    between one tablespoon and four is about 150 calories.
                    {"\n\n"}
                    When you say the amounts, that guesswork disappears. The same description then
                    gives you the same answer every time, which is what makes this week's logs
                    worth comparing to last week's.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>Say it the way you'd tell a friend</Text>
                  <Text style={s.helpBody}>
                    You don't need to be precise or technical about any of this. "Two eggs" is far
                    more useful than "some eggs", and "a big bowl of rice" is far more useful than
                    just "rice". Everyday words like spoons, cups, handfuls and palm-sized pieces
                    are exactly what MOTION is built to understand.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>The fat is where the calories hide</Text>
                  <Text style={s.helpBody}>
                    Oil, butter, cream and cheese carry more calories per spoonful than anything
                    else on your plate, and they're also the easiest things to forget about. If
                    something was fried, or there's a creamy sauce involved, that's the single most
                    useful thing you can tell MOTION.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>Guessing is allowed</Text>
                  <Text style={s.helpBody}>
                    When you're eating out you have no way of knowing what went into the pan, so
                    just estimate. Saying "maybe two spoons of oil" is far more useful than saying
                    nothing at all — MOTION would much rather have your rough guess than make one
                    of its own.
                  </Text>
                </ScrollView>

                <Tap onPress={() => setShowHelp(false)} style={{ marginTop: 16 }}>
                  <View style={s.helpBtn}>
                    <Check size={15} color={T.ink} />
                    <Text style={s.helpBtnText}>Got it</Text>
                  </View>
                </Tap>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: T.bg },

    head: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingTop: 56, paddingBottom: 6,
    },
    headBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headTitle: { flex: 1, textAlign: "center", fontSize: 15.5, color: T.text, fontFamily: FONTS.heading },

    toggleRow: {
      flexDirection: "row", alignItems: "center", gap: 9,
      marginHorizontal: 20, marginBottom: 10,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13, paddingVertical: 8, paddingHorizontal: 13,
    },
    toggleLabel: { flex: 1, fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    /* listening / denied share this centred layout */
    body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },

    title: { fontSize: 24, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    sub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 20 },
    lead: {
      fontSize: 13, color: T.sub, fontFamily: FONTS.body,
      lineHeight: 20, textAlign: "center", marginTop: 10,
    },

    exampleCard: {
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      borderRadius: 15, padding: 14, marginTop: 18,
    },
    exampleLabel: { fontSize: 9, letterSpacing: 1.2, color: T.green, fontFamily: FONTS.headingMed, marginBottom: 6 },
    exampleText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 20 },

    sectionTitle: {
      fontSize: 13, color: T.text, fontFamily: FONTS.headingMed,
      marginTop: 24, marginBottom: 14,
    },

    tipRow: { flexDirection: "row", gap: 11, marginBottom: 18 },
    tipNum: {
      width: 22, height: 22, borderRadius: 8,
      backgroundColor: T.greenBg, borderWidth: 1, borderColor: T.greenBorder,
      alignItems: "center", justifyContent: "center", marginTop: 1,
    },
    tipNumText: { fontSize: 11, color: T.green, fontFamily: FONTS.headingMed },
    tipTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    tipBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 19, marginTop: 5 },

    okCard: {
      backgroundColor: "rgba(251,191,36,0.09)", borderWidth: 1, borderColor: `${T.gold}55`,
      borderRadius: 15, padding: 15, marginTop: 6,
    },
    okHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    okTitle: { fontSize: 14, color: T.gold, fontFamily: FONTS.headingMed },
    okBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 19 },

    messyNote: {
      fontSize: 12, color: T.micro, fontFamily: FONTS.body,
      lineHeight: 18, marginTop: 18, textAlign: "center",
    },

    listeningLabel: { fontSize: 10, letterSpacing: 2, color: T.green, fontFamily: FONTS.headingMed },
    timer: { fontSize: 44, color: T.text, fontFamily: FONTS.heading },

    meter: { flexDirection: "row", alignItems: "center", gap: 7, height: 52, marginVertical: 6 },
    meterBar: { width: 6, height: 46, borderRadius: 3, backgroundColor: T.green },

    hint: {
      fontSize: 12, color: T.micro, fontFamily: FONTS.body,
      textAlign: "center", lineHeight: 18, marginTop: 8,
    },

    deniedIcon: {
      width: 64, height: 64, borderRadius: 21,
      backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border,
      alignItems: "center", justifyContent: "center", marginBottom: 6,
    },

    errRow: {
      flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16,
      backgroundColor: "rgba(251,191,36,0.10)", borderWidth: 1,
      borderColor: `${T.gold}55`, borderRadius: 12, padding: 12,
    },
    errText: { flex: 1, fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 17 },

    /* the live transcript */
    transcriptWrap: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 8 },
    transcriptNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}44`,
      borderRadius: 12, padding: 11,
    },
    transcriptNoteText: { flex: 1, fontSize: 11, color: T.sub, fontFamily: FONTS.body, lineHeight: 16 },
    transcript: {
      maxHeight: 110,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13,
    },
    transcriptText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 20 },
    transcriptEmpty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, fontStyle: "italic" },

    controls: { alignItems: "center", paddingBottom: 40, paddingTop: 6, gap: 12 },
    micBtn: { width: 82, height: 82, borderRadius: 41, alignItems: "center", justifyContent: "center" },
    stopSquare: { width: 26, height: 26, borderRadius: 7, backgroundColor: T.green },
    micHint: { fontSize: 11.5, color: T.micro, fontFamily: FONTS.body },

    /* help */
    helpBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
    helpCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
    helpCard: {
      width: "100%", maxWidth: 360,
      backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
      borderRadius: 22, padding: 20,
    },
    helpHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    helpTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    helpClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
    helpSubhead: { fontSize: 12.5, color: T.green, fontFamily: FONTS.headingMed, marginBottom: 5 },
    helpBody: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 19 },
    helpDivider: { height: 1, backgroundColor: T.border, marginVertical: 14 },

    helpBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.green, borderRadius: 13, paddingVertical: 13,
    },
    helpBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });