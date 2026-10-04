import "server-only";

import Stripe from "stripe";

// Marks Checkout sessions for the tutorial PDF so they can never unlock the HD download (and vice versa); both cost the same.
export const tutorialPdfProduct = "tutorial_pdf";

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  return new Stripe(secretKey);
}

export function getAppBaseUrl(): string {
  const value = process.env.APP_BASE_URL;
  if (!value) throw new Error("The application base URL is not configured.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The application base URL is invalid.");
  }

  const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("The application base URL must be an HTTPS origin.");
  }

  return url.origin;
}

// Shared by the PDF download page and API so both apply identical rules.
export async function verifiedTutorialPdfResultId(sessionId: string): Promise<string | null> {
  try {
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    const resultId = session.metadata?.lumoraResultId;
    const valid = session.status === "complete" && session.payment_status === "paid" && session.mode === "payment" && session.currency === "eur" && session.amount_total === 195
      && session.metadata?.lumoraProduct === tutorialPdfProduct && !!resultId && /^[A-Za-z0-9_-]{43}$/.test(resultId) && session.client_reference_id === resultId;
    return valid ? resultId! : null;
  } catch {
    return null;
  }
}
