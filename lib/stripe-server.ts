import "server-only";

import Stripe from "stripe";

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
