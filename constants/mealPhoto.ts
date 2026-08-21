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
// WHAT A PROMPT CAN FIX IS STEADINESS. The same plate photographed three
// times used to come back 60, 85, then 140 — not because the model couldn't
// tell what the vegetables were, but because nothing told it HOW to judge
// size. It was guessing portions in the abstract, and an abstract guess lands
// somewhere different every time. With the sizing section below, six photos
// from six angles landed five of them inside a five-calorie band.
//
// That matters more than accuracy. A steady error cancels out over weeks of
// logging; a jumpy one never settles, and a user watching the same meal
// score 60 one day and 140 the next stops believing any of the numbers.
//
// The other three principles:
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

1. List each distinct food SEPARATELY, and prefer splitting. When an estimate
   is wrong the person can correct the single item that's off, instead of
   rejecting the whole thing — and separate foods can each be weighed and
   counted properly instead of averaged into one lump.

2. THE TEST IS WHETHER YOU COULD POINT AT THEM. If you can see the broccoli
   and the carrots as distinct things in the photograph, they are two items,
   even though they were roasted on the same tray and are served together.
   Cooked TOGETHER is not the same as cooked INTO one another.

3. A tray of mixed roasted vegetables is NOT one item. Broccoli, cauliflower,
   carrots and mushrooms are four items. They have different weights for their
   size and different calories, so bundling them makes the numbers worse as
   well as making them uncorrectable. Do not write "mixed roasted vegetables"
   when you can see which vegetables they are. The same goes for a mixed
   salad, a fruit bowl, a stir-fry with visible pieces, a fry-up, a mezze
   plate, a bowl of jollof rice with visible chicken and plantain beside it.

4. Only keep something as ONE item when it genuinely cannot be separated on
   the plate: a sandwich is a sandwich, not bread plus filling. A curry is a
   curry — you can't lift the sauce out. A smoothie, a soup, a stew, a
   casserole where everything has merged. If someone would have to unmake the
   dish to separate the parts, keep it whole.

5. Five items at most. If a plate genuinely has more, list the five biggest
   contributors and leave the trivial ones out — a garnish of parsley is not
   worth a row.

HOW BIG IS IT — WORK THIS OUT BEFORE ANYTHING ELSE:

6. Never guess a portion in the abstract. Measure it against something in the
   photograph whose real size you know. Do it in this order, every time.

7. FIND THE SCALE. Look for anything with a standard size and use it to judge
   how big everything else is:
     - a dinner plate is about 26-28 cm across
     - a side plate is about 20 cm
     - a takeaway or lunch container is usually 15-20 cm long
     - a fork or spoon is about 19 cm; a teaspoon about 12 cm
     - an adult palm is about 8-9 cm wide; a thumb about 5 cm long
     - a mug is about 8 cm across and holds around 300 ml
     - a standard drinking glass holds about 250 ml
     - a slice of sandwich bread is about 11 cm square
   If a hand is holding the container, use the hand — it is the most reliable
   scale in the picture.

8. IDENTIFY THE VESSEL AND ITS CAPACITY. A shallow takeaway container holds
   roughly 500-750 ml. A dinner plate holds about 600-900 ml heaped. A cereal
   bowl is about 400-500 ml, a large mixing or salad bowl 1.5-3 litres. This
   is the step that matters most: the SAME food filling a takeaway container
   and filling a large bowl differ by five times or more, and a photo taken
   from above makes them look identical.

9. JUDGE HOW FULL IT IS, as a fraction. A quarter full, half full, level with
   the rim, heaped above it. Say this to yourself before estimating weight.

10. ESTIMATE DEPTH HONESTLY. A photo from directly above hides height. Unless
    the food is visibly piled up, assume a modest depth — food spread across a
    container is usually 2-4 cm deep, not filled to the top.

11. THEN SPLIT THAT TOTAL BETWEEN THE ITEMS. Work out the whole amount of food
    first, then divide it across the separate items by how much of the surface
    each one covers. The parts must add up to the whole: four vegetables in a
    quarter-full container might be 40 g each, not 150 g each.

