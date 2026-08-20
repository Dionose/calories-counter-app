// constants/mealPhoto.ts
// Estimating a plate of food from a photograph.
//
// THIS IS THE HARD ONE, and it's worth being clear-eyed about why.
//
// A nutrition panel is transcription: the numbers are printed, and reading
// them right is a matter of seeing clearly. A plate of food has no numbers on
// it at all. The model has to identify what's there, guess how much of it
// there is from a flat image with no depth information, and know that rice
// packs differently from salad. The honest accuracy ceiling is somewhere
// around ±25%, and no prompt fixes that.
//
// SO THE JOB HERE IS NOT PRECISION — it's being useful and honest at the same
// time. Three principles fall out of that:
//
//   1. SEPARATE ITEMS, not one blob. "Chicken, rice, broccoli" as three
//      entries beats "chicken dinner, 620 cal" — because when the estimate is
//      wrong, the user can fix the one item that's off instead of rejecting
//      the whole plate.
//
//   2. ROUND NUMBERS. Reporting 412 calories implies a measurement nobody
//      took. 400 says the same thing without the false precision.
//
//   3. ANCHORED PORTIONS. The model estimates in the app's own vocabulary —
//      "a palm-sized piece", "a cup" — so the amount ladder can pick it up and
//      the user can adjust in words they recognise.

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* same two models, same order and reasoning as the label reader: lite first,
   heavier one as the fallback when capacity is stretched.

   MODEL NAMES EXPIRE — check here first if this stops working. The 404
   handler prints Google's own message naming the replacement. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

export type MealItem = {
  /** what it is — "Grilled chicken breast" */
  name: string;
  /** how much, in the app's own anchored vocabulary — "a palm-sized piece" */
  amountLabel: string;
  /** the grams behind that, so the ladder and the maths have something real */
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** the model's own view: how sure is it about THIS item?
      A chicken breast is easier to judge than a sauce, and saying so lets the
      screen nudge the user toward the ones worth checking. */
  sure: "high" | "medium" | "low";
};

export type MealReading = {
  items: MealItem[];
  /** what the whole plate looks like, in a few words — "Chicken with rice and
      steamed broccoli". Used as the heading. */
  summary: string | null;
  confident: boolean;
  problem: string | null;
};

export type Progress = (message: string) => void;

/* The prompt is long because every paragraph of it exists to counter a
   specific way meal estimation goes wrong. The model's instinct is to be
   helpful and specific; here that instinct produces confident nonsense. */
const PROMPT = `You are looking at a photograph of a meal and estimating what's in it.

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

HOW TO SPLIT THE PLATE:

1. List each distinct food SEPARATELY. A plate of chicken, rice and broccoli
   is three items, not one. This matters: when an estimate is wrong the person
   can correct the single item that's off, instead of rejecting the whole
   thing.

2. But don't split what's eaten as one thing. A sandwich is a sandwich, not
   bread plus filling plus butter. A curry is a curry. Use judgement: if
   someone would name it as one food, keep it as one.

3. Five items at most. Beyond that the list stops being correctable and starts
   being a chore.

HOW TO DESCRIBE AMOUNTS:

4. "amountLabel" must be something a person can PICTURE, anchored to a hand or
   a common object. Good: "a palm-sized piece", "a cup", "half a cup",
   "a small handful", "two slices", "a tablespoon", "a medium apple".
   Bad: "a serving", "a portion", "some", "a normal amount" — those are
   abstract words that give no guidance at all.

5. "grams" is your estimate of the weight of that item as shown. Be realistic:
   a restaurant chicken breast is 150-200 g, a home portion of cooked rice is
   150-250 g, a slice of bread is 40-50 g.

HOW TO NUMBER IT:

6. ROUND EVERYTHING. Calories to the nearest 10 for anything over 100, nearest
   5 below that. Macros to the nearest gram. Reporting "412 calories" implies a
   measurement nobody took — say 410.

7. Calories must be consistent with the macros: protein and carbs are about
   4 calories a gram, fat about 9. If they don't roughly add up, fix them.

BEING HONEST ABOUT WHAT YOU CAN'T SEE:

8. "sure" is per item, and it should genuinely vary. HIGH for something
   clearly visible whose size is easy to judge — a whole apple, two visible
   eggs, a countable number of slices. MEDIUM for a normal plated portion.
   LOW for anything where you're guessing at hidden volume: how much oil the
   vegetables were cooked in, how much rice is under the sauce, how much
   dressing is on the salad.

9. Do NOT invent items you cannot see. If the chicken looks like it was fried,
   say so in its name — but don't add a separate "cooking oil" entry you have
   no way to measure.

10. If the photo isn't food, is too dark or blurry to judge, or shows a packet
    rather than a meal, set "confident" to false, leave "items" empty, and put
    ONE short sentence in "problem" addressed to the person — for example
    "That looks like a packaged product — the barcode scanner will be more
    accurate" or "Too dark to make out what's on the plate".

11. "summary" is a few plain words for the whole plate — "Chicken with rice and
    broccoli". Not a sentence, not a description of the photograph.

You are ESTIMATING, and the person will be told that. A sensible estimate they
can correct is far more useful than a precise-looking number that's wrong —
so round honestly, mark your uncertainty, and never pretend to know a volume
you cannot see.`;

