import type { CategoryRequirements, LookAnalysis, LookCategory, ProductMatchCategoryName, ProductMatchRequirement } from "@/lib/look-analysis/types";
import type { MakeupTutorial, TutorialPhase, TutorialProductSlot, TutorialStep, TutorialSwatch, TutorialTool } from "./types";

const minimumConfidence = 0.4;

const swatchColours: [RegExp, string][] = [
  [/burgundy|wine|oxblood/i, "#6d2336"], [/plum|aubergine/i, "#6f3a5a"], [/berry|raspberry/i, "#9a3556"],
  [/terracotta|brick|rust/i, "#b5593f"], [/coral/i, "#e8735f"], [/peach|apricot/i, "#f0a98a"],
  [/orange/i, "#e08a3c"], [/copper/i, "#b8693d"], [/bronze/i, "#a87546"], [/gold|champagne/i, "#d9b877"],
  [/rosewood|dusty rose/i, "#b57577"], [/mauve/i, "#a77a87"], [/rose|pink/i, "#d98a97"], [/red/i, "#b3293a"],
  [/taupe/i, "#8f7b72"], [/chocolate|espresso|dark brown/i, "#4a2f27"], [/brown|chestnut|auburn/i, "#7a4a38"],
  [/nude|beige|sand|cream|ivory/i, "#d9b9a2"], [/black|charcoal/i, "#26201f"], [/grey|gray|silver/i, "#9a9696"],
  [/blue|navy/i, "#3f5b8c"], [/green|olive/i, "#6b7a4d"], [/purple|lilac|lavender/i, "#8b6bb0"],
];

function swatchColour(colourFamily: string | null): string | null {
  if (!colourFamily) return null;
  return swatchColours.find(([pattern]) => pattern.test(colourFamily))?.[1] ?? null;
}

const placeholderWord = /\b(unknown|n\/a|none|null|undefined|unspecified)\b/gi;

// Removes placeholder words, adjacent repeated words ("bold bold") and repeated phrases ("cool tones tones").
function tidy(text: string): string {
  return text
    .replace(placeholderWord, " ")
    .replace(/\b([\p{L}'-]+(?:\s+[\p{L}'-]+)?)(?:\s+\1\b)+/giu, "$1")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;])(\s*[,;])+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clean(value: string | null | undefined): string | null {
  const text = tidy(value ?? "");
  return text.length > 0 ? text : null;
}

function lower(value: string | null): string | null {
  return value ? value.toLowerCase() : null;
}

function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Joins descriptors and skips any word an earlier part already used, so "matte" + "matte purple" reads "matte purple".
function phrase(...parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const part of parts) {
    for (const word of tidy(part ?? "").toLowerCase().split(/\s+/).filter(Boolean)) {
      if (seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }
  }
  return words.join(" ");
}

function article(text: string): string {
  return /^[aeiou]/i.test(text) ? "an" : "a";
}

function finishKind(finish: string | null): "shimmer" | "glossy" | "soft" {
  if (finish && /shimmer|glitter|metallic|foil|sparkl|pearl|frost/i.test(finish)) return "shimmer";
  if (finish && /gloss|shiny|dewy|wet|plump/i.test(finish)) return "glossy";
  return "soft";
}

function depth(intensity: string | null): "sheer" | "soft" | "medium" | "bold" {
  switch (intensity) {
    case "sheer": return "sheer";
    case "soft": case "light": return "soft";
    case "bold": case "intense": return "bold";
    default: return "medium";
  }
}


function slotFor(requirement: ProductMatchRequirement): TutorialProductSlot {
  return {
    category: requirement.category,
    attributes: {
      subtype: clean(requirement.subtype), colour_family: clean(requirement.colour_family), undertone: clean(requirement.undertone) as ProductMatchRequirement["undertone"], finish: clean(requirement.finish),
      intensity: clean(requirement.intensity) as ProductMatchRequirement["intensity"], application_style: clean(requirement.application_style), coverage: clean(requirement.coverage), product_form: clean(requirement.product_form),
    },
  };
}

