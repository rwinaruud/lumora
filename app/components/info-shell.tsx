import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "./back-button";
import { SiteFooter } from "./site-footer";

export function InfoShell({ children }: { children: ReactNode }) {
  return <main className="site-shell">
    <header className="site-header">
      <BackButton />
      <Link className="brand" href="/" aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></Link>
    </header>
    <article className="info-page">{children}</article>
    <SiteFooter />
  </main>;
}
