"use client";

import { useEffect } from "react";
import { trackEventOnce } from "@/lib/analytics";

export function PurchaseTracker({ transactionId }: { transactionId: string }) {
  useEffect(() => {
    trackEventOnce(`purchase:${transactionId}`, "purchase", { transaction_id: transactionId, value: 1.95, currency: "EUR", item_name: "Lumora HD download" });
  }, [transactionId]);
  return null;
}
