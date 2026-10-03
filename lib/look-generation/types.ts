export type LookGenerationInput = {
  originalImage: string;
  inspirationImage: string;
};

export type LookGenerationProvider = {
  id: string;
  model: string;
  generate(input: LookGenerationInput): Promise<string>;
};

export type GeneratedLookImage = {
  imageDataUrl: string;
  provider: string;
  model: string;
};

export type LookGenerationResult = {
  previewDataUrl: string;
  resultId: string;
  provider: string;
  model: string;
};