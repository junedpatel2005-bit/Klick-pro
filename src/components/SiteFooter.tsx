import Link from "next/link";
import { Logo } from "./Logo";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

export function SiteFooter() {
  return (
    <>
      <footer className="border-t border-border bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-5 lg:px-8">
          <div className="md:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-bold text-white"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-cta text-cta-foreground">
                S
              </span>
              Klick-Pro
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/65">
              The trusted marketplace where clients meet vetted professionals. Post jobs, hire
              experts, track work — all in one platform.
            </p>
            <div className="mt-6 flex gap-2 text-white/70">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md p-2 hover:bg-white/10 hover:text-white"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md p-2 hover:bg-white/10 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md p-2 hover:bg-white/10 hover:text-white"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="https://www.twitter.com"
                target="_blank"
                rel="noreferrer"
                className="rounded-md p-2 hover:bg-white/10 hover:text-white"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>
          <FooterCol
            title="Company"
            links={[
              { l: "About", to: "/about" },
              { l: "Careers", to: "/careers" },
              { l: "Blog", to: "/blog" },
            ]}
          />
          <FooterCol
            title="Support"
            links={[
              { l: "FAQ", to: "/faq" },
              { l: "Contact", to: "/contact" },
              { l: "Help Center", to: "/faq" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { l: "Privacy Policy", to: "/privacy-policy" },
              { l: "Terms", to: "/terms" },
              { l: "Cookies", to: "/cookies" },
            ]}
          />
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
            <span>© 2026 Klick-Pro, Inc. All rights reserved.</span>
            <span>Made for trusted local & remote work.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: { l: string; to: string }[] }) {
  return (
    <div>
      <h4 className="font-display text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-white/65">
        {links.map((l) => (
          <li key={l.l}>
            <Link href={l.to} className="hover:text-white">
              {l.l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
