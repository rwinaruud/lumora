import { readMakeupTutorial } from "@/lib/generated-result-storage";
import { getAppBaseUrl, getStripeClient, tutorialPdfProduct } from "@/lib/stripe-server";
import { ApiRequestError, readJsonBody, requestErrorResponse } from "@/lib/api/request-validation";

export const runtime = "nodejs";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let resultId: string;
  try {
    const body = await readJsonBody(request, 2_048);
    const value = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).resultId : null;
    if (typeof value !== "string" || !resultIdPattern.test(value)) throw new ApiRequestError("The Lumora result ID is invalid.", 400, "INVALID_REQUEST");
    resultId = value;
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: noStore });
  }

  try {
    // Only a tutorial that already exists can be bought; it is never created or changed after payment.
    if (!await readMakeupTutorial(resultId)) {
      return Response.json({ error: { code: "TUTORIAL_NOT_FOUND", message: "This tutorial is no longer available." } }, { status: 404, headers: noStore });
    }

    const baseUrl = getAppBaseUrl();
    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: { currency: "eur", unit_amount: 195, product_data: { name: "Lumora makeup tutorial PDF" } },
      }],
      metadata: { lumoraResultId: resultId, lumoraProduct: tutorialPdfProduct },
      client_reference_id: resultId,
      success_url: `${baseUrl}/tutorial-pdf?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/tutorial/${resultId}`,
    });

    if (!session.url) throw new Error("Stripe did not provide a Checkout URL.");
    return Response.json({ url: session.url }, { headers: noStore });
  } catch (error) {
    console.error("Lumora tutorial PDF Checkout session creation failed.", error);
    return Response.json({ error: { code: "CHECKOUT_UNAVAILABLE", message: "Checkout is temporarily unavailable. Please try again." } }, { status: 503, headers: noStore });
  }
}
