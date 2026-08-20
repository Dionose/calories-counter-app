// constants/mealVoice.ts
// Turning "I had two eggs and some toast" into food.
//
// TWO STEPS, and the split is deliberate:
//
//   1. THE PHONE TRANSCRIBES. iOS does speech-to-text on-device, for free,
//      forever. Sending audio to Gemini would work too, but it charges per
//      second of speech for every user for the life of the app — and the
//      transcription is the part a phone already does well.
//
//   2. GEMINI READS THE TEXT. Turning words into named foods with weights is
//      the part that needs a model, and text is the cheapest thing you can
//      send one.
//
// THE TRANSCRIPT IS NEVER SHOWN. Dictation makes mistakes — "large green
// lentils" comes out as "lodge green lentils" often enough — and a user shown
// that would assume the app misheard them and give up, when the model would
// have understood it perfectly well. What gets confirmed is the RESULT:
// the foods and the numbers. If it misheard, that shows up as a wrong food on
// a screen where fixing it takes one tap.
//
// This is the same estimation problem as the meal photo, minus the picture —
// so it reuses MealItem and the same honest-uncertainty result screen. If
// anything it's HARDER: a photo at least shows how much is on the plate.

import { MealItem } from "./mealPhoto";

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* lite first, same as everywhere else. Text-only requests are fast and cheap,
   so this should be the quickest call in the app.

   MODEL NAMES EXPIRE — check here first if this stops working. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

export type VoiceReading = {
  items: MealItem[];
  summary: string | null;
  confident: boolean;
  problem: string | null;
};

export type Progress = (message: string) => void;

/* The prompt's most important job is handling MESSY INPUT gracefully.

   Real dictation is not tidy. People say "um", start sentences again, and the
   recogniser mishears words. The model is told to work with that rather than
   refuse — because the user never sees the transcript and has no idea why a
   refusal happened. */
const PROMPT = `You are reading a spoken description of a meal, transcribed by a phone.

Return ONLY a JSON object. No markdown, no code fences, no explanation.

{
  "summary": string or null,
  "items": [
    {
      "name": string,
      "amountLabel": string,
      "grams": number,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sure": "high" | "medium" | "low"
    }
  ],
  "confident": boolean,
  "problem": string or null
}

THE TRANSCRIPT IS MESSY, AND THAT'S NORMAL:

1. This came from speech recognition, so expect false starts, filler words,
   and misheard words. Work out what they MEANT. "Lodge green lentils" is
   large green lentils. "Two boiled eggs and some toes" is toast. Read through
   the errors the way a person would.

2. The speaker never sees this transcript, so they don't know what was
   misheard. Refusing over a garbled word helps nobody — make the sensible
   interpretation and mark it "low" if you're unsure.

3. Ignore anything that isn't about food. People talk around the point.

HOW TO SPLIT IT:

4. List each distinct food SEPARATELY, so a wrong one can be corrected without
   rejecting everything. But keep as one item anything eaten as one thing — a
   sandwich is a sandwich, a curry is a curry.

5. Five items at most.

AMOUNTS:

6. If they SAID how much — "two eggs", "a big bowl", "half a cup" — use their
   words in "amountLabel" and their number in "grams". What someone tells you
   about their own plate beats any assumption.

7. If they didn't say, assume a normal portion and set "sure" to "low" for
   that item. Write "amountLabel" as something PICTURABLE — "a palm-sized
   piece", "a cup", "a small handful" — never "a serving" or "a portion",
   which say nothing.

NUMBERS:

8. ROUND. Calories to the nearest 10 above 100, nearest 5 below. Macros to
   whole grams. "412 calories" implies a measurement nobody took.

9. Calories must match the macros: protein and carbs about 4 a gram, fat
   about 9.

10. "sure" should genuinely vary. HIGH when they gave a clear food and a clear
    amount. MEDIUM for a clear food with no amount. LOW when you're guessing
    at what they meant, or at how it was cooked.

WHEN YOU CAN'T:

11. If the transcript has no food in it at all — silence, background noise, or
    something unrelated — set "confident" false, leave items empty, and put ONE
    short sentence in "problem" addressed to the speaker, like "MOTION didn't
    catch any food in that — try again?"

12. "summary" is a few plain words for the meal: "Eggs and toast".

They are TELLING you what they ate, which makes them the best source there is
about their own plate. Take them at their word on amounts, estimate sensibly
where they didn't say, and be honest about which is which.`;

