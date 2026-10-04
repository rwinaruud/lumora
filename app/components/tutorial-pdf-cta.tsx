"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function TutorialPdfCta({ resultId }: { resultId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tutorial-pdf-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const payload = await response.json() as { url?: unknown };
      if (!response.ok || typeof payload.url !== "string") throw new Error("Checkout is temporarily unavailable. Please try again.");
      trackEvent("tutorial_pdf_checkout_started", { value: 1.95, currency: "EUR" });
      window.location.assign(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout is temporarily unavailable. Please try again.");
      setLoading(false);
    }
  }

  return <section className="tutorial-keep" aria-labelledby="tutorial-keep-title">
    <i className="smear smear-lilac" aria-hidden="true" /><i className="smear smear-coral" aria-hidden="true" /><i className="sparkle" aria-hidden="true" />
    <span className="guide-paper" aria-hidden="true">LUMORA</span>
    <span className="eyebrow">THE PDF GUIDE</span>
    <h2 id="tutorial-keep-title">Keep your tutorial</h2>
    <p>Save your personalised Lumora tutorial as a beautifully designed PDF. One-time payment, no subscription.</p>
    <button className="button button-primary" type="button" disabled={loading} onClick={() => { void begin(); }}>{loading ? "Opening Checkout…" : "Download PDF · €1.95"} <svg className="lumora-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></svg></button>
    {error && <p role="alert" className="tutorial-keep-error">{error}</p>}
  </section>;
}
