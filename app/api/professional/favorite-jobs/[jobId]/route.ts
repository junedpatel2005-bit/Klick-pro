import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function professionalIdFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "PROFESSIONAL" ? session.userId : null;
  } catch {
    return null;
  }
}

function jobIdFrom(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const professionalId = await professionalIdFrom(request);
  const jobId = jobIdFrom((await params).jobId);
  if (!professionalId || !jobId)
    return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const job = await db.clientJob.findFirst({
    where: {
      id: jobId,
      status: "OPEN",
      AND: [
        { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
        { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
      ],
    },
  });
  if (!job) return NextResponse.json({ error: "This job is no longer open." }, { status: 404 });

  await db.favoriteJob.upsert({
    where: { userId_jobId: { userId: professionalId, jobId } },
    create: { userId: professionalId, jobId },
    update: {},
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const professionalId = await professionalIdFrom(request);
  const jobId = jobIdFrom((await params).jobId);
  if (!professionalId || !jobId)
    return NextResponse.json({ error: "Job not found." }, { status: 404 });

  await db.favoriteJob.deleteMany({ where: { userId: professionalId, jobId } });
  return NextResponse.json({ saved: false });
}
