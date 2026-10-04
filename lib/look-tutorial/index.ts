import type { CategoryRequirements, LookAnalysis, LookCategory, ProductMatchCategoryName, ProductMatchRequirement } from "@/lib/look-analysis/types";
import type { MakeupTutorial, TutorialPhase, TutorialProductSlot, TutorialStep, TutorialSwatch } from "./types";

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

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text && !/^unknown$/i.test(text) ? text : null;
}

function lower(value: string | null): string | null {
  return value ? value.toLowerCase() : null;
}

function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function intensityWords(intensity: string | null): string {
  switch (intensity) {
    case "sheer": return "a sheer wash";
    case "soft": case "light": return "a soft layer";
    case "bold": case "intense": return "a bold, buildable layer";
    default: return "a medium layer";
  }
}

function definitionWord(intensity: string | null): string {
  switch (intensity) {
    case "sheer": return "barely-there";
    case "soft": case "light": return "soft";
    case "bold": case "intense": return "bold";
    default: return "defined";
  }
}

function shade(colour: string | null, finish: string | null, fallback: string): string {
  return [lower(finish), lower(colour)].filter(Boolean).join(" ") || fallback;
}

function slotFor(requirement: ProductMatchRequirement): TutorialProductSlot {
  return {
    category: requirement.category,
    attributes: {
      subtype: requirement.subtype, colour_family: requirement.colour_family, undertone: requirement.undertone, finish: requirement.finish,
      intensity: requirement.intensity, application_style: requirement.application_style, coverage: requirement.coverage, product_form: requirement.product_form,
    },
  };
}

function slotFromCategory(category: ProductMatchCategoryName, source: CategoryRequirements): TutorialProductSlot {
  return {
    category,
    attributes: { subtype: null, colour_family: source.colourFamily, undertone: source.undertone as ProductMatchRequirement["undertone"], finish: source.finish, intensity: null, application_style: null, coverage: null, product_form: null },
  };
}

function trusted(source: CategoryRequirements): boolean {
  return source.confidenceScore >= minimumConfidence && Boolean(clean(source.colourFamily) || clean(source.description));
}

function tipsFrom(source: CategoryRequirements | null, extra: string[] = []): string[] {
  const characteristics = (source?.characteristics ?? []).map((item) => clean(item)).filter((item): item is string => Boolean(item));
  return [...characteristics.slice(0, 2).map(sentence), ...extra].slice(0, 2);
}

const phaseMinutes: Record<TutorialPhase, number> = { complexion: 5, brows: 3, eyes: 5, lashes_liner: 3, cheeks: 3, lips: 2, finish: 1 };

