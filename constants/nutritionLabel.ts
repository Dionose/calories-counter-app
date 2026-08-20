// constants/nutritionLabel.ts
// Reading a nutrition panel from a photograph.
//
// WHY THIS IS THE EASY AI TASK. Estimating a plate of food is genuinely hard —
// the model can't see depth, can't know how densely the rice is packed, and
// the honest accuracy is somewhere around ±25%. A nutrition panel is the
// opposite: printed text in a standardised layout, and reading it is
// transcription rather than judgement. Done right it should be near-exact.
//
// WHY IT MATTERS HERE. Open Food Facts is volunteer-entered, so a record often
// disagrees with the packet in the user's hand — a bottle reading "¼ cup
// (60 ml)" can be stored as "1 tbsp (19 g)". Neither is wrong; they were
// entered from different labels. No amount of cleverness resolves that from
// our side, because only the person holding the bottle can see what it says.
// A photo of the panel is them showing us.
//
// AND WHY NOTHING IS APPLIED SILENTLY. A misread panel is WORSE than no panel:
// the user trusts it because it came from their own label. So everything read
// here is handed back for confirmation before it touches a log.
//
// SPEED IS A FEATURE HERE. The user is standing in a kitchen holding a packet,
// watching a spinner. Thirty seconds of that and they'll skip the step next
// time and take the estimate instead — which defeats the whole point of
// building this.

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* LITE FIRST, deliberately.

   Reading printed text off a label is TRANSCRIPTION, not reasoning — the
   lighter model should handle it identically and return faster, and on a task
   the user is actively waiting through, speed beats any quality margin. The
   heavier model stays behind it as the fallback.

   MODEL NAMES EXPIRE, AND FAST. This file started on gemini-2.0-flash, gone
   before the first real test. The first fallback was gemini-2.5-flash-lite,
   also already retired — so the fallback silently 404'd every time and the
   retry chain collapsed to nothing. Both were caught only because the 404
   handler prints Google's own message, which names the replacement.
   CHECK THESE FIRST when reading stops working. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/* attempts per model before moving to the next one */
const ATTEMPTS = 2;

export type LabelReading = {
  /** exactly as printed — "1/2 cup (125 ml)", "2 tbsp (19 g)" */
  servingText: string | null;
  servingGrams: number | null;
  servingMl: number | null;
  /** per SERVING, which is how panels are written */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** how many servings the whole container holds, when the panel says */
  servingsPerContainer: number | null;
  /** the model's own view of whether the photo was readable */
  confident: boolean;
  /** what went wrong, in words the user can act on */
  problem: string | null;
};

/** told what's happening, so a long wait doesn't look like a hang.
    A silent spinner at thirty seconds reads as broken; "still going, the
    reader's busy" reads as slow, and those are very different feelings. */
export type Progress = (message: string) => void;

const PROMPT = `You are reading a nutrition facts panel from a photograph of food packaging.

Return ONLY a JSON object. No markdown, no code fences, no explanation before or after.

{
  "servingText": string or null,
  "servingGrams": number or null,
  "servingMl": number or null,
  "calories": number or null,
  "protein": number or null,
  "carbs": number or null,
  "fat": number or null,
  "servingsPerContainer": number or null,
  "confident": boolean,
  "problem": string or null
}

RULES:

1. Every nutrient figure must be PER SERVING, exactly as the panel states it.
   If the panel shows both per-serving and per-100g columns, use the PER
   SERVING column. Never mix the two.

2. "calories" means kilocalories (kcal) — the big number most panels label
   "Calories". If the panel only gives kilojoules (kJ), divide by 4.184 and
   use that.

3. "servingText" is the serving size copied EXACTLY as printed, including any
   fraction and any bracketed weight. Examples: "1/2 cup (125 ml)",
   "2 tbsp (19 g)", "1 scoop (33 g)". Do not reformat it, do not convert it,
   do not tidy it up.

4. servingGrams and servingMl are the numeric parts, when the panel gives
   them. A panel saying "1/2 cup (125 ml)" has servingMl 125 and servingGrams
   null. One saying "1 scoop (33 g)" has servingGrams 33 and servingMl null.
   Use null for the one the panel doesn't give — never zero.

5. protein, carbs and fat are in GRAMS. Use total carbohydrate, not net carbs.

6. If the photo is blurry, cut off, angled so text is unreadable, or is not a
   nutrition panel at all, set "confident" to false and explain in "problem"
   in one short sentence addressed to the user — for example "The panel is cut
   off at the bottom" or "This looks like the ingredients list rather than the
   nutrition panel". Leave the numbers null rather than guessing.

7. If you can read most of the panel but one figure is unclear, return what
   you can read and leave the unclear one null. Partial is useful; invented is
   not.

8. Keep "problem" to one short sentence. Long explanations get cut off before
   the JSON closes, and a truncated object is worse than a terse one.

Read carefully. These numbers go straight into someone's food diary, and a
misread figure is worse than no figure at all because they will trust it —
it came from their own packet.`;

/** Read a nutrition panel from a photo.

    NEVER THROWS. Every failure comes back as a reading with confident:false
    and a problem message, so callers don't need a try/catch around it — and
    one that wraps this alongside other work will swallow good readings, which
    is exactly what happened the first time. */