/** Estimate a meal from a photo.

    NEVER THROWS — every failure returns a reading with confident:false and a
    problem message, same contract as the label reader. A caller that wraps
    this in a try/catch alongside other work will swallow good readings. */
export async function readMealPhoto(base64: string, onProgress?: Progress): Promise<MealReading> {
  if (!GEMINI_KEY) {
    return fail("Meal reading isn't set up on this build.");
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
      /* LOW BUT NOT ZERO. Unlike a nutrition panel there isn't one right
         answer here — a little flexibility helps the model settle on a
         sensible reading rather than fixating. Still low, because this is
         estimation and not invention. */
      temperature: 0.2,
      /* generous: five items with seven fields each adds up, and a truncated
         response is unparseable */
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
            console.log(`MEAL: ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return parsed;
          }
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`MEAL ${model} → ${lastStatus}`, errText.slice(0, 200));

        if (lastStatus === 404) break;
        if (lastStatus !== 503 && lastStatus !== 429) break;

        onProgress?.(
          m === 0 && attempt === 0
            ? "Busy — trying again…"
            : "Still busy. Trying another reader…"
        );
      } catch (e: any) {
        console.log(`MEAL ${model} threw:`, e?.message || e);
        lastStatus = 0;
      }
    }
  }

  console.log(`MEAL: gave up after ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (lastStatus === 503) {
    return fail("MOTION's reader is overloaded right now — nothing wrong with your photo. Try again in a moment.");
  }
  if (lastStatus === 429) return fail("That's a lot of photos in a short time. Wait a minute and try again.");
  return fail("Couldn't reach the reader. Check your connection and try again.");
}

async function parseResponse(res: Response): Promise<MealReading | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    const finish = json?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.log("MEAL finishReason:", finish);

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
      ? parsed.items
          .map(toItem)
          .filter(Boolean)
          /* five is the cap the prompt asks for; enforce it here too, since a
             list longer than that stops being correctable */
          .slice(0, 5) as MealItem[]
      : [];

    return {
      items,
      summary: str(parsed.summary),
      /* an empty list isn't a reading, whatever the model says about its own
         confidence */
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

  /* a nameless item, or one with no weight or calories, is noise — drop it
     rather than showing a row the user can't act on */
  if (!name || !grams || calories == null) return null;

  return {
    name,
    /* the fallback here is deliberately physical rather than "a serving",
       which is the abstract wording this whole system exists to avoid */
    amountLabel: str(raw?.amountLabel) || `about ${Math.round(grams)} g`,
    grams: Math.round(grams),
    calories: Math.round(calories),
    protein: Math.round(num(raw?.protein) ?? 0),
    carbs: Math.round(num(raw?.carbs) ?? 0),
    fat: Math.round(num(raw?.fat) ?? 0),
    sure: raw?.sure === "high" || raw?.sure === "low" ? raw.sure : "medium",
  };
}

function fail(problem: string): MealReading {
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

/** the plate's totals — what goes on the hero and into the log */
export function mealTotals(items: MealItem[]) {
  return items.reduce(
    (t, i) => ({
      cal: t.cal + i.calories,
      p: t.p + i.protein,
      c: t.c + i.carbs,
      f: t.f + i.fat,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
}