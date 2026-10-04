import { analyzeLook, type LookAnalysisImage, type LookAnalysisInput } from "@/lib/look-analysis";
import { createOpenAIVisionProvider } from "@/lib/look-analysis/openai-provider";
import { enforceAiRateLimit } from "@/lib/api/ai-rate-limit";
import { privateResultExists, storeLookAnalysis } from "@/lib/generated-result-storage";
import { ApiRequestError, readJsonBody, requestErrorResponse, validateImageDataUrl } from "@/lib/api/request-validation";

export const runtime = "nodejs";

function parseImage(value: unknown, label: string, required = false): LookAnalysisImage | undefined {
  if (value === undefined && !required) return undefined;
  const source = typeof value === "object" && value !== null && !Array.isArray(value) && "uri" in value ? (value as { uri: unknown }).uri : value;
  const uri = validateImageDataUrl(source, label);
  return { uri, mediaType: uri.slice(5, uri.indexOf(";")) };
}

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;

function parseInput(value: unknown): LookAnalysisInput {
  if (typeof value !== "object" || value === null || Array.isArray(value) || !("images" in value) || typeof value.images !== "object" || value.images === null || Array.isArray(value.images)) {
    throw new ApiRequestError("A look analysis image payload is required.", 400, "INVALID_REQUEST");
  }
  const requestBody = value as Record<string, unknown>;
  const images = value.images as Record<string, unknown>;
  return {
    images: {
      generated: parseImage(images.generated, "The generated Lumora", true),
    },
    ...(typeof requestBody.inspirationLookId === "string" && requestBody.inspirationLookId.length <= 64 ? { inspirationLookId: requestBody.inspirationLookId } : {}),
  };
}

function parseResultId(value: unknown): string | null {
  const resultId = typeof value === "object" && value !== null && "resultId" in value ? (value as { resultId: unknown }).resultId : null;
  return typeof resultId === "string" && resultIdPattern.test(resultId) ? resultId : null;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Look Analysis is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const rateLimitResponse = await enforceAiRateLimit(request, "look-analysis");
  if (rateLimitResponse) return rateLimitResponse;

  let input: LookAnalysisInput;
  let resultId: string | null = null;
  try {
    const body = await readJsonBody(request, 16_000_000);
    input = parseInput(body);
    resultId = parseResultId(body);
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
    const analysis = await analyzeLook(input, createOpenAIVisionProvider(process.env.OPENAI_API_KEY, model));
    if (resultId) {
      // Persisted so the tutorial can be built later without a second image analysis; failures never affect the response.
      try { if (await privateResultExists(resultId)) await storeLookAnalysis(resultId, analysis); } catch { /* best effort */ }
    }
    return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "LOOK_ANALYSIS_FAILED", message: "Look Analysis couldn't be completed. Please try again." } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}