export async function readNutritionLabel(base64: string, onProgress?: Progress): Promise<LabelReading> {
  if (!GEMINI_KEY) {
    return blank("Label reading isn't set up on this build.");
  }

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: base64 } },
        ],
      },
    ],
    generationConfig: {
      /* zero temperature: this is transcription, and there is exactly one
         right answer on the packet. Creativity is the enemy here. */
      temperature: 0,
      /* generous, because a TRUNCATED response is unparseable — the object
         stops mid-key and JSON.parse fails with something cryptic. */
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const started = Date.now();
  let lastStatus = 0;

  /* WORK THROUGH THE MODELS. A 503 means Google's capacity is stretched on one
     model, not across the board — so a second model is a genuinely different
     chance rather than the same request repeated. */
  for (let m = 0; m < MODELS.length; m++) {
    const model = MODELS[m];

    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0 || m > 0) {
        /* short pauses. Long enough for a spike to pass, short enough that
           the whole sequence stays under about ten seconds. */
        await new Promise((r) => setTimeout(r, 1200));
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
            /* how long the user actually waited. The only way to tell a slow
               model from a slow network from a retry chain. */
            console.log(`LABEL: ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return parsed;
          }
          /* a 200 that produced nothing usable — try again rather than
             reporting failure on the first stumble */
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`GEMINI ${model} → ${lastStatus}`, errText.slice(0, 200));

        /* a 404 means THIS model is gone — move straight to the next rather
           than retrying a name that will never work */
        if (lastStatus === 404) break;
        /* a bad key fails identically every time; only capacity errors are
           worth waiting on */
        if (lastStatus !== 503 && lastStatus !== 429) break;

        /* tell the user WHY it's taking a while — silence here is what makes
           a slow read feel like a broken one */
        onProgress?.(
          m === 0 && attempt === 0
            ? "The reader's busy — trying again…"
            : "Still busy. Trying another reader…"
        );
      } catch (e: any) {
        console.log(`GEMINI ${model} threw:`, e?.message || e);
        lastStatus = 0;
      }
    }
  }

  console.log(`LABEL: gave up after ${((Date.now() - started) / 1000).toFixed(1)}s`);

  /* the wording on 503 matters more than it looks. An early version said
     "couldn't read that one", and the natural reading of that is "your photo
     was bad" — so five perfectly good photos got retaken chasing a problem
     that was never at this end. */
  if (lastStatus === 503) {
    return blank("Google's label reader is overloaded right now — nothing wrong with your photo. Try again in a minute, or use the database figures.");
  }
  if (lastStatus === 429) return blank("That's a lot of label reads in a short time. Wait a minute and try again.");
  if (lastStatus === 400) return blank("The label reader rejected that request — check the terminal.");
  if (lastStatus === 403) return blank("The API key was refused — check the terminal.");
  if (lastStatus === 404) return blank("The label reader's models have moved — check the terminal.");
  return blank("Couldn't reach the label reader. Check your connection and try again.");
}

/** pull a reading out of a successful response, or null if there's nothing
    usable in it */
async function parseResponse(res: Response): Promise<LabelReading | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    /* "MAX_TOKENS" means it was cut off mid-object — a fixable config problem
       rather than a refusal, and the two look identical from a parse error */
    const finish = json?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.log("GEMINI finishReason:", finish);

    if (!text) return null;

    const clean = text.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      /* one salvage attempt: everything between the first { and the last },
         which rescues a reply wrapped in stray prose */
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      parsed = JSON.parse(clean.slice(start, end + 1));
    }

    return {
      servingText: str(parsed.servingText),
      servingGrams: num(parsed.servingGrams),
      servingMl: num(parsed.servingMl),
      calories: num(parsed.calories),
      protein: num(parsed.protein),
      carbs: num(parsed.carbs),
      fat: num(parsed.fat),
      servingsPerContainer: num(parsed.servingsPerContainer),
      confident: parsed.confident !== false && num(parsed.calories) != null,
      problem: str(parsed.problem),
    };
  } catch {
    return null;
  }
}

function blank(problem: string): LabelReading {
  return {
    servingText: null,
    servingGrams: null,
    servingMl: null,
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
    servingsPerContainer: null,
    confident: false,
    problem,
  };
}

/** coerce one field, and a bad value becomes null rather than throwing.

    NULL MUST STAY NULL, and this is the subtle one. Number(null) is 0, and
    0 passes a `>= 0` check — so a panel that legitimately had no gram figure
    came through as servingGrams: 0. Then `servingGrams ?? servingMl` chose
    the zero over a perfectly good 60 ml, because 0 isn't nullish. The reading
    was correct at every step and still produced nothing usable. */
function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** the per-100g figures a FoodDef needs, worked back from a per-serving
    reading. Panels state per serving; our whole system stores per 100 g. */
export function per100From(r: LabelReading): {
  per100: number; p: number; c: number; f: number;
} | null {
  const grams = r.servingGrams ?? r.servingMl;
  if (!grams || !r.calories) return null;

  const factor = 100 / grams;
  return {
    per100: Math.round(r.calories * factor),
    p: Math.round((r.protein ?? 0) * factor * 10) / 10,
    c: Math.round((r.carbs ?? 0) * factor * 10) / 10,
    f: Math.round((r.fat ?? 0) * factor * 10) / 10,
  };
}