import Link from "next/link";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter({ minimal = false }: { minimal?: boolean }) {
  if (minimal) return <footer className="site-footer site-footer-minimal"><span>© LUMORA BEAUTY</span><span>Keep you, you.</span><span>Private by default</span></footer>;
  return <footer className="site-footer">
    <span className="footer-copy">© LUMORA BEAUTY</span>
    <nav className="footer-nav" aria-label="Lumora information">{footerLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    <span className="footer-tagline"><span>Keep you, you.</span><span>Private by default</span></span>
  </footer>;
}
