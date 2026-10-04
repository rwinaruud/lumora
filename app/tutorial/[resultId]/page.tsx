import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/site-footer";
import { TutorialViewTracker } from "@/app/components/tutorial-view-tracker";
import { TutorialPdfCta } from "@/app/components/tutorial-pdf-cta";
import type { TutorialProductSlot } from "@/lib/look-tutorial";
import { resolveTutorial } from "@/lib/look-tutorial/resolve";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;

export const metadata: Metadata = {
  title: "Your makeup tutorial | Lumora Beauty",
  description: "A personalised step-by-step guide to your Lumora look.",
  robots: { index: false, follow: false },
};

const difficultyLabel = { easy: "Easy", intermediate: "Intermediate", advanced: "Advanced" } as const;

// Future affiliate products render here, driven by each step's productSlots. Nothing is shown until a product feed exists.
function StepProducts({ slots }: { slots: TutorialProductSlot[] }) {
  void slots;
  return null;
}

export default async function TutorialPage({ params }: PageProps<"/tutorial/[resultId]">) {
  const { resultId } = await params;
  if (!resultIdPattern.test(resultId)) notFound();
  const tutorial = await resolveTutorial(resultId);
  if (!tutorial) notFound();

  return <main className="site-shell">
    <TutorialViewTracker viewKey={resultId} stepCount={tutorial.steps.length} difficulty={tutorial.difficulty} />
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></Link>
    </header>
    <article className="tutorial-page">
      <div className="flow-heading"><span className="eyebrow">YOUR MAKEUP TUTORIAL</span><h1>{tutorial.title}</h1><p>{tutorial.summary}</p></div>
      <div className="tutorial-hero"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-lilac" aria-hidden="true" /><i className="sparkle" aria-hidden="true" />
        <div className="tutorial-hero-photo tilt"><Image src={`/api/share-preview/${resultId}`} alt="Your Lumora makeup look" fill unoptimized preload sizes="(max-width: 700px) 80vw, 320px" /></div>
      </div>
      <dl className="tutorial-meta">
        <div><dt>Time</dt><dd>~{tutorial.estimatedMinutes} min</dd></div>
        <div><dt>Level</dt><dd>{difficultyLabel[tutorial.difficulty]}</dd></div>
        <div><dt>Steps</dt><dd>{tutorial.steps.length}</dd></div>
      </dl>
      {tutorial.highlights.length > 0 && <ul className="tutorial-highlights" aria-label="Look highlights">{tutorial.highlights.map((item) => <li key={item}>{item}</li>)}</ul>}
      {tutorial.palette.length > 0 && <section className="tutorial-palette" aria-label="Colours and finishes">
        <h2>The palette</h2>
        <ul>{tutorial.palette.map((swatch) => <li key={swatch.label}>
          <span className="tutorial-swatch" style={swatch.colour ? { background: swatch.colour } : undefined} aria-hidden="true" />
          <strong>{swatch.label}</strong><small>{[swatch.colourFamily, swatch.finish].filter(Boolean).join(" · ")}</small>
        </li>)}</ul>
      </section>}
      <ol className="tutorial-steps">
        {tutorial.steps.map((step, index) => <li className="tutorial-step" key={step.id}>
          <span className="tutorial-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div className="tutorial-step-body">
            <h2>{step.title}</h2>
            <p>{step.instruction}</p>
            {(step.attributes.colour || step.attributes.finish || step.attributes.intensity) && <ul className="tutorial-chips">{[step.attributes.colour, step.attributes.finish, step.attributes.intensity].filter(Boolean).map((chip) => <li key={chip}>{chip}</li>)}</ul>}
            {step.tools.length > 0 && <p className="tutorial-needs"><span>You&apos;ll need</span>{step.tools.map((item) => item.label).join(" · ")}</p>}
            {step.tip && <p className="tutorial-tip"><span>Lumora tip</span>{step.tip}</p>}
            <StepProducts slots={step.productSlots} />
          </div>
        </li>)}
      </ol>
      <TutorialPdfCta resultId={resultId} />
      <Link className="button button-primary" href="/">Create another Lumora <span aria-hidden="true">→</span></Link>
      <p className="privacy-note">{tutorial.disclaimer}</p>
    </article>
    <SiteFooter />
  </main>;
}
