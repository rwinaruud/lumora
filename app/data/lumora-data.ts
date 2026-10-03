export type CuratedLook = { id: string; name: string; description: string; image: string; tone: string };

const portrait = (id: string, width = 700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

export const curatedLooks: CuratedLook[] = [
  { id: "natural", name: "Natural", description: "Soft & effortless", image: portrait("photo-1488426862026-3ee34a7d66df"), tone: "#e9d4c8" },
  { id: "glow", name: "Glow", description: "Fresh & dewy", image: portrait("photo-1524504388940-b1c1722653e1"), tone: "#e9bba9" },
  { id: "soft-glam", name: "Soft glam", description: "Polished & defined", image: portrait("photo-1534528741775-53994a69daeb"), tone: "#c88a7c" },
  { id: "smoky", name: "Smoky", description: "Smoky & sultry", image: portrait("photo-1508214751196-bcfd4ca60f91"), tone: "#785959" },
  { id: "bold", name: "Bold", description: "Strong & confident", image: portrait("photo-1506794778202-cad84cf45f1d"), tone: "#a64b4c" },
  { id: "editorial", name: "Editorial", description: "Creative & expressive", image: portrait("photo-1529139574466-a303027c1d8b"), tone: "#9e706e" },
];

export const heroPortrait = portrait("photo-1488426862026-3ee34a7d66df", 1200);