function slotFromCategory(category: ProductMatchCategoryName, source: CategoryRequirements): TutorialProductSlot {
  return {
    category,
    attributes: { subtype: null, colour_family: clean(source.colourFamily), undertone: clean(source.undertone) as ProductMatchRequirement["undertone"], finish: clean(source.finish), intensity: null, application_style: null, coverage: null, product_form: null },
  };
}

function trusted(source: CategoryRequirements): boolean {
  return source.confidenceScore >= minimumConfidence && Boolean(clean(source.colourFamily) || clean(source.description));
}

const product = (label: string, category: ProductMatchCategoryName | null): TutorialTool => ({ label: sentence(tidy(label)), kind: "product", category });
const tool = (label: string): TutorialTool => ({ label, kind: "tool", category: null });

// Wording for how strong the layer should be, shared by the application steps.
const layerWords = { sheer: "a sheer wash", soft: "a soft layer", medium: "a medium layer", bold: "a rich first layer" } as const;

function evidence(source: CategoryRequirements | null): string {
  return [source?.description, source?.productCategory, ...(source?.characteristics ?? [])].map((item) => clean(item) ?? "").join(" ").toLowerCase();
}

type StepDraft = {
  phase: TutorialPhase;
  key: string;
  title: string;
  category: ProductMatchCategoryName;
  source: CategoryRequirements | null;
  requirement: ProductMatchRequirement | null;
  instruction: string;
  tools: TutorialTool[];
  tip: string | null;
  minutes: number;
  slots: TutorialProductSlot[];
};

