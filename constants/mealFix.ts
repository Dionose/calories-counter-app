// constants/mealFix.ts
// Talking to a photo estimate — describing the whole dish, or fixing one item.
//
// THE PERSON WHO ATE IT KNOWS THINGS THE PHOTO CAN'T SHOW. A camera sees the
// surface: it can't tell mashed spinach from scrambled egg, can't see what the
// rice was fried in, can't know it was cooked with butter. Whoever made it can
// say all of that in a sentence, and it moves the numbers more than correcting
// a single item ever would.
//
// TWO DIFFERENT THINGS CAN BE SAID, and telling them apart is the whole job:
//
//   A FULL DESCRIPTION — "this is broccoli, cauliflower and carrots, all
//   roasted." They have just told you what the dish IS. Their list BECOMES the
//   plate: anything the photo guessed that they didn't name is removed.
//
//   A SINGLE CORRECTION — "the green one is spinach, not eggs." They pointed
//   at one item. Everything else stays exactly as it was.
//
// GETTING THIS WRONG IS WORSE THAN NO FEATURE AT ALL. It used to treat every
// description as a correction, so a full description ADDED to the photo's
// guess instead of replacing it: a plate the model read as plantain and beans,
// described by the cook as beef, spinach, beans and olive oil, ended up
// carrying the plantain AND all four — double-counted calories, and a plate
// containing food nobody ate. Found on a real meal, and it's the reason the
// replace/correct split exists.
//
// WHAT WAS REMOVED IS ALWAYS SAID OUT LOUD. When a description replaces the
// plate, the note names what went — "plantain removed, you didn't mention it".
// That hands the judgement back: maybe there WAS plantain and they forgot, and
// they can add it back. Silently deleting three items would be the app
// deciding for them.
//
// WHEN IT CAN'T TELL, IT DOES NOTHING. A sentence that could mean two items
// comes back as understood:false and the plate is untouched. A silent wrong
// change to a plate someone already checked is worse than being asked again.
//
// Reuses the same speech path as mealVoice.ts: the phone transcribes
// on-device for free, and only the text is sent.
import { MealItem } from "./mealPhoto";

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* lite first, same as everywhere else. MODEL NAMES EXPIRE — check here first
   if this stops working. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

export type MealFix = {
  /** replace the item at this index with this one */
  edits: { index: number; item: MealItem }[];
  /** drop these indexes */
  removes: number[];
  /** append these */
  adds: MealItem[];
  /** false means the plate must be left exactly as it was */
  understood: boolean;
  /** true when they described the whole dish rather than fixing one item */
  fullDescription: boolean;
  /** one short line describing what changed, shown to the user */
  note: string | null;
  /** why nothing happened, when understood is false */
  problem: string | null;
};

export type Progress = (message: string) => void;

const PROMPT = `You are improving an ESTIMATE of a meal, using what the person who ate it just said out loud.

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
      "sure": "high" | "medium" | "low"
    }
  ],
  "removes": [number],
  "adds": [
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
  ]
}

FIRST, DECIDE WHICH OF TWO THINGS THEY DID. This decision changes everything
else, so make it before anything else.

A) A FULL DESCRIPTION — they told you what the dish IS, or listed what's in it.
   "This is broccoli, cauliflower and carrots, all roasted."
   "It's jollof rice with chicken, fried in groundnut oil."
   "There's beef, spinach, beans and olive oil in it."
   Set "fullDescription": true.

B) A SINGLE CORRECTION — they pointed at one thing and fixed it.
   "The green one is mashed spinach, not eggs."
   "There's no butter on that toast."
   "The rice was more like two cups."
   Set "fullDescription": false.

The tell is whether they are naming THE DISH or its contents as a whole (A), or
referring to ONE item on a list they can see (B).

IF IT IS A FULL DESCRIPTION (A):

1. WHAT THEY SAID IS NOW THE PLATE. They were there and you were not. Their
   list replaces the guess entirely.

2. Every item in the current list that their description does NOT account for
   goes in "removes". This is the most important rule in this file. If the list
   says plantain and beans, and they say beef, spinach, beans and olive oil,
   then plantain is REMOVED — not kept alongside. Keeping it would count food
   nobody ate.

3. Items they named that already exist in the list should be EDITED to match
   what they said, not added again. Beans stay beans; adjust the numbers if
   their description changes them.

4. Items they named that aren't in the list go in "adds".

5. In "note", say plainly what you removed and why, addressed to them. For
   example: "Updated to what you described. Removed plantain — you didn't
   mention it." Under twenty words. If nothing was removed, just say what
   changed.

IF IT IS A SINGLE CORRECTION (B):

6. TOUCH ONLY WHAT THEY MENTIONED. Every other item is left out of your answer
   entirely — no edit, no remove.

7. NOT MENTIONING SOMETHING IS NOT DENYING IT here. Only remove an item if they
   explicitly say it isn't there.

8. In "note", say what you changed, under twelve words.

BOTH CASES:

9. "index" refers to the numbered list below. Use those exact numbers.

10. When a food CHANGES, its calories and macros must change with it. Spinach
    is not egg. Work them out fresh for the new food at a sensible weight.

11. Cooking method changes fat and calories, not identity. Rice fried in oil
    carries meaningfully more than boiled rice — reflect that in the numbers
    and say so in the name ("Jollof rice, fried").

12. Oil, butter and dressing they mention are real calories and usually the
    biggest thing a photo misses. Add them as their own item where that makes
    sense.

13. Keep an existing weight unless they said otherwise — usually they're
    telling you WHAT it was, not how much.

14. ROUND. Calories to the nearest 10 above 100, nearest 5 below. Macros to
    whole grams. Calories must match the macros: protein and carbs about 4 a
    gram, fat about 9.

15. "amountLabel" must stay PICTURABLE — "a cup", "a palm-sized piece", "two
    slices". Never "a serving" or "a portion".

16. "sure" for something they told you themselves is "high" when they gave an
    amount too, "medium" when they named the food but not the amount.

THE TRANSCRIPT IS MESSY:

17. This came from speech recognition. Expect false starts, filler words and
    misheard words, and read through them the way a person would. "Spin itch"
    is spinach. "Jelly rice" is jollof rice.

18. The speaker never sees the transcript, so refusing over a garbled word
    helps nobody — if their intent is clear, act on it.

WHEN YOU GENUINELY CAN'T TELL:

19. If you cannot work out what they mean, set "understood" to false, leave
    edits, removes and adds EMPTY, and put one short sentence in "problem"
    addressed to them.

20. Do the same if there's nothing about food in what they said at all.

21. NEVER guess between two possible items. Leaving the plate untouched and
    asking again is always better than changing the wrong thing.`;

