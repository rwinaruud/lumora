import { privateResultExists } from "@/lib/generated-result-storage";
import { getAppBaseUrl, getStripeClient } from "@/lib/stripe-server";
import { ApiRequestError, readJsonBody, requestErrorResponse } from "@/lib/api/request-validation";

export const runtime = "nodejs";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;

function parseResultId(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiRequestError("A Lumora result is required.", 400, "INVALID_REQUEST");
  }
  const resultId = (value as Record<string, unknown>).resultId;
  if (typeof resultId !== "string" || !resultIdPattern.test(resultId)) {
    throw new ApiRequestError("The Lumora result ID is invalid.", 400, "INVALID_REQUEST");
  }
  return resultId;
}

export async function POST(request: Request) {
  let resultId: string;
  try {
    resultId = parseResultId(await readJsonBody(request, 2_048));
  } catch (error) {
    if (error instanceof ApiRequestError) return requestErrorResponse(error);
    return Response.json({ error: { code: "INVALID_REQUEST", message: "The request body is invalid." } }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    if (!await privateResultExists(resultId)) {
      return Response.json({ error: { code: "RESULT_NOT_FOUND", message: "This Lumora result is no longer available." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const stripe = getStripeClient();
    const baseUrl = getAppBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: 195,
          product_data: { name: "Lumora HD download" },
        },
      }],
      metadata: { lumoraResultId: resultId },
      client_reference_id: resultId,
      success_url: `${baseUrl}/download?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
    });

    if (!session.url) throw new Error("Stripe did not provide a Checkout URL.");
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lumora Checkout session creation failed.", error);
    return Response.json({ error: { code: "CHECKOUT_UNAVAILABLE", message: "Checkout is temporarily unavailable. Please try again." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
