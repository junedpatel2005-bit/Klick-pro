import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="gradient-hero">
          <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Klick-Pro blog
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Work smarter, together.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Practical marketplace advice for clients and independent professionals.
            </p>
          </div>
        </section>
        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Getting started
            </p>
            <h2 className="mt-3 font-display text-xl font-semibold">
              How to write a job post that attracts the right professional
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Clear goals, budget expectations, and timelines help professionals send stronger
              proposals.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-7 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              For professionals
            </p>
            <h2 className="mt-3 font-display text-xl font-semibold">
              Build trust with a complete professional profile
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Add your skills, service details, verification documents, and reviews to stand out.
            </p>
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
