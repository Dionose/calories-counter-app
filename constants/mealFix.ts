// constants/mealFix.ts
// Talking to a meal estimate — describing the whole dish, fixing one item, or
// saying what went into something you cooked.
//
// THE PERSON WHO ATE IT KNOWS THINGS THE PHOTO CAN'T SHOW. A camera sees the
// surface: it can't tell mashed spinach from scrambled egg, can't see what the
// rice was fried in, can't know there's butter under the toast.
//
// THREE THINGS CAN BE SAID:
//
//   A FULL DESCRIPTION — "this is broccoli, cauliflower and carrots, all
//   roasted." Their list BECOMES the plate; anything they didn't name goes.
//
//   A SINGLE CORRECTION — "the green one is spinach, not eggs." One item.
//
//   A RECIPE — "curry stew, I made it with tomatoes, onions and oil." One item
//   carrying its INGREDIENTS, worth what they add up to.
//
// ⚠️ THE FAILURE THIS PROMPT IS BUILT AROUND: told "white rice and Nigerian
// tomato stew, I made the stew with tomatoes, onions and oil", the model
// returned ONE item called "Tomato and onion curry stew with oil" and no
// ingredients at all. It heard every ingredient and spent them on a longer
// NAME. Three separate tests, same result. A name counts nothing.
//
// THE FIXED VALUES GO FIRST, before the JSON shape and every other rule. They
// used to sit in the middle and got followed four times in five — the fifth
// run priced a chicken breast at 385 calories instead of 290. Instructions
// buried in a long prompt compete with everything around them.
//
// AND THEY DESCRIBED THE POT, NOT THE PLATE. Someone lists what went into a
// pot that fed four, then eats a bowl.
//
// GETTING THE REPLACE/CORRECT SPLIT WRONG IS WORSE THAN NO FEATURE AT ALL. It
// used to treat every description as a correction, so a description ADDED to
// the photo's guess — a plate read as plantain and beans, described as beef,
// spinach, beans and olive oil, kept the plantain AND added all four.
import { WEIGHT_REFERENCE } from "./foodWeights";
import { MealItem } from "./mealPhoto";
import { MealPart } from "./meals";

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* lite first, same as everywhere else. MODEL NAMES EXPIRE — check here first
   if this stops working. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

/** an item as this file returns it — the photo reader's shape, plus the
    ingredients a spoken recipe can attach to it */
export type FixItem = MealItem & { parts?: MealPart[] };

export type MealFix = {
  edits: { index: number; item: FixItem }[];
  removes: number[];
  adds: FixItem[];
  understood: boolean;
  fullDescription: boolean;
  note: string | null;
  problem: string | null;
};

export type Progress = (message: string) => void;

