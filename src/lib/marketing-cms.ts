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
      title: "A simpler, safer way to hire & get hired",
      description:
        "Klick-Pro connects clients with verified professionals through a secure, milestone-based escrow workflow. Here is how the end-to-end process works.",
    },
    items: [
      item(
        "step-1-post",
        "1. Post your job",
        "Describe what you need, choose a service category, and specify your budget and timeline. It takes under two minutes.",
        "clipboard",
      ),
      item(
        "step-2-proposals",
        "2. Receive & compare quotes",
        "Verified professionals review your job and send customized proposals. Chat directly, compare ratings, and choose the best match.",
        "message",
      ),
      item(
        "step-3-escrow",
        "3. Fund secure escrow",
        "Accept a proposal and deposit milestone funds into secure escrow. Money is protected safely by Klick-Pro before work begins.",
        "shield",
      ),
      item(
        "step-4-tracking",
        "4. Collaborate & track milestones",
        "Professionals start work, update stages, share progress, and submit completed deliverables directly within the project tracker.",
        "briefcase",
      ),
      item(
        "step-5-approval",
        "5. Inspect & release payment",
        "Review the submitted deliverables. Once you approve the work, funds are released directly to the professional's wallet.",
        "wallet",
      ),
      item(
        "step-6-review",
        "6. Rate & review",
        "Both parties leave verified reviews and ratings upon project completion, helping build reputation and trust across the community.",
        "star",
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
        "Post once. Get qualified, vetted proposals fast. Pay securely only when work is completed and approved.",
    },
    items: [
      item(
        "step-1-post",
        "1. Post your job requirement",
        "Describe your task or project, choose the service category, and set your budget and timeline. It's completely free to post.",
        "clipboard",
      ),
      item(
        "step-2-proposals",
        "2. Get verified proposals",
        "Receive competitive quotes from ID-verified, background-checked professionals. Review their ratings, completed projects, and client feedback.",
        "users",
      ),
      item(
        "step-3-chat",
        "3. Chat & finalize scope",
        "Message professionals in real-time to discuss details, ask questions, negotiate terms, and shortlist the top candidate.",
        "message",
      ),
      item(
        "step-4-escrow",
        "4. Secure escrow deposit",
        "Deposit milestone payments securely through Razorpay. Your money is held safely in escrow and never released upfront.",
        "shield",
      ),
      item(
        "step-5-milestones",
        "5. Track work & inspect results",
        "Follow project stages in real-time, inspect deliverables uploaded by your pro, and request revisions until you are 100% satisfied.",
        "briefcase",
      ),
      item(
        "step-6-release-review",
        "6. Release payment & review",
        "Approve the completed milestone to release payment to the pro, then leave a review to help others in the community.",
        "star",
      ),
    ],
  },
  "for-professionals": {
    hero: {
      label: "For professionals",
      title: "Find quality jobs. Get paid safely. Grow your business.",
      description:
        "Connect with verified clients, submit competitive proposals, and receive guaranteed milestone payouts with zero payment chasing.",
    },
    items: [
      item(
        "step-1-profile",
        "1. Build profile & verify ID",
        "Showcase your expertise, add skills, set service areas, and complete verification to earn your verified pro trust badge.",
        "shield",
      ),
      item(
        "step-2-browse",
        "2. Discover matching jobs",
        "Browse local and digital job postings matched to your trade, filtered by budget, location distance, and client urgency.",
        "search",
      ),
      item(
        "step-3-proposals",
        "3. Send custom proposals",
        "Pitch your services with tailored quotes and timelines. Chat directly with clients to understand requirements and win contracts.",
        "message",
      ),
      item(
        "step-4-escrow",
        "4. Guaranteed escrow funding",
        "Start work with total peace of mind. Client funds are deposited into secure escrow before you start, guaranteeing payment upon delivery.",
        "clipboard",
      ),
      item(
        "step-5-deliver",
        "5. Submit milestone deliverables",
        "Keep clients updated with stage progression, upload completed work deliverables, and request milestone review in one click.",
        "briefcase",
      ),
      item(
        "step-6-payouts",
        "6. Instant payouts & reputation",
        "Once milestones are approved, withdraw your earnings directly to your bank account anytime via Razorpay and collect 5-star reviews.",
        "wallet",
      ),
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
