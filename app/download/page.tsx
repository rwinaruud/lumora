import Link from "next/link";
import { SiteFooter } from "@/app/components/site-footer";

export default async function DownloadPage({ searchParams }: PageProps<"/download">) {
  const { session_id: sessionId } = await searchParams;
  const validSessionId = typeof sessionId === "string" && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId);

  return <main className="site-shell">
    <header className="site-header"><Link className="brand" href="/" aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></Link></header>
    <section className="flow-page">
      <div className="flow-heading"><span className="eyebrow">YOUR LUMORA</span><h1>Your HD download</h1><p>Payment is verified securely before your original image is sent.</p></div>
      <div className="flow-footer">
        {validSessionId
          ? <a className="button button-primary" href={`/api/hd-download?session_id=${encodeURIComponent(sessionId)}`}>Download HD <span aria-hidden="true">→</span></a>
          : <p role="alert">This download link is invalid. Return to Lumora to create a new look.</p>}
        <Link className="button button-outline" href="/">Back to Lumora</Link>
      </div>
    </section>
    <SiteFooter />
  </main>;
}