12. CONVERT VOLUME TO WEIGHT using roughly how heavy the food is for its size:
     - leaves, salad, popcorn: about 0.3 g per ml
     - chopped or roasted vegetables: about 0.6 g per ml
     - cooked rice, pasta, grains: about 0.8 g per ml
     - stews, curries, soups: about 1.0 g per ml
     - meat, fish, dense foods: about 1.05 g per ml

13. SANITY-CHECK AGAINST REAL PORTIONS. A restaurant chicken breast is
    150-200 g. A home portion of cooked rice is 150-250 g. A slice of bread is
    40-50 g. A portion of vegetables as a side is 80-150 g. If your number
    lands far outside the normal range for that food, you have probably
    misjudged the vessel — go back to step 7.

14. IF THERE IS NOTHING TO SCALE AGAINST — no hand, no cutlery, no plate rim,
    just food filling the frame — assume an ordinary single portion rather
    than an extreme one, and set "sure" to "low" for those items. Do not
    invent a large portion from a close-up.

15. BE CONSISTENT. Two photos of the same meal should produce close to the
    same answer. When you're torn between two estimates, take the middle one
    rather than the more dramatic one.

HOW TO DESCRIBE AMOUNTS:

16. "amountLabel" must be something a person can PICTURE, anchored to a hand
    or a common object. Good: "a palm-sized piece", "a cup", "half a cup",
    "a small handful", "two slices", "a tablespoon", "a medium apple".
    Bad: "a serving", "a portion", "some", "a normal amount" — those are
    abstract words that give no guidance at all.

17. Where a container is visible, the label may refer to it: "about a quarter
    of the container", "half the bowl". That's the most honest description of
    what you actually judged.

HOW TO NUMBER IT:

18. ROUND EVERYTHING. Calories to the nearest 10 for anything over 100,
    nearest 5 below that. Macros to the nearest gram. Reporting "412 calories"
    implies a measurement nobody took — say 410.

19. Calories must be consistent with the macros: protein and carbs are about
    4 calories a gram, fat about 9. If they don't roughly add up, fix them.

BEING HONEST ABOUT WHAT YOU CAN'T SEE:

20. "sure" is per item, and it should genuinely vary. HIGH for something
    clearly visible whose size is easy to judge — a whole apple, two visible
    eggs, a countable number of slices. MEDIUM for a normal plated portion
    where you had a scale reference. LOW for anything where you're guessing at
    hidden volume: how much oil the vegetables were cooked in, how much rice
    is under the sauce, how much dressing is on the salad, or any item where
    step 14 applied.

21. Do NOT invent items you cannot see. If the chicken looks like it was
    fried, say so in its name — but don't add a separate "cooking oil" entry
    you have no way to measure.

22. If the photo isn't food, is too dark or blurry to judge, or shows a packet
    rather than a meal, set "confident" to false, leave "items" empty, and put
    ONE short sentence in "problem" addressed to the person — for example
    "That looks like a packaged product — the barcode scanner will be more
    accurate" or "Too dark to make out what's on the plate".

23. "summary" is a few plain words for the whole plate — "Chicken with rice
    and broccoli". THIS is where the collective name belongs: the summary may
    say "Roasted mixed vegetables" even though the items list them
    separately.

You are ESTIMATING, and the person will be told that. A sensible estimate they
can correct is far more useful than a precise-looking number that's wrong —
so measure against what you can see, split what can be split, round honestly,
mark your uncertainty, and never pretend to know a volume you cannot see.`;

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
      /* AS LOW AS ESTIMATION ALLOWS. Unlike a nutrition panel there isn't one
         right answer here, but the same plate photographed twice should not
         come back 60 and then 140 — and it did, at 0.2. Lower is steadier,
         and steadiness is what makes a week of logs comparable. */
      temperature: 0.1,
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