/* THE TABLE IS THE FIRST THING IN THE PROMPT. Everything else follows it. */
const PROMPT = `${WEIGHT_REFERENCE}

Now: you are improving an ESTIMATE of a meal, using what the person who ate it
just said out loud.

Return ONLY a JSON object. No markdown, no code fences, no explanation.

{
  "understood": boolean,
  "fullDescription": boolean,
  "note": string or null,
  "problem": string or null,
  "edits": [
    {
      "index": number,
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
  "removes": [number],
  "adds": [ same shape as an edit, without "index" ]
}

WHAT WENT INTO A DISH GOES IN "parts", NEVER INTO THE NAME.

Given "white rice and Nigerian tomato stew — I made the stew with tomatoes,
onions, pepper and oil":

  WRONG — this loses everything and counts nothing:
    { "name": "Tomato and onion stew with oil", "calories": 310 }

  WRONG — the ingredients are not separate foods on the plate:
    { "name": "Tomatoes" }, { "name": "Onions" }, { "name": "Oil" }

  RIGHT:
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

A NAME IS NOT A BREAKDOWN. "Stew with oil" counts no oil. Only "parts" counts.

FIRST, DECIDE WHICH OF TWO THINGS THEY DID:

A) A FULL DESCRIPTION — they told you what the dish IS, or what's in it.
   Set "fullDescription": true.

B) A SINGLE CORRECTION — they pointed at one item and fixed it.
   Set "fullDescription": false.

The tell is whether they are naming THE DISH or its contents as a whole (A), or
referring to ONE item on a list they can see (B).

IF IT IS A FULL DESCRIPTION (A):

1. WHAT THEY SAID IS NOW THE PLATE. Their list replaces the guess entirely.

2. Every item in the current list their description does NOT account for goes
   in "removes".

3. Items they named that already exist should be EDITED, not added again.

4. Items they named that aren't in the list go in "adds".

5. In "note", say what you removed and why — "Updated to what you described.
   Removed plantain — you didn't mention it." Under twenty words.

IF IT IS A SINGLE CORRECTION (B):

6. TOUCH ONLY WHAT THEY MENTIONED. Every other item is left out entirely.

7. NOT MENTIONING SOMETHING IS NOT DENYING IT here. Only remove an item if
   they explicitly say it isn't there.

8. In "note", say what you changed, under twelve words.

USING "parts":

9. A dish takes "parts" when it is cooked as ONE thing but MADE of several: a
   stew, soup, sauce, curry, smoothie, casserole, marinade.

10. THE DISH IS ONE ROW. Never split the ingredients into top-level items.

11. THE ITEM'S CALORIES AND MACROS MUST EQUAL THE SUM OF ITS PARTS.

12. TWO OR MORE INGREDIENTS, or none.

13. THEY DESCRIBED THE POT, NOT THE PLATE. Scale EVERY ingredient down to the
    portion in front of them. Cooked with 100 ml of oil and eating about a
    quarter of it? That's 25 ml in this bowl, not 100.

14. OIL, BUTTER AND CREAM ARE THE POINT — invisible in a photo, huge in
    calories. Use the fixed values above.

15. SPICES AND SEASONINGS STILL EARN A LINE even at a few calories.

16. Rice served ALONGSIDE a stew is its own item. Only what went INTO the pot
    is a part of the stew.

17. Don't invent ingredients they didn't mention.

BOTH CASES:

18. "index" refers to the numbered list below. Use those exact numbers.

19. A COUNT of something in the table — "two chicken breasts", "three eggs",
    "two tablespoons of oil" — is a LOOKUP, not an estimate. Multiply the
    table's numbers by the count and stop there. A SERVING named in the table
    — "a plate of pasta", "a bowl of rice" — is also a lookup.

20. When a food CHANGES, its calories and macros must change with it.

21. Cooking method changes fat and calories, not identity.

22. Keep an existing weight unless they said otherwise.

23. ROUND. Calories to the nearest 10 above 100, nearest 5 below. Macros to
    whole grams. Calories must match the macros: protein and carbs about 4 a
    gram, fat about 9.

24. CHECK YOURSELF AGAINST WHAT'S NORMAL. Two grilled chicken breasts are
    around 580 calories, never 385 and never 900. A plate of pasta with cream
    sauce is 600-900. If a number lands outside the ordinary range, you have
    mis-weighed it — go back to the table.

25. "amountLabel" must stay PICTURABLE — "two breasts", "a bowl", "two
    tablespoons". Never "a serving" or "a portion".

26. "sure": HIGH when the table covered it, MEDIUM when they named the food
    but not the amount, LOW when guessing at a volume.

THE TRANSCRIPT IS MESSY:

27. This came from speech recognition. Read through false starts, filler and
    misheard words the way a person would. "Spin itch" is spinach. "Jelly
    rice" is jollof rice. "Corey stew" is curry stew.

28. The speaker never sees the transcript, so refusing over a garbled word
    helps nobody.

WHEN YOU GENUINELY CAN'T TELL:

29. Set "understood" to false, leave edits, removes and adds EMPTY, and put
    one short sentence in "problem" addressed to them.

30. NEVER guess between two possible items.`;

/** Apply a spoken description, correction or recipe to a plate.

    NEVER THROWS — failures come back with understood:false and a problem
    message, same contract as the readers. */
