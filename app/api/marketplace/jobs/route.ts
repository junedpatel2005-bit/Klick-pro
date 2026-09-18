import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const jobs = await db.clientJob.findMany({
    where: {
      status: "OPEN",
      AND: [
        { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      locationLabel: true,
      locationState: true,
      locationDistrict: true,
      budgetMin: true,
      budgetMax: true,
      hourlyRate: true,
      timingType: true,
      createdAt: true,
      user: { select: { firstName: true, isVerified: true } },
    },
  });

  return NextResponse.json(
    jobs.map((job) => ({
      ...job,
      clientName: job.user.firstName ? `${job.user.firstName}` : "Client",
      clientVerified: job.user.isVerified,
      user: undefined,
      createdAt: job.createdAt.toISOString(),
    })),
  );
}
