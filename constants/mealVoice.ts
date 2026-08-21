// constants/mealVoice.ts
// Turning "I had two eggs and some toast" into food.
//
// TWO STEPS, and the split is deliberate:
//
//   1. THE PHONE TRANSCRIBES. iOS does speech-to-text on-device, for free,
//      forever. Sending audio to Gemini would work too, but it charges per
//      second of speech for every user for the life of the app.
//
//   2. GEMINI READS THE TEXT. Turning words into named foods with weights is
//      the part that needs a model, and text is the cheapest thing to send one.
//
// THE TRANSCRIPT IS SHOWN BY DEFAULT (it used to be hidden, on the theory that
// watching dictation stumble makes people distrust the app — that lost to a
// real user who kept looking for the words and couldn't tell if the phone was
// hearing him). What protects it is the note on that screen: MOTION reads
// through mishearings the way a person would.
//
// A DISH CAN COME BACK WITH ITS INGREDIENTS. "Rice and curry stew, I made the
// stew with tomatoes, onions and oil" is one plate with two items, and the
// stew carries what went into it — because cooking oil is invisible to a
// camera, enormous in calories, and only the cook can report it.
//
// THE FIXED VALUES GO FIRST IN THE PROMPT, before the JSON shape and before
// every other rule. They used to sit in the middle and got followed about four
// times in five — the fifth run came back with a chicken breast at 385 calories
// instead of 290. Instructions buried in a long prompt compete with everything
// around them, and this one has to win.

import { WEIGHT_REFERENCE } from "./foodWeights";
import { MealItem } from "./mealPhoto";
import { MealPart } from "./meals";

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* lite first, same as everywhere else. Text-only requests are fast and cheap,
   so this should be the quickest call in the app.

   MODEL NAMES EXPIRE — check here first if this stops working. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

/** an item as this reader returns it — the photo reader's shape, plus the
    ingredients of a dish they described cooking */
export type VoiceItem = MealItem & { parts?: MealPart[] };

export type VoiceReading = {
  items: VoiceItem[];
  summary: string | null;
  confident: boolean;
  problem: string | null;
};

export type Progress = (message: string) => void;

/* THE TABLE IS THE FIRST THING IN THE PROMPT. Everything else follows it. */
const PROMPT = `${WEIGHT_REFERENCE}

Now: you are reading a spoken description of a meal, transcribed by a phone.

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
      "sure": "high" | "medium" | "low",
      "parts": [
        {
          "name": string,
          "amountLabel": string,
          "grams": number,
          "calories": number,
          "protein": number,
          "carbs": number,
          "fat": number
        }
      ]
    }
  ],
  "confident": boolean,
  "problem": string or null
}

"parts" is OPTIONAL and belongs only on a cooked dish whose ingredients they
told you. Leave it out entirely for ordinary foods.

WHAT WENT INTO A DISH GOES IN "parts", NEVER INTO THE NAME.

Given "white rice and Nigerian tomato stew — I made the stew with tomatoes,
onions, pepper and oil":

  WRONG — this loses everything and counts nothing:
    { "name": "Tomato and onion stew with oil", "calories": 310 }

  WRONG — the ingredients are not separate foods on the plate:
    { "name": "Tomatoes" }, { "name": "Onions" }, { "name": "Oil" }

  RIGHT — two items, and the stew carries its ingredients:
    { "name": "White rice", "amountLabel": "a bowl", ... }
    {
      "name": "Nigerian tomato stew",
      "amountLabel": "a bowl",
      "parts": [
        { "name": "Tomatoes", ... },
        { "name": "Onions", ... },
        { "name": "Pepper", ... },
        { "name": "Vegetable oil", "amountLabel": "two tablespoons", ... }
      ]
    }

A NAME IS NOT A BREAKDOWN. "Stew with oil" counts no oil — it's a longer label
on the same guess. Only "parts" counts anything.

THE TRANSCRIPT IS MESSY, AND THAT'S NORMAL:

1. This came from speech recognition, so expect false starts, filler words,
   and misheard words. Work out what they MEANT. "Lodge green lentils" is
   large green lentils. "Two boiled eggs and some toes" is toast. "Corey stew"
   is curry stew.

2. Refusing over a garbled word helps nobody — make the sensible
   interpretation and mark it "low" if you're unsure.

3. Ignore anything that isn't about food.

HOW TO SPLIT IT:

4. List each distinct food SEPARATELY. Rice served alongside a stew is its own
   item.

5. But keep as ONE item anything eaten as one thing — a sandwich is a
   sandwich, a stew is a stew. What went INTO the pot becomes "parts".

6. Five items at most.

USING "parts":

7. A dish takes "parts" when it is cooked as ONE thing but MADE of several: a
   stew, soup, sauce, curry, smoothie, casserole, marinade.

8. THE ITEM'S CALORIES AND MACROS MUST EQUAL THE SUM OF ITS PARTS.

9. TWO OR MORE INGREDIENTS, or none.

10. THEY DESCRIBED THE POT, NOT THE PLATE. Scale EVERY ingredient down to what
    they actually ate. Cooked with 100 ml of oil and ate about a quarter of
    it? That's 25 ml in this bowl, not 100.

11. OIL, BUTTER AND CREAM ARE THE POINT — invisible in a photo, huge in
    calories. Use the fixed values above.

12. SPICES AND SEASONINGS STILL EARN A LINE even at a few calories. The person
    mentioned them and expects to see them.

13. Don't invent ingredients they didn't mention.

AMOUNTS:

14. A COUNT of something in the table — "two chicken breasts", "three eggs",
    "two tablespoons of oil" — is a LOOKUP, not an estimate. Multiply the
    table's numbers by the count and stop there.

15. A SERVING named in the table — "a plate of pasta", "a bowl of rice" — is
    also a lookup.

16. Anything else: estimate from the categories above, take the middle, and
    set "sure" to "low".

17. "amountLabel" must be PICTURABLE — "two breasts", "a bowl", "two
    tablespoons". Never "a serving" or "a portion".

NUMBERS:

18. ROUND. Calories to the nearest 10 above 100, nearest 5 below. Macros to
    whole grams.

19. Calories must match the macros: protein and carbs about 4 a gram, fat
    about 9.

20. CHECK YOURSELF AGAINST WHAT'S NORMAL. Two grilled chicken breasts are
    around 580 calories, never 385 and never 900. A plate of pasta with cream
    sauce is 600-900. If a number lands outside the ordinary range, you have
    mis-weighed it — go back to the table.

21. "sure": HIGH when the table covered it, MEDIUM for a clear food with no
    amount, LOW when guessing at a volume or a cooking method.

WHEN YOU CAN'T:

22. If the transcript has no food in it at all, set "confident" false, leave
    items empty, and put ONE short sentence in "problem" addressed to the
    speaker, like "MOTION didn't catch any food in that — try again?"

23. "summary" is a few plain words for the meal: "Rice and curry stew".

They are TELLING you what they ate, which makes them the best source there is
about their own plate. Use the fixed values for anything they cover, take
their word on amounts, count what went into their cooking, and be honest about
which numbers are solid and which are guesses.`;

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
      /* AS LOW AS INTERPRETATION ALLOWS. The mishearing work — "toes" becoming
         "toast" — survives at 0.1; the weight-guessing doesn't. */
      temperature: 0.1,
      /* a dish with eight ingredients inside it is a lot of JSON, and a
         truncated response is unparseable */
      maxOutputTokens: 3072,
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

    const items: VoiceItem[] = Array.isArray(parsed.items)
      ? (parsed.items.map(toItem).filter(Boolean) as VoiceItem[]).slice(0, 5)
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

