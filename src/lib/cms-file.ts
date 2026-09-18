import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeCmsHtml } from "@/lib/sanitizeCmsHtml";

const contentFile = path.resolve(process.cwd(), "data", "cms-content.json");
export type CmsIcon = "shield" | "handshake" | "award" | "briefcase" | "users";
export type CmsCard = { id: string; title: string; description: string; icon: CmsIcon };
export type CmsContent = {
  hero: { label: string; title: string; description: string };
  cards: CmsCard[];
  sectionOrder: Array<"hero" | "features">;
  updatedAt: string | null;
};
export const defaultContent: CmsContent = {
  hero: {
    label: "ABOUT KLICK-PRO",
    title: "Better work starts with trust.",
    description:
      "Klick-Pro brings clients and skilled professionals together in one safe, simple marketplace.",
  },
  cards: [
    {
      id: "trust-first",
      title: "Trust first",
      description:
        "Verified profiles and clear project milestones help everyone work with confidence.",
      icon: "shield",
    },
    {
      id: "both-sides",
      title: "Built for both sides",
      description: "Clients hire with clarity while professionals grow their business.",
      icon: "handshake",
    },
    {
      id: "work-worth-doing",
      title: "Work worth doing",
      description: "From local services to digital projects, good work deserves a better home.",
      icon: "award",
    },
  ],
  sectionOrder: ["hero", "features"],
  updatedAt: null,
};
let writeQueue = Promise.resolve();

async function ensureContentFile() {
  await mkdir(path.dirname(contentFile), { recursive: true });
  try {
    await readFile(contentFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(contentFile, JSON.stringify(defaultContent, null, 2) + "\n", "utf8");
  }
}

export async function readCmsContent(): Promise<CmsContent> {
  await ensureContentFile();
  try {
    const parsed: unknown = JSON.parse(await readFile(contentFile, "utf8"));
    if (!parsed || typeof parsed !== "object") return defaultContent;
    const record = parsed as Record<string, unknown>;
    const hero = record.hero as Record<string, unknown> | undefined;
    const cards = Array.isArray(record.cards) ? record.cards : [];
    if (!hero || !cards.length) return defaultContent;
    return {
      hero: {
        label: typeof hero.label === "string" ? hero.label : defaultContent.hero.label,
        title: typeof hero.title === "string" ? hero.title : defaultContent.hero.title,
        description:
          typeof hero.description === "string"
            ? sanitizeCmsHtml(hero.description)
            : defaultContent.hero.description,
      },
      cards: cards
        .filter((card): card is Record<string, unknown> =>
          Boolean(card && typeof card === "object"),
        )
        .map((card, index) => ({
          id: typeof card.id === "string" && card.id ? card.id : `card-${index + 1}`,
          title: typeof card.title === "string" ? card.title : "New card",
          description: typeof card.description === "string" ? card.description : "",
          icon: isCmsIcon(card.icon) ? card.icon : "shield",
        })),
      sectionOrder:
        Array.isArray(record.sectionOrder) &&
        record.sectionOrder.length === 2 &&
        record.sectionOrder.includes("hero") &&
        record.sectionOrder.includes("features")
          ? (record.sectionOrder as Array<"hero" | "features">)
          : defaultContent.sectionOrder,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    };
  } catch {
    return defaultContent;
  }
}

export async function writeCmsContent(content: Omit<CmsContent, "updatedAt">): Promise<CmsContent> {
  const next: CmsContent = {
    hero: {
      label: content.hero.label.trim(),
      title: content.hero.title.trim(),
      description: sanitizeCmsHtml(content.hero.description),
    },
    cards: content.cards.map((card) => ({
      id: card.id,
      title: card.title.trim(),
      description: card.description.trim(),
      icon: card.icon,
    })),
    sectionOrder: content.sectionOrder,
    updatedAt: new Date().toISOString(),
  };
  writeQueue = writeQueue.then(async () => {
    await ensureContentFile();
    await writeFile(contentFile, JSON.stringify(next, null, 2) + "\n", "utf8");
  });
  await writeQueue;
  return next;
}

function isCmsIcon(value: unknown): value is CmsIcon {
  return ["shield", "handshake", "award", "briefcase", "users"].includes(value as string);
}
