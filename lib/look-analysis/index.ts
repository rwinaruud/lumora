import type { LookAnalysis, LookAnalysisInput, LookAnalysisProvider } from "./types";

export async function analyzeLook(
  input: LookAnalysisInput,
  provider: LookAnalysisProvider,
): Promise<LookAnalysis> {
  const analysis = await provider.analyze(input);

  return {
    schemaVersion: "1.0",
    mode: provider.mode,
    provider: provider.id,
    availableImages: {
      original: Boolean(input.images.original),
      inspiration: Boolean(input.images.inspiration),
      generated: Boolean(input.images.generated),
    },
    ...(input.inspirationLookId ? { inspirationLookId: input.inspirationLookId } : {}),
    ...analysis,
  };
}

export type {
  CategoryRequirements,
  LookAnalysis,
  LookAnalysisCategories,
  LookAnalysisImage,
  LookAnalysisInput,
  LookAnalysisProvider,
  LookAnalysisProviderOutput,
  LookCategory,
  LookProfile,
  ProductMatchCategoryName,
  ProductMatchRequirement,
  ProductMatchingSpecification,
} from "./types";