/** Turn a transcript into food.

    NEVER THROWS — failures come back with confident:false and a problem
    message. */
export async function readMealDescription(transcript: string, onProgress?: Progress): Promise<VoiceReading> {
  if (!GEMINI_KEY) {
    return fail("Voice logging isn't set up on this build.");
  }

  const text = transcript.trim();
  if (text.length < 3) {
    return fail("MOTION didn't catch that — try describing your meal again.");
  }

  const body = JSON.stringify({
    contents: [
      { parts: [{ text: `${PROMPT}\n\nTHE TRANSCRIPT:\n"${text}"` }] },
    ],
    generationConfig: {
      /* slightly warmer than the label reader, because interpreting messy
         speech genuinely needs some flexibility — "toes" becoming "toast" is
         inference, not transcription */
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const started = Date.now();
  let lastStatus = 0;

  for (let m = 0; m < MODELS.length; m++) {
    const model = MODELS[m];

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0 || m > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }

      try {
        const res = await fetch(`${endpointFor(model)}?key=${GEMINI_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (res.ok) {
          const parsed = await parseResponse(res);
          if (parsed) {
            console.log(`VOICE: ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return parsed;
          }
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`VOICE ${model} → ${lastStatus}`, errText.slice(0, 200));

        if (lastStatus === 404) break;
        if (lastStatus !== 503 && lastStatus !== 429) break;

        onProgress?.(
          m === 0 && attempt === 0 ? "Busy — trying again…" : "Still busy. Trying another reader…"
        );
      } catch (e: any) {
        console.log(`VOICE ${model} threw:`, e?.message || e);
        lastStatus = 0;
      }
    }
  }

  if (lastStatus === 503) {
    return fail("MOTION's reader is overloaded right now — nothing wrong with what you said. Try again in a moment.");
  }
  if (lastStatus === 429) return fail("That's a lot of requests in a short time. Wait a minute and try again.");
  return fail("Couldn't reach the reader. Check your connection and try again.");
}

async function parseResponse(res: Response): Promise<VoiceReading | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    const finish = json?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.log("VOICE finishReason:", finish);

    if (!text) return null;

    const clean = text.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      parsed = JSON.parse(clean.slice(start, end + 1));
    }

    const items: MealItem[] = Array.isArray(parsed.items)
      ? (parsed.items.map(toItem).filter(Boolean) as MealItem[]).slice(0, 5)
      : [];

    return {
      items,
      summary: str(parsed.summary),
      confident: parsed.confident !== false && items.length > 0,
      problem: str(parsed.problem),
    };
  } catch {
    return null;
  }
}

function toItem(raw: any): MealItem | null {
  const name = str(raw?.name);
  const grams = num(raw?.grams);
  const calories = num(raw?.calories);

  if (!name || !grams || calories == null) return null;

  return {
    name,
    amountLabel: str(raw?.amountLabel) || `about ${Math.round(grams)} g`,
    grams: Math.round(grams),
    calories: Math.round(calories),
    protein: Math.round(num(raw?.protein) ?? 0),
    carbs: Math.round(num(raw?.carbs) ?? 0),
    fat: Math.round(num(raw?.fat) ?? 0),
    sure: raw?.sure === "high" || raw?.sure === "low" ? raw.sure : "medium",
  };
}

function fail(problem: string): VoiceReading {
  return { items: [], summary: null, confident: false, problem };
}

/* NULL MUST STAY NULL — Number(null) is 0, and a zero that should have been
   absent silently becomes a real value downstream. Learned the hard way in
   nutritionLabel.ts, where an absent serving weight became 0 g and took a
   perfectly good reading down with it. */
function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}