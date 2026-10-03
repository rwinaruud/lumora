import type { Metadata } from "next";
import { InfoShell } from "../components/info-shell";

export const metadata: Metadata = { title: "Contact | Lumora Beauty" };

export default function ContactPage() {
  return <InfoShell>
    <header className="info-heading"><span className="eyebrow"><span className="eyebrow-dot" /> SAY HELLO</span><h1>We’d love to hear from you.</h1><p className="info-intro">Questions, feedback or something else?</p></header>
    <div className="contact-list">
      <div><small>GENERAL</small><a href="mailto:hello@lumorabeauty.ai">hello@lumorabeauty.ai</a></div>
      <div><small>PRIVACY</small><a href="mailto:privacy@lumorabeauty.ai">privacy@lumorabeauty.ai</a></div>
    </div>
  </InfoShell>;
}
