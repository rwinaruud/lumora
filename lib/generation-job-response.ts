import "server-only";

import { previewForResult, type GenerationJob } from "@/lib/generated-result-storage";

const noStore = { "Cache-Control": "no-store" };

export async function generationJobResponse(job: GenerationJob): Promise<Response> {
  if (job.status === "pending") return Response.json({ status: "pending" }, { status: 202, headers: noStore });
  if (job.status === "failed") {
    return Response.json({ status: "failed", error: { code: "IMAGE_GENERATION_FAILED", message: job.message } }, { status: 502, headers: noStore });
  }
  try {
    return Response.json({
      status: "completed",
      previewDataUrl: await previewForResult(job.resultId),
      resultId: job.resultId,
      provider: job.provider,
      model: job.model,
    }, { headers: noStore });
  } catch (error) {
    console.error("Lumora completed job preview failed.", error);
    return Response.json({ status: "failed", error: { code: "IMAGE_GENERATION_FAILED", message: "Lumora couldn't load this image. Please try again." } }, { status: 502, headers: noStore });
  }
}
