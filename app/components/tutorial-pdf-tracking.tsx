"use client";

import { useEffect } from "react";
import { trackEvent, trackEventOnce } from "@/lib/analytics";

// Only rendered after the server has verified the payment. The key is kept in sessionStorage only and never sent to GA.
export function TutorialPdfPurchaseTracker({ dedupeKey }: { dedupeKey: string }) {
  useEffect(() => {
    trackEventOnce(`tutorial_pdf_purchased:${dedupeKey}`, "tutorial_pdf_purchased", { value: 1.95, currency: "EUR" });
  }, [dedupeKey]);
  return null;
}

export function TutorialPdfDownloadLink({ href }: { href: string }) {
  return <a className="button button-primary" href={href} onClick={() => trackEvent("tutorial_pdf_downloaded")}>Download PDF <span aria-hidden="true">→</span></a>;
}
