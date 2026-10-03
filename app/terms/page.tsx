import type { Metadata } from "next";
import { InfoShell } from "../components/info-shell";

export const metadata: Metadata = { title: "Terms of Use | Lumora Beauty" };

const sections = [
  { title: "About Lumora", body: "Lumora provides AI-generated makeup visualizations for inspiration and entertainment." },
  { title: "AI-generated results", body: "Lumora results are generated using artificial intelligence. Results may contain inaccuracies, variations or visual artifacts and should not be treated as an exact representation of how a product or makeup look will appear in real life." },
  { title: "Uploaded images", body: "You are responsible for the images you upload and for having the necessary rights or permission to use them. Do not upload images that are unlawful or violate the rights of others." },
  { title: "Purchases", body: "Prices for paid features are displayed before purchase. Additional payment and refund information will be included before public launch." },
  { title: "Product recommendations", body: "Product recommendations are intended to help recreate the visual characteristics of a look. Lumora does not claim that recommended products are the exact products used in an inspiration image." },
  { title: "Affiliate links", body: "Some links to retailers may be affiliate links. Lumora may receive a commission from qualifying purchases at no additional cost to you." },
  { title: "Availability", body: "Lumora may change, improve, suspend or discontinue parts of the service. We do not guarantee uninterrupted availability." },
];

export default function TermsPage() {
  return <InfoShell>
    <header className="info-heading"><h1>Terms of Use</h1><p className="info-updated">Last updated: October 2026</p></header>
    <div className="info-sections">
      {sections.map((section, index) => <section key={section.title}><h2><span>{index + 1}.</span> {section.title}</h2><p>{section.body}</p></section>)}
      <section><h2><span>{sections.length + 1}.</span> Contact</h2><p>Questions about these terms can be sent to:<br /><a href="mailto:hello@lumorabeauty.ai">hello@lumorabeauty.ai</a></p></section>
    </div>
  </InfoShell>;
}
