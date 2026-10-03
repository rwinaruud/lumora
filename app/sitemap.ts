import type { MetadataRoute } from "next";

const baseUrl = "https://lumorabeauty.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/faq", "/contact", "/privacy", "/terms"].map((path) => ({
    url: `${baseUrl}${path}`,
  }));
}
