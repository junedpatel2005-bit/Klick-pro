import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyDisputeRaised, notifyUsers } from "@/lib/marketplace-notifications";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import { emitRealtimeProjectUpdate } from "@/lib/realtime";

const attachmentIds = z.array(z.number().int().positive()).min(1).max(10);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-milestone"),
    projectId: z.number().int().positive(),
    title: z.string().trim().min(2).max(160),
    amount: z.number().int().min(0),
    description: z.string().trim().max(2000).nullish(),
    deadline: z.string().datetime().nullish(),
  }),
  z.object({
    action: z.literal("create-milestones"),
    projectId: z.number().int().positive(),
    milestones: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(160),
          amount: z.number().int().min(0),
          description: z.string().trim().max(2000).nullish(),
          deadline: z.string().datetime().nullish(),
        }),
      )
      .min(1)
      .max(50),
  }),
  z.object({
    action: z.literal("update-milestone"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive(),
    title: z.string().trim().min(1).max(160),
    amount: z.number().int().min(0),
    description: z.string().trim().max(2000).nullish(),
  }),
  z.object({
    action: z.literal("delete-milestone"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive(),
  }),
  z.object({ action: z.literal("start-work"), projectId: z.number().int().positive() }),
  z.object({
    action: z.literal("update-progress"),
    projectId: z.number().int().positive(),
    progress: z.number().int().min(0).max(100),
    stage: z.string().trim().max(160).nullish(),
    note: z.string().trim().max(2000).nullish(),
  }),
  z.object({
    action: z.literal("upload-work"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive().nullish(),
    title: z.string().trim().min(2).max(160),
    note: z.string().trim().max(2000).nullish(),
    attachmentIds,
  }),
  z.object({
    action: z.literal("submit-milestone"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive(),
    note: z.string().trim().min(2).max(2000),
    attachmentIds,
  }),
  z.object({
    action: z.literal("request-revision"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive(),
    note: z.string().trim().min(2).max(2000),
  }),
  z.object({
    action: z.literal("approve-milestone"),
    projectId: z.number().int().positive(),
    milestoneId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("submit-final-work"),
    projectId: z.number().int().positive(),
    note: z.string().trim().min(2).max(2000),
    attachmentIds,
  }),
  z.object({
    action: z.literal("request-client"),
    projectId: z.number().int().positive(),
    title: z.string().trim().min(2).max(160).optional(),
    note: z.string().trim().min(2).max(2000),
  }),
  z.object({ action: z.literal("complete-project"), projectId: z.number().int().positive() }),
  z.object({
    action: z.literal("confirm-project-completion"),
    projectId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("respond-to-review"),
    projectId: z.number().int().positive(),
    response: z.string().trim().min(2).max(2000),
  }),
  z.object({
    action: z.literal("submit-review"),
    projectId: z.number().int().positive(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).nullish(),
  }),
  z.object({
    action: z.literal("submit-dispute"),
    projectId: z.number().int().positive(),
    issueType: z.string().trim().min(2).max(80),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM").optional(),
    message: z.string().trim().min(10).max(4000),
  }),
]);

const clientActions = new Set([
  "create-milestone",
  "create-milestones",
  "update-milestone",
  "delete-milestone",
  "start-work",
  "request-revision",
  "approve-milestone",
  "complete-project",
]);
const sharedActions = new Set(["submit-review", "submit-dispute"]);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const session = await verifySession(token);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please provide valid project information." },
        { status: 400 },
      );
    const input = parsed.data;
    const isClientAction = clientActions.has(input.action);
    const isSharedAction = sharedActions.has(input.action);
    const isProfessionalAction = !isClientAction && !isSharedAction;
    if (
      (isClientAction && session.role !== "CLIENT") ||
      (isProfessionalAction && session.role !== "PROFESSIONAL")
    )
      return NextResponse.json(
        { error: `${isClientAction ? "Client" : "Professional"} access required.` },
        { status: 403 },
      );
    const project = await db.projectTracking.findFirst({
      where: {
        id: input.projectId,
        OR: [{ clientId: session.userId }, { professionalId: session.userId }],
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const event = async (
      type: string,
      title: string,
      description?: string,
      fields: {
        milestoneId?: number;
        progress?: number;
        stage?: string;
        attachmentJson?: string;
      } = {},
    ) => {
      const timelineEvent = await db.projectTimelineEvent.create({
        data: {
          trackingId: project.id,
          actorId: session.userId,
          actorRole: session.role,
          type,
          title,
          description,
          ...fields,
        },
      });
      const dedicatedNotificationTypes = new Set([
        "PROJECT_COMPLETION_REQUESTED",
        "PROJECT_COMPLETED",
        "PROFESSIONAL_REQUEST",
      ]);
      if (!dedicatedNotificationTypes.has(type)) {
        const activityDetails = [
          { label: "Activity", value: title },
          ...(description ? [{ label: "Activity details", value: description }] : []),
          ...(fields.milestoneId
            ? [
                {
                  label: "Milestone",
                  value: await db.projectMilestone
                    .findUnique({
                      where: { id: fields.milestoneId },
                      select: { title: true, amount: true, dueDate: true },
                    })
                    .then((milestone) =>
                      milestone
                        ? `${milestone.title} · ₹${milestone.amount.toLocaleString("en-IN")}${milestone.dueDate ? ` · due ${milestone.dueDate.toLocaleDateString("en-IN")}` : ""}`
                        : `Milestone #${fields.milestoneId}`,
                    ),
                },
              ]
            : []),
        ];
        const partnerRecipients =
          session.role === "ADMIN"
            ? [project.clientId, project.professionalId]
            : [project.clientId, project.professionalId].filter((id) => id !== session.userId);
        await notifyUsers(partnerRecipients, {
          type: `PROJECT_ACTIVITY_${type}`,
          title,
          description: description ?? title,
          href: `/project/${project.id}/tracking`,
          emailDetails: activityDetails,
        });
      }
      emitRealtimeProjectUpdate([project.clientId, project.professionalId], {
        projectId: project.id,
      });
      return timelineEvent;
    };
    const attachmentsFor = async (ids: number[]) => {
      const uniqueIds = [...new Set(ids)];
      const files = await db.storedFile.findMany({
        where: {
          id: { in: uniqueIds },
          ownerId: session.userId,
          purpose: `project-work:${project.id}`,
          isPublic: false,
        },
      });
      if (files.length !== uniqueIds.length) return null;
      return files.map((file) => ({
        id: file.id,
        name: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        url: `/api/v1/portal/project-files/${file.id}`,
      }));
    };

    if (input.action === "start-work") {
      if (session.role !== "CLIENT")
        return NextResponse.json(
          { error: "Only the client can start this project." },
          { status: 403 },
        );
      if (project.status !== "READY_TO_START")
        return NextResponse.json({ error: "This project has already started." }, { status: 409 });
      const started = await db.projectTracking.updateMany({
        where: { id: project.id, clientId: session.userId, status: "READY_TO_START" },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
      if (started.count !== 1)
        return NextResponse.json(
          { error: "This project changed before it could be started." },
          { status: 409 },
        );
      const firstMilestone = await db.projectMilestone.findFirst({
        where: { trackingId: project.id, status: "UPCOMING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true },
      });
      if (firstMilestone) {
        await db.projectMilestone.update({
          where: { id: firstMilestone.id },
          data: { status: "IN_PROGRESS" },
        });
        await db.projectTracking.update({
          where: { id: project.id },
          data: { currentStage: firstMilestone.title },
        });
      }
      await event("WORK_STARTED", "Work started", "The client started work on this project.");
    }
    if (input.action === "update-progress") {
      const stageText = input.stage?.trim() || project.currentStage || "In Progress";
      const noteText = input.note?.trim() || `Progress updated to ${input.progress}%`;
      await db.projectTracking.update({
        where: { id: project.id },
        data: { status: "IN_PROGRESS", progress: input.progress, currentStage: stageText },
      });
      await event("PROGRESS_UPDATED", `Progress updated — ${input.progress}%`, noteText, {
        progress: input.progress,
        stage: stageText,
      });
    }
    if (input.action === "create-milestone") {
      const projectRequest = await db.projectRequest.findUnique({
        where: { id: project.requestId },
        select: { bidAmount: true },
      });
      const existingMilestones = await db.projectMilestone.aggregate({
        where: { trackingId: project.id },
        _sum: { amount: true },
      });
      const existingTotal = existingMilestones._sum.amount ?? 0;
      const budgetCeiling = Math.max(projectRequest?.bidAmount ?? 0, existingTotal);
      if (budgetCeiling > 0 && existingTotal + input.amount > budgetCeiling)
        return NextResponse.json(
          {
            error: `Milestone total cannot exceed the project budget of ₹${budgetCeiling.toLocaleString("en-IN")}. Remaining amount: ₹${Math.max(0, budgetCeiling - existingTotal).toLocaleString("en-IN")}.`,
          },
          { status: 400 },
        );
      const jobDates = await db.clientJob.findUnique({
        where: { id: project.jobId },
        select: { title: true, jobDate: true, deadline: true },
      });
      if (
        input.deadline &&
        jobDates &&
        ((jobDates.jobDate && new Date(input.deadline) < jobDates.jobDate) ||
          (jobDates.deadline && new Date(input.deadline) > jobDates.deadline))
      )
        return NextResponse.json(
          { error: "Milestone date must be between the preferred job date and deadline." },
          { status: 400 },
        );
      // A new milestone should start IN_PROGRESS whenever nothing else is currently active —
      // not just when it's the very first milestone ever created. Otherwise a milestone added
      // after all prior ones are already approved gets stuck at UPCOMING with no way for the
      // professional to work on it (no future approval event will ever activate it).
      const activeCount = await db.projectMilestone.count({
        where: {
          trackingId: project.id,
          status: { in: ["IN_PROGRESS", "REVISION_REQUESTED", "AWAITING_CLIENT_REVIEW"] },
        },
      });
      const milestone = await db.projectMilestone.create({
        data: {
          trackingId: project.id,
          clientId: project.clientId,
          professionalId: project.professionalId,
          title: input.title,
          amount: input.amount,
          description: input.description ?? null,
          dueDate: input.deadline ? new Date(input.deadline) : null,
          status: activeCount === 0 ? "IN_PROGRESS" : "UPCOMING",
        },
      });
      const jobTitle = jobDates?.title?.trim() || `Project #${project.id}`;
      await event("MILESTONE_CREATED", `Milestone created · ${jobTitle}`, input.title, {
        milestoneId: milestone.id,
      });
    }
    if (input.action === "create-milestones") {
      const projectRequest = await db.projectRequest.findUnique({
        where: { id: project.requestId },
        select: { bidAmount: true },
      });
      const totalNewAmount = input.milestones.reduce((acc, m) => acc + m.amount, 0);
      const existingMilestones = await db.projectMilestone.aggregate({
        where: { trackingId: project.id },
        _sum: { amount: true },
      });
      const existingTotal = existingMilestones._sum.amount ?? 0;
      const budgetCeiling = Math.max(projectRequest?.bidAmount ?? 0, existingTotal);
      if (budgetCeiling > 0 && existingTotal + totalNewAmount > budgetCeiling)
        return NextResponse.json(
          {
            error: `Milestones total cannot exceed the project amount of ₹${budgetCeiling.toLocaleString("en-IN")}. Remaining amount: ₹${Math.max(0, budgetCeiling - existingTotal).toLocaleString("en-IN")}.`,
          },
          { status: 400 },
        );
      const jobDates = await db.clientJob.findUnique({
        where: { id: project.jobId },
        select: { title: true, jobDate: true, deadline: true },
      });
      for (const m of input.milestones) {
        if (
          m.deadline &&
          jobDates &&
          ((jobDates.jobDate && new Date(m.deadline) < jobDates.jobDate) ||
            (jobDates.deadline && new Date(m.deadline) > jobDates.deadline))
        )
          return NextResponse.json(
            { error: "Milestone date must be between the preferred job date and deadline." },
            { status: 400 },
          );
      }
      const activeCount = await db.projectMilestone.count({
        where: {
          trackingId: project.id,
          status: { in: ["IN_PROGRESS", "REVISION_REQUESTED", "AWAITING_CLIENT_REVIEW"] },
        },
      });
      let currentlyActive = activeCount > 0;
      const jobTitle = jobDates?.title?.trim() || `Project #${project.id}`;
      for (const m of input.milestones) {
        const status = !currentlyActive ? "IN_PROGRESS" : "UPCOMING";
        if (status === "IN_PROGRESS") currentlyActive = true;
        const created = await db.projectMilestone.create({
          data: {
            trackingId: project.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            title: m.title,
            amount: m.amount,
            description: m.description ?? null,
            dueDate: m.deadline ? new Date(m.deadline) : null,
            status,
          },
        });
        await event("MILESTONE_CREATED", `Milestone created · ${jobTitle}`, m.title, {
          milestoneId: created.id,
        });
      }
    }
    if (input.action === "update-milestone") {
      const milestone = await db.projectMilestone.findUnique({
        where: { id: input.milestoneId },
      });
      if (!milestone || milestone.trackingId !== project.id) {
        return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      }
      const milestoneWorkCount = await db.projectWorkUpload.count({
        where: { milestoneId: milestone.id },
      });
      if (
        milestone.status === "APPROVED" ||
        milestone.status === "COMPLETED" ||
        milestone.status === "AWAITING_CLIENT_REVIEW" ||
        milestone.submittedAt !== null ||
        milestoneWorkCount > 0 ||
        project.status === "COMPLETED"
      ) {
        return NextResponse.json(
          { error: "Milestones that are awaiting review, have submitted work, or are completed cannot be modified." },
          { status: 400 },
        );
      }
      const existingPayment = await db.payment.findFirst({
        where: { milestoneId: milestone.id },
        select: { status: true },
      });
      if (existingPayment?.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Paid or completed milestones cannot be modified." },
          { status: 400 },
        );
      }
      const projectRequest = await db.projectRequest.findUnique({
        where: { id: project.requestId },
        select: { bidAmount: true },
      });
      if (projectRequest?.bidAmount != null) {
        const allMilestones = await db.projectMilestone.findMany({
          where: { trackingId: project.id },
          select: { id: true, amount: true },
        });
        const otherTotal = allMilestones
          .filter((m) => m.id !== input.milestoneId)
          .reduce((sum, m) => sum + m.amount, 0);
        if (otherTotal + input.amount > projectRequest.bidAmount) {
          const maxAllowed = Math.max(0, projectRequest.bidAmount - otherTotal);
          return NextResponse.json(
            {
              error: `Milestone total cannot exceed the agreed project amount of ₹${projectRequest.bidAmount.toLocaleString("en-IN")}. Max allowed for this milestone is ₹${maxAllowed.toLocaleString("en-IN")}.`,
            },
            { status: 400 },
          );
        }
      }
      await db.projectMilestone.update({
        where: { id: input.milestoneId },
        data: {
          title: input.title,
          amount: input.amount,
          description: input.description ?? null,
        },
      });
      await event(
        "MILESTONE_UPDATED",
        `Milestone updated · ${input.title}`,
        input.description ?? undefined,
        {
          milestoneId: input.milestoneId,
        },
      );
    }
    if (input.action === "delete-milestone") {
      const milestone = await db.projectMilestone.findUnique({
        where: { id: input.milestoneId },
      });
      if (!milestone || milestone.trackingId !== project.id) {
        return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      }
      const milestoneWorkCount = await db.projectWorkUpload.count({
        where: { milestoneId: milestone.id },
      });
      if (
        milestone.status === "APPROVED" ||
        milestone.status === "COMPLETED" ||
        milestone.status === "AWAITING_CLIENT_REVIEW" ||
        milestone.submittedAt !== null ||
        milestoneWorkCount > 0 ||
        project.status === "COMPLETED"
      ) {
        return NextResponse.json(
          { error: "This milestone has submitted work, is active, completed, or approved and cannot be deleted." },
          { status: 400 },
        );
      }
      const existingPayment = await db.payment.findFirst({
        where: { milestoneId: milestone.id },
        select: { status: true },
      });
      if (existingPayment?.status === "COMPLETED") {
        return NextResponse.json(
          { error: "Paid or completed milestones cannot be deleted." },
          { status: 400 },
        );
      }
      await db.projectMilestone.delete({
        where: { id: input.milestoneId },
      });
      await event("MILESTONE_DELETED", `Milestone removed · ${milestone.title}`);
    }
    if (input.action === "upload-work") {
      if (!["IN_PROGRESS", "REVISION_REQUESTED"].includes(project.status))
        return NextResponse.json(
          { error: "Work can only be uploaded while the project is in progress." },
          { status: 409 },
        );
      const attachments = await attachmentsFor(input.attachmentIds);
      if (!attachments)
        return NextResponse.json(
          { error: "One or more uploaded files are unavailable." },
          { status: 400 },
        );
      const previousUploadsCount = await db.projectWorkUpload.count({
        where: {
          trackingId: project.id,
          ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
        },
      });
      const roundNumber = previousUploadsCount + 1;
      const upload = await db.projectWorkUpload.create({
        data: {
          trackingId: project.id,
          milestoneId: input.milestoneId ?? null,
          title: input.title,
          note: input.note ?? null,
          fileName: attachments[0]?.name ?? null,
          fileUrl: attachments[0]?.url ?? null,
          filesJson: JSON.stringify(attachments),
          roundNumber,
          status: "UPLOADED",
        },
      });
      await event(
        upload.roundNumber > 1 ? "REVISED_WORK_UPLOADED" : "WORK_UPLOADED",
        upload.roundNumber > 1 ? `Revised work uploaded (Round ${upload.roundNumber})` : "Work uploaded",
        input.note ?? input.title,
        {
          milestoneId: input.milestoneId ?? undefined,
          attachmentJson: JSON.stringify(attachments),
        },
      );
    }
    if (input.action === "submit-milestone") {
      const milestone = await db.projectMilestone.findFirst({
        where: {
          id: input.milestoneId,
          trackingId: project.id,
          status: { in: ["IN_PROGRESS", "REVISION_REQUESTED"] },
        },
      });
      if (!milestone)
        return NextResponse.json({ error: "This milestone cannot be submitted." }, { status: 409 });
      const attachments = await attachmentsFor(input.attachmentIds);
      if (!attachments)
        return NextResponse.json(
          { error: "One or more uploaded files are unavailable." },
          { status: 400 },
        );
      const isResubmission = milestone.status === "REVISION_REQUESTED";
      const previousSubmissionsCount = await db.projectWorkUpload.count({
        where: { trackingId: project.id, milestoneId: milestone.id },
      });
      const roundNumber = previousSubmissionsCount + 1;
      await db.projectWorkUpload.create({
        data: {
          trackingId: project.id,
          milestoneId: milestone.id,
          title: milestone.title,
          note: input.note,
          fileName: attachments[0]?.name ?? null,
          fileUrl: attachments[0]?.url ?? null,
          filesJson: JSON.stringify(attachments),
          roundNumber,
          status: "SUBMITTED",
        },
      });
      await db.projectMilestone.update({
        where: { id: milestone.id },
        data: { status: "AWAITING_CLIENT_REVIEW", submittedAt: new Date() },
      });
      await db.projectTracking.update({
        where: { id: project.id },
        data: { status: "AWAITING_CLIENT_REVIEW", currentStage: milestone.title },
      });
      await event(
        isResubmission ? "REVISED_WORK_SUBMITTED" : "MILESTONE_SUBMITTED",
        isResubmission ? `Revised work submitted (Round ${roundNumber})` : "Milestone submitted",
        input.note,
        {
          milestoneId: milestone.id,
          attachmentJson: JSON.stringify(attachments),
        },
      );
    }
    if (input.action === "request-revision") {
      const milestone = await db.projectMilestone.findFirst({
        where: { id: input.milestoneId, trackingId: project.id, status: "AWAITING_CLIENT_REVIEW" },
      });
      if (!milestone)
        return NextResponse.json(
          { error: "This milestone is not awaiting review." },
          { status: 409 },
        );
      await db.projectRevisionRequest.create({
        data: {
          trackingId: project.id,
          clientId: project.clientId,
          professionalId: project.professionalId,
          note: input.note,
        },
      });
      await db.projectMilestone.update({
        where: { id: milestone.id },
        data: { status: "REVISION_REQUESTED" },
      });
      await db.projectTracking.update({
        where: { id: project.id },
        data: { status: "REVISION_REQUESTED", currentStage: milestone.title },
      });
      await event("REVISION_REQUESTED", "Revision requested", input.note, {
        milestoneId: milestone.id,
      });
    }
    if (input.action === "approve-milestone") {
      const job = await db.clientJob.findUnique({
        where: { id: project.jobId },
        select: { paymentMethod: true },
      });
      if (job?.paymentMethod === "OFFLINE") {
        const milestone = await db.projectMilestone.findFirst({
          where: {
            id: input.milestoneId,
            trackingId: project.id,
            status: "AWAITING_CLIENT_REVIEW",
          },
        });
        if (!milestone)
          return NextResponse.json(
            { error: "This milestone is not awaiting review." },
            { status: 409 },
          );
        try {
          const payment = await db.$transaction(async (tx) => {
            const claim = await tx.projectMilestone.updateMany({
              where: {
                id: milestone.id,
                trackingId: project.id,
                status: "AWAITING_CLIENT_REVIEW",
              },
              data: { status: "PAYMENT_PROCESSING" },
            });
            if (claim.count !== 1) throw new Error("This milestone is already being processed.");
            const payment = await tx.payment.upsert({
              where: { milestoneId: milestone.id },
              create: {
                clientId: project.clientId,
                professionalId: project.professionalId,
                jobId: project.jobId,
                amount: milestone.amount,
                baseAmount: milestone.amount,
                professionalPayoutAmount: milestone.amount,
                currency: "INR",
                provider: "offline",
                projectTrackingId: project.id,
                milestoneId: milestone.id,
                status: "COMPLETED",
                capturedAt: new Date(),
                idempotencyKey: `offline-milestone-${milestone.id}`,
              },
              update: {
                amount: milestone.amount,
                baseAmount: milestone.amount,
                clientFeeAmount: 0,
                professionalPayoutAmount: milestone.amount,
                adminNetAmount: 0,
                commissionAmount: 0,
                provider: "offline",
                status: "COMPLETED",
                capturedAt: new Date(),
              },
            });
            await tx.projectMilestone.update({
              where: { id: milestone.id },
              data: { status: "APPROVED", approvedAt: new Date() },
            });
            await tx.projectTransaction.create({
              data: {
                trackingId: project.id,
                milestoneId: milestone.id,
                clientId: project.clientId,
                professionalId: project.professionalId,
                amount: milestone.amount,
                currency: "INR",
                type: "OFFLINE_MILESTONE_PAYMENT",
                status: "COMPLETED",
                description: `Offline milestone payment confirmed: ${milestone.title}`,
              },
            });
            const next = await tx.projectMilestone.findFirst({
              where: { trackingId: project.id, status: "UPCOMING" },
              orderBy: { createdAt: "asc" },
            });
            if (next) {
              await tx.projectMilestone.update({
                where: { id: next.id },
                data: { status: "IN_PROGRESS" },
              });
              await tx.projectTracking.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS", currentStage: next.title },
              });
            } else {
              await tx.projectTracking.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS", currentStage: null },
              });
            }
            return payment;
          });
          await event(
            "MILESTONE_PAID",
            "Milestone paid",
            `The client confirmed offline payment for ${milestone.title}.`,
            { milestoneId: milestone.id },
          );
          return NextResponse.json({
            ok: true,
            paymentMethod: "OFFLINE",
            charged: payment.amount,
            professionalReceives: payment.professionalPayoutAmount,
            adminReceives: 0,
            platformEarnings: 0,
            status: "COMPLETED",
            message: "Offline payment recorded. The professional was marked as paid.",
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes("already being processed"))
            return NextResponse.json({ error: error.message }, { status: 409 });
          console.error("Offline milestone approval failed", error);
          return NextResponse.json(
            { error: "Offline milestone payment could not be recorded." },
            { status: 500 },
          );
        }
      }
      return NextResponse.json(
        { error: "Milestones must be paid from the client wallet.", paymentRequired: true },
        { status: 402 },
      );
    }
    if (input.action === "submit-final-work") {
      const milestones = await db.projectMilestone.findMany({ where: { trackingId: project.id } });
      if (milestones.length === 0 || !milestones.every((item) => item.status === "APPROVED"))
        return NextResponse.json(
          { error: "All milestones must be approved before final work can be submitted." },
          { status: 409 },
        );
      const attachments = await attachmentsFor(input.attachmentIds);
      if (!attachments)
        return NextResponse.json(
          { error: "One or more uploaded files are unavailable." },
          { status: 400 },
        );
      await db.projectWorkUpload.create({
        data: {
          trackingId: project.id,
          title: "Final work",
          note: input.note,
          fileName: attachments[0]?.name ?? null,
          fileUrl: attachments[0]?.url ?? null,
          filesJson: JSON.stringify(attachments),
          status: "FINAL_SUBMITTED",
        },
      });
      await db.projectTracking.update({
        where: { id: project.id },
        data: { status: "FINAL_WORK_SUBMITTED" },
      });
      await event("FINAL_WORK_SUBMITTED", "Final work submitted", input.note, {
        attachmentJson: JSON.stringify(attachments),
      });
    }
    if (input.action === "request-client") {
      await event("PROFESSIONAL_REQUEST", input.title ?? "Request sent to client", input.note);
      await notifyUsers([project.clientId], {
        type: "PROJECT_REQUEST",
        title: input.title ?? "Request from your professional",
        description: input.note,
        href: `/project/${project.id}/tracking`,
      });
    }
    if (input.action === "complete-project") {
      if (project.status === "COMPLETED")
        return NextResponse.json(
          { error: "This project is already completed." },
          { status: 409 },
        );
      const pendingMilestonesCount = await db.projectMilestone.count({
        where: {
          trackingId: project.id,
          status: { not: "APPROVED" },
        },
      });
      if (pendingMilestonesCount > 0) {
        return NextResponse.json(
          {
            error: `Cannot close project yet: there are still ${pendingMilestonesCount} unapproved milestone(s). Please approve all deliverables first.`,
          },
          { status: 409 },
        );
      }
      const completed = await db.projectTracking.updateMany({
        where: {
          id: project.id,
          clientId: session.userId,
        },
        data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
      });
      if (completed.count !== 1)
        return NextResponse.json(
          { error: "This project could not be closed. Please verify and try again." },
          { status: 409 },
        );
      await db.clientJob.updateMany({
        where: { id: project.jobId, userId: project.clientId },
        data: { status: "CLOSED" },
      });
      await event(
        "PROJECT_COMPLETED",
        "Project completed and closed",
        "All milestones were approved and the client successfully closed the project.",
      );
      await notifyUsers([project.professionalId], {
        type: "PROJECT_COMPLETED",
        title: "Project closed and completed",
        description: "The client approved all deliverables and closed the project.",
        href: `/project/${project.id}/tracking`,
      });
    }
    if (input.action === "confirm-project-completion") {
      if (project.status !== "AWAITING_PROFESSIONAL_CONFIRMATION")
        return NextResponse.json(
          { error: "This project is not waiting for your completion confirmation." },
          { status: 409 },
        );
      const confirmed = await db.projectTracking.updateMany({
        where: {
          id: project.id,
          professionalId: session.userId,
          status: "AWAITING_PROFESSIONAL_CONFIRMATION",
        },
        data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
      });
      if (confirmed.count !== 1)
        return NextResponse.json(
          { error: "This project changed before completion could be confirmed." },
          { status: 409 },
        );
      await db.clientJob.updateMany({
        where: { id: project.jobId, userId: project.clientId },
        data: { status: "CLOSED" },
      });
      await event(
        "PROJECT_COMPLETED",
        "Project completed",
        "The professional confirmed project completion after the client requested confirmation.",
        { progress: 100 },
      );
      await notifyUsers([project.clientId], {
        type: "PROJECT_COMPLETED",
        title: "Project completed",
        description: "The professional confirmed that your project is complete.",
        href: `/project/${project.id}/tracking`,
      });
    }
    if (input.action === "submit-review") {
      if (!["CLIENT", "PROFESSIONAL"].includes(session.role))
        return NextResponse.json(
          { error: "Only project clients and professionals can submit reviews." },
          { status: 403 },
        );
      const isClientReview = session.role === "CLIENT";
      const isProjectParticipant = isClientReview
        ? project.clientId === session.userId
        : project.professionalId === session.userId;
      if (!isProjectParticipant)
        return NextResponse.json(
          { error: "You can only review projects you participated in." },
          { status: 403 },
        );
      if (!["COMPLETED", "CLOSED"].includes(project.status))
        return NextResponse.json(
          { error: "Reviews can be submitted after the project is complete." },
          { status: 409 },
        );

      const reviewedAt = new Date();
      const review = await db.$transaction(async (tx) => {
        const savedReview = await tx.projectReview.upsert({
          where: { trackingId: project.id },
          update: isClientReview
            ? {
                rating: input.rating,
                comment: input.comment ?? null,
                clientReviewedAt: reviewedAt,
              }
            : {
                professionalRating: input.rating,
                professionalComment: input.comment ?? null,
                professionalReviewedAt: reviewedAt,
              },
          create: {
            trackingId: project.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            ...(isClientReview
              ? {
                  rating: input.rating,
                  comment: input.comment ?? null,
                  clientReviewedAt: reviewedAt,
                }
              : {
                  professionalRating: input.rating,
                  professionalComment: input.comment ?? null,
                  professionalReviewedAt: reviewedAt,
                }),
          },
        });

        const recipientId = isClientReview ? project.professionalId : project.clientId;
        let averageRating = 0;
        let reviewCount = 0;
        if (isClientReview) {
          const reviewStats = await tx.projectReview.aggregate({
            where: { professionalId: recipientId, rating: { not: null } },
            _avg: { rating: true },
            _count: { rating: true },
          });
          averageRating = reviewStats._avg.rating ?? 0;
          reviewCount = reviewStats._count.rating;
        } else {
          const reviewStats = await tx.projectReview.aggregate({
            where: { clientId: recipientId, professionalRating: { not: null } },
            _avg: { professionalRating: true },
            _count: { professionalRating: true },
          });
          averageRating = reviewStats._avg.professionalRating ?? 0;
          reviewCount = reviewStats._count.professionalRating;
        }

        await tx.user.update({
          where: { id: recipientId },
          data: {
            averageRating: Number(averageRating.toFixed(1)),
            reviewCount,
          },
        });
        return savedReview;
      });
      await event(
        "PROJECT_REVIEW_SUBMITTED",
        `${isClientReview ? "Professional" : "Client"} review submitted`,
        input.comment ??
          `Rated the ${isClientReview ? "professional" : "client"} ${input.rating}/5.`,
      );
      return NextResponse.json({ ok: true, reviewId: review.id });
    }
    if (input.action === "respond-to-review") {
      const review = await db.projectReview.findUnique({ where: { trackingId: project.id } });
      if (!review || review.rating === null)
        return NextResponse.json({ error: "No client review is available yet." }, { status: 409 });
      await db.projectReview.update({
        where: { trackingId: project.id },
        data: { professionalResponse: input.response, professionalResponseAt: new Date() },
      });
      await event(
        "REVIEW_RESPONSE_SUBMITTED",
        "Response to client review submitted",
        input.response,
      );
      return NextResponse.json({ ok: true });
    }
    if (input.action === "submit-dispute") {
      if (
        ![
          "READY_TO_START",
          "IN_PROGRESS",
          "AWAITING_CLIENT_REVIEW",
          "REVISION_REQUESTED",
          "FINAL_WORK_SUBMITTED",
          "COMPLETED",
          "CLOSED",
        ].includes(project.status)
      )
        return NextResponse.json(
          { error: "A dispute can only be raised while the project is active or closed." },
          { status: 409 },
        );
      const existingOpenDispute = await db.projectDispute.findFirst({
        where: { trackingId: project.id, status: "OPEN" },
      });
      if (existingOpenDispute)
        return NextResponse.json(
          { error: "This project already has an open dispute." },
          { status: 409 },
        );
      const dispute = await db.projectDispute.create({
        data: {
          trackingId: project.id,
          reporterId: session.userId,
          reporterRole: session.role,
          clientId: project.clientId,
          professionalId: project.professionalId,
          issueType: input.issueType,
          priority: input.priority ?? "MEDIUM",
          message: input.message,
          status: "OPEN",
        },
      });
      await event(
        "DISPUTE_RAISED",
        "Dispute raised",
        `Issue type: ${input.issueType}. ${input.message}`,
      );
      const [job, reporter] = await Promise.all([
        db.clientJob.findUnique({ where: { id: project.jobId }, select: { title: true } }),
        db.user.findUnique({
          where: { id: session.userId },
          select: { firstName: true, lastName: true },
        }),
      ]);
      enqueueBackgroundJob(
        "dispute.raised.notifications",
        () =>
          notifyDisputeRaised({
            disputeId: dispute.id,
            trackingId: project.id,
            jobTitle: job?.title ?? null,
            issueType: input.issueType,
            reporterRole: session.role as "CLIENT" | "PROFESSIONAL",
            reporterName: reporter
              ? `${reporter.firstName} ${reporter.lastName}`.trim()
              : session.role === "CLIENT"
                ? "The client"
                : "The professional",
            clientId: project.clientId,
            professionalId: project.professionalId,
          }),
        { disputeId: dispute.id, trackingId: project.id },
      );
      return NextResponse.json({ ok: true, disputeId: dispute.id });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("project.action.failed", error);
    return NextResponse.json({ error: "Unable to update the project." }, { status: 500 });
  }
}
