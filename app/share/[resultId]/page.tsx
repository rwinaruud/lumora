import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter } from "@/app/components/site-footer";
import { privateResultExists } from "@/lib/generated-result-storage";
import { getAppBaseUrl } from "@/lib/stripe-server";

const resultIdPattern = /^[A-Za-z0-9_-]{43}$/;

type SharePageProps = PageProps<"/share/[resultId]">;

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { resultId } = await params;
  const baseUrl = getAppBaseUrl();
  const shareUrl = new URL(`/share/${encodeURIComponent(resultId)}`, baseUrl).toString();
  const previewUrl = new URL(`/api/share-preview/${encodeURIComponent(resultId)}`, baseUrl).toString();
  const title = "Your Lumora | Lumora Beauty";
  const description = "See the look. On you.";

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: { canonical: shareUrl },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      url: shareUrl,
      images: [{ url: previewUrl, alt: "A shared Lumora makeup preview" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewUrl],
    },
  };
}

export default async function SharedLumoraPage({ params }: SharePageProps) {
  const { resultId } = await params;
  if (!resultIdPattern.test(resultId) || !await privateResultExists(resultId)) notFound();

  return <main className="site-shell">
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></Link>
      <span className="header-note">BEAUTY, MADE PERSONAL</span>
    </header>
    <section className="share-page">
      <div className="flow-heading"><span className="eyebrow">MADE WITH LUMORA</span><h1>Your Lumora</h1><p>See the look. On you.</p></div>
      <div className="story-preview">
        <Image src={`/api/share-preview/${resultId}`} alt="A shared Lumora makeup preview" fill unoptimized preload sizes="(max-width: 700px) 70vw, 290px" />
        <div className="story-top"><span>LUMORA</span><small>BEAUTY, MADE PERSONAL</small></div>
        <div className="story-bottom"><span>Made with Lumora</span><strong>See the look.<br /><em>On you.</em></strong><small>lumorabeauty.ai</small></div>
      </div>
      <Link className="button button-primary" href="/">Create your own Lumora <span aria-hidden="true">→</span></Link>
      <p className="privacy-note">A look shared with you.</p>
    </section>
    <SiteFooter />
  </main>;
}
