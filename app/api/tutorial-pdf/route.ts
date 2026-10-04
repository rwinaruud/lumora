import sharp from "sharp";
import { readPrivateResult } from "@/lib/generated-result-storage";
import { verifiedTutorialPdfResultId } from "@/lib/stripe-server";
import { resolveTutorial } from "@/lib/look-tutorial/resolve";
import { buildTutorialPdf } from "@/lib/look-tutorial/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

const sessionIdPattern = /^cs_(?:test|live)_[A-Za-z0-9]+$/;
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !sessionIdPattern.test(sessionId)) {
    return Response.json({ error: { code: "INVALID_SESSION", message: "A valid Checkout session is required." } }, { status: 400, headers: noStore });
  }

  try {
    const resultId = await verifiedTutorialPdfResultId(sessionId);
    if (!resultId) {
      return Response.json({ error: { code: "PAYMENT_NOT_VERIFIED", message: "Payment could not be verified for this tutorial." } }, { status: 403, headers: noStore });
    }

    // Built on demand from the stored tutorial and stored result image. Nothing is regenerated or reinterpreted.
    const tutorial = await resolveTutorial(resultId);
    if (!tutorial) {
      return Response.json({ error: { code: "TUTORIAL_NOT_FOUND", message: "This tutorial is no longer available." } }, { status: 404, headers: noStore });
    }
    const original = Buffer.from(await (await readPrivateResult(resultId)).arrayBuffer());
    const image = await sharp(original).rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    const pdf = await buildTutorialPdf(tutorial, image);

    return new Response(Buffer.from(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="lumora-makeup-tutorial.pdf"',
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Lumora tutorial PDF download failed.", error);
    return Response.json({ error: { code: "DOWNLOAD_UNAVAILABLE", message: "This tutorial PDF is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}
