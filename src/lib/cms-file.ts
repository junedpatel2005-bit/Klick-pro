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
    title: "Empowering honest work through trust & transparency",
    description:
      "Klick-Pro is a milestone-based service marketplace designed to connect clients with verified professionals across India, backed by secure escrow protection and clear accountability.",
  },
  cards: [
    {
      id: "trust-verification",
      title: "Trust & ID Verification",
      description:
        "Every professional undergoes identity and credential verification so clients hire with total confidence and peace of mind.",
      icon: "shield",
    },
    {
      id: "escrow-protection",
      title: "Guaranteed Escrow Protection",
      description:
        "Milestone payments remain safely deposited in escrow before work begins and are released only when deliverables are approved.",
      icon: "briefcase",
    },
    {
      id: "both-sides",
      title: "Built for Both Sides",
      description:
        "Clients receive reliable work without haggling, while professionals grow sustainable businesses without chasing unpaid invoices.",
      icon: "handshake",
    },
    {
      id: "fair-pricing",
      title: "Fair & Transparent Pricing",
      description:
        "Clear milestones, transparent pricing, and low platform commissions with zero hidden charges or surprise deductions.",
      icon: "award",
    },
    {
      id: "community-reputation",
      title: "Community-Driven Reputation",
      description:
        "Only clients with completed, paid projects can leave ratings and reviews, ensuring 100% genuine reputation across the platform.",
      icon: "users",
    },
    {
      id: "support-dispute",
      title: "Dedicated Support & Mediation",
      description:
        "A dedicated support team and built-in dispute resolution protect both parties and ensure fair outcomes if issues ever arise.",
      icon: "shield",
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
