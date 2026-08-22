// constants/addIngredient.ts
// "I forgot the scotch bonnet."
//
// WHY THIS EXISTS SEPARATELY FROM mealFix.ts. That one takes a whole plate and
// a spoken correction and works out what changed across every item — a big,
// careful call that has to decide what was replaced, what was set aside, and
// what stayed. This is the opposite: ONE row, ONE thing that was left out,
// price it and hand it back.
//
// Splitting them means this call can be small and fast, and — more
// importantly — it CANNOT touch anything else. Dion's rule for this feature
// was that existing numbers must not move: whatever is already on a dish keeps
// exactly the calories it was given, and the new thing simply joins the total.
// Re-estimating the whole dish would be more "accurate" in theory and would
// quietly change figures the user had already read and accepted.
//
// WHAT PROMPTED IT. Dion described a meal at length and one item — a scotch
// bonnet — didn't survive into the result. Re-describing an entire plate to
// add one pepper is absurd, and forgetting something is the ordinary case
// rather than the edge case.
//
// ⚠️ IT NEVER ARGUES ABOUT WHAT BELONGS. The first version of this prompt said
// "ingredients someone FORGOT to mention, to a dish" — and the model started
// judging plausibility. Told "two steaks", it refused: steak isn't an
// ingredient of chicken drumsticks. It also refused paprika once and accepted
// it the next time, because that judgment was never stable.
//
// That was never its job. If someone says they ate steak with the drumsticks,
// that's their plate. An app that tells a person they can't have eaten what
// they just said they ate is worse than one that's occasionally imprecise —
// and the refusal reads as "this feature doesn't work", so they stop using it.
// The dish name is context for judging AMOUNTS, nothing else.

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* Same chain as every other reader: the light model first, the heavier one as
   fallback. Pricing one item is a small task and the lighter model does it
   well.

   MODEL NAMES EXPIRE. This chain has already been through two dead names —
   check here first if calls start failing. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export type AddedPart = {
  name: string;
  amountLabel: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type AddResult = {
  parts: AddedPart[];
  /** what to tell the user in one line, or null when nothing came back */
  note: string | null;
  error: string | null;
};

const PROMPT = `You price food that someone has just told you they ate.

They are looking at one item in a meal they have logged, and they are adding something that was left out. Return ONLY a JSON object. No markdown, no code fences, no explanation.

{
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
  ],
  "note": string or null
}

THE MOST IMPORTANT RULE:

NEVER refuse something because it does not seem to belong. You are not
checking whether an ingredient makes sense in a recipe, and you are not
judging whether the food goes together. If they say two steaks, price two
steaks. If they say ice cream on their curry, price ice cream. It is their
plate, they were there, and they are telling you what was on it. Refusing is
always the wrong answer.

The item's name is given to you ONLY so you can judge sensible amounts — how
big a spoon of sauce is likely to be for that kind of dish. It is never a
reason to reject anything.

THE REST:

1. ONLY what they just said. Do not add anything else you think belongs,
   however obvious it seems. If they say "scotch bonnet", return the scotch
   bonnet and nothing else — they are correcting one specific omission, not
   asking you to rebuild a recipe.

2. SEASONINGS ARE SMALL. Spices, herbs, peppers, a splash of vinegar, a pinch
   of salt — usually between 0 and 15 calories, and returning 40 for a chilli
   is a real error that adds up across a plate. A whole scotch bonnet is about
   5 g and roughly 2 calories. A teaspoon of dried spice is about 2 g and
   roughly 6 calories.

3. FATS AND OILS ARE THE EXCEPTION, and the reason this feature matters. A
   tablespoon of oil is about 14 g and 120 calories; butter is about 14 g and
   100 calories; a tablespoon of heavy cream is about 15 g and 50 calories.
   When someone remembers they fried something, that number is large and
   should look large.

4. WHOLE FOODS ARE PRICED AS WHOLE FOODS. "Two steaks" is two steaks — roughly
   220 g each and about 550 calories for the pair, more if they say ribeye.
   Do not shrink a real food down to a garnish because it arrived through this
   screen.

5. If they gave an amount, use it. If they gave none, assume a normal quantity
   for one person and say so in amountLabel — "about a teaspoon", "a splash".
   Never demand precision they didn't offer.

6. amountLabel is what a person would say out loud, not a measurement:
   "one scotch bonnet", "a tablespoon of butter", "two steaks", "a pinch". It
   appears on screen exactly as you write it.

7. If they mention SEVERAL things, return one entry for each.

8. "note" is one short sentence saying what was added, in plain language and
   under 15 words. Example: "Added a scotch bonnet and a teaspoon of cumin."

9. Return an empty parts array ONLY if what they said contains no food at all
   — silence, a stray noise, or a sentence about something else entirely. Put
   the reason in "note". This is the only case where returning nothing is
   correct, and it is rare. If you can find any food in what they said, price
   it.

Round every number to a whole number. Grams and calories are never negative.`;

/** Price what they said, as something belonging to one row.

    NEVER THROWS. Every failure comes back as an empty result with a message,
    so callers don't need a try/catch — and a thrown error inside a voice
    handler would leave the sheet spinning forever. */
export async function addIngredients(
  dishName: string,
  spoken: string
): Promise<AddResult> {
  if (!GEMINI_KEY) {
    return { parts: [], note: null, error: "Voice adding isn't set up on this build." };
  }

  const said = spoken.trim();
  if (said.length < 2) {
    return { parts: [], note: null, error: "MOTION didn't catch that. Try again?" };
  }

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            /* the wording matters — "they are adding this to" rather than
               "this is an ingredient of", so nothing invites the model to
               check whether it fits */
            text: `They are adding this to an item called: ${dishName}\n\nThey said: "${said}"`,
          },
        ],
      },
    ],
    generationConfig: {
      /* ZERO, not 0.1. At 0.1 the same words gave different answers on
         different tries — paprika was refused once and accepted the next time,
         and so was a steak. Someone who says the same thing twice and gets two
         different results stops trusting every number in the app. */
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  let lastStatus = 0;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 900));

      try {
        const res = await fetch(`${endpointFor(model)}?key=${GEMINI_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (res.ok) {
          const parsed = await parseResponse(res);
          if (parsed) return parsed;
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`ADD-INGREDIENT ${model} → ${lastStatus}`, errText.slice(0, 160));

        /* a dead model name never recovers — move on rather than retrying it */
        if (lastStatus === 404) break;
        if (lastStatus !== 503 && lastStatus !== 429) break;
      } catch (e: any) {
        console.log("ADD-INGREDIENT threw:", e?.message || e);
        lastStatus = 0;
      }
    }
  }

  if (lastStatus === 503) {
    return { parts: [], note: null, error: "MOTION's busy right now — try again in a moment." };
  }
  return { parts: [], note: null, error: "Couldn't add that. Check your connection and try again." };
}

async function parseResponse(res: Response): Promise<AddResult | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const clean = text.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      /* one salvage attempt — everything between the first { and the last } */
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      parsed = JSON.parse(clean.slice(start, end + 1));
    }

    const raw = Array.isArray(parsed.parts) ? parsed.parts : [];

    const parts: AddedPart[] = raw
      .map((p: any) => ({
        name: String(p?.name || "").trim(),
        amountLabel: String(p?.amountLabel || "a little").trim(),
        grams: num(p?.grams),
        calories: num(p?.calories),
        protein: num(p?.protein),
        carbs: num(p?.carbs),
        fat: num(p?.fat),
      }))
      /* a nameless part would render as an empty row with a number beside it,
         which looks like a rendering fault rather than data */
      .filter((p: AddedPart) => p.name.length > 0);

    return {
      parts,
      note: typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : null,
      error: null,
    };
  } catch {
    return null;
  }
}

/** whole numbers, never negative, never NaN */
function num(v: any): number {
  const n = Math.round(Number(v));
  return isFinite(n) && n > 0 ? n : 0;
}