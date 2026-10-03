import type { Metadata } from "next";
import { InfoShell } from "../components/info-shell";

export const metadata: Metadata = { title: "Privacy Policy | Lumora Beauty" };

const sections = [
  { title: "What Lumora processes", body: "When you use Lumora, you may provide a photo of yourself and a makeup inspiration image. Lumora processes these images to create your personalized makeup visualization and, when requested, analyze the resulting look." },
  { title: "Private by default", body: "Your uploaded photos and generated Lumora are private by default. Lumora does not automatically publish them or post them to social media." },
  { title: "Sharing", body: "If you choose to use Lumora’s sharing features, you explicitly initiate that action. Nothing is posted without your permission." },
  { title: "Payments", body: "If you purchase a paid Lumora feature, payment is handled by our payment provider. Lumora does not store your complete payment card details." },
  { title: "Product recommendations", body: "Lumora may provide links to third-party retailers. Some of these links may be affiliate links, meaning Lumora may receive a commission if you make a purchase." },
  { title: "AI processing", body: "Lumora uses third-party technology providers to process images and provide parts of the service. Additional information about these providers and applicable data processing will be included in this policy before public launch." },
  { title: "Storage and deletion", body: "Lumora is designed to retain uploaded and generated images only for as long as necessary to provide the service. Specific retention periods will be published here before public launch." },
  { title: "Your rights", body: "Depending on where you live, privacy laws may provide rights relating to your personal data. Contact us if you have a privacy-related request." },
];

export default function PrivacyPage() {
  return <InfoShell>
    <header className="info-heading"><h1>Privacy Policy</h1><p className="info-intro">Your photos are personal. We treat them that way.</p><p className="info-updated">Last updated: October 2026</p></header>
    <div className="info-sections">
      {sections.map((section, index) => <section key={section.title}><h2><span>{index + 1}.</span> {section.title}</h2><p>{section.body}</p></section>)}
      <section><h2><span>{sections.length + 1}.</span> Contact</h2><p>For privacy questions, contact:<br /><a href="mailto:privacy@lumorabeauty.ai">privacy@lumorabeauty.ai</a></p></section>
    </div>
  </InfoShell>;
}
