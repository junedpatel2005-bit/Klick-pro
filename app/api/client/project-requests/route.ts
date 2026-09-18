import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { MAX_HIRE_REQUEST_BUDGET } from "@/lib/constants/hiring";
import { notifyUsers } from "@/lib/marketplace-notifications";
import { emitRealtimeProposalNew } from "@/lib/realtime";

const bodySchema = z.object({
  jobId: z.coerce.number().int().positive(),
  professionalId: z.coerce.number().int().positive(),
  bidAmount: z.coerce.number().int().positive(),
  duration: z.string().trim().max(100),
  coverLetter: z.string().trim().max(5000).optional().or(z.literal("")),
});

async function getClientId(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "CLIENT" ? session.userId : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const clientId = await getClientId(request);
  if (!clientId)
    return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please review the request details.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { jobId, professionalId, bidAmount, duration, coverLetter } = parsed.data;

  const job = await db.clientJob.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== clientId) {
    return NextResponse.json(
      { error: "This job was not found or does not belong to you." },
      { status: 404 },
    );
  }
  if (job.status !== "OPEN") {
    return NextResponse.json(
      { error: "Only open jobs can be used to request a hire." },
      { status: 409 },
    );
  }

  if (job.timingType !== "HOURLY" && job.budgetMin !== null && job.budgetMax !== null) {
    if (bidAmount < job.budgetMin || bidAmount > job.budgetMax) {
      return NextResponse.json(
        {
          error: `Bid amount must be between ₹${job.budgetMin.toLocaleString()} and ₹${job.budgetMax.toLocaleString()} for this job.`,
        },
        { status: 400 },
      );
    }
  } else if (bidAmount > MAX_HIRE_REQUEST_BUDGET) {
    return NextResponse.json({ error: "Bid amount is too high." }, { status: 400 });
  }

  const professional = await db.user.findUnique({
    where: { id: professionalId, role: "PROFESSIONAL" },
  });
  if (!professional) {
    return NextResponse.json({ error: "Professional not found." }, { status: 404 });
  }

  const existing = await db.projectRequest.findFirst({
    where: { jobId, clientId, professionalId, status: "PENDING" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A pending request for this job and professional already exists." },
      { status: 409 },
    );
  }

  const requestRecord = await db.projectRequest.create({
    data: {
      jobId,
      clientId,
      professionalId,
      bidAmount,
      duration,
      coverLetter: coverLetter || "",
      status: "PENDING",
      origin: "CLIENT_HIRE",
    },
  });

  const clientUser = await db.user.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true },
  });
  const clientName = clientUser
    ? `${clientUser.firstName} ${clientUser.lastName}`.trim()
    : "A client";

  await notifyUsers([professionalId], {
    type: "NEW_HIRE_REQUEST",
    title: "New hire request",
    description: `${clientName} sent you a hire request for ${job.title ?? "a job"}.`,
    href: `/job/${jobId}?requestId=${requestRecord.id}`,
    emailDetails: [
      { label: "Job", value: job.title ?? `Job #${job.id}` },
      { label: "Offered amount", value: `₹${bidAmount.toLocaleString("en-IN")}` },
      { label: "Timeline", value: duration },
    ],
  });
  emitRealtimeProposalNew([professionalId], { jobId });

  return NextResponse.json({ request: requestRecord }, { status: 201 });
}