export async function fixMealWithVoice(
  items: MealItem[],
  transcript: string,
  onProgress?: Progress
): Promise<MealFix> {
  if (!GEMINI_KEY) return fail("Voice isn't set up on this build.");

  const text = transcript.trim();
  if (text.length < 3) return fail("MOTION didn't catch that — try again?");
  if (!items.length) return fail("There's nothing on the plate to describe yet.");

  const list = items
    .map(
      (it, i) =>
        `${i}. ${it.name} — ${it.amountLabel}, about ${it.grams} g, ${it.calories} cal ` +
        `(P ${it.protein} / C ${it.carbs} / F ${it.fat}), confidence ${it.sure}`
    )
    .join("\n");

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: `${PROMPT}\n\nTHE CURRENT ITEMS:\n${list}\n\nWHAT THEY SAID:\n"${text}"`,
          },
        ],
      },
    ],
    generationConfig: {
      /* AS LOW AS INTERPRETATION ALLOWS — the mishearing work survives at 0.1,
         the weight-guessing doesn't. Same reasoning as mealVoice.ts. */
      temperature: 0.1,
      /* a recipe with eight ingredients inside an item is a lot of JSON, and a
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
      if (attempt > 0 || m > 0) await new Promise((r) => setTimeout(r, 1000));

      try {
        const res = await fetch(`${endpointFor(model)}?key=${GEMINI_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (res.ok) {
          const parsed = await parseResponse(res, items.length);
          if (parsed) {
            console.log(`FIX: ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return parsed;
          }
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`FIX ${model} → ${lastStatus}`, errText.slice(0, 200));

        if (lastStatus === 404) break;
        if (lastStatus !== 503 && lastStatus !== 429) break;

        onProgress?.(
          m === 0 && attempt === 0 ? "Busy — trying again…" : "Still busy. Trying another reader…"
        );
      } catch (e: any) {
        console.log(`FIX ${model} threw:`, e?.message || e);
        lastStatus = 0;
      }
    }
  }

  if (lastStatus === 503) {
    return fail("MOTION's reader is overloaded right now — nothing wrong with what you said. Try again in a moment.");
  }
  if (lastStatus === 429) {
    return fail("That's a lot of requests in a short time. Wait a minute and try again.");
  }
  return fail("Couldn't reach the reader. Check your connection and try again.");
}

async function parseResponse(res: Response, itemCount: number): Promise<MealFix | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    const finish = json?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") console.log("FIX finishReason:", finish);

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

    const validIndex = (v: any) => {
      const n = num(v);
      return n != null && Number.isInteger(n) && n >= 0 && n < itemCount;
    };

    const edits = Array.isArray(parsed.edits)
      ? (parsed.edits
          .filter((e: any) => validIndex(e?.index))
          .map((e: any) => {
            const item = toItem(e);
            return item ? { index: Math.round(Number(e.index)), item } : null;
          })
          .filter(Boolean) as { index: number; item: FixItem }[])
      : [];

    const adds = Array.isArray(parsed.adds)
      ? (parsed.adds.map(toItem).filter(Boolean) as FixItem[]).slice(0, 8)
      : [];

    let removes = Array.isArray(parsed.removes)
      ? (parsed.removes.filter(validIndex).map((v: any) => Math.round(Number(v))) as number[])
      : [];

    const fullDescription = parsed.fullDescription === true;

    /* ---------- THE SAFETY NET ----------
       On a full description, everything they didn't account for should have
       been listed in "removes". Models forget, leaving the phantom item
       sitting there — the double-counting bug this file exists to prevent. */
    if (fullDescription) {
      const edited = new Set(edits.map((e) => e.index));
      const all = Array.from({ length: itemCount }, (_, i) => i);
      removes = all.filter((i) => !edited.has(i));
    }

    const changedSomething = edits.length > 0 || removes.length > 0 || adds.length > 0;

    if (fullDescription && !adds.length && !edits.length) {
      return {
        edits: [],
        removes: [],
        adds: [],
        understood: false,
        fullDescription: false,
        note: null,
        problem: "MOTION couldn't work out the foods from that — try naming them one by one.",
      };
    }

    return {
      edits,
      removes,
      adds,
      understood: parsed.understood !== false && changedSomething,
      fullDescription,
      note: str(parsed.note),
      problem:
        str(parsed.problem) ||
        (changedSomething
          ? null
          : "MOTION didn't find anything to change from that — try describing the dish, like \"curry stew with tomatoes, onions and oil\"."),
    };
  } catch {
    return null;
  }
}

function toItem(raw: any): FixItem | null {
  let name = str(raw?.name);
  const grams = num(raw?.grams);
  const calories = num(raw?.calories);

  if (!name || !grams || calories == null) return null;

  const parts = toParts(raw?.parts);

  if (parts) {
    /* CLEAN THE NAME. Even with the rule stated twice, the model sometimes
       writes "Tomato stew with oil" AND supplies the parts. */
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

function fail(problem: string): MealFix {
  return {
    edits: [],
    removes: [],
    adds: [],
    understood: false,
    fullDescription: false,
    note: null,
    problem,
  };
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