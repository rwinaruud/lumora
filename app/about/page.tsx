import type { Metadata } from "next";
import { InfoShell } from "../components/info-shell";

export const metadata: Metadata = { title: "About | Lumora Beauty" };

export default function AboutPage() {
  return <InfoShell>
    <header className="info-heading"><span className="eyebrow"><span className="eyebrow-dot" /> ABOUT LUMORA</span><h1>See the look.<br /><em>On you.</em></h1></header>
    <div className="info-body info-body-large">
      <p>Lumora is a new way to explore makeup.</p>
      <p>Upload a photo of yourself and a makeup look that inspires you. Lumora recreates the look on your photo while keeping the things that make you, you.</p>
      <p>Your features. Your skin tone. Your expression. Your identity.</p>
      <p>The idea is simple: makeup should be something to explore, not something that tells you what you should look like.</p>
      <p>Try something subtle. Try something completely different. Find a look you love — and, if you want, discover products that can help you recreate it in real life.</p>
    </div>
    <p className="info-closing">Keep you, you.</p>
  </InfoShell>;
}
