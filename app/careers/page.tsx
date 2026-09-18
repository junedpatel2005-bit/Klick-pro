import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="gradient-hero">
          <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Careers at Klick-Pro
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Build a better way to work.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              We are creating a trusted marketplace where local clients and professionals can work
              confidently together.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
            <h2 className="font-display text-2xl font-semibold">Open roles coming soon</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Want to work with us? Send your profile through our contact page and we will keep it
              on file for future opportunities.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
