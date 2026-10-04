import { enforceAiRateLimit } from "@/lib/api/ai-rate-limit";
import { ApiRequestError, readJsonBody, requestErrorResponse } from "@/lib/api/request-validation";
import { privateResultExists, previewForResult, readLookAnalysis, readMakeupTutorial, storeLookAnalysis, storeMakeupTutorial } from "@/lib/generated-result-storage";
import { analyzeLook } from "@/lib/look-analysis";
import { createOpenAIVisionProvider } from "@/lib/look-analysis/openai-provider";
import { buildMakeupTutorial, type MakeupTutorial } from "@/lib/look-tutorial";

export const runtime = "nodejs";
export const maxDuration = 60;

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;
const noStore = { "Cache-Control": "no-store" };

function summaryOf(tutorial: MakeupTutorial) {
  return { status: "completed" as const, stepCount: tutorial.steps.length, difficulty: tutorial.difficulty, estimatedMinutes: tutorial.estimatedMinutes };
}

export async function POST(request: Request) {
  let resultId: string;
  try {
    const body = await readJsonBody(request, 1_000);
    const value = typeof body === "object" && body !== null && "resultId" in body ? (body as { resultId: unknown }).resultId : null;
    if (typeof value !== "string" || !resultIdPattern.test(value)) throw new ApiRequestError("A valid Lumora result is required.", 400, "INVALID_REQUEST");
    resultId = value;
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: noStore });
  }

  try {
    const existing = await readMakeupTutorial(resultId);
    if (existing) return Response.json(summaryOf(existing), { headers: noStore });

    if (!await privateResultExists(resultId)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "This Lumora could not be found." } }, { status: 404, headers: noStore });
    }

    let analysis = await readLookAnalysis(resultId);
    if (!analysis) {
      // Normally the analysis is stored right after generation; this only covers a missing or failed one.
      if (!process.env.OPENAI_API_KEY) {
        return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Your makeup tutorial is temporarily unavailable." } }, { status: 503, headers: noStore });
      }
      const limited = await enforceAiRateLimit(request, "look-analysis");
      if (limited) return limited;
      const generated = { uri: await previewForResult(resultId), mediaType: "image/jpeg" };
      analysis = await analyzeLook({ images: { generated } }, createOpenAIVisionProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_VISION_MODEL || "gpt-4o-mini"));
      await storeLookAnalysis(resultId, analysis);
    }

    const tutorial = buildMakeupTutorial(analysis);
    if (tutorial.steps.length < 2) {
      return Response.json({ error: { code: "TUTORIAL_UNAVAILABLE", message: "We couldn't build a tutorial for this look." } }, { status: 422, headers: noStore });
    }
    await storeMakeupTutorial(resultId, tutorial);
    // If a concurrent request stored first, serve what is stored so every viewer sees one tutorial.
    return Response.json(summaryOf((await readMakeupTutorial(resultId)) ?? tutorial), { headers: noStore });
  } catch {
    return Response.json({ error: { code: "TUTORIAL_FAILED", message: "Your makeup tutorial couldn't be created. Please try again." } }, { status: 502, headers: noStore });
  }
}
