// constants/productPhoto.ts
// Reading a product's NAME off the front of a packet.
//
// THE COMPANION TO nutritionLabel.ts. That one reads the numbers; this one
// reads what the thing is called — and between them a food MOTION has never
// heard of becomes loggable without the user typing a word.
//
// WHY NOT JUST ASK THEM TO TYPE IT. Because they're standing in a kitchen or a
// shop aisle holding a bag, and "large green lentils" is a genuinely annoying
// thing to thumb into a phone. The camera is already open. The name is already
// printed on the packet in large letters. Asking them to transcribe something
// the phone can see is the kind of small friction that stops people logging at
// all.
//
// AND IT'S AN EASIER READ than the panel. Front-of-pack text is large,
// high-contrast and designed to be read across a shop — so this should
// succeed more often than the nutrition panel does, not less.

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;

/* the same two models, same order and same reasoning as nutritionLabel:
   lite first because this is transcription, not judgement.

   MODEL NAMES EXPIRE — if this stops working, check here first. The 404
   handler prints Google's own message, which names the replacement. */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

const endpointFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const ATTEMPTS = 2;

export type ProductReading = {
  /** what the food is — "Large green lentils" */
  name: string | null;
  /** who makes it, when the front says — "Great Value" */
  brand: string | null;
  confident: boolean;
  problem: string | null;
};

const PROMPT = `You are reading the FRONT of a food package from a photograph.

Return ONLY a JSON object. No markdown, no code fences, no explanation.

{
  "name": string or null,
  "brand": string or null,
  "confident": boolean,
  "problem": string or null
}

RULES:

1. "name" is what the FOOD is — "Large green lentils", "Greek yogurt",
   "Sriracha hot sauce". Sentence case, not the packet's shouting capitals.

2. "brand" is the manufacturer, when the front shows one — "Great Value",
   "Lee Kum Kee". Null if there isn't one or you can't read it. Do NOT put the
   brand in the name; they are separate fields.

3. Leave out marketing words that aren't part of the food's identity —
   "NEW!", "family size", "now with more flavour". Keep words that genuinely
   describe it: "unsalted", "wholegrain", "reduced fat", "extra virgin".

4. If the photo is blurry, or shows something that isn't food packaging, set
   "confident" to false and say why in "problem" in ONE short sentence
   addressed to the user — for example "That looks like the back of the pack"
   or "The name is too blurry to read". Leave name and brand null rather than
   guessing.

5. If you can read the food but not the brand, return the name and leave brand
   null. A partial answer is useful; an invented one is not.

Keep "problem" to one short sentence.`;

export type Progress = (message: string) => void;

/** Read a product name from a photo of the front of a packet.

    NEVER THROWS — every failure returns a reading with confident:false and a
    problem message, same contract as readNutritionLabel. */
export async function readProductFront(base64: string, onProgress?: Progress): Promise<ProductReading> {
  if (!GEMINI_KEY) {
    return { name: null, brand: null, confident: false, problem: "Photo reading isn't set up on this build." };
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
      /* zero temperature — the name is printed on the packet, there's nothing
         to be creative about */
      temperature: 0,
      maxOutputTokens: 300,
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
            console.log(`FRONT: ${model} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            return parsed;
          }
          continue;
        }

        lastStatus = res.status;
        const errText = await res.text().catch(() => "");
        console.log(`FRONT ${model} → ${lastStatus}`, errText.slice(0, 200));

        /* a 404 means this model is gone — straight to the next rather than
           retrying a name that will never work */
        if (lastStatus === 404) break;
        if (lastStatus !== 503 && lastStatus !== 429) break;

        onProgress?.(
          m === 0 && attempt === 0
            ? "Busy — trying again…"
            : "Still busy. Trying another reader…"
        );
      } catch (e: any) {
        console.log(`FRONT ${model} threw:`, e?.message || e);
        lastStatus = 0;
      }
    }
  }

  if (lastStatus === 503) {
    return { name: null, brand: null, confident: false, problem: "The reader's overloaded right now — nothing wrong with your photo. Try again in a moment, or type the name." };
  }
  if (lastStatus === 429) return { name: null, brand: null, confident: false, problem: "That's a lot of reads in a short time. Wait a minute, or type the name." };
  return { name: null, brand: null, confident: false, problem: "Couldn't reach the reader. Check your connection, or type the name instead." };
}

async function parseResponse(res: Response): Promise<ProductReading | null> {
  try {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
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

    const name = str(parsed.name);

    return {
      name,
      brand: str(parsed.brand),
      /* a reading with no name isn't a reading, whatever the model says about
         its own confidence */
      confident: parsed.confident !== false && !!name,
      problem: str(parsed.problem),
    };
  } catch {
    return null;
  }
}

function str(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}