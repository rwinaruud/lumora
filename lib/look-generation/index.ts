import type { GeneratedLookImage, LookGenerationInput, LookGenerationProvider } from "./types";

export async function generateLookImage(
  input: LookGenerationInput,
  provider: LookGenerationProvider,
): Promise<GeneratedLookImage> {
  return {
    imageDataUrl: await provider.generate(input),
    provider: provider.id,
    model: provider.model,
  };
}

export type { GeneratedLookImage, LookGenerationInput, LookGenerationProvider, LookGenerationResult } from "./types";