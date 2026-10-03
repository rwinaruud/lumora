export type LookGenerationInput = {
  originalImage: string;
  inspirationImage: string;
};

export type LookGenerationProvider = {
  id: string;
  model: string;
  generate(input: LookGenerationInput): Promise<string>;
};

export type LookGenerationResult = {
  imageDataUrl: string;
  provider: string;
  model: string;
};