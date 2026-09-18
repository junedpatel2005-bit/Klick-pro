"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClientAccountMenu } from "@/components/ClientAccountMenu";
import { Logo } from "./Logo";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/services", label: "Services" },
  { to: "/for-clients", label: "For Clients" },
  { to: "/for-professionals", label: "For Professionals" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
];

export function SiteHeader({
  preview = false,
  onNavigate,
}: {
  preview?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ role: string } | null>(null);
  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { role: string } } | null) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);
  const homeHref = user?.role === "PROFESSIONAL" ? "/professional-home" : "/";
  const dashboardHref =
    user?.role === "ADMIN"
      ? "/admin"
      : user?.role === "PROFESSIONAL"
        ? "/professional/dashboard"
        : "/dashboard";
  return (
    <header
      onClickCapture={
        preview
          ? (event) => {
              const link = (event.target as HTMLElement).closest("a");
              if (link) {
                event.preventDefault();
                onNavigate?.(link.getAttribute("href") ?? "/");
              }
            }
          : undefined
      }
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo preview={preview} />
          <nav className="hidden items-center gap-6 lg:flex">
            {links.map((l) => {
              const active =
                l.to === "/"
                  ? pathname === homeHref
                  : pathname === l.to || pathname.startsWith(`${l.to}/`);
              return (
                <Link
                  key={l.to}
                  href={l.to === "/" ? homeHref : l.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative px-1 py-2 text-sm transition-colors after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:transition-transform ${active ? "font-semibold text-primary after:scale-x-100 after:bg-primary" : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100 hover:after:bg-primary/40"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href={dashboardHref}>Dashboard</Link>
              </Button>
              <div className="hidden sm:block">
                <ClientAccountMenu />
              </div>
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
          {user?.role === "CLIENT" ? (
            <Button
              asChild
              size="sm"
              className="bg-cta text-cta-foreground hover:bg-cta/90 shadow-soft"
            >
              <Link href="/post-job">Post a Job</Link>
            </Button>
          ) : null}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((l) => {
              const active =
                l.to === "/"
                  ? pathname === homeHref
                  : pathname === l.to || pathname.startsWith(`${l.to}/`);
              return (
                <Link
                  key={l.to}
                  href={l.to === "/" ? homeHref : l.to}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-sm ${active ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted"}`}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={dashboardHref}>Dashboard</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
              )}
              {user?.role === "CLIENT" ? (
                <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
                  <Link href="/post-job">Post a Job</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
