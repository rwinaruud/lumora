"use client";

import { useEffect } from "react";
import { trackEventOnce } from "@/lib/analytics";

export function TutorialViewTracker({ viewKey, stepCount, difficulty }: { viewKey: string; stepCount: number; difficulty: string }) {
  useEffect(() => {
    trackEventOnce(`tutorial_viewed:${viewKey}`, "tutorial_viewed", { step_count: stepCount, difficulty });
  }, [viewKey, stepCount, difficulty]);
  return null;
}
