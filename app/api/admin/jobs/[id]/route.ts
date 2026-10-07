import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId < 1)
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  const parsed = z
    .object({ status: z.enum(["OPEN", "CLOSED"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid job update." }, { status: 400 });
  try {
    const job = await db.clientJob.update({
      where: { id: jobId },
      data: { status: parsed.data.status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Unable to update job." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId < 1)
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  try {
    await db.clientJob.delete({ where: { id: jobId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete job. It may have related records." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  try {
    const session = await verifySession(token);
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId) || jobId < 1) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  const job = await db.clientJob.findUnique({
    where: { id: jobId },
    include: {
      attachments: { orderBy: { createdAt: "desc" } },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
          address: true,
          isVerified: true,
          createdAt: true,
        },
      },
      _count: { select: { favoriteJobs: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const [proposals, project] = await Promise.all([
    db.projectRequest.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        professionalId: true,
        bidAmount: true,
        duration: true,
        status: true,
        origin: true,
        createdAt: true,
      },
    }),
    db.projectTracking.findFirst({
      where: { jobId },
      select: {
        id: true,
        status: true,
        progress: true,
        currentStage: true,
        startedAt: true,
        completedAt: true,
        acceptedAt: true,
        requestId: true,
        clientId: true,
        professionalId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const professionalIds = [...new Set(proposals.map((proposal) => proposal.professionalId))];
  if (project?.professionalId && !professionalIds.includes(project.professionalId)) {
    professionalIds.push(project.professionalId);
  }
  const professionals = await db.user.findMany({
    where: { id: { in: professionalIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const professionalsById = new Map(
    professionals.map((professional) => [professional.id, professional]),
  );
  const [milestones, paymentsSum, timelineEvents, workUploads, transactions, paymentsList] = project
    ? await Promise.all([
        db.projectMilestone.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            amount: true,
            dueDate: true,
            status: true,
            approvedAt: true,
            submittedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        db.projectTransaction.aggregate({
          where: { trackingId: project.id, status: "COMPLETED" },
          _sum: { amount: true },
        }),
        db.projectTimelineEvent.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "desc" },
        }),
        db.projectWorkUpload.findMany({
          where: { trackingId: project.id },
          include: {
            milestone: {
              select: { id: true, title: true, amount: true },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.projectTransaction.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "desc" },
        }),
        db.payment.findMany({
          where: {
            OR: [{ jobId }, { projectTrackingId: project.id }],
            status: { in: ["COMPLETED", "CAPTURED", "PAID"] },
          },
          include: {
            milestone: { select: { id: true, title: true, amount: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : await Promise.all([
        Promise.resolve([]),
        Promise.resolve({ _sum: { amount: null } }),
        Promise.resolve([]),
        Promise.resolve([]),
        Promise.resolve([]),
        db.payment.findMany({
          where: {
            jobId,
            status: { in: ["COMPLETED", "CAPTURED", "PAID"] },
          },
          include: {
            milestone: { select: { id: true, title: true, amount: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
  const milestoneTotal = milestones.reduce((total, milestone) => total + milestone.amount, 0);
  const paidAmount = paymentsSum._sum.amount ?? 0;

  type TimelineItem = {
    id: string;
    type:
      | "PAYMENT"
      | "MILESTONE_COMPLETED"
      | "PROOF_SUBMITTED"
      | "PROJECT_COMPLETED"
      | "WORK_STARTED"
      | "MILESTONE_CREATED"
      | "REVISION_REQUESTED"
      | "PROGRESS_UPDATE"
      | "JOB_POSTED"
      | "PROFESSIONAL_HIRED"
      | "OTHER";
    title: string;
    description?: string | null;
    amount?: number | null;
    actorRole?: "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";
    actorName?: string | null;
    createdAt: string;
    status?: string | null;
    stage?: string | null;
    progress?: number | null;
    files?: Array<{ name: string; url?: string | null }>;
  };

  const timelineItems: TimelineItem[] = [];
  const clientName = `${job.user.firstName} ${job.user.lastName}`.trim();

  const hiredProposal = proposals.find(
    (p) => p.status === "ACCEPTED" || (project && p.id === project.requestId),
  );
  const hiredProId = project?.professionalId ?? hiredProposal?.professionalId;
  const hiredPro = hiredProId ? professionalsById.get(hiredProId) : null;
  const proName = hiredPro ? `${hiredPro.firstName} ${hiredPro.lastName}`.trim() : "Professional";

  // 1. Initial Job Posted Event
  timelineItems.push({
    id: `job-posted-${job.id}`,
    type: "JOB_POSTED",
    title: "Job posted by client",
    description: job.description
      ? job.description.length > 200
        ? `${job.description.slice(0, 200)}…`
        : job.description
      : "Client posted this job requirement.",
    amount: job.budgetMax ?? job.budgetMin ?? job.hourlyRate ?? null,
    actorRole: "CLIENT",
    actorName: clientName,
    createdAt: job.createdAt.toISOString(),
    status: job.status,
  });

  // 2. Professional Hired / Proposal Accepted
  if (hiredProposal || project) {
    const hiredAt = project?.acceptedAt ?? hiredProposal?.createdAt ?? project?.createdAt;
    if (hiredAt) {
      timelineItems.push({
        id: `hired-${project?.id ?? hiredProposal?.id ?? job.id}`,
        type: "PROFESSIONAL_HIRED",
        title: `Professional hired: ${proName}`,
        description: hiredProposal
          ? `Proposal accepted at ₹${hiredProposal.bidAmount.toLocaleString()} · Duration: ${hiredProposal.duration}`
          : `Project assigned to ${proName}`,
        amount: hiredProposal?.bidAmount ?? null,
        actorRole: "CLIENT",
        actorName: clientName,
        createdAt: hiredAt.toISOString(),
        status: "ACCEPTED",
      });
    }
  }

  // 3. Work Started
  if (project?.startedAt) {
    timelineItems.push({
      id: `work-started-${project.id}`,
      type: "WORK_STARTED",
      title: "Project work started",
      description: "Professional started work on the project.",
      actorRole: "PROFESSIONAL",
      actorName: proName,
      createdAt: project.startedAt.toISOString(),
      status: "IN_PROGRESS",
    });
  }

  // 4. ProjectTimelineEvents (STRICTLY NO MESSAGES / CHATS)
  const milestoneMap = new Map(milestones.map((m) => [m.id, m]));

  for (const event of timelineEvents) {
    const rawType = (event.type || "").toUpperCase();
    const rawTitle = (event.title || "").toUpperCase();

    // STRICT FILTER: Exclude any messages or chat events
    if (
      rawType.includes("MESSAGE") ||
      rawType.includes("CHAT") ||
      rawType.includes("COMMUNICATION") ||
      rawTitle.includes("MESSAGE") ||
      rawTitle.includes("CHAT")
    ) {
      continue;
    }

    let files: Array<{ name: string; url?: string | null }> = [];
    if (event.attachmentJson) {
      try {
        const parsed = JSON.parse(event.attachmentJson);
        if (Array.isArray(parsed)) {
          files = parsed.map((item) => ({
            name: item.name || item.fileName || "Attachment",
            url: item.url || item.fileUrl || null,
          }));
        }
      } catch {
        // ignore malformed JSON
      }
    }

    let itemType: TimelineItem["type"] = "OTHER";
    if (rawType === "MILESTONE_PAID" || rawType.includes("PAYMENT") || rawType.includes("PAID")) {
      itemType = "PAYMENT";
    } else if (rawType === "MILESTONE_APPROVED" || rawType === "MILESTONE_COMPLETED") {
      itemType = "MILESTONE_COMPLETED";
    } else if (
      rawType === "WORK_UPLOADED" ||
      rawType === "MILESTONE_SUBMITTED" ||
      rawType === "FINAL_WORK_SUBMITTED" ||
      rawType.includes("PROOF")
    ) {
      itemType = "PROOF_SUBMITTED";
    } else if (rawType === "PROJECT_COMPLETED") {
      itemType = "PROJECT_COMPLETED";
    } else if (rawType === "WORK_STARTED") {
      itemType = "WORK_STARTED";
    } else if (rawType === "MILESTONE_CREATED") {
      itemType = "MILESTONE_CREATED";
    } else if (rawType === "REVISION_REQUESTED") {
      itemType = "REVISION_REQUESTED";
    } else if (rawType === "PROGRESS_UPDATED") {
      itemType = "PROGRESS_UPDATE";
    }

    const linkedMilestone = event.milestoneId ? milestoneMap.get(event.milestoneId) : null;
    const actorRole = (event.actorRole as TimelineItem["actorRole"]) ?? "SYSTEM";
    const actorName =
      actorRole === "CLIENT"
        ? clientName
        : actorRole === "PROFESSIONAL"
          ? proName
          : actorRole === "ADMIN"
            ? "Admin"
            : "System";

    timelineItems.push({
      id: `te-${event.id}`,
      type: itemType,
      title: event.title,
      description: event.description,
      amount: linkedMilestone?.amount ?? null,
      actorRole,
      actorName,
      createdAt: event.createdAt.toISOString(),
      stage: event.stage,
      progress: event.progress,
      files: files.length > 0 ? files : undefined,
    });
  }

  // 5. Work Uploads (Proofs)
  for (const upload of workUploads) {
    let files: Array<{ name: string; url?: string | null }> = [];
    if (upload.filesJson) {
      try {
        const parsed = JSON.parse(upload.filesJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          files = parsed.map((item) => ({
            name: item.name || item.fileName || "File",
            url: item.url || item.fileUrl || null,
          }));
        }
      } catch {
        // ignore malformed JSON
      }
    }
    if (files.length === 0 && upload.fileName) {
      files = [{ name: upload.fileName, url: upload.fileUrl ?? null }];
    }

    const alreadyPresent = timelineItems.find(
      (item) =>
        item.type === "PROOF_SUBMITTED" &&
        Math.abs(new Date(item.createdAt).getTime() - upload.createdAt.getTime()) < 30000,
    );

    if (!alreadyPresent) {
      const milestoneTitle = upload.milestone?.title;
      timelineItems.push({
        id: `upload-${upload.id}`,
        type: "PROOF_SUBMITTED",
        title: upload.title
          ? `Proof submitted: ${upload.title}`
          : `Deliverables submitted (Round ${upload.roundNumber})`,
        description:
          upload.note || (milestoneTitle ? `Submitted for milestone: ${milestoneTitle}` : null),
        amount: upload.milestone?.amount ?? null,
        actorRole: "PROFESSIONAL",
        actorName: proName,
        createdAt: upload.createdAt.toISOString(),
        status: upload.status,
        files: files.length > 0 ? files : undefined,
      });
    } else if ((!alreadyPresent.files || alreadyPresent.files.length === 0) && files.length > 0) {
      alreadyPresent.files = files;
    }
  }

  // 6. Milestones Completed & Approved
  for (const milestone of milestones) {
    if (
      (milestone.status === "APPROVED" || milestone.status === "COMPLETED") &&
      milestone.approvedAt
    ) {
      const alreadyPresent = timelineItems.some(
        (item) =>
          item.type === "MILESTONE_COMPLETED" &&
          Math.abs(new Date(item.createdAt).getTime() - milestone.approvedAt!.getTime()) < 30000,
      );
      if (!alreadyPresent) {
        timelineItems.push({
          id: `milestone-done-${milestone.id}`,
          type: "MILESTONE_COMPLETED",
          title: `Milestone completed: ${milestone.title}`,
          description: `Client approved milestone deliverables for ₹${milestone.amount.toLocaleString()}.`,
          amount: milestone.amount,
          actorRole: "CLIENT",
          actorName: clientName,
          createdAt: milestone.approvedAt.toISOString(),
          status: milestone.status,
        });
      }
    }
  }

  // 7. Payments Released
  const allPayments = [
    ...transactions.map((tx) => ({
      id: `tx-${tx.id}`,
      amount: tx.amount,
      createdAt: tx.createdAt,
      status: tx.status,
      description: tx.description,
    })),
    ...paymentsList.map((pay) => ({
      id: `pay-${pay.id}`,
      amount: pay.amount,
      createdAt: pay.capturedAt ?? pay.createdAt,
      status: pay.status,
      description: pay.milestone?.title
        ? `Milestone "${pay.milestone.title}" funded and released to professional.`
        : "Payment released to professional.",
    })),
  ];

  for (const p of allPayments) {
    if (p.status === "COMPLETED" || p.status === "CAPTURED" || p.status === "PAID") {
      const alreadyPresent = timelineItems.some(
        (item) =>
          item.type === "PAYMENT" &&
          Math.abs(new Date(item.createdAt).getTime() - p.createdAt.getTime()) < 30000,
      );
      if (!alreadyPresent) {
        timelineItems.push({
          id: p.id,
          type: "PAYMENT",
          title: `Payment released · ₹${p.amount.toLocaleString()}`,
          description: p.description || "Payment released to professional.",
          amount: p.amount,
          actorRole: "CLIENT",
          actorName: clientName,
          createdAt: p.createdAt.toISOString(),
          status: p.status,
        });
      }
    }
  }

  // 8. Project Completed
  if (project?.completedAt || project?.status === "COMPLETED") {
    const completedTime = project.completedAt ?? project.updatedAt;
    const alreadyPresent = timelineItems.some(
      (item) =>
        item.type === "PROJECT_COMPLETED" &&
        Math.abs(new Date(item.createdAt).getTime() - completedTime.getTime()) < 30000,
    );
    if (!alreadyPresent) {
      timelineItems.push({
        id: `project-done-${project.id}`,
        type: "PROJECT_COMPLETED",
        title: "Project completed",
        description: "All milestones and deliverables have been finalized and approved.",
        actorRole: "SYSTEM",
        createdAt: completedTime.toISOString(),
        status: "COMPLETED",
      });
    }
  }

  // Sort newest first
  timelineItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    job: {
      ...job,
      proposals: proposals.map((proposal) => ({
        ...proposal,
        professional: professionalsById.get(proposal.professionalId) ?? null,
      })),
      timeline: timelineItems,
      project: project
        ? {
            ...project,
            milestones,
            timeline: timelineItems,
            financial: {
              milestoneTotal,
              paidAmount,
              remainingAmount: Math.max(milestoneTotal - paidAmount, 0),
            },
          }
        : null,
    },
  });
}
