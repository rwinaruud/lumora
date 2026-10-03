import type { Metadata } from "next";
import { InfoShell } from "../components/info-shell";

export const metadata: Metadata = { title: "FAQ | Lumora Beauty" };

const questions = [
  { q: "What is Lumora?", a: "Lumora lets you see how a makeup look could look on you. Upload your photo and an inspiration image, or choose one of our curated looks, and Lumora creates your personalized result." },
  { q: "Does Lumora change my face?", a: "Lumora is designed to preserve your identity and facial features while recreating the makeup look. AI-generated images can still contain small variations, so results should be seen as a visualization rather than an exact representation." },
  { q: "Is Lumora free?", a: "Creating and viewing your Lumora preview is free. You can also share your look and explore product recommendations for free. A high-resolution download without Lumora branding is available separately." },
  { q: "Do I need an account?", a: "No. Lumora does not require an account to create a look." },
  { q: "What kind of photo should I upload?", a: "Use a clear photo with one visible face. Phone photos are perfect. For the best result, avoid heavily obscured faces or photos where your face is very small." },
  { q: "Can I use any makeup inspiration?", a: "You can upload a makeup inspiration image or choose one of Lumora’s curated looks. Make sure you have the right to use images you upload." },
  { q: "Are the recommended products the exact products used in my inspiration photo?", a: "No. Lumora analyzes the look and recommends products that may help recreate it. We do not claim to identify the exact products originally used." },
  { q: "Does Lumora earn money from product recommendations?", a: "Some product links may be affiliate links. If you purchase through one of these links, Lumora may receive a commission at no additional cost to you." },
  { q: "What happens to my photos?", a: "Your photos are processed to create your Lumora. They are private by default and are not publicly shared by Lumora. More information about processing and retention is available in our Privacy Policy." },
  { q: "Will Lumora post my photo on social media?", a: "Never automatically. Sharing only happens when you explicitly choose to share your Lumora." },
];

export default function FaqPage() {
  return <InfoShell>
    <header className="info-heading"><span className="eyebrow"><span className="eyebrow-dot" /> GOOD TO KNOW</span><h1>Questions?<br /><em>Meet answers.</em></h1></header>
    <div className="faq-list">{questions.map((item) => <details key={item.q} className="faq-item"><summary><span>{item.q}</span><i aria-hidden="true" /></summary><p>{item.a}</p></details>)}</div>
  </InfoShell>;
}