/** Apply a spoken description or correction to a plate.

    NEVER THROWS — failures come back with understood:false and a problem
    message, same contract as the readers. */
export async function fixMealWithVoice(
  items: MealItem[],
  transcript: string,
  onProgress?: Progress
): Promise<MealFix> {
  if (!GEMINI_KEY) return fail("Voice isn't set up on this build.");

  const text = transcript.trim();
  if (text.length < 3) {
    return fail("MOTION didn't catch that — try again?");
  }
  if (!items.length) {
    return fail("There's nothing on the plate to describe yet.");
  }

  /* the numbered list the prompt refers to. Names, amounts and current
     numbers, so the model can judge what needs recalculating. */
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
      /* same warmth as the voice reader — interpreting messy speech needs a
         little flexibility, but this is correction, not invention */
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
          const parsed = await parseResponse(res, items);
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

async function parseResponse(res: Response, items: MealItem[]): Promise<MealFix | null> {
  const itemCount = items.length;

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

    /* an index the model invented would silently edit the wrong row, or crash
       on a row that doesn't exist — drop anything out of range */
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
          .filter(Boolean) as { index: number; item: MealItem }[])
      : [];

    const adds = Array.isArray(parsed.adds)
      ? (parsed.adds.map(toItem).filter(Boolean) as MealItem[]).slice(0, 8)
      : [];

    let removes = Array.isArray(parsed.removes)
      ? (parsed.removes.filter(validIndex).map((v: any) => Math.round(Number(v))) as number[])
      : [];

    const fullDescription = parsed.fullDescription === true;

    /* ---------- THE SAFETY NET ----------
       On a full description, everything they didn't account for should have
       been listed in "removes". Models forget this: they add the four things
       said and leave the phantom item sitting there, which is exactly the
       double-counting bug this file exists to prevent.

       So on a full description, anything neither EDITED nor explicitly kept is
       removed here, whether or not the model remembered to say so. */
    if (fullDescription) {
      const edited = new Set(edits.map((e) => e.index));
      const all = Array.from({ length: itemCount }, (_, i) => i);
      removes = all.filter((i) => !edited.has(i));
    }

    const changedSomething = edits.length > 0 || removes.length > 0 || adds.length > 0;

    /* a full description that removes everything and adds nothing would leave
       an empty plate — that's a misread, not an answer */
    const wouldEmpty = fullDescription && !adds.length && !edits.length;

    if (wouldEmpty) {
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

    /* THE MODEL SAYING "understood" ISN'T ENOUGH. If it claims to have
       understood but returns no changes, nothing would happen and the user
       would be left staring at an unchanged plate wondering whether it
       worked. Treat that as not understood. */
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
          : "MOTION didn't find anything to change from that — try describing the dish, like \"it's roasted broccoli, cauliflower and carrots\"."),
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