export function buildMakeupTutorial(analysis: LookAnalysis): MakeupTutorial {
  const { categories, look_profile: profile } = analysis;
  const matching = analysis.product_matching.categories.filter((item) => item.confidence >= minimumConfidence);
  const matchesFor = (...names: ProductMatchCategoryName[]) => matching.filter((item) => names.includes(item.category));
  const steps: TutorialStep[] = [];

  const add = (phase: TutorialPhase, title: string, category: ProductMatchCategoryName, source: CategoryRequirements | null, requirement: ProductMatchRequirement | null, instruction: string, slots: TutorialProductSlot[], extraTips: string[] = []) => {
    steps.push({
      id: phase, phase, title, category,
      attributes: {
        colour: clean(source?.colourFamily) ?? clean(requirement?.colour_family),
        finish: clean(source?.finish) ?? clean(requirement?.finish),
        intensity: clean(source?.intensity) ?? clean(requirement?.intensity),
        undertone: clean(source?.undertone) ?? clean(requirement?.undertone),
      },
      instruction, tips: tipsFrom(source, extraTips), productSlots: slots,
    });
  };

  const base = matchesFor("foundation", "concealer");
  if (base.length) {
    const lead = base[0];
    const coverage = clean(lead.coverage);
    add("complexion", "Even out the complexion", lead.category, null, lead,
      `Apply a ${[lower(coverage), lower(clean(lead.finish))].filter(Boolean).join(", ") || "natural"} base where you need it and blend it outward so the skin still looks like skin.`,
      base.map(slotFor));
  }

  if (trusted(categories.brows)) {
    const brows = categories.brows;
    add("brows", "Define the brows", "brows", brows, null,
      `Fill sparse areas with short strokes in ${lower(clean(brows.colourFamily)) ?? "a shade close to your own brow colour"}, then brush through to soften the finish.`,
      [slotFromCategory("brows", brows)]);
  }

  if (trusted(categories.eyeshadow)) {
    const eyes = categories.eyeshadow;
    add("eyes", "Build the eyes", "eyeshadow", eyes, null,
      `Sweep ${shade(eyes.colourFamily, eyes.finish, "the eyeshadow")} across the lid and into the crease as ${intensityWords(clean(eyes.intensity))}, blending the edges until there is no hard line.`,
      [slotFromCategory("eyeshadow", eyes)]);
  }

  if (trusted(categories.linerMascara)) {
    const lashes = categories.linerMascara;
    const linerMatch = matchesFor("eyeliner")[0] ?? null;
    const mascaraMatch = matchesFor("mascara")[0] ?? null;
    const slots = [linerMatch ? slotFor(linerMatch) : null, mascaraMatch ? slotFor(mascaraMatch) : null].filter((slot): slot is TutorialProductSlot => slot !== null);
    add("lashes_liner", "Define the lashes and liner", linerMatch ? "eyeliner" : "mascara", lashes, linerMatch ?? mascaraMatch,
      `Line the upper lash line with ${lower(clean(lashes.colourFamily)) ?? "a shade that suits the look"} for ${definitionWord(clean(lashes.intensity))} definition, then coat the lashes from root to tip.`,
      slots.length ? slots : [slotFromCategory("eyeliner", lashes)]);
  }

  const cheekMatches = matchesFor("bronzer", "contour", "highlighter");
  if (trusted(categories.blush) || cheekMatches.length) {
    const blush = trusted(categories.blush) ? categories.blush : null;
    const lead = cheekMatches[0] ?? null;
    const slots = [blush ? slotFromCategory("blush", blush) : null, ...cheekMatches.map(slotFor)].filter((slot): slot is TutorialProductSlot => slot !== null);
    add("cheeks", blush ? "Add colour to the cheeks" : "Shape and glow", blush ? "blush" : lead!.category, blush, blush ? null : lead,
      blush
        ? `Tap ${shade(blush.colourFamily, blush.finish, "blush")} onto the apples of the cheeks and blend upward as ${intensityWords(clean(blush.intensity))}.`
        : `Place ${shade(lead!.colour_family, lead!.finish, "a little warmth")} where the light would naturally hit, and blend until it melts into the skin.`,
      slots);
  }

  if (trusted(categories.lipColour)) {
    const lips = categories.lipColour;
    add("lips", "Finish with the lips", "lip_colour", lips, null,
      `Apply ${shade(lips.colourFamily, lips.finish, "the lip colour")} from the centre of the lips outward as ${intensityWords(clean(lips.intensity))}, then press the lips together to even it out.`,
      [slotFromCategory("lip_colour", lips)]);
  }

  const setting = matchesFor("setting_powder")[0];
  if (setting) {
    add("finish", "Set the look", "setting_powder", null, setting,
      `Dust a light veil of ${lower(clean(setting.finish)) ?? "translucent"} powder only where shine appears, so the finish stays as it is.`,
      [slotFor(setting)]);
  }

  const style = clean(profile.overall_makeup_style);
  const direction = clean(profile.overall_colour_direction);
  const warmth = profile.overall_warmth_coolness !== "unknown" ? profile.overall_warmth_coolness : null;
  const overallIntensity = profile.overall_intensity !== "unknown" ? profile.overall_intensity : null;

  const summary = [
    `A ${[overallIntensity, lower(style) ?? "makeup"].filter(Boolean).join(" ")} look`,
    direction ? ` in ${lower(direction)} tones` : "",
    warmth && warmth !== "neutral" ? ` with a ${warmth === "mixed" ? "balanced" : warmth} feel` : "",
    ".",
  ].join("");

  const minutes = Math.max(5, Math.round(steps.reduce((total, step) => total + phaseMinutes[step.phase], 0) / 5) * 5);
  const heavy = overallIntensity === "bold" || overallIntensity === "intense";
  const difficulty = heavy ? (steps.length >= 5 ? "advanced" : "intermediate") : steps.length >= 6 ? "intermediate" : "easy";

  const palette: TutorialSwatch[] = ([["Eyes", "eyeshadow"], ["Liner", "linerMascara"], ["Brows", "brows"], ["Cheeks", "blush"], ["Lips", "lipColour"]] as [string, LookCategory][])
    .flatMap(([label, key]) => {
      const source = categories[key];
      const colourFamily = clean(source.colourFamily);
      if (!trusted(source) || !colourFamily) return [];
      return [{ label, colour: swatchColour(colourFamily), colourFamily, finish: clean(source.finish) }];
    });

  return {
    schemaVersion: "1.0",
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

export type { MakeupTutorial, TutorialPhase, TutorialProductSlot, TutorialStep, TutorialSwatch } from "./types";
