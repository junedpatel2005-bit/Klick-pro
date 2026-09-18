import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  marketingPageIds,
  type MarketingPageContent,
  type MarketingPageId,
  type MarketingItem,
} from "@/lib/marketing-cms-shared";
export { marketingPageIds } from "@/lib/marketing-cms-shared";
export type {
  MarketingPageContent,
  MarketingPageId,
  MarketingItem,
} from "@/lib/marketing-cms-shared";
const file = path.resolve(process.cwd(), "data", "cms-marketing.json");
const item = (id: string, title: string, description: string, icon = "shield"): MarketingItem => ({
  id,
  title,
  description,
  icon,
});
export const marketingDefaults: Record<MarketingPageId, MarketingPageContent> = {
  "how-it-works": {
    hero: {
      label: "How it works",
      title: "A simpler way to hire & get hired",
      description:
        "Klick-Pro handles the busywork — discovery, vetting, payments, and tracking — so you can focus on the work.",
    },
    items: [
      item(
        "post",
        "Post your job",
        "Describe the work, set your budget and timeline. It's free and takes 2 minutes.",
        "clipboard",
      ),
      item(
        "compare",
        "Compare proposals",
        "Receive quotes from vetted pros. Chat, compare ratings, and shortlist the best.",
        "message",
      ),
      item(
        "hire",
        "Hire safely",
        "Funds are held in escrow and released only when each milestone is approved.",
        "shield",
      ),
      item(
        "pay",
        "Pay & review",
        "Release final payment and rate your pro to help our community.",
        "wallet",
      ),
    ],
  },
  "professional-home": {
    hero: {
      label: "Grow your professional business",
      title: "Find projects that match your skills",
      description:
        "Browse available projects, bid on work, and build your reputation with satisfied clients worldwide.",
    },
    features: {
      label: "Why Professionals Choose Us",
      title: "Everything you need to grow",
      description: "Find quality projects, get paid safely, and build a reputation clients trust.",
    },
    items: [
      item("grow", "Grow", "Find quality projects and build your professional business.", "trend"),
      item(
        "safe",
        "Get paid safely",
        "Work with clear milestones and reliable payments.",
        "shield",
      ),
      item(
        "reputation",
        "Build your reputation",
        "Deliver great work and earn reviews clients trust.",
        "star",
      ),
    ],
  },
  services: {
    hero: {
      label: "Marketplace jobs",
      title: "Browse client jobs",
      description:
        "Explore open work posted by clients and find the right service category for you.",
    },
    items: [
      item(
        "local",
        "Local services",
        "Find trusted professionals near you for work that needs a local touch.",
        "map",
      ),
      item(
        "digital",
        "Digital projects",
        "Connect with skilled remote professionals for flexible project work.",
        "search",
      ),
      item(
        "managed",
        "Managed projects",
        "Track communication, milestones, and payments in one place.",
        "briefcase",
      ),
    ],
  },
  "for-clients": {
    hero: {
      label: "For clients",
      title: "Hire trusted pros — without the back-and-forth",
      description:
        "Post once. Get qualified, vetted proposals fast. Pay only when work is done. It's the modern way to get things done.",
    },
    items: [
      item(
        "vetted",
        "Vetted professionals",
        "Every pro is ID-verified. Background checks for in-home services.",
        "shield",
      ),
      item(
        "escrow",
        "Escrow payments",
        "Your money is safe. Released only when you approve a milestone.",
        "wallet",
      ),
      item(
        "matches",
        "Fast matches",
        "Get your first proposal in under 2 hours, on average.",
        "clock",
      ),
      item("support", "World-class support", "Real humans, 24/7 — never a bot.", "users"),
    ],
  },
  "for-professionals": {
    hero: {
      label: "For professionals",
      title: "Find quality jobs. Get paid safely. Grow your business.",
      description:
        "No more chasing leads or waiting on payments. Klick-Pro brings nearby and remote jobs straight to you.",
    },
    items: [
      item(
        "grow",
        "Grow",
        "Algorithmic match-making puts you in front of the right clients.",
        "trend",
      ),
      item(
        "trusted",
        "Trusted",
        "Verified badges and ratings build long-term reputation.",
        "shield",
      ),
      item("nearby", "Nearby", "See jobs by distance, urgency, and budget — at a glance.", "map"),
      item("paid", "Paid weekly", "Withdraw earnings to your bank or wallet, anytime.", "wallet"),
    ],
  },
  pricing: {
    hero: {
      label: "Pricing",
      title: "Simple, transparent pricing",
      description: "Free for clients. Pros pay only when they get paid. No hidden fees.",
    },
    items: [
      item(
        "starter",
        "Starter",
        "Post jobs and apply for free. Pay only when you hire or are hired.",
        "check",
      ),
      item("pro", "Pro", "Win more work with priority placement and unlimited proposals.", "star"),
      item(
        "business",
        "Business",
        "Hire at scale with team seats, contracts, and dedicated support.",
        "briefcase",
      ),
    ],
  },
  faq: {
    hero: {
      label: "Help center",
      title: "Frequently asked questions",
      description: "Can't find what you're looking for? Our team is one click away.",
    },
    items: [
      item(
        "what",
        "What is Klick-Pro?",
        "Klick-Pro is a marketplace that connects clients with verified professionals for local and remote work.",
      ),
      item(
        "free",
        "Is it free to use?",
        "Posting jobs and creating a profile are free. Clients pay only the agreed price.",
      ),
      item(
        "vet",
        "How are professionals vetted?",
        "Every pro completes ID verification. For in-home services, we also run background checks.",
      ),
    ],
  },
  contact: {
    hero: {
      label: "Contact Klick-Pro",
      title: "How can we help?",
      description: "Tell us what you need and our marketplace team will be in touch.",
    },
    items: [
      item(
        "email",
        "Email support",
        "For account, project, or payment questions, send us a message any time.",
        "mail",
      ),
      item(
        "safe",
        "Safe & private",
        "Your request is only visible to the Klick-Pro support team.",
        "shield",
      ),
    ],
  },
};
export async function readMarketingContent(page: MarketingPageId) {
  let all: Partial<Record<MarketingPageId, MarketingPageContent>> = {};
  try {
    all = JSON.parse(await readFile(file, "utf8")) as typeof all;
  } catch {
    /* initialize below */
  }
  const value = all[page] ?? marketingDefaults[page];
  if (!all[page]) {
    all[page] = value;
    // Vercel's deployed filesystem is read-only. The default content is still
    // valid for this request even when the best-effort cache write is rejected.
    await mkdir(path.dirname(file), { recursive: true })
      .then(() => writeFile(file, JSON.stringify(all, null, 2) + "\n", "utf8"))
      .catch(() => undefined);
  }
  return value;
}
export async function writeMarketingContent(page: MarketingPageId, content: MarketingPageContent) {
  let all: Partial<Record<MarketingPageId, MarketingPageContent>> = {};
  try {
    all = JSON.parse(await readFile(file, "utf8")) as typeof all;
  } catch {
    /* recreate */
  }
  all[page] = content;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(all, null, 2) + "\n", "utf8");
  return content;
}
