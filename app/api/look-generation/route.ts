import { generateLookImage, type LookGenerationInput } from "@/lib/look-generation";
import { createOpenAIImageProvider } from "@/lib/look-generation/openai-provider";
import { enforceAiRateLimit } from "@/lib/api/ai-rate-limit";
import { ApiRequestError, readJsonBody, requestErrorResponse, validateImageDataUrl } from "@/lib/api/request-validation";

export const runtime = "nodejs";

function parseInput(value: unknown): LookGenerationInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiRequestError("Two input images are required.", 400, "INVALID_REQUEST");
  }
  const requestBody = value as Record<string, unknown>;
  return {
    originalImage: validateImageDataUrl(requestBody.originalImage, "Your photo"),
    inspirationImage: validateImageDataUrl(requestBody.inspirationImage, "Your inspiration"),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image generation is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const rateLimitResponse = await enforceAiRateLimit(request, "image-generation");
  if (rateLimitResponse) return rateLimitResponse;

  let input: LookGenerationInput;
  try {
    input = parseInput(await readJsonBody(request, 11_000_000));
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst";
    return Response.json(await generateLookImage(input, createOpenAIImageProvider(apiKey, model)), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "IMAGE_GENERATION_FAILED", message: "Lumora couldn't create this image. Please try again." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}