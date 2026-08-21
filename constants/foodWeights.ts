// constants/foodWeights.ts
// What things weigh, and what they cost — the fixed values every reader uses.
//
// WHY THIS EXISTS. Asked the same meal five times, MOTION answered 1,065,
// 1,070, 1,065, 875 and 1,000 calories. The foods were identified correctly
// every time; the WEIGHTS moved. A supermarket chicken breast can be 100 g or
// 300 g, and with nothing anchoring it the model picked afresh each run.
//
// FIRST ATTEMPT: fix the grams. It half-worked — chicken breast locked at
// 575-580 for three runs, then came back 385. Fixing the weight still left
// the model multiplying by its OWN calories-per-gram, so there was a second
// place for the number to drift, and a long prompt gave it room to forget.
//
// SO THIS TABLE NOW CARRIES BOTH: what one unit weighs AND what one unit
// costs. "Two chicken breasts" is a lookup — 350 g, 580 calories — with no
// arithmetic left to wander.
//
// IT ALSO COVERS SERVINGS, not just countable things. "A plate of pasta" was
// the other half of the drift: nobody counts pasta, so the model was choosing
// how big a plate is, and 190 calories went missing on the run where it chose
// small. Common serving words now have fixed weights too.
//
// THIS ISN'T TEACHING THE MODEL ANYTHING. It already knows what a chicken
// breast weighs. The table's job is to stop it re-rolling the dice on the
// foods people say most often — same input, same number, every time.
//
// WHY NOT A REAL FOOD DATABASE? Fifty lines cost nothing and fit in every
// request. Half a million entries would fit in none of them. Long term the
// right answer is the model NAMING foods and USDA supplying the numbers —
// that plumbing already exists for search — but that's a bigger piece of work,
// and this closes most of the gap today.
//
// SHARED BY EVERY READER on purpose. Two readers with different numbers for a
// chicken breast would be its own bug, and an invisible one.

/** Dropped in at the TOP of each reader's prompt, before anything else.

    Position matters: this used to sit in the middle of thirty numbered rules
    and got followed about four times in five. Instructions buried in a long
    prompt compete with everything around them. */
export const WEIGHT_REFERENCE = `╔════════════════════════════════════════════════════════════╗
║  FIXED VALUES — READ THIS BEFORE ANYTHING ELSE             ║
╚════════════════════════════════════════════════════════════╝

The numbers below are NOT suggestions and NOT starting points. They are the
answer. When a food in this table appears, use its numbers exactly — do not
estimate, do not adjust, do not round differently.

The SAME words must always produce the SAME numbers. Someone logging the same
meal on Monday and Thursday must see the same total, or nothing else in this
app can be trusted.

COUNTED FOODS — multiply by how many they said.
Format: item = weight, calories per one

  MEAT AND FISH
    chicken breast, boneless      175 g   290 cal
    chicken thigh, boneless        90 g   180 cal
    chicken drumstick               80 g   150 cal
    beef or lamb steak            225 g   500 cal
    beef burger patty             110 g   280 cal
    pork chop                     150 g   290 cal
    sausage                        60 g   180 cal
    rasher of bacon                25 g   110 cal
    meatball                       30 g    70 cal
    salmon fillet                 150 g   310 cal
    white fish fillet             140 g   150 cal
    prawn, peeled                  10 g    10 cal
    tin of tuna, drained          145 g   180 cal

  EGGS AND DAIRY
    large egg                      50 g    70 cal
    egg white                      33 g    17 cal
    slice of cheese                20 g    80 cal
    tablespoon of butter           14 g   100 cal
    cup of whole milk             240 ml  150 cal

  BREAD AND GRAINS
    slice of sandwich bread        40 g   105 cal
    slice of thick or sourdough    50 g   130 cal
    bread roll or bun              60 g   170 cal
    bagel                         100 g   270 cal
    tortilla or wrap               45 g   140 cal
    slice of pizza                120 g   285 cal

  FRUIT AND VEGETABLES
    banana, peeled                120 g   105 cal
    apple                         180 g    95 cal
    orange                        130 g    60 cal
    half an avocado               100 g   160 cal
    medium potato                 170 g   145 cal
    sweet potato                  150 g   130 cal
    tomato                        120 g    22 cal
    onion                         110 g    45 cal
    carrot                         60 g    25 cal
    bell pepper                   120 g    30 cal
    mushroom                       20 g     4 cal
    clove of garlic                 3 g     4 cal

  FATS, SAUCES AND EXTRAS — the ones photos miss
    tablespoon of any cooking oil  14 g   120 cal
    teaspoon of any cooking oil     5 g    40 cal
    tablespoon of heavy cream      15 g    50 cal
    tablespoon of mayonnaise       14 g   100 cal
    tablespoon of peanut butter    16 g    95 cal
    tablespoon of tomato paste     16 g    13 cal
    tablespoon of curry paste      16 g    35 cal
    stock or bouillon cube         10 g    20 cal
    scoop of protein powder        30 g   120 cal
    handful of nuts                30 g   180 cal
    biscuit or cookie              15 g    70 cal

SERVINGS — when they name a serving rather than a count.
These are also FIXED. Nobody counts pasta, so without this the size of "a
plate" moves between answers and takes 200 calories with it.

    a plate of cooked pasta       250 g   390 cal   (before sauce)
    a bowl of cooked rice         250 g   325 cal
    a cup of cooked rice          160 g   205 cal
    a cup of cooked pasta         140 g   220 cal
    a bowl of soup                350 ml
    a bowl of stew or curry       250 g
    a cup of cooked beans/lentils 170 g   200 cal
    a cup of cooked oats          230 g   150 cal
    a portion of vegetables       120 g
    a handful of salad leaves      30 g     8 cal
    a side salad                  100 g
    a glass of juice              250 ml  115 cal

  Sauce, oil and cheese are counted SEPARATELY from the plate of pasta above —
  that number is the pasta alone.

MEASURES
    cup = 240 ml · tablespoon = 15 ml · teaspoon = 5 ml

ANYTHING NOT LISTED:

  Use the nearest category rather than inventing a number.
    a medium fruit                150 g
    a small fruit                  80 g
    a large fruit                 200 g
    a medium vegetable            120 g
    a boneless portion of meat    150 g
    a cup of any cooked grain     160 g
    a spoonful of any fat or oil   14 g
    a cup of any liquid           240 ml

  TAKE THE MIDDLE. When a food could plausibly be 100 g or 300 g, use the
  middle, never either end. The low end makes someone's day look better than
  it was; the high end makes it look worse. Only the middle is stable enough
  that two logs of the same meal can be compared.

BEFORE YOU ANSWER, CHECK: did any food in your answer appear in the table
above? If so, does your number match it exactly? If it doesn't, fix it. This
is the most common mistake made here — the table is read, then quietly
overridden by an estimate that felt more precise.

╚════════════════════════════════════════════════════════════╝`;