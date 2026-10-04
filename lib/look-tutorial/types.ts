import type { ProductMatchCategoryName, ProductMatchRequirement } from "@/lib/look-analysis/types";

export type TutorialPhase = "complexion" | "brows" | "eyes" | "lashes_liner" | "cheeks" | "lips" | "finish";

// Metadata only. A future affiliate block fills "Products for this step" by matching on this slot.
export type TutorialProductSlot = {
  category: ProductMatchCategoryName;
  attributes: Pick<ProductMatchRequirement, "subtype" | "colour_family" | "undertone" | "finish" | "intensity" | "application_style" | "coverage" | "product_form">;
};

export type TutorialStep = {
  id: string;
  phase: TutorialPhase;
  title: string;
  category: ProductMatchCategoryName;
  attributes: { colour: string | null; finish: string | null; intensity: string | null; undertone: string | null };
  instruction: string;
  tips: string[];
  productSlots: TutorialProductSlot[];
};

export type TutorialSwatch = { label: string; colour: string | null; colourFamily: string; finish: string | null };

export type MakeupTutorial = {
  schemaVersion: "1.0";
  title: string;
  summary: string;
  estimatedMinutes: number;
  difficulty: "easy" | "intermediate" | "advanced";
  highlights: string[];
  palette: TutorialSwatch[];
  steps: TutorialStep[];
  disclaimer: string;
};
