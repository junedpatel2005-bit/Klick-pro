export const marketingPageIds = [
  "how-it-works",
  "professional-home",
  "services",
  "for-clients",
  "for-professionals",
  "pricing",
  "faq",
  "contact",
] as const;
export type MarketingPageId = (typeof marketingPageIds)[number];
export type MarketingItem = { id: string; title: string; description: string; icon: string };
export type MarketingPageContent = {
  hero: { label: string; title: string; description: string };
  features?: { label: string; title: string; description: string };
  items: MarketingItem[];
};
