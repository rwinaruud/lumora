import { createFreePreview, readPrivateResult } from "@/lib/generated-result-storage";

export const runtime = "nodejs";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ resultId: string }> }) {
  const { resultId } = await params;
  if (!resultIdPattern.test(resultId)) {
    return Response.json({ error: "This Lumora preview is not available." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const original = await readPrivateResult(resultId);
    const preview = await createFreePreview(Buffer.from(await original.arrayBuffer()));
    const responseBody = new Uint8Array(preview.byteLength);
    responseBody.set(preview);
    return new Response(responseBody, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Content-Length": String(preview.length),
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error("Shared Lumora preview could not be created.", error);
    return Response.json({ error: "This Lumora preview is not available." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
