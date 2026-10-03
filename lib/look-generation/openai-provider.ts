import "server-only";

import type { LookGenerationInput, LookGenerationProvider } from "./types";

const imagePattern = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;

function appendImage(formData: FormData, role: string, dataUrl: string) {
  const match = imagePattern.exec(dataUrl);
  if (!match) throw new Error(`The ${role} image is not a supported image.`);
  const [, mediaType, encodedImage] = match;
  const bytes = Uint8Array.from(Buffer.from(encodedImage, "base64"));
  formData.append("image[]", new Blob([bytes], { type: mediaType }), `${role}.jpg`);
}

export function createOpenAIImageProvider(apiKey: string, model: string): LookGenerationProvider {
  return {
    id: "openai-images",
    model,
    async generate(input: LookGenerationInput) {
      const formData = new FormData();
      formData.set("model", model);
      formData.set("prompt", [
        "Create one photorealistic edited version of the first input image.",
        "INPUT ROLES: image 1 is the user's original photo and the source/identity anchor. Image 2 is makeup inspiration only.",
        "The desired result is the same person wearing the makeup look inspired by image 2. Transfer makeup characteristics only: complexion finish, blush, contour, highlight, eyeshadow colours and placement, eyeliner, lashes and mascara, brows, and lip colour/finish.",
        "Preserve the source person's identity, exact facial geometry, skin tone, age, natural skin features, hair, expression, pose, clothing, crop, lighting, and background as closely as possible.",
        "Do not beautify, retouch, smooth skin, reshape or symmetrize the face, rejuvenate, change facial features, hair, expression, pose, clothing, or setting. Do not copy the inspiration person's identity or any non-makeup details.",
        "Keep the makeup realistic and wearable, applied only to the source person's face. Return only the edited photo, without text, borders, or extra objects.",
      ].join(" "));
      formData.set("size", "auto");
      formData.set("quality", "high");
      formData.set("output_format", "jpeg");
      appendImage(formData, "source", input.originalImage);
      appendImage(formData, "inspiration", input.inspirationImage);

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(180_000),
      });

      if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status}).`);
      const payload = await response.json() as { data?: { b64_json?: string }[] };
      const encodedResult = payload.data?.[0]?.b64_json;
      if (!encodedResult || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedResult)) {
        throw new Error("OpenAI did not return a valid generated image.");
      }
      return `data:image/jpeg;base64,${encodedResult}`;
    },
  };
}