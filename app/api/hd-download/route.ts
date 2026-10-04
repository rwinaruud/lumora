import { readPrivateResult } from "@/lib/generated-result-storage";
import { getStripeClient, tutorialPdfProduct } from "@/lib/stripe-server";
import sharp from "sharp";

export const runtime = "nodejs";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionIdPattern = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !sessionIdPattern.test(sessionId)) {
    return Response.json({ error: { code: "INVALID_SESSION", message: "A valid Checkout session is required." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    const resultId = session.metadata?.lumoraResultId;
    if (
      session.status !== "complete"
      || session.payment_status !== "paid"
      || session.mode !== "payment"
      || session.currency !== "eur"
      || session.amount_total !== 195
      || !resultId
      || !resultIdPattern.test(resultId)
      || session.client_reference_id !== resultId
      || session.metadata?.lumoraProduct === tutorialPdfProduct
    ) {
      return Response.json({ error: { code: "PAYMENT_NOT_VERIFIED", message: "Payment could not be verified for this Lumora download." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const original = await readPrivateResult(resultId);
    const originalBytes = Buffer.from(await original.arrayBuffer());
    const metadata = await sharp(originalBytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("The stored image dimensions could not be read.");
    const swapsAxes = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
    const width = (swapsAxes ? metadata.height : metadata.width) * 2;
    const height = (swapsAxes ? metadata.width : metadata.height) * 2;
    const hdImage = sharp(originalBytes)
      .rotate()
      .resize({ width, height, fit: "fill", kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" });
    const imageChunks = hdImage[Symbol.asyncIterator]();
    const imageStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await imageChunks.next();
          if (chunk.done) controller.close();
          else controller.enqueue(chunk.value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        hdImage.destroy();
      },
    });

    return new Response(imageStream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="lumora-${resultId}.jpg"`,
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Lumora HD download failed.", error);
    return Response.json({ error: { code: "DOWNLOAD_UNAVAILABLE", message: "This Lumora download is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
