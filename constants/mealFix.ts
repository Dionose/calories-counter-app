// constants/mealFix.ts
// Talking to a photo estimate — describing the dish, or fixing what's wrong.
//
// THE PERSON WHO ATE IT KNOWS THINGS THE PHOTO CAN'T SHOW. A camera sees the
// surface: it can't tell mashed spinach from scrambled egg, can't see what the
// rice was fried in, can't know it was cooked with butter. Whoever made it can
// say all of that in a sentence, and it moves the numbers more than correcting
// a single item ever would.
//
// So this handles BOTH:
//   DESCRIBING  — "it's jollof rice, fried in groundnut oil, with chicken"
//                 may legitimately update several items at once, because the
//                 description speaks to all of them.
//   CORRECTING  — "the green one is spinach, not eggs" changes exactly one.
//
// IT RETURNS INSTRUCTIONS, NOT A NEW PLATE. The model is given the current
// items and asked what to CHANGE. Handing back a whole fresh plate would
// re-guess the items that were already right: correct the spinach and the
// beans come back different, which reads as the app being unreliable even
// though the correction worked.
//
// SILENCE IS NOT DENIAL. Someone describing jollof rice won't list every
// ingredient — they may never mention the carrots the photo clearly shows.
// Unmentioned items are LEFT ALONE, never removed. Only an explicit "there's
// no X" removes anything.
//
// WHEN IT CAN'T TELL, IT DOES NOTHING. A sentence that could mean two items
// comes back as understood:false and the plate is untouched. A silent wrong
// change to a plate someone already checked is worse than being asked to say
// it again.
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
  /** drop these indexes — only ever from an explicit denial */
  removes: number[];
  /** append these */
  adds: MealItem[];
  /** false means the plate must be left exactly as it was */
  understood: boolean;
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

WHAT THEY MIGHT BE DOING:

1. The list below was estimated from a PHOTOGRAPH, which only shows the
   surface. They may be doing either of these, or both at once:

   DESCRIBING THE DISH — telling you what it actually is and how it was made.
   "It's jollof rice, fried in groundnut oil, with chicken." This is the most
   valuable thing they can give you: cooking method, oil, butter, cream,
   stock, and what a dish actually is are all invisible in a photo and change
   the numbers a great deal.

   CORRECTING A MISTAKE — "the green one is mashed spinach, not eggs."

2. A DESCRIPTION MAY UPDATE SEVERAL ITEMS AT ONCE. If they say the whole dish
   was fried in oil, every item that was fried is affected. If they name the
   dish and the list is a rough version of it, improve each item the
   description genuinely speaks to.

WHAT YOU MUST NOT TOUCH:

3. ANY ITEM THE DESCRIPTION DOESN'T SPEAK TO IS LEFT OUT of your answer
   entirely. Re-guessing items that were already right is the single worst
   thing you can do here.

4. NOT MENTIONING SOMETHING IS NOT DENYING IT. People describing a dish list
   the main things and skip the rest — someone describing jollof rice may
   never mention the carrots in it, even though the photo clearly shows them.
   An item they simply didn't talk about STAYS EXACTLY AS IT IS. Never remove
   something just because it went unmentioned.

5. Only put an index in "removes" when they EXPLICITLY say it isn't there:
   "there's no butter on that toast", "that's not chicken, there's no meat in
   it at all".

6. "index" refers to the numbered list below. Use those exact numbers.

WHICH ACTION TO USE:

7. EDIT when an item is actually a different food, a different amount, or was
   cooked differently than assumed. Change the name if the food changed, and
   recalculate calories and macros to match.

8. ADD when they mention something the photo missed — "there was also a glass
   of orange juice", "there's butter under that".

9. REMOVE only under rule 5.

THE NUMBERS:

10. When a food CHANGES, its calories and macros must change with it. Spinach
    is not egg. Work them out fresh for the new food at the weight given.

11. Cooking method changes fat and calories, not identity. Rice fried in oil
    carries meaningfully more than boiled rice — reflect that in the numbers
    and say so in the name ("Jollof rice, fried").

12. Keep the existing weight unless they said otherwise — most of the time
    they're telling you WHAT it was, not how much.

13. ROUND. Calories to the nearest 10 above 100, nearest 5 below. Macros to
    whole grams. Calories must match the macros: protein and carbs about 4 a
    gram, fat about 9.

14. "amountLabel" must stay PICTURABLE — "a cup", "a palm-sized piece", "two
    slices". Never "a serving" or "a portion".

15. "sure" for something they told you themselves is "high" when they gave an
    amount too, "medium" when they named the food but not the amount.

THE TRANSCRIPT IS MESSY:

16. This came from speech recognition. Expect false starts, filler words and
    misheard words, and read through them the way a person would. "Spin itch"
    is spinach. "Jelly rice" is jollof rice.

17. The speaker never sees the transcript, so refusing over a garbled word
    helps nobody — if their intent is clear, act on it.

WHEN YOU GENUINELY CAN'T TELL:

18. If you cannot work out which item they mean, or what they want changed,
    set "understood" to false, leave edits, removes and adds EMPTY, and put
    one short sentence in "problem" addressed to them — for example "MOTION
    wasn't sure which item you meant — try naming it, like 'the green one is
    spinach'".

19. Do the same if there's nothing about food in what they said at all.

20. NEVER guess between two possible items. Leaving the plate untouched and
    asking again is always better than changing the wrong thing.

21. "note" is one short line saying what you changed, addressed to them:
    "Updated the rice for frying in oil." Keep it under twelve words.`;

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

    const removes = Array.isArray(parsed.removes)
      ? (parsed.removes.filter(validIndex).map((v: any) => Math.round(Number(v))) as number[])
      : [];

    const adds = Array.isArray(parsed.adds)
      ? (parsed.adds.map(toItem).filter(Boolean) as MealItem[]).slice(0, 5)
      : [];

    const changedSomething = edits.length > 0 || removes.length > 0 || adds.length > 0;

    /* THE MODEL SAYING "understood" ISN'T ENOUGH. If it claims to have
       understood but returns no changes, nothing would happen and the user
       would be left staring at an unchanged plate wondering whether it
       worked. Treat that as not understood. */
    return {
      edits,
      removes,
      adds,
      understood: parsed.understood !== false && changedSomething,
      note: str(parsed.note),
      problem:
        str(parsed.problem) ||
        (changedSomething
          ? null
          : "MOTION didn't find anything to change from that — try describing the dish, like \"it's jollof rice fried in oil\"."),
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
  return { edits: [], removes: [], adds: [], understood: false, note: null, problem };
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