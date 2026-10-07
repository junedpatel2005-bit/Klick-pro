import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Star } from "lucide-react";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  hideAside = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideAside?: boolean;
}) {
  return (
    <div
      className={
        hideAside
          ? "min-h-screen bg-[radial-gradient(circle_at_top,_oklch(0.98_0.02_263),_var(--color-background)_52%)] px-4 sm:px-6"
          : "min-h-screen lg:grid lg:grid-cols-2"
      }
    >
      <div
        className={`flex min-h-screen flex-col py-6 sm:py-8 lg:px-12 ${hideAside ? "mx-auto max-w-3xl" : "px-6"}`}
      >
        <div className={hideAside ? "flex justify-center" : ""}>
          <Logo />
        </div>
        <div
          className={`mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8 sm:py-10 ${
            hideAside
              ? "my-4 rounded-3xl border border-border/80 bg-card/95 p-6 shadow-elevated backdrop-blur sm:p-8"
              : ""
          }`}
        >
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="text-center text-xs text-muted-foreground">© 2026 Klick-Pro, Inc.</p>
      </div>
      {!hideAside && (
        <div className="relative hidden gradient-hero lg:block">
          <div className="absolute inset-0 flex flex-col justify-between p-12">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to site
            </Link>
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-elevated backdrop-blur">
              <div className="flex gap-1 text-warning">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-warning" />
                ))}
              </div>
              <p className="mt-3 text-lg leading-snug text-foreground">
                "Klick-Pro is the only marketplace I trust. The pros are exceptional and the process
                is effortless."
              </p>
              <div className="mt-5 flex items-center gap-3">
                <img
                  src="https://i.pravatar.cc/100?u=olivia"
                  className="h-10 w-10 rounded-full"
                  alt=""
                />
                <div>
                  <p className="text-sm font-semibold">Olivia Bennett</p>
                  <p className="text-xs text-muted-foreground">Founder, Lumen</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
