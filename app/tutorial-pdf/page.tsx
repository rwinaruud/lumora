import Link from "next/link";
import { SiteFooter } from "@/app/components/site-footer";
import { TutorialPdfDownloadLink, TutorialPdfPurchaseTracker } from "@/app/components/tutorial-pdf-tracking";
import { verifiedTutorialPdfResultId } from "@/lib/stripe-server";

export const metadata = { title: "Your tutorial PDF | Lumora Beauty", robots: { index: false, follow: false } };

export default async function TutorialPdfPage({ searchParams }: PageProps<"/tutorial-pdf">) {
  const { session_id: sessionId } = await searchParams;
  const validSessionId = typeof sessionId === "string" && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId);
  const resultId = validSessionId ? await verifiedTutorialPdfResultId(sessionId) : null;

  return <main className="site-shell">
    {resultId && validSessionId && <TutorialPdfPurchaseTracker dedupeKey={sessionId} />}
    <header className="site-header"><Link className="brand" href="/" aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></Link></header>
    <section className="flow-page confirm-page">
      <div className="confirm-art" aria-hidden="true"><i className="smear smear-pink" /><i className="smear smear-lilac" /><i className="smear smear-coral" /><i className="sparkle" /></div>
      <div className="flow-heading"><span className="eyebrow">YOUR LUMORA</span><h1>Your <em>tutorial PDF</em></h1><p>Payment is verified securely before your PDF is created.</p></div>
      <div className="flow-footer">
        {resultId && validSessionId
          ? <TutorialPdfDownloadLink href={`/api/tutorial-pdf?session_id=${encodeURIComponent(sessionId)}`} />
          : <p role="alert">This download link is invalid or the payment could not be verified. Return to Lumora to try again.</p>}
        {resultId && <Link className="button button-secondary" href={`/tutorial/${resultId}`}>Back to my tutorial</Link>}
        <Link className="button button-secondary" href="/">Back to Lumora</Link>
      </div>
    </section>
    <SiteFooter />
  </main>;
}
