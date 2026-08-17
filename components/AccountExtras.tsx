// components/AccountExtras.tsx
// The last three Account rows: Support (with the AI chat), Privacy, and the
// Log out sheet. Grouped because they're the tail of one section and none is
// big enough to own a file.
import { Bot, ChevronDown, Download, LogOut, Mail, Send, Shield, Trash2 } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../constants/AppState";
import * as H from "../constants/haptics";
import { FONTS } from "../constants/theme";
import BackRow from "./BackRow";
import Tap from "./Tap";

/* ================= SUPPORT ================= */
const FAQS = [
  {
    q: "How does MOTION count calories from a photo?",
    a: "Snap your meal and MOTION AI estimates the foods plus their calories and macros. You can adjust anything before it's logged.",
  },
  {
    q: "Is my data private?",
    a: "Yes — we never sell your data or hand it to advertisers. The Privacy section has the full, plain-language rundown.",
  },
  {
    q: "What do I get with Pro?",
    a: "A 3-day free trial unlocks everything. After that, Pro keeps the premium features — Motion Voice AI, barcode scan, smartwatch sync and leaderboard ranking.",
  },
  {
    q: "How does my streak work?",
    a: "Log at least one meal each day to keep it alive. The longer it runs, the higher your tier climbs, and the more each day is worth on the leaderboard.",
  },
  {
    q: "Why did my daily target change?",
    a: "Changing your goal, pace or activity in Profile → Goals rebuilds it from your body. If you asked for burned calories to be added back, training days will also show a higher number on Home.",
  },
];

