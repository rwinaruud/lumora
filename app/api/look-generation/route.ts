import { generateLookImage, type LookGenerationInput } from "@/lib/look-generation";
import { createOpenAIImageProvider } from "@/lib/look-generation/openai-provider";
import { after } from "next/server";
import { generationJobResponse } from "@/lib/generation-job-response";
import { assertPrivateStorageAccess, createPendingGenerationJob, finishGenerationJob, hasPrivateStorageConfiguration, isValidJobId, readGenerationJob, storeGeneratedResult } from "@/lib/generated-result-storage";
import { assertUsableSelfie, FaceGuardianRejection } from "@/lib/look-generation/face-guardian";
import { enforceAiRateLimit } from "@/lib/api/ai-rate-limit";
import { ApiRequestError, readJsonBody, requestErrorResponse, validateImageDataUrl } from "@/lib/api/request-validation";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseInput(value: unknown): LookGenerationInput & { jobId: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiRequestError("Two input images are required.", 400, "INVALID_REQUEST");
  }
  const requestBody = value as Record<string, unknown>;
  if (!isValidJobId(requestBody.jobId)) throw new ApiRequestError("A valid job ID is required.", 400, "INVALID_REQUEST");
  return {
    jobId: requestBody.jobId,
    originalImage: validateImageDataUrl(requestBody.originalImage, "Your photo"),
    inspirationImage: validateImageDataUrl(requestBody.inspirationImage, "Your inspiration"),
  };
}

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !hasPrivateStorageConfiguration()) {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image generation is temporarily unavailable." } }, { status: 503, headers: noStore });
  }

  let parsed: LookGenerationInput & { jobId: string };
  try {
    parsed = parseInput(await readJsonBody(request, 11_000_000));
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: noStore });
  }
  const { jobId, ...input } = parsed;

  // A known job ID never triggers a new generation, rate-limit attempt or face check.
  try {
    const existing = await readGenerationJob(jobId);
    if (existing) return await generationJobResponse(existing);
  } catch (error) {
    console.error("Lumora job lookup failed.", error);
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image generation is temporarily unavailable." } }, { status: 503, headers: noStore });
  }

  const rateLimitResponse = await enforceAiRateLimit(request, "image-generation");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    await assertUsableSelfie(input.originalImage, apiKey, process.env.OPENAI_VISION_MODEL || "gpt-4o-mini");
  } catch (error) {
    if (error instanceof FaceGuardianRejection) {
      return Response.json({ error: { code: "NO_USABLE_FACE", message: error.message } }, { status: 422, headers: noStore });
    }
    console.error("Lumora face check failed.", error);
    return Response.json({ error: { code: "FACE_CHECK_UNAVAILABLE", message: "We couldn't check your photo just now. Please try again." } }, { status: 503, headers: noStore });
  }

  try {
    await assertPrivateStorageAccess();
    // The atomic create is the idempotency lock: only one request per job ID proceeds.
    if (!(await createPendingGenerationJob(jobId))) {
      const existing = await readGenerationJob(jobId);
      if (existing) return await generationJobResponse(existing);
      return Response.json({ status: "pending" }, { status: 202, headers: noStore });
    }
  } catch (error) {
    console.error("Lumora private image storage is unavailable.", error);
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image generation is temporarily unavailable." } }, { status: 503, headers: noStore });
  }

  after(async () => {
    try {
      const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst";
      const generated = await generateLookImage(input, createOpenAIImageProvider(apiKey, model));
      const stored = await storeGeneratedResult(generated.imageDataUrl);
      await finishGenerationJob(jobId, { status: "completed", resultId: stored.resultId, provider: generated.provider, model: generated.model });
    } catch (error) {
      console.error("Lumora generation or private storage failed.", error);
      try {
        await finishGenerationJob(jobId, { status: "failed", message: "Lumora couldn't create this image. Please try again." });
      } catch (finishError) {
        console.error("Lumora failed job state could not be saved.", finishError);
      }
    }
  });

  return Response.json({ status: "pending" }, { status: 202, headers: noStore });
}
