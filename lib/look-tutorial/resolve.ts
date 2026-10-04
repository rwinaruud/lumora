import "server-only";

import { readLookAnalysis, readMakeupTutorial } from "@/lib/generated-result-storage";
import { buildMakeupTutorial, normalizeStoredTutorial, type MakeupTutorial } from "@/lib/look-tutorial";

// The tutorial a viewer sees for a result: the stored one, with pre-2.0 tutorials rebuilt in memory from the stored analysis.
// The web page and the PDF both use this so they always show the same content. Nothing is written back.
export async function resolveTutorial(resultId: string): Promise<MakeupTutorial | null> {
  const stored = await readMakeupTutorial(resultId);
  if (!stored) return null;
  let tutorial = normalizeStoredTutorial(stored);
  if ((stored as { schemaVersion?: string }).schemaVersion !== "2.0") {
    const analysis = await readLookAnalysis(resultId).catch(() => null);
    const rebuilt = analysis ? buildMakeupTutorial(analysis) : null;
    if (rebuilt && rebuilt.steps.length >= 2) tutorial = rebuilt;
  }
  return tutorial;
}