export function SupportScreen({ onBack, onChat }: { onBack: () => void; onChat: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const [open, setOpen] = useState(-1);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Support" onBack={onBack} />
      <Text style={s.note}>
        We're here to help — chat with MOTION AI any time, email us, or check the common questions below.
      </Text>

      {/* the AI chat is the primary route */}
      <Tap onPress={() => { H.tap(); onChat(); }}>
        <View style={s.aiCard}>
          <View style={s.aiRow}>
            <View style={s.aiIcon}>
              <Bot size={22} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.aiTitle}>MOTION AI Support</Text>
              <Text style={s.aiSub}>Available 24/7 · instant answers about the app, your plan & logging</Text>
            </View>
          </View>
          <View style={s.aiCta}>
            <Text style={s.aiCtaText}>Start a chat</Text>
          </View>
        </View>
      </Tap>

      <View style={s.emailCard}>
        <View style={s.smallIcon}>
          <Mail size={16} color={T.green} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.emailTitle}>Email us</Text>
          <Text style={s.emailSub}>support@motion.app · we reply within a day</Text>
        </View>
      </View>

      <Text style={s.sectionLabel}>Common questions</Text>
      <View style={s.group}>
        {FAQS.map((f, i) => {
          const on = open === i;
          return (
            <View key={i}>
              {i > 0 && <View style={s.divider} />}
              <Tap onPress={() => { H.tap(); setOpen(on ? -1 : i); }}>
                <View style={s.faqRow}>
                  <Text style={[s.faqQ, on && { color: T.green }]}>{f.q}</Text>
                  <ChevronDown
                    size={16}
                    color={on ? T.green : T.micro}
                    style={{ transform: [{ rotate: on ? "180deg" : "0deg" }] }}
                  />
                </View>
              </Tap>
              {on && (
                <View style={s.faqBody}>
                  <Text style={s.faqA}>{f.a}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/* ================= SUPPORT CHAT ================= */
type Msg = { from: "ai" | "me"; text: string };

export function SupportChat({ onBack }: { onBack: () => void }) {
  const { T } = useApp();
  const s = styles(T);
  const listRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "ai",
      text: "Hi! I'm MOTION's AI assistant. Ask me anything about logging meals, your plan, streaks, or your subscription.",
    },
  ]);

  /* Placeholder replies until the real assistant is wired at backend phase.
     The typing pause is deliberate — an instant reply reads as canned. */
  const send = () => {
    const q = input.trim();
    if (!q) return;
    H.tap();
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          from: "ai",
          text: "Thanks for reaching out. The full assistant isn't connected yet — once it is, it'll answer here instantly. In the meantime you can email support@motion.app and we'll reply within a day.",
        },
      ]);
    }, 900);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 56 }}>
        <BackRow title="MOTION AI · 24/7" onBack={onBack} />
      </View>

      <ScrollView
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {msgs.map((m, i) => (
          <View key={i} style={[s.bubble, m.from === "me" ? s.bubbleMe : s.bubbleAi]}>
            <Text style={[s.bubbleText, m.from === "me" && { color: T.ink }]}>{m.text}</Text>
          </View>
        ))}

        {typing && (
          <View style={[s.bubble, s.bubbleAi, s.typing]}>
            <Text style={s.typingText}>MOTION AI is typing…</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          placeholder="Ask MOTION AI…"
          placeholderTextColor={T.micro}
          style={s.composerInput}
          returnKeyType="send"
        />
        <Pressable onPress={send} style={[s.sendBtn, !input.trim() && { opacity: 0.4 }]} hitSlop={8}>
          <Send size={17} color={T.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ================= PRIVACY ================= */
export function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { T } = useApp();
  const s = styles(T);

  const P = (t: string, k: string) => <Text key={k} style={s.pText}>{t}</Text>;
  const HEAD = (t: string, k: string) => <Text key={k} style={s.pHead}>{t}</Text>;

  return (
    <ScrollView contentContainerStyle={s.page}>
      <BackRow title="Privacy" onBack={onBack} />

      <View style={s.privHead}>
        <Shield size={16} color={T.green} />
        <Text style={s.privTitle}>Your privacy at MOTION</Text>
      </View>

      {P("Your health is personal, and we treat your data that way. Here's a plain-language summary of what we collect, what we never do with it, and the control you keep at all times.", "intro")}

      {HEAD("What we collect", "h1")}
      {P("Only what MOTION needs to work for you: the meals and foods you log, your goals, your weight entries, and — if you turn it on — activity data from your connected watch or your phone's health hub. Nothing more.", "p1")}

      {HEAD("Your food photos", "h2")}
      {P("When you snap a meal, the photo is used to estimate your food and is processed securely. We don't publish your photos, we don't tie them to your identity for anyone else, and we don't use them to recognise or track you.", "p2")}

      {HEAD("What we will never do", "h3")}
      {P("We will never sell your data. We will never hand your personal information to advertisers or data brokers, and we don't build an advertising profile of you. Your meals, your weight, and your health information are not shared with third parties to market to you.", "p3")}
      {P("We don't post anything on your behalf, and nothing about your account is public unless you choose it — for example, the leaderboard, where only your username is ever shown, never your real name and never your numbers.", "p4")}

      {HEAD("Who can see your data", "h4")}
      {P("You. If you connect a coach, they see only what that feature explicitly shares — your username and the progress you agree to share — never your login, your email, or anything you keep private.", "p5")}

      {HEAD("You're in control", "h5")}
      {P("You can export everything you've logged whenever you like, and you can permanently delete your account and all its data from this screen. Deletion is final — we don't keep a shadow copy.", "p6")}

      <View style={s.group}>
        <Tap onPress={() => H.tap()}>
          <View style={s.privRow}>
            <View style={s.smallIcon}>
              <Download size={15} color={T.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.privRowTitle}>Export my data</Text>
              <Text style={s.privRowSub}>Everything you've logged, as a file</Text>
            </View>
          </View>
        </Tap>

        <View style={s.divider} />

        <Tap onPress={() => H.warn()}>
          <View style={s.privRow}>
            <View style={[s.smallIcon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              <Trash2 size={15} color={T.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.privRowTitle, { color: T.red }]}>Delete my account</Text>
              <Text style={s.privRowSub}>Permanent — this can't be undone</Text>
            </View>
          </View>
        </Tap>
      </View>

      <Text style={s.privFoot}>
        Questions about any of this? Support → MOTION AI, or email support@motion.app.
      </Text>
    </ScrollView>
  );
}

/* ================= LOG OUT ================= */
export function LogoutSheet({
  visible, onCancel, onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { T } = useApp();
  const s = styles(T);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.sheet}>
          <View style={s.grabber} />

          <View style={{ alignItems: "center", marginBottom: 18 }}>
            <View style={s.logoutIcon}>
              <LogOut size={20} color={T.red} />
            </View>
            <Text style={s.logoutTitle}>Log out of MOTION?</Text>
            <Text style={s.logoutSub}>You'll need to sign back in to pick up where you left off.</Text>
          </View>

          <Tap onPress={() => { H.warn(); onConfirm(); }}>
            <View style={s.logoutBtn}>
              <Text style={s.logoutBtnText}>Log out</Text>
            </View>
          </Tap>

          <Tap onPress={onCancel} style={{ marginTop: 10 }}>
            <View style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </View>
          </Tap>
        </View>
      </View>
    </Modal>
  );
}

const styles = (T: any) =>
  StyleSheet.create({
    page: { padding: 16, paddingTop: 56, paddingBottom: 40 },
    note: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5, marginBottom: 16 },
    sectionLabel: { fontSize: 10, letterSpacing: 1.2, color: T.micro, fontFamily: FONTS.body, textTransform: "uppercase", marginLeft: 4, marginTop: 22, marginBottom: 8 },
    group: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden", marginTop: 14 },
    divider: { height: 1, backgroundColor: T.border, marginLeft: 14 },
    smallIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },

    /* support */
    aiCard: { backgroundColor: T.card, borderWidth: 1, borderColor: T.greenBorder, borderRadius: 16, padding: 16 },
    aiRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    aiIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: T.greenBg, alignItems: "center", justifyContent: "center" },
    aiTitle: { fontSize: 14.5, color: T.text, fontFamily: FONTS.heading },
    aiSub: { fontSize: 11, color: T.sub, fontFamily: FONTS.body, marginTop: 2, lineHeight: 15 },
    aiCta: { marginTop: 12, backgroundColor: T.green, borderRadius: 11, paddingVertical: 11, alignItems: "center" },
    aiCtaText: { fontSize: 13.5, color: T.ink, fontFamily: FONTS.headingMed },

    emailCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, marginTop: 12 },
    emailTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    emailSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 1 },

    faqRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14 },
    faqQ: { flex: 1, fontSize: 13, color: T.text, fontFamily: FONTS.headingMed, lineHeight: 18 },
    faqBody: { paddingHorizontal: 14, paddingBottom: 14, marginTop: -2 },
    faqA: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 18.5 },

    /* chat */
    bubble: { maxWidth: "84%", borderRadius: 15, paddingVertical: 10, paddingHorizontal: 13 },
    bubbleAi: { alignSelf: "flex-start", backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
    bubbleMe: { alignSelf: "flex-end", backgroundColor: T.green },
    bubbleText: { fontSize: 13, color: T.text, fontFamily: FONTS.body, lineHeight: 19 },
    typing: { paddingVertical: 9 },
    typingText: { fontSize: 12, color: T.micro, fontFamily: FONTS.body, fontStyle: "italic" },
    composer: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: T.border },
    composerInput: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13.5, color: T.text, fontFamily: FONTS.body },
    sendBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: T.green, alignItems: "center", justifyContent: "center" },

    /* privacy */
    privHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    privTitle: { fontSize: 15, color: T.text, fontFamily: FONTS.heading },
    pHead: { fontSize: 13, color: T.text, fontFamily: FONTS.headingMed, marginTop: 16, marginBottom: 6 },
    pText: { fontSize: 12.5, color: T.sub, fontFamily: FONTS.body, lineHeight: 20, marginBottom: 12 },
    privRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
    privRowTitle: { fontSize: 13.5, color: T.text, fontFamily: FONTS.headingMed },
    privRowSub: { fontSize: 11.5, color: T.sub, fontFamily: FONTS.body, marginTop: 1 },
    privFoot: { fontSize: 11, color: T.micro, fontFamily: FONTS.body, textAlign: "center", marginTop: 16, lineHeight: 16 },

    /* logout */
    backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.6)" },
    sheet: { marginTop: "auto", backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
    grabber: { width: 38, height: 4, borderRadius: 99, backgroundColor: T.border, alignSelf: "center", marginBottom: 18 },
    logoutIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 10 },
    logoutTitle: { fontSize: 16, color: T.text, fontFamily: FONTS.heading },
    logoutSub: { fontSize: 12, color: T.sub, fontFamily: FONTS.body, marginTop: 4, textAlign: "center", lineHeight: 17 },
    logoutBtn: { backgroundColor: T.red, borderRadius: 13, paddingVertical: 14, alignItems: "center" },
    logoutBtnText: { fontSize: 14, color: "#FFFFFF", fontFamily: FONTS.headingMed },
    cancelBtn: { backgroundColor: T.cardHi, borderWidth: 1, borderColor: T.border, borderRadius: 13, paddingVertical: 13, alignItems: "center" },
    cancelText: { fontSize: 13, color: T.sub, fontFamily: FONTS.headingMed },
  });