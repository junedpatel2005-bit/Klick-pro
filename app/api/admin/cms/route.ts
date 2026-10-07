import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { readCmsContent, writeCmsContent, type CmsIcon } from "@/lib/cms-file";
import { readHomeContent, writeHomeContent, type HomeContent } from "@/lib/home-cms-file";
import {
  marketingPageIds,
  readMarketingContent,
  writeMarketingContent,
  type MarketingPageContent,
  type MarketingPageId,
} from "@/lib/marketing-cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  try {
    const page = new URL(request.url).searchParams.get("page");
    if (page === "home") return NextResponse.json(await readHomeContent());
    if (marketingPageIds.includes(page as MarketingPageId))
      return NextResponse.json(await readMarketingContent(page as MarketingPageId));
    return NextResponse.json(await readCmsContent());
  } catch {
    return NextResponse.json({ error: "Unable to read CMS content." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (
      body &&
      typeof body === "object" &&
      marketingPageIds.includes((body as { page?: string }).page as MarketingPageId)
    ) {
      const page = (body as { page: MarketingPageId }).page;
      const parsedMarketing = z
        .object({
          hero: z.object({
            label: z.string().max(120),
            title: z.string().max(240),
            description: z.string().max(5000),
          }),
          items: z
            .array(
              z.object({
                id: z.string().min(1).max(120),
                title: z.string().max(240),
                description: z.string().max(5000),
                icon: z.string().max(40),
              }),
            )
            .min(1)
            .max(50),
        })
        .safeParse((body as { content?: unknown }).content);
      if (!parsedMarketing.success)
        return NextResponse.json({ error: "Invalid marketing page content." }, { status: 400 });
      return NextResponse.json(
        await writeMarketingContent(page, parsedMarketing.data as MarketingPageContent),
      );
    }
    if (body && typeof body === "object" && (body as { page?: string }).page === "home") {
      const value = (body as { content?: unknown }).content;
      const parsedHome = z
        .object({
          hero: z.object({
            eyebrow: z.string().max(160),
            title: z.string().max(240),
            description: z.string().max(5000),
            primaryCta: z.string().max(120),
            secondaryCta: z.string().max(120),
          }),
          features: z
            .array(
              z.object({
                id: z.string().min(1).max(120),
                title: z.string().max(240),
                description: z.string().max(5000),
                icon: z.string().max(40),
              }),
            )
            .min(1)
            .max(50),
        })
        .safeParse(value);
      if (!parsedHome.success)
        return NextResponse.json({ error: "Invalid Home content." }, { status: 400 });
      return NextResponse.json(await writeHomeContent(parsedHome.data as HomeContent));
    }
    const parsed = z
      .object({
        hero: z.object({
          label: z.string().max(120),
          title: z.string().max(240),
          description: z.string().max(500_000),
        }),
        cards: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              title: z.string().max(240),
              description: z.string().max(5_000),
              icon: z.enum(["shield", "handshake", "award", "briefcase", "users"]),
            }),
          )
          .min(1)
          .max(50),
        sectionOrder: z.array(z.enum(["hero", "features"])).length(2),
      })
      .superRefine((value, context) => {
        const ids = value.cards.map((card) => card.id);
        if (new Set(ids).size !== ids.length)
          context.addIssue({ code: z.ZodIssueCode.custom, message: "Card IDs must be unique." });
      })
      .safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ error: "Content must be valid text." }, { status: 400 });
    return NextResponse.json(
      await writeCmsContent(
        parsed.data as {
          hero: { label: string; title: string; description: string };
          cards: { id: string; title: string; description: string; icon: CmsIcon }[];
          sectionOrder: Array<"hero" | "features">;
        },
      ),
    );
  } catch {
    return NextResponse.json({ error: "Unable to save CMS content." }, { status: 500 });
  }
}
