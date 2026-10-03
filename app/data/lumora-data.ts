export type CuratedLook = { id: string; name: string; description: string; image: string; tone: string };

export const curatedLooks: CuratedLook[] = [
  { id: "natural", name: "Natural", description: "Soft & effortless", image: "/look-natural.jpg", tone: "#e9d4c8" },
  { id: "glow", name: "Glow", description: "Fresh & dewy", image: "/look-glow.jpg", tone: "#e9bba9" },
  { id: "soft-glam", name: "Soft Glam", description: "Polished & defined", image: "/look-soft-glam.jpg", tone: "#c88a7c" },
  { id: "smoky", name: "Smoky", description: "Smoky & sultry", image: "/look-smoky.jpg", tone: "#785959" },
  { id: "bold", name: "Bold", description: "Strong & confident", image: "/look-bold.jpg", tone: "#a64b4c" },
  { id: "editorial", name: "Editorial", description: "Creative & expressive", image: "/look-editorial.jpg", tone: "#9e706e" },
];

export const heroPortrait = "/lumora-hero.jpg";