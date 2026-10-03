import type { LookGenerationInput, LookGenerationProvider, LookGenerationResult } from "./types";

export async function generateLookImage(
  input: LookGenerationInput,
  provider: LookGenerationProvider,
): Promise<LookGenerationResult> {
  return {
    imageDataUrl: await provider.generate(input),
    provider: provider.id,
    model: provider.model,
  };
}

export type { LookGenerationInput, LookGenerationProvider, LookGenerationResult } from "./types";