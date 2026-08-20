// components/VoiceCapture.tsx
// Describing a meal out loud.
//
// THE TRANSCRIPT IS OFF BY DEFAULT, and that's the main design decision here.
//
// Dictation makes mistakes — "large green lentils" comes out as "lodge green
// lentils" often enough — and a person watching those errors appear assumes
// the app misheard them and gives up, when the model would have understood it
// perfectly well. Hiding it by default protects people from a problem they
// don't have.
//
// But it's a TOGGLE, not a ban. Some people want to see it, and it's genuinely
// useful for anyone checking how well their accent is handled. When it's on,
// a note sits above it saying the errors don't matter — because they don't.
//
// ON-DEVICE, AND FREE. iOS transcribes locally at no cost, forever. Sending
// audio to Gemini would work too but charges per second of speech for every
// user for the life of the app — and the transcription is the part a phone
// already does well.
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { AlertTriangle, Check, Info, Mic, Type, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import Tap from "./Tap";

/* how long before the recogniser is stopped automatically.

   Not a limit on what someone can say — 45 seconds is far longer than anyone
   spends describing a plate. It's a guard against a phone left listening in a
   pocket, which would run the battery down and eventually send a minute of
   background noise to be parsed as food. */
const MAX_SECONDS = 45;

export default function VoiceCapture({
  visible, meal, onClose, onTranscript,
}: {
  visible: boolean;
  meal: string;
  onClose: () => void;
  /** the finished transcript, handed straight up — the caller sends it to
      Gemini and shows the result */
  onTranscript: (text: string) => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  const [state, setState] = useState<"idle" | "listening" | "denied">("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  /* OFF by default — see the file header. On, it shows live. */
  const [showWords, setShowWords] = useState(false);
  const [live, setLive] = useState("");

  /* the words so far. Kept in a ref as well as state because the ref is what
     gets SENT — state updates are async, and a transcript read from state at
     the moment recognition ends can be a word behind. */
  const words = useRef("");

  const pulse = useRef(new Animated.Value(1)).current;
  const level = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);

  /* ---------- the recogniser's events ---------- */

  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results?.[0]?.transcript;
    if (!said) return;
    words.current = said;
    /* only pay the re-render cost when it's actually on screen */
    if (showWords) setLive(said);
  });

  useSpeechRecognitionEvent("error", (e) => {
    console.log("VOICE recognition error:", e.error, e.message);
    setState("idle");

    /* "no-speech" isn't an error worth alarming anyone about — they tapped
       the mic and said nothing, which is a thing people do */
    if (e.error === "no-speech") {
      setError("MOTION didn't hear anything. Tap the mic and describe your meal.");
      return;
    }
    setError("Something went wrong listening. Try again?");
  });

  useSpeechRecognitionEvent("end", () => {
    setState("idle");
    /* the recogniser has stopped and the final transcript is in. Hand it up
       ONLY if there's something in it — an empty result means they stopped
       before saying anything. */
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
     after the sheet closed is both a battery drain and a privacy problem */
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
         be treated as the end of speech — losing everything said after it. */
      interimResults: true,
      /* keep listening through natural pauses. Someone describing a plate
         thinks between items, and cutting them off mid-thought would produce
         half a meal. */
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={s.screen}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={12} style={s.headBtn}>
            <X size={20} color={T.text} />
          </Pressable>
          <Text style={s.headTitle}>Describe your {meal.toLowerCase()}</Text>
          <Pressable onPress={() => { H.tap(); setShowHelp(true); }} hitSlop={12} style={s.headBtn}>
            <Info size={19} color={T.green} />
          </Pressable>
        </View>

        {/* THE TOGGLE. Off by default, because watching dictation stumble makes
            people think the app is failing when it isn't. On for anyone who
            wants to see it — and for checking how a particular accent fares. */}
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

        <View style={s.body}>
          {state === "denied" ? (
            <>
              <View style={s.deniedIcon}>
                <Mic size={30} color={T.sub} />
              </View>
              <Text style={s.title}>MOTION needs to listen</Text>
              <Text style={s.sub}>
                Turn on Microphone and Speech Recognition in Settings → MOTION, and this'll work.
                {"\n\n"}
                Your phone does the listening itself — the recording never leaves it.
              </Text>
            </>
          ) : state === "listening" ? (
            <>
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

              {!showWords && (
                <Text style={s.hint}>
                  Take your time — MOTION waits through pauses. Say what it was, how it was
                  cooked, and roughly how much.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={s.title}>Say what you ate</Text>
              <Text style={s.sub}>
                "Two scrambled eggs, a slice of toast with butter, and a glass of orange juice."
                {"\n\n"}
                The more you say about how much and how it was cooked, the closer MOTION gets.
              </Text>

              {error ? (
                <View style={s.errRow}>
                  <AlertTriangle size={14} color={T.gold} />
                  <Text style={s.errText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* THE LIVE TRANSCRIPT, when it's switched on.

            The note above it is the important part. Dictation gets words wrong
            — especially with an accent, especially with food names — and
            someone reading their own mangled words assumes the app has failed.
            It hasn't: the model reads through those errors the way a person
            would, and saying so is what makes this safe to show at all. */}
        {showWords && (
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

        {/* the mic */}
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
                  : <Mic size={30} color={T.ink} />}
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

        {/* WHAT TO SAY. The quality of the estimate depends almost entirely on
            how much the person tells us, and most people under-describe until
            they're shown what a good description sounds like. */}
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

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                  <Text style={s.helpSubhead}>Say how much</Text>
                  <Text style={s.helpBody}>
                    "Two eggs" beats "some eggs". "A big bowl of rice" beats "rice". MOTION can't
                    see your plate, so what you say about the amount is all it has.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>Say how it was cooked</Text>
                  <Text style={s.helpBody}>
                    Fried, grilled, boiled, roasted — it changes the calories more than most
                    people expect. Mention oil or butter if there was any.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>Don't forget the sides</Text>
                  <Text style={s.helpBody}>
                    Drinks, sauces, a bit of bread. These are what people leave out, and they add
                    up faster than the main food does.
                  </Text>

                  <View style={s.helpDivider} />

                  <Text style={s.helpSubhead}>Don't worry about how you say it</Text>
                  <Text style={s.helpBody}>
                    Stumble, start again, change your mind — MOTION reads through all of that.
                    You'll see the foods it worked out before anything is logged, so there's
                    nothing to get right the first time.
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
      marginHorizontal: 20, marginBottom: 4,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13, paddingVertical: 8, paddingHorizontal: 13,
    },
    toggleLabel: { flex: 1, fontSize: 12.5, color: T.sub, fontFamily: FONTS.body },

    body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },

    title: { fontSize: 24, color: T.text, fontFamily: FONTS.heading, textAlign: "center" },
    sub: { fontSize: 13, color: T.sub, fontFamily: FONTS.body, textAlign: "center", lineHeight: 20 },

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
    transcriptWrap: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    transcriptNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      backgroundColor: "rgba(251,191,36,0.08)", borderWidth: 1, borderColor: `${T.gold}44`,
      borderRadius: 12, padding: 11,
    },
    transcriptNoteText: { flex: 1, fontSize: 11, color: T.sub, fontFamily: FONTS.body, lineHeight: 16 },
    transcript: {
      maxHeight: 120,
      backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
      borderRadius: 13,
    },
    transcriptText: { fontSize: 13.5, color: T.text, fontFamily: FONTS.body, lineHeight: 20 },
    transcriptEmpty: { fontSize: 12.5, color: T.micro, fontFamily: FONTS.body, fontStyle: "italic" },

    controls: { alignItems: "center", paddingBottom: 44, gap: 14 },
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
    helpBody: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, lineHeight: 18 },
    helpDivider: { height: 1, backgroundColor: T.border, marginVertical: 13 },

    helpBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: T.green, borderRadius: 13, paddingVertical: 13,
    },
    helpBtnText: { fontSize: 14, color: T.ink, fontFamily: FONTS.headingMed },
  });