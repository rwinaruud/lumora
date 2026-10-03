import { generationJobResponse } from "@/lib/generation-job-response";
import { hasPrivateStorageConfiguration, isValidJobId, readGenerationJob } from "@/lib/generated-result-storage";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, context: RouteContext<"/api/look-generation/[jobId]">) {
  const { jobId } = await context.params;
  if (!isValidJobId(jobId)) {
    return Response.json({ error: { code: "NOT_FOUND", message: "This Lumora could not be found." } }, { status: 404, headers: noStore });
  }
  if (!hasPrivateStorageConfiguration()) {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Image generation is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
  try {
    const job = await readGenerationJob(jobId);
    if (!job) return Response.json({ error: { code: "NOT_FOUND", message: "This Lumora could not be found." } }, { status: 404, headers: noStore });
    return await generationJobResponse(job);
  } catch (error) {
    console.error("Lumora job status failed.", error);
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Lumora couldn't check this image. Please try again." } }, { status: 503, headers: noStore });
  }
}
