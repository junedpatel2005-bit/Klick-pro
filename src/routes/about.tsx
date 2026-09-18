import { readCmsContent } from "@/lib/cms-file";
import { AboutFeatureGrid } from "@/components/AboutFeatureGrid";
import { AboutHero } from "@/components/AboutHero";

export default async function About() {
  const content = await readCmsContent();
  return (
    <div className="min-h-screen bg-background">
      <main>
        {content.sectionOrder.map((section) =>
          section === "hero" ? (
            <AboutHero key={section} {...content.hero} />
          ) : (
            <section key={section} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
              <AboutFeatureGrid cards={content.cards} />
            </section>
          ),
        )}
      </main>
    </div>
  );
}