export function buildMakeupTutorial(analysis: LookAnalysis): MakeupTutorial {
  const { categories, look_profile: profile } = analysis;
  const matching = analysis.product_matching.categories.filter((item) => item.confidence >= minimumConfidence);
  const matchesFor = (...names: ProductMatchCategoryName[]) => matching.filter((item) => names.includes(item.category));
  const steps: TutorialStep[] = [];
  let techniqueScore = 0;

  // Look complexity decides which optional steps earn a place, so simple looks stay short.
  const overallLevel = profile.overall_intensity;
  const styleText = `${profile.overall_makeup_style ?? ""} ${profile.key_makeup_characteristics.join(" ")}`;
  const complexity: "simple" | "medium" | "bold" =
    overallLevel === "bold" || overallLevel === "intense" || /glam|dramatic|smoky|editorial|graphic|statement/i.test(styleText) ? "bold"
      : overallLevel === "sheer" || overallLevel === "light" || /natural|soft|minimal|fresh|everyday|barely/i.test(styleText) ? "simple"
        : "medium";

  const add = (draft: StepDraft) => {
    const { source, requirement } = draft;
    steps.push({
      id: draft.key, phase: draft.phase, title: draft.title, category: draft.category,
      attributes: {
        colour: lower(clean(source?.colourFamily) ?? clean(requirement?.colour_family)),
        finish: lower(clean(source?.finish) ?? clean(requirement?.finish)),
        intensity: lower(clean(source?.intensity) ?? clean(requirement?.intensity)),
        undertone: lower(clean(source?.undertone) ?? clean(requirement?.undertone)),
      },
      instruction: tidy(draft.instruction), tools: draft.tools, tip: draft.tip ? tidy(draft.tip) : null, minutes: draft.minutes, productSlots: draft.slots,
    });
  };

  // Complexion: only when the analysis contains base products.
  const base = matchesFor("foundation", "concealer");
  if (base.length) {
    const lead = base[0];
    const coverage = lower(clean(lead.coverage));
    const finish = lower(clean(lead.finish));
    const descriptor = phrase(coverage, finish) || "natural";
    const hasConcealer = base.some((item) => item.category === "concealer");
    add({
      phase: "complexion", key: "complexion", title: "Even out the complexion", category: lead.category, source: null, requirement: lead,
      instruction: `To recreate the ${descriptor} base in this look, place a small amount of foundation or skin tint at the centre of the face and blend it outward with a damp sponge or foundation brush, using pressing motions rather than dragging. Concentrate on the areas where you want more evenness and sheer it out towards the hairline and jaw so your skin still looks like skin. ${hasConcealer ? "Tap concealer only where you want extra brightness or coverage and blend the edges until they disappear. " : ""}Choose a shade that matches your own skin tone.`,
      tools: [product(`${descriptor} foundation or skin tint`, "foundation"), ...(hasConcealer ? [product("Concealer", "concealer")] : []), tool("Damp sponge or foundation brush")],
      tip: "Start with less than you think you need and add coverage only where it is useful.",
      minutes: 5, slots: base.map(slotFor),
    });
  }

  // Eyes: placement, blending, then lash line and lashes.
  if (trusted(categories.eyeshadow)) {
    const eyes = categories.eyeshadow;
    const colour = lower(clean(eyes.colourFamily));
    const finish = lower(clean(eyes.finish));
    const shade = phrase(finish, colour) || "eyeshadow";
    const shadeName = `${shade}${/eyeshadow|shadow/.test(shade) ? "" : " eyeshadow"}`;
    const kind = finishKind(finish);
    const level = depth(clean(eyes.intensity));
    const slots = [slotFromCategory("eyeshadow", eyes)];
    const eyeProducts = [product(shadeName, "eyeshadow")];

    if (level === "bold" || (kind === "shimmer" && level !== "sheer" && level !== "soft") || (complexity === "bold" && level === "medium")) {
      add({
        phase: "eyes", key: "eyes-prep", title: "Prep the lids", category: "eyeshadow", source: null, requirement: null,
        instruction: `Dab a very small amount of concealer or eyeshadow primer over the mobile lid and up to the crease, then blend it out with a fingertip or flat brush. Let it settle for a few seconds. This is a general preparation step rather than something visible in the look: it gives the ${shadeName} an even base so the colour shows true and stays put. Skip it if your lids are already even and the shadow grips well.`,
        tools: [product("Concealer or eyeshadow primer", "concealer"), tool("Fingertip or flat brush")],
        tip: "Keep this layer thin — too much product can make shadow settle into creases.",
        minutes: 2, slots: [],
      });
    }

    const place = kind === "shimmer"
      ? `Press ${shade} onto the centre of the mobile lid with a flat eyeshadow brush or your fingertip. Pressing rather than sweeping keeps the shimmer concentrated and smooth. Keep the strongest colour close to the lash line, then tap a little towards the inner corner to catch the light. Build ${layerWords[level]} with short patting movements.`
      : `Start with ${layerWords[level]} of ${shade} over the mobile lid using a flat eyeshadow brush, working from the outer half towards the centre. Keep the strongest colour close to the lash line and in the centre of the lid, and tap off excess before it touches the skin.${level === "bold" ? " Press a second layer on the centre and outer half for a deeper payoff. Stay on the lid for now — blending comes next." : ""}`;
    const blend = `With a clean fluffy brush, blend the edges of the colour upward into the crease using small circular motions. Work at the outer corner first, where the colour should sit deepest, then fade it softly towards the inner third. Stop below the brow bone so the eye stays defined. ${level === "bold" ? "Add a second thin layer to the outer third to deepen it, then blend the edges again." : level === "medium" ? "If you want more depth, add one thin layer to the outer third and blend again." : "Keep the pressure light so the colour stays a soft haze."}`;

    const splitEyes = level === "bold" || (level === "medium" && complexity === "bold");
    if (!splitEyes) {
      const soft = level === "sheer" || level === "soft";
      add({
        phase: "eyes", key: "eyes-colour", title: soft ? "Wash the lids with colour" : "Build the eye colour", category: "eyeshadow", source: eyes, requirement: null,
        instruction: soft
          ? `${place} Then, with a clean fluffy brush, blend the edges upward into the crease with small circular motions and stop below the brow bone. Keep the pressure light so the colour stays a soft haze rather than a defined shape.`
          : `${place} Then, with a clean fluffy brush, blend the edges upward into the crease using small circular motions, working at the outer corner first and fading towards the inner third. Stop below the brow bone, and add one thin layer to the outer third if you want more depth.`,
        tools: [...eyeProducts, tool("Flat eyeshadow brush"), tool("Fluffy blending brush")],
        tip: "Build the colour in thin layers — it is easier to add intensity than to remove it.",
        minutes: 3, slots,
      });
    } else {
      add({
        phase: "eyes", key: "eyes-colour", title: "Place the main colour", category: "eyeshadow", source: eyes, requirement: null,
        instruction: place, tools: [...eyeProducts, tool(kind === "shimmer" ? "Flat shadow brush or fingertip" : "Flat eyeshadow brush")],
        tip: kind === "shimmer" ? "Press, don't sweep — it keeps shimmer on the lid instead of the cheeks." : "Tap the brush on the back of your hand first so the first application isn't too heavy.",
        minutes: 3, slots,
      });
      add({
        phase: "eyes", key: "eyes-blend", title: "Blend and build", category: "eyeshadow", source: eyes, requirement: null,
        instruction: blend, tools: [tool("Clean fluffy blending brush"), ...eyeProducts],
        tip: "Build the colour in thin layers — it is easier to add intensity than to remove it.",
        minutes: 3, slots: [],
      });
    }
  }

  // Lash line and lashes. The analysis combines them, so only describe what its text supports.
  if (trusted(categories.linerMascara)) {
    const lashes = categories.linerMascara;
    const linerMatch = matchesFor("eyeliner")[0] ?? null;
    const mascaraMatch = matchesFor("mascara")[0] ?? null;
    const text = evidence(lashes);
    const wing = /wing|flick|cat[- ]?eye|graphic/.test(text);
    const linerEvidence = Boolean(linerMatch) || /liner|line|smoky|smoked|smudg/.test(text);
    const mascaraEvidence = Boolean(mascaraMatch) || /mascara|lash/.test(text);
    const colour = lower(clean(lashes.colourFamily)) ?? "black";
    const level = depth(clean(lashes.intensity));
    const smudged = /smoky|smoked|smudg|soft/.test(text) || level === "soft" || level === "sheer";

    if (linerEvidence) {
      techniqueScore += wing ? 3 : 1.5;
      add({
        phase: "lashes_liner", key: "liner", title: wing ? "Draw the winged liner" : "Define the lash line", category: "eyeliner", source: lashes, requirement: linerMatch,
        instruction: wing
          ? `Rest your elbow on a table and look slightly down into a mirror. Draw a thin line along the upper lash line, starting at the centre and working outward, then sweep the tip up and out towards the end of your brow. Close the wing by connecting it back to the lash line. Return to the inner corner with short strokes, keeping the line thinnest there and slightly thicker towards the outer third. Check that both wings point the same way before you add more.`
          : `Rest your elbow on a table and look slightly down into a mirror. Draw short connected strokes in ${colour} along the upper lash line, from the outer corner inward and as close to the roots as you can. Keep the line thin at the inner corner and slightly thicker towards the outer third. ${smudged ? "Soften the edge with a small smudge brush so it reads as depth rather than a hard line." : level === "bold" ? "Go over it once more for a deeper, more defined line." : "Fill any gaps between the lashes with tiny dots of colour."}`,
        tools: [product(`${colour} eyeliner`, "eyeliner"), ...(smudged ? [tool("Small smudge brush")] : [])],
        tip: "Draw in short strokes rather than one long line — it is easier to correct and keeps the line even.",
        minutes: wing ? 4 : 3, slots: [linerMatch ? slotFor(linerMatch) : slotFromCategory("eyeliner", lashes)],
      });
    }
    if (mascaraEvidence || !linerEvidence) {
      add({
        phase: "lashes_liner", key: "lashes", title: "Finish the lashes", category: "mascara", source: linerEvidence ? null : lashes, requirement: mascaraMatch,
        instruction: `Curl the lashes if you like. Place the mascara wand at the base of the upper lashes and wiggle it gently as you pull through to the tips. ${level === "sheer" || level === "soft" ? "One coat is enough to keep the lashes soft and natural." : "Add a second coat, concentrating on the outer lashes for lift and length."} For the lower lashes, use just the tip of the wand with light strokes. Comb through with a clean spoolie while the formula is still wet to separate any clumps.`,
        tools: [product(`${linerEvidence ? "Black" : colour} mascara`, "mascara"), tool("Eyelash curler"), tool("Spoolie")],
        tip: "Wiggle the wand at the roots first — that is where the lift comes from.",
        minutes: 2, slots: [mascaraMatch ? slotFor(mascaraMatch) : slotFromCategory("mascara", lashes)],
      });
    }
  }

  // Brows: describe the visible definition; never assume sparse brows.
  if (trusted(categories.brows)) {
    const brows = categories.brows;
    const colour = lower(clean(brows.colourFamily));
    const level = depth(clean(brows.intensity));
    const definition = level === "bold" ? "strong, defined" : level === "medium" ? "defined" : "soft, natural";
    add({
      phase: "brows", key: "brows", title: "Shape the brows", category: "brows", source: brows, requirement: null,
      instruction: `Brush the brows upward and outward with a spoolie to see their natural shape. Using a brow pencil or powder in ${colour ? phrase(colour) : "a shade close to your own brow colour"}, add short, hair-like strokes along the brow, following your natural shape and working from the middle towards the tail. Keep the front softer by starting the colour a little further in. Add definition only where it helps you match the ${definition} brow in this look, then brush through with the spoolie to blend any harsh lines.`,
      tools: [product(`${colour ? phrase(colour) : "Natural shade"} brow pencil or powder`, "brows"), tool("Spoolie"), ...(level === "bold" || level === "medium" ? [product("Clear or tinted brow gel", "brows")] : [])],
      tip: "Keep the front of the brow softer than the tail for a more natural finish.",
      minutes: 3, slots: [slotFromCategory("brows", brows)],
    });
  }

  // Cheeks
  const cheekMatches = matchesFor("bronzer", "contour", "highlighter");
  const blush = trusted(categories.blush) ? categories.blush : null;
  if (blush) {
    const colour = lower(clean(blush.colourFamily));
    const finish = lower(clean(blush.finish));
    const shade = phrase(finish, colour) || "blush";
    const level = depth(clean(blush.intensity));
    const blushName = `${shade}${/blush/.test(shade) ? "" : " blush"}`;
    const blushMatch = matchesFor("blush")[0] ?? null;
    const creamy = /cream|liquid|gel|stick|balm/i.test(blushMatch?.product_form ?? "");
    add({
      phase: "cheeks", key: "blush", title: "Add colour to the cheeks", category: "blush", source: blush, requirement: blushMatch,
      instruction: `Smile lightly to find the apples of the cheeks, then place the ${blushName} there ${creamy ? "with your fingertips or a damp sponge" : "with a fluffy brush"} and blend upward and outward towards the temples. Start with ${layerWords[level]} and build only if you want more. Keep the colour a little lighter near the nose and soften the edges until no line is visible.`,
      tools: [product(blushName, "blush"), tool(creamy ? "Fingertips or damp sponge" : "Fluffy blush brush")],
      tip: "Smile to find the apples, then blend up and out — it lifts the face.",
      minutes: 2, slots: [slotFromCategory("blush", blush), ...(blushMatch ? [slotFor(blushMatch)] : [])],
    });
  }
  if (cheekMatches.length) {
    const shapers = cheekMatches.filter((item) => item.category === "bronzer" || item.category === "contour");
    const glow = cheekMatches.filter((item) => item.category === "highlighter");
    const part = (item: ProductMatchRequirement) => phrase(item.finish, item.colour_family) || item.category;
    const text = [
      shapers[0] ? `Place ${part(shapers[0])} in the hollow beneath the cheekbone, starting near the ear and sweeping towards the middle of the cheek, and stop before you reach the outer corner of the eye. Blend upward with a clean fluffy brush until there is no visible edge.` : "",
      glow[0] ? `Tap the ${part(glow[0])} highlighter on the high points of the cheekbones with a fingertip or small brush, keeping it small so it reads as light rather than glitter.` : "",
    ].filter(Boolean).join(" ");
    add({
      phase: "cheeks", key: "shape-glow", title: shapers[0] && glow[0] ? "Shape and glow" : shapers[0] ? "Add warmth and shape" : "Add a glow", category: cheekMatches[0].category, source: null, requirement: cheekMatches[0],
      instruction: text,
      tools: [...shapers.slice(0, 1).map((item) => product(`${part(item)} ${item.category}`, item.category)), ...glow.slice(0, 1).map((item) => product(`${part(item)} highlighter`, "highlighter")), tool("Fluffy brush")],
      tip: shapers[0] ? "Build in thin layers — it is easier to add shape than to take it away." : "Less is more with highlighter: aim for a lit-from-within look.",
      minutes: 3, slots: cheekMatches.map(slotFor),
    });
  }

  // Lips
  if (trusted(categories.lipColour)) {
    const lips = categories.lipColour;
    const colour = lower(clean(lips.colourFamily));
    const finish = lower(clean(lips.finish));
    const shade = phrase(finish, colour) || "lip colour";
    const kind = finishKind(finish);
    const level = depth(clean(lips.intensity));
    const colourName = `${shade}${/\blip|\bgloss\b|lipstick/.test(shade) ? "" : " lip colour"}`;
    const slots = [slotFromCategory("lip_colour", lips)];
    const definedShape = level === "bold" || (level === "medium" && complexity === "bold");

    if (definedShape && kind !== "glossy") {
      techniqueScore += level === "bold" ? 1 : 0.5;
      add({
        phase: "lips", key: "lip-line", title: "Define the lip shape", category: "lip_colour", source: lips, requirement: null,
        instruction: `Using a lip liner in a shade close to ${colour ?? "the lip colour"} or a small lip brush, trace the outer edge of the lips, starting at the peaks of the cupid's bow and working outward to the corners. Stay close to your natural lip line and fill in the outer edge lightly so the colour has a boundary to settle into.`,
        tools: [product(`${colour ?? "Matching"} lip liner`, "lip_colour"), tool("Lip brush")],
        tip: "Stay close to your natural lip line — it gives definition without looking drawn on.",
        minutes: 1, slots: [],
      });
    }
    const apply = kind === "glossy"
      ? `Apply the ${colourName} to the centre of the lips first, then press the lips together to spread it. Add a little more at the centre of the lower lip for fullness, and keep the edges clean with a cotton bud.`
      : level === "sheer" || level === "soft"
        ? `Dab the ${colourName} onto the centre of the lips with a fingertip and blend outward, leaving the edges softly blurred for a stained, natural finish. Add a second thin layer only if you want more colour.`
        : definedShape
          ? `Apply the ${colourName} from the centre of the lips outward with a lip brush or directly from the bullet, filling in towards the corners. Press the lips onto a tissue to blot, then add a second thin layer for even colour and longer wear.`
          : `Apply the ${colourName} from the centre of the lips outward with a lip brush or directly from the bullet, following your natural lip line and keeping the edges softly defined. Press the lips together to even it out, then blot lightly with a tissue and add a second thin layer only if you want more colour.`;
    add({
      phase: "lips", key: "lips", title: "Apply the lip colour", category: "lip_colour", source: lips, requirement: null,
      instruction: apply,
      tools: [product(colourName, "lip_colour"), ...(kind === "glossy" ? [] : [tool("Lip brush")])],
      tip: kind === "glossy" ? "Keep gloss to the centre of the lips — it looks fuller and stays out of the corners." : "Blot with a tissue between layers for a more even finish.",
      minutes: 2, slots,
    });
  }

  const setting = matchesFor("setting_powder")[0];
  if (setting) {
    const finish = lower(clean(setting.finish)) ?? "translucent";
    add({
      phase: "finish", key: "set", title: "Set the look", category: "setting_powder", source: null, requirement: setting,
      instruction: `Dust a light veil of ${finish} powder with a fluffy brush only where shine tends to appear, usually the forehead, nose and chin. Skip the areas you want to keep luminous so the finish of the look is preserved.`,
      tools: [product(`${finish} setting powder`, "setting_powder"), tool("Fluffy powder brush")],
      tip: "Press the powder in rather than sweeping it — it keeps the skin looking fresh.",
      minutes: 1, slots: [slotFor(setting)],
    });
  }

  if (complexity === "bold" && steps.length >= 6 && steps.length <= 8) {
    add({
      phase: "finish", key: "balance", title: "Balance and refine", category: "other", source: null, requirement: null,
      instruction: "Step back and check the look at arm's length, ideally in natural light. Compare the eyes, cheeks and lips: one should lead while the others support it. If something feels too heavy, tap it with a clean fingertip or sponge to soften it; if it feels too faint, add one thin layer. Clean up any fallout under the eyes with a cotton bud.",
      tools: [tool("Clean fluffy brush"), tool("Cotton buds")],
      tip: "Check the look from a distance — that is how others will see it.",
      minutes: 1, slots: [],
    });
  }

  const style = clean(profile.overall_makeup_style)?.replace(/\s+(makeup\s+)?look$/i, "") ?? null;
  const direction = clean(profile.overall_colour_direction)?.replace(/\s*\b(tones?|shades?|colou?rs?|palette)$/i, "") ?? null;
  const warmth = profile.overall_warmth_coolness !== "unknown" ? profile.overall_warmth_coolness : null;
  const overallIntensity = profile.overall_intensity !== "unknown" ? profile.overall_intensity : null;
  const descriptor = phrase(overallIntensity, style) || "makeup";
  const warmthClause = warmth && warmth !== "neutral" && !(direction && /warm|cool|neutral/i.test(direction)) ? ` with a ${warmth === "mixed" ? "balanced" : warmth} feel` : "";
  const summary = tidy(`${sentence(article(descriptor))} ${descriptor} look${direction ? ` in ${direction.toLowerCase()} tones` : ""}${warmthClause}.`);

  const minutes = Math.max(10, Math.round(steps.reduce((total, step) => total + step.minutes, 0) / 5) * 5);
  const heavy = overallIntensity === "bold" || overallIntensity === "intense";
  const score = steps.length * 0.5 + techniqueScore + (heavy ? 1.5 : 0);
  const difficulty = score >= 8 ? "advanced" : score >= 5 ? "intermediate" : "easy";

  const palette: TutorialSwatch[] = ([["Eyes", "eyeshadow"], ["Liner", "linerMascara"], ["Brows", "brows"], ["Cheeks", "blush"], ["Lips", "lipColour"]] as [string, LookCategory][])
    .flatMap(([label, key]) => {
      const source = categories[key];
      const colourFamily = clean(source.colourFamily);
      if (!trusted(source) || !colourFamily) return [];
      return [{ label, colour: swatchColour(colourFamily), colourFamily: lower(colourFamily) ?? colourFamily, finish: lower(clean(source.finish)) }];
    });

  return {
    schemaVersion: "2.0",
    title: style ? sentence(style) : "Your Lumora look",
    summary,
    estimatedMinutes: minutes,
    difficulty,
    highlights: profile.key_makeup_characteristics.map((item) => clean(item)).filter((item): item is string => Boolean(item)).slice(0, 4).map(sentence),
    palette,
    steps,
    disclaimer: "A guide to recreating the look you see. It describes the visible makeup and does not identify the products or techniques used.",
  };
}

// Tutorials stored before schema 2.0 have no tools, tip or per-step minutes; give them a safe shape so old links keep rendering.
export function normalizeStoredTutorial(stored: unknown): MakeupTutorial {
  const value = stored as Omit<MakeupTutorial, "steps"> & { steps?: (Partial<TutorialStep> & { tips?: string[] })[] };
  return {
    ...value,
    schemaVersion: "2.0",
    steps: (value.steps ?? []).map((step) => ({
      ...step,
      tools: step.tools ?? [],
      tip: step.tip ?? step.tips?.[0] ?? null,
      minutes: step.minutes ?? 0,
      productSlots: step.productSlots ?? [],
    })) as TutorialStep[],
  };
}

export type { MakeupTutorial, TutorialPhase, TutorialProductSlot, TutorialStep, TutorialSwatch, TutorialTool } from "./types";
