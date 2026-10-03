export const noUsableFaceMessage = "We couldn't find a clear face in this photo. Please upload a clear selfie with one face visible.";

export class FaceGuardianRejection extends Error {}

type FaceAssessment = {
  face_count: number;
  face_size: "large" | "medium" | "small" | "none";
  face_clearly_visible: boolean;
  face_obscured: boolean;
};

const assessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["face_count", "face_size", "face_clearly_visible", "face_obscured"],
  properties: {
    face_count: { type: "integer", minimum: 0, maximum: 20 },
    face_size: { type: "string", enum: ["large", "medium", "small", "none"] },
    face_clearly_visible: { type: "boolean" },
    face_obscured: { type: "boolean" },
  },
};

function parseAssessment(value: unknown): FaceAssessment {
  const item = value as Partial<FaceAssessment> | null;
  if (!item || typeof item.face_count !== "number" || typeof item.face_clearly_visible !== "boolean" || typeof item.face_obscured !== "boolean" || !["large", "medium", "small", "none"].includes(item.face_size as string)) {
    throw new Error("Face check returned an invalid result.");
  }
  return item as FaceAssessment;
}

// Throws FaceGuardianRejection when the photo is not a usable single-face selfie.
export async function assertUsableSelfie(imageDataUrl: string, apiKey: string, model: string): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 100,
      response_format: { type: "json_schema", json_schema: { name: "lumora_face_check", strict: true, schema: assessmentSchema } },
      messages: [
        { role: "system", content: "You check whether a photo is usable as a selfie for a makeup try-on. Only count real, human faces that are visible in the photo (not drawings, statues, or faces on posters/screens in the background unless they are the main subject). Describe, do not identify anyone. Return only the requested structured data." },
        { role: "user", content: [
          { type: "text", text: "Count the human faces. For the main face report its size relative to the frame (large: face fills a major part of the photo; medium: clearly visible but smaller; small: tiny or distant; none: no face), whether it is clearly visible and unobstructed enough to see eyes, nose and mouth, and whether it is obscured (sunglasses, mask, hand, heavy blur, extreme angle, or cropped)." },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
        ] },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Face check request failed (${response.status}).`);
  const payload = await response.json() as { choices?: { message?: { content?: string | null } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Face check returned an empty result.");
  const assessment = parseAssessment(JSON.parse(content));
  if (assessment.face_count !== 1 || assessment.face_size === "none" || assessment.face_size === "small" || !assessment.face_clearly_visible || assessment.face_obscured) {
    throw new FaceGuardianRejection(noUsableFaceMessage);
  }
}
