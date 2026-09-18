import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ jobs: [] });

  const jobs = await db.clientJob.findMany({
    where: {
      status: "OPEN",
      AND: [
        { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ],
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, category: true, locationLabel: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ jobs });
}
