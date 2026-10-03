export type LookAnalysisImage = {
  uri: string;
  mediaType?: string;
};

export type LookAnalysisInput = {
  images: {
    original?: LookAnalysisImage;
    inspiration?: LookAnalysisImage;
    generated?: LookAnalysisImage;
  };
  inspirationLookId?: string;
};

export type LookCategory = "eyeshadow" | "linerMascara" | "brows" | "blush" | "lipColour";

export type CategoryRequirements = {
  productCategory: string | null;
  colourFamily: string | null;
  undertone: string | null;
  finish: string | null;
  intensity: "sheer" | "soft" | "medium" | "bold" | "unknown" | null;
  characteristics: string[];
  skinToneGuidance: string | null;
  description: string | null;
  confidenceScore: number;
};

export type LookAnalysisCategories = Record<LookCategory, CategoryRequirements>;

export type ProductMatchCategoryName =
  | "eyeshadow"
  | "eyeliner"
  | "mascara"
  | "brows"
  | "blush"
  | "lip_colour"
  | "foundation"
  | "concealer"
  | "contour"
  | "highlighter"
  | "bronzer"
  | "setting_powder"
  | "other";

export type ProductMatchRequirement = {
  category: ProductMatchCategoryName;
  subtype: string | null;
  colour_family: string | null;
  undertone: "warm" | "cool" | "neutral" | "mixed" | "unknown" | null;
  finish: string | null;
  intensity: "sheer" | "light" | "medium" | "bold" | "intense" | "unknown" | null;
  application_style: string | null;
  coverage: string | null;
  product_form: string | null;
  confidence: number;
  reason: string;
};

export type LookProfile = {
  overall_makeup_style: string | null;
  overall_colour_direction: string | null;
  overall_warmth_coolness: "warm" | "cool" | "neutral" | "mixed" | "unknown";
  overall_intensity: "sheer" | "light" | "medium" | "bold" | "intense" | "unknown";
  key_makeup_characteristics: string[];
};

export type ProductMatchingSpecification = {
  categories: ProductMatchRequirement[];
};

export type LookAnalysisProviderOutput = {
  categories: LookAnalysisCategories;
  look_profile: LookProfile;
  product_matching: ProductMatchingSpecification;
};

export type LookAnalysisProvider = {
  id: string;
  mode: "live";
  analyze(input: LookAnalysisInput): Promise<LookAnalysisProviderOutput>;
};

export type LookAnalysis = {
  schemaVersion: "1.0";
  mode: LookAnalysisProvider["mode"];
  provider: string;
  availableImages: {
    original: boolean;
    inspiration: boolean;
    generated: boolean;
  };
  inspirationLookId?: string;
  categories: LookAnalysisCategories;
  look_profile: LookProfile;
  product_matching: ProductMatchingSpecification;
};