import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyUsers } from "@/lib/marketplace-notifications";
import { emitRealtimeProposalNew, emitRealtimeProjectUpdate } from "@/lib/realtime";

const reopenSchema = z.object({
  workDescription: z.string().trim().min(3, "Please describe the work needed.").max(3000),
  amount: z.coerce.number().int().min(0, "Amount cannot be negative.").max(10_000_000),
  reason: z.enum(["ISSUE", "ADDITIONAL_WORK"]).default("ADDITIONAL_WORK"),
  assignPreviousPro: z.boolean().default(true),
  duration: z.string().trim().max(100).optional().default("1-3 days"),
});

async function getClient(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "CLIENT" ? session.userId : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const clientId = await getClient(request);
    if (!clientId) {
      return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
    }

    const rawId = (await params).id;
    const jobId = Number(rawId);
    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = reopenSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0] || "Invalid reopen details.";
      return NextResponse.json({ error: firstError, fields: fieldErrors }, { status: 400 });
    }

    const { workDescription, amount, reason, assignPreviousPro, duration } = parsed.data;

    const job = await db.clientJob.findFirst({
      where: { id: jobId, userId: clientId },
      include: {
        projectTrackings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            professional: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const reasonLabel =
      reason === "ISSUE" ? "Issue / Warranty Rework" : "Additional Work";
    const timestamp = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const appendNote = `\n\n--- [REOPENED: ${reasonLabel} (${timestamp})] ---\nWork Needed: ${workDescription}\nOffered Amount: ₹${amount.toLocaleString("en-IN")}`;
    const updatedDescription = (job.description ? job.description.trim() : "") + appendNote;

    // 1. Update job status to OPEN and update budget
    const updatedJob = await db.clientJob.update({
      where: { id: jobId },
      data: {
        status: "OPEN",
        budgetMin: amount,
        budgetMax: amount,
        description: updatedDescription,
      },
    });

    // 2. Replace complex milestones with a SINGLE work milestone representing the reopened scope
    await db.clientJobMilestone.deleteMany({ where: { jobId } });
    const milestoneTitle =
      reason === "ISSUE"
        ? `Warranty Fix: ${workDescription.slice(0, 50)}`
        : `Additional Work: ${workDescription.slice(0, 50)}`;

    await db.clientJobMilestone.create({
      data: {
        jobId,
        title: milestoneTitle,
        description: workDescription,
        percentage: 100,
        amount,
        sortOrder: 0,
      },
    });

    // 3. If assignPreviousPro is true and a previous professional exists, create a direct hire request
    let hireRequest = null;
    const previousTracking = job.projectTrackings[0];
    const previousPro = previousTracking?.professional;

    if (assignPreviousPro && previousPro) {
      hireRequest = await db.projectRequest.create({
        data: {
          jobId,
          clientId,
          professionalId: previousPro.id,
          bidAmount: amount,
          duration: duration || "1-3 days",
          coverLetter: `[${reasonLabel}] ${workDescription}`,
          status: "PENDING",
          origin: "CLIENT_HIRE",
        },
      });

      const jobTitle = job.title?.trim() || `Job #${job.id}`;
      await notifyUsers([previousPro.id], {
        type: "HIRE_OFFER_RECEIVED",
        title: `${jobTitle} · Reopened with work request`,
        description: `Client requested ${reasonLabel.toLowerCase()} (₹${amount.toLocaleString("en-IN")}): "${workDescription.slice(0, 100)}". Review and negotiate.`,
        href: `/job/${job.id}`,
      });

      emitRealtimeProposalNew([clientId, previousPro.id], { jobId });
      if (previousTracking) {
        emitRealtimeProjectUpdate([clientId, previousPro.id], {
          projectId: previousTracking.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      hireRequest,
      message: `Job reopened successfully with ₹${amount.toLocaleString("en-IN")} allocated for: "${workDescription}".`,
    });
  } catch (error) {
    console.error("Failed to reopen job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reopen job." },
      { status: 500 },
    );
  }
}

