import "server-only";
import { db } from "@/lib/db";

export type FaqGroup = { title: string; items: { q: string; a: string }[] };

export async function getPublishedFaqGroups(): Promise<FaqGroup[]> {
  const faqs = await db.faq.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { category: true, question: true, answer: true },
  });
  const order: string[] = [];
  const groups = new Map<string, FaqGroup>();
  for (const faq of faqs) {
    const title = faq.category?.trim() || "General";
    if (!groups.has(title)) {
      order.push(title);
      groups.set(title, { title, items: [] });
    }
    groups.get(title)?.items.push({ q: faq.question, a: faq.answer });
  }
  return order
    .map((title) => groups.get(title))
    .filter((group): group is FaqGroup => Boolean(group));
}
