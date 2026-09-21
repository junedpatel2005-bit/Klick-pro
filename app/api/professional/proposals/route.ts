import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyUsers } from "@/lib/marketplace-notifications";
import { attachLastActorRole } from "@/lib/project-request-actions";
import { emitRealtimeProposalNew } from "@/lib/realtime";

const proposalSchema = z.object({
  jobId: z.number().int().positive(),
  bidAmount: z.number().int().positive().max(10_000_000),
  hourlyRate: z.number().int().positive().max(1_000_000).optional(),
  totalJobHours: z.number().int().positive().max(10_000).optional(),
  duration: z.string().trim().min(2).max(100),
  coverLetter: z.string().trim().min(10).max(5000),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token)
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL")
      return NextResponse.json({ error: "Professional access required." }, { status: 403 });
    const jobId = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(request.nextUrl.searchParams.get("jobId"));
    if (!jobId.success)
      return NextResponse.json({ error: "A valid job is required." }, { status: 400 });
    const proposal = await db.projectRequest.findFirst({
      where: { jobId: jobId.data, professionalId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    const [proposalWithActor] = proposal ? await attachLastActorRole([proposal]) : [null];
    const negotiation = proposal
      ? await db.projectNegotiation.findFirst({
          where: { requestId: proposal.id },
          orderBy: { createdAt: "desc" },
          select: {
            senderRole: true,
            previousBidAmount: true,
            previousHourlyRate: true,
            previousTotalJobHours: true,
            previousDuration: true,
            previousMessage: true,
          },
        })
      : null;
    const project = await db.projectTracking.findFirst({
      where: { jobId: jobId.data, professionalId: session.userId },
      select: { id: true },
    });
    return NextResponse.json({
      proposal: proposalWithActor ?? null,
      negotiation,
      projectId: project?.id ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load your proposal." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token)
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL")
      return NextResponse.json({ error: "Professional access required." }, { status: 403 });
    const parsed = proposalSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please provide a price, delivery estimate, and message." },
        { status: 400 },
      );
    const job = await db.clientJob.findUnique({ where: { id: parsed.data.jobId } });
    if (
      !job ||
      job.status !== "OPEN" ||
      (job.jobDate != null && job.jobDate > new Date()) ||
      (job.deadline != null && job.deadline < new Date())
    )
      return NextResponse.json(
        { error: "This job is no longer accepting proposals." },
        { status: 409 },
      );
    if (job.userId === session.userId)
      return NextResponse.json(
        { error: "You cannot send a proposal to your own job." },
        { status: 403 },
      );
    const hourlyProjectTotal =
      job.timingType === "HOURLY" && parsed.data.hourlyRate && parsed.data.totalJobHours
        ? parsed.data.hourlyRate * parsed.data.totalJobHours
        : null;
    if (job.timingType === "HOURLY" && hourlyProjectTotal === null)
      return NextResponse.json(
        { error: "Enter both an hourly rate and total job hours." },
        { status: 400 },
      );
    if (hourlyProjectTotal !== null && hourlyProjectTotal > 10_000_000)
      return NextResponse.json({ error: "Project total is too high." }, { status: 400 });
    const bidAmount = hourlyProjectTotal ?? parsed.data.bidAmount;
    const existing = await db.projectRequest.findFirst({
      where: {
        jobId: job.id,
        professionalId: session.userId,
        origin: "PROFESSIONAL_PROPOSAL",
        status: "PENDING",
      },
      select: { id: true },
    });

    if (existing) {
      const updated = await db.projectRequest.update({
        where: { id: existing.id },
        data: {
          bidAmount,
          hourlyRate: job.timingType === "HOURLY" ? parsed.data.hourlyRate : null,
          totalJobHours: job.timingType === "HOURLY" ? parsed.data.totalJobHours : null,
          duration: parsed.data.duration,
          coverLetter: parsed.data.coverLetter,
        },
      });
      await notifyUsers([job.userId], {
        type: "PROPOSAL_UPDATED",
        title: `${job.title ?? "Project"} · Proposal Updated`,
        description: `A professional updated their proposal for ${job.title ?? "your job"}.`,
        href: `/job/${job.id}`,
        emailDetails: [
          { label: "Project", value: job.title ?? `Project #${job.id}` },
          { label: "Proposed amount", value: `₹${bidAmount.toLocaleString("en-IN")}` },
          { label: "Delivery time", value: parsed.data.duration },
          { label: "Proposal message", value: parsed.data.coverLetter },
        ],
      });
      emitRealtimeProposalNew([job.userId], { jobId: job.id });
      return NextResponse.json({ proposal: updated });
    }

    const proposal = await db.projectRequest.create({
      data: {
        jobId: job.id,
        clientId: job.userId,
        professionalId: session.userId,
        bidAmount,
        hourlyRate: job.timingType === "HOURLY" ? parsed.data.hourlyRate : null,
        totalJobHours: job.timingType === "HOURLY" ? parsed.data.totalJobHours : null,
        duration: parsed.data.duration,
        coverLetter: parsed.data.coverLetter,
        status: "PENDING",
        origin: "PROFESSIONAL_PROPOSAL",
      },
    });
    const professional = await db.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    });
    await notifyUsers([job.userId], {
      type: "NEW_PROPOSAL",
      title: `${job.title ?? "Project"} · New Proposal`,
      description: `${professional ? `${professional.firstName} ${professional.lastName}` : "A professional"} sent a proposal for ${job.title ?? "your job"}.`,
      href: `/job/${job.id}`,
      emailDetails: [
        {
          label: "Professional",
          value: professional
            ? `${professional.firstName} ${professional.lastName}`.trim()
            : "A professional",
        },
        { label: "Project", value: job.title ?? `Project #${job.id}` },
        { label: "Proposed amount", value: `₹${bidAmount.toLocaleString("en-IN")}` },
        { label: "Delivery time", value: parsed.data.duration },
        { label: "Proposal message", value: parsed.data.coverLetter },
      ],
    });
    emitRealtimeProposalNew([job.userId], { jobId: job.id });
    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error("professional.proposal.failed", error);
    return NextResponse.json({ error: "Unable to send your proposal." }, { status: 500 });
  }
}