function toItem(raw: any): VoiceItem | null {
  let name = str(raw?.name);
  const grams = num(raw?.grams);
  const calories = num(raw?.calories);

  if (!name || !grams || calories == null) return null;

  const parts = toParts(raw?.parts);

  if (parts) {
    /* CLEAN THE NAME. Even with the rule stated twice, the model sometimes
       writes "Tomato stew with oil" AND supplies the parts — which reads as
       though the oil is being counted twice. */
    name = stripIngredientTail(name);

    /* THE DISH IS WORTH WHAT WENT INTO IT. Recomputed rather than trusted:
       models routinely list ingredients and then report a headline number that
       doesn't match them. */
    const t = parts.reduce(
      (acc, p) => ({
        calories: acc.calories + (p.calories || 0),
        protein: acc.protein + (p.protein || 0),
        carbs: acc.carbs + (p.carbs || 0),
        fat: acc.fat + (p.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      name,
      amountLabel: str(raw?.amountLabel) || `about ${Math.round(grams)} g`,
      grams: Math.round(grams),
      calories: Math.round(t.calories),
      protein: Math.round(t.protein),
      carbs: Math.round(t.carbs),
      fat: Math.round(t.fat),
      sure: raw?.sure === "high" || raw?.sure === "low" ? raw.sure : "medium",
      parts,
    };
  }

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

/** "Nigerian tomato stew with oil and onions" → "Nigerian tomato stew".

    ONLY applied to a dish that already has its ingredients listed — for a
    plain item "with oil" may be the only record that oil exists at all. */
function stripIngredientTail(name: string): string {
  const cut = name.replace(/\s*[,(]?\s*\bwith\b[^,()]*\)?\s*$/i, "").trim();
  return cut.length >= 3 ? cut : name;
}

/** ingredients, cleaned.

    ONE ingredient is not a recipe — it would give a dish a breakdown
    consisting of itself. Two or more, or nothing. */
function toParts(raw: any): MealPart[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const parts = raw
    .map((p: any) => {
      const name = str(p?.name);
      const calories = num(p?.calories);
      /* a spice at 2 calories is still worth a line — the person said it, and
         a breakdown missing what they mentioned reads as not listening. */
      if (!name || calories == null) return null;
      return {
        name,
        amountLabel: str(p?.amountLabel) || undefined,
        grams: num(p?.grams) ?? undefined,
        calories: Math.round(calories),
        protein: Math.round(num(p?.protein) ?? 0),
        carbs: Math.round(num(p?.carbs) ?? 0),
        fat: Math.round(num(p?.fat) ?? 0),
      } as MealPart;
    })
    .filter(Boolean) as MealPart[];

  /* ten is already more than anyone lists out loud */
  return parts.length >= 2 ? parts.slice(0, 10) : undefined;
}

function fail(problem: string): VoiceReading {
  return { items: [], summary: null, confident: false, problem };
}

/* NULL MUST STAY NULL — Number(null) is 0, and a zero that should have been
   absent silently becomes a real value downstream. Learned the hard way in
   nutritionLabel.ts. */
function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}