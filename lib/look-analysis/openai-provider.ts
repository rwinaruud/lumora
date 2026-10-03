import "server-only";

import type { CategoryRequirements, LookAnalysisCategories, LookAnalysisInput, LookAnalysisProvider, LookAnalysisProviderOutput, ProductMatchCategoryName, ProductMatchRequirement } from "./types";

const categories = ["eyeshadow", "linerMascara", "brows", "blush", "lipColour"] as const;
const intensities = ["sheer", "soft", "medium", "bold", "unknown"] as const;
const productCategories: ProductMatchCategoryName[] = ["eyeshadow", "eyeliner", "mascara", "brows", "blush", "lip_colour", "foundation", "concealer", "contour", "highlighter", "bronzer", "setting_powder", "other"];
const matchIntensities = ["sheer", "light", "medium", "bold", "intense", "unknown"] as const;
const undertones = ["warm", "cool", "neutral", "mixed", "unknown"] as const;
const overallIntensities = ["sheer", "light", "medium", "bold", "intense", "unknown"] as const;

const categorySchema = {
  type: "object",
  additionalProperties: false,
  required: ["productCategory", "colourFamily", "undertone", "finish", "intensity", "characteristics", "skinToneGuidance", "description", "confidenceScore"],
  properties: {
    productCategory: { type: ["string", "null"] },
    colourFamily: { type: ["string", "null"] },
    undertone: { type: ["string", "null"] },
    finish: { type: ["string", "null"] },
    intensity: { type: ["string", "null"], enum: [...intensities, null] },
    characteristics: { type: "array", items: { type: "string" } },
    skinToneGuidance: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 },
  },
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["categories", "look_profile", "product_matching"],
  properties: {
    categories: {
      type: "object",
      additionalProperties: false,
      required: [...categories],
      properties: Object.fromEntries(categories.map((category) => [category, categorySchema])),
    },
    look_profile: {
      type: "object",
      additionalProperties: false,
      required: ["overall_makeup_style", "overall_colour_direction", "overall_warmth_coolness", "overall_intensity", "key_makeup_characteristics"],
      properties: {
        overall_makeup_style: { type: ["string", "null"] },
        overall_colour_direction: { type: ["string", "null"] },
        overall_warmth_coolness: { type: "string", enum: [...undertones] },
        overall_intensity: { type: "string", enum: [...overallIntensities] },
        key_makeup_characteristics: { type: "array", items: { type: "string" } },
      },
    },
    product_matching: {
      type: "object",
      additionalProperties: false,
      required: ["categories"],
      properties: {
        categories: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category", "subtype", "colour_family", "undertone", "finish", "intensity", "application_style", "coverage", "product_form", "confidence", "reason"],
            properties: {
              category: { type: "string", enum: productCategories },
              subtype: { type: ["string", "null"] },
              colour_family: { type: ["string", "null"] },
              undertone: { type: ["string", "null"], enum: [...undertones, null] },
              finish: { type: ["string", "null"] },
              intensity: { type: ["string", "null"], enum: [...matchIntensities, null] },
              application_style: { type: ["string", "null"] },
              coverage: { type: ["string", "null"] },
              product_form: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseNullableText(value: unknown): string | null {
  if (!nullableText(value)) throw new Error("Vision provider returned invalid product-matching attributes.");
  return value;
}

function parseCategoryRequirements(value: unknown): CategoryRequirements {
  if (!isRecord(value)) throw new Error("Vision provider returned an invalid category.");
  const { productCategory, colourFamily, undertone, finish, intensity, characteristics, skinToneGuidance, description, confidenceScore } = value;
  if (!nullableText(productCategory) || !nullableText(colourFamily) || !nullableText(undertone) || !nullableText(finish) || !nullableText(skinToneGuidance) || !nullableText(description)) {
    throw new Error("Vision provider returned invalid text attributes.");
  }
  if (intensity !== null && !intensities.includes(intensity as (typeof intensities)[number])) {
    throw new Error("Vision provider returned an invalid intensity.");
  }
  if (!Array.isArray(characteristics) || !characteristics.every((item) => typeof item === "string")) {
    throw new Error("Vision provider returned invalid category characteristics.");
  }
  if (typeof confidenceScore !== "number" || confidenceScore < 0 || confidenceScore > 1) {
    throw new Error("Vision provider returned an invalid confidence score.");
  }
  return { productCategory, colourFamily, undertone, finish, intensity: intensity as CategoryRequirements["intensity"], characteristics, skinToneGuidance, description, confidenceScore };
}

function parseCategories(value: unknown): LookAnalysisCategories {
  if (!isRecord(value) || !categories.every((category) => category in value)) {
    throw new Error("Vision provider returned an incomplete analysis.");
  }
  return Object.fromEntries(categories.map((category) => [category, parseCategoryRequirements(value[category])])) as LookAnalysisCategories;
}

function parseProductMatching(value: unknown): LookAnalysisProviderOutput["product_matching"] {
  if (!isRecord(value) || !Array.isArray(value.categories)) throw new Error("Vision provider returned an invalid product-matching specification.");
  const requirements = value.categories.map((item): ProductMatchRequirement => {
    if (!isRecord(item)) throw new Error("Vision provider returned an invalid product-matching category.");
    const { category, subtype, colour_family, undertone, finish, intensity, application_style, coverage, product_form, confidence, reason } = item;
    if (typeof category !== "string" || !productCategories.includes(category as ProductMatchCategoryName)) throw new Error("Vision provider returned an unsupported product-matching category.");
    const parsedSubtype = parseNullableText(subtype);
    const parsedColourFamily = parseNullableText(colour_family);
    const parsedFinish = parseNullableText(finish);
    const parsedApplicationStyle = parseNullableText(application_style);
    const parsedCoverage = parseNullableText(coverage);
    const parsedProductForm = parseNullableText(product_form);
    if (undertone !== null && !undertones.includes(undertone as (typeof undertones)[number])) throw new Error("Vision provider returned an invalid product undertone.");
    if (intensity !== null && !matchIntensities.includes(intensity as (typeof matchIntensities)[number])) throw new Error("Vision provider returned an invalid product intensity.");
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1 || typeof reason !== "string") throw new Error("Vision provider returned invalid product confidence or reasoning.");
    return { category: category as ProductMatchCategoryName, subtype: parsedSubtype, colour_family: parsedColourFamily, undertone: undertone as ProductMatchRequirement["undertone"], finish: parsedFinish, intensity: intensity as ProductMatchRequirement["intensity"], application_style: parsedApplicationStyle, coverage: parsedCoverage, product_form: parsedProductForm, confidence, reason };
  });
  return { categories: requirements };
}

function parseProviderOutput(value: unknown): LookAnalysisProviderOutput {
  if (!isRecord(value) || !isRecord(value.look_profile)) throw new Error("Vision provider returned an incomplete rich analysis.");
  const { overall_makeup_style, overall_colour_direction, overall_warmth_coolness, overall_intensity, key_makeup_characteristics } = value.look_profile;
  if (!nullableText(overall_makeup_style) || !nullableText(overall_colour_direction)) throw new Error("Vision provider returned an invalid overall look description.");
  if (typeof overall_warmth_coolness !== "string" || !undertones.includes(overall_warmth_coolness as (typeof undertones)[number])) throw new Error("Vision provider returned an invalid overall undertone.");
  if (typeof overall_intensity !== "string" || !overallIntensities.includes(overall_intensity as (typeof overallIntensities)[number])) throw new Error("Vision provider returned an invalid overall intensity.");
  if (!Array.isArray(key_makeup_characteristics) || !key_makeup_characteristics.every((item) => typeof item === "string")) throw new Error("Vision provider returned invalid overall characteristics.");
  return {
    categories: parseCategories(value.categories),
    look_profile: { overall_makeup_style, overall_colour_direction, overall_warmth_coolness: overall_warmth_coolness as LookAnalysisProviderOutput["look_profile"]["overall_warmth_coolness"], overall_intensity: overall_intensity as LookAnalysisProviderOutput["look_profile"]["overall_intensity"], key_makeup_characteristics },
    product_matching: parseProductMatching(value.product_matching),
  };
}

export function createOpenAIVisionProvider(apiKey: string, model: string): LookAnalysisProvider {
  return {
    id: `openai:${model}`,
    mode: "live",
    async analyze(input: LookAnalysisInput) {
      const imageParts = (Object.entries(input.images) as [keyof LookAnalysisInput["images"], LookAnalysisInput["images"][keyof LookAnalysisInput["images"]]][])
        .filter((entry): entry is [keyof LookAnalysisInput["images"], NonNullable<typeof entry[1]>] => Boolean(entry[1]))
        .map(([role, image]) => [
          { type: "text", text: `${role} image${role === "generated" ? " (primary target)" : role === "inspiration" ? " (context only; do not assume it was copied exactly)" : " (use to adapt shades to the user's complexion)"}:` },
          { type: "image_url", image_url: { url: image.uri, detail: "high" } },
        ]).flat();

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 2600,
          response_format: { type: "json_schema", json_schema: { name: "lumora_look_analysis", strict: true, schema: responseSchema } },
          messages: [
            {
              role: "system",
              content: "You are a makeup look-analysis service. Analyze the visible makeup in the generated Lumora result as the primary target. The original photo is only for complexion context. The inspiration image is context only; never assume its products, colours, or makeup were copied. Do not identify brands, exact products, or product names. Derive every attribute from the actual generated image. If an attribute is not visually reliable, use null or unknown and lower confidence. Skin-tone guidance must adapt colour depth and undertone to the original user's complexion. Do not assess attractiveness or skin flaws. Return only the requested structured data.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze the generated Lumora image as the target and return both the legacy five categories (eyeshadow, linerMascara, brows, blush, lipColour) and a product_matching.categories list for every makeup category visibly present in that generated image. For each matching entry include category, subtype, colour_family, undertone (warm/cool/neutral/mixed/unknown), finish, intensity (sheer/light/medium/bold/intense/unknown), application_style, coverage, product_form, confidence from 0 to 1, and a short reason grounded in visible image evidence. Do not include brands, exact product names, prices, or availability. Do not infer that the inspiration makeup was copied. Use null or unknown whenever an attribute cannot be determined reliably; omit undetected product categories instead of guessing. Also return look_profile with overall_makeup_style, overall_colour_direction, overall_warmth_coolness, overall_intensity, and key_makeup_characteristics. Preserve all legacy categories and fields. ${input.inspirationLookId ? `Curated inspiration identifier for context only: ${input.inspirationLookId}.` : ""}` },
                ...imageParts,
              ],
            },
          ],
        }),
      });

      if (!response.ok) throw new Error(`Vision provider request failed (${response.status}).`);
      const payload = await response.json() as { choices?: { message?: { content?: string | null } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Vision provider returned an empty analysis.");
      return parseProviderOutput(JSON.parse(content));
    },
  };
}