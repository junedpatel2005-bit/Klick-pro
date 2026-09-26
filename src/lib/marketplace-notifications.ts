import "server-only";

import { db } from "@/lib/db";
import { logServerError } from "@/lib/server-logger";
import {
  emitRealtimeNotification,
  emitAdminNotification,
  emitAdminOverviewUpdate,
  emitAdminUsersUpdate,
  emitAdminOperationsUpdate,
  emitAdminVerificationsUpdate,
} from "@/lib/realtime";
import { sendNotificationEmail } from "@/lib/email";
import { enqueueBackgroundJob } from "@/lib/background-jobs";

type BroadcastNotification = {
  type: string;
  title: string;
  description: string;
  href: string;
  emailDetails?: Array<{ label: string; value: string }>;
  templateVariables?: Record<string, string | number | undefined | null>;
};

async function sendEmails(
  recipients: Array<{
    id: number;
    email: string;
    emailNotificationsEnabled: boolean;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
  }>,
  notification: BroadcastNotification,
) {
  const results = await Promise.allSettled(
    recipients
      .filter((recipient) => recipient.emailNotificationsEnabled && recipient.email.trim())
      .map((recipient) => {
        const recipientName =
          [recipient.firstName, recipient.lastName].filter(Boolean).join(" ").trim() ||
          recipient.firstName ||
          "";

        return sendNotificationEmail({
          to: recipient.email.trim(),
          ...notification,
          details: notification.emailDetails,
          audience: (recipient.role as "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM") || undefined,
          recipientName: recipientName || undefined,
          templateVariables: {
            ...notification.templateVariables,
            user_name: recipientName || "there",
            client_name:
              recipient.role === "CLIENT"
                ? recipientName || "Client"
                : (notification.templateVariables?.client_name ?? "Client"),
            professional_name:
              recipient.role === "PROFESSIONAL"
                ? recipientName || "Professional"
                : (notification.templateVariables?.professional_name ?? "Professional"),
            prof_name:
              recipient.role === "PROFESSIONAL"
                ? recipientName || "Professional"
                : (notification.templateVariables?.prof_name ?? "Professional"),
          },
        });
      }),
  );
  results.forEach((result) => {
    if (result.status === "rejected")
      logServerError("marketplace.notification.email.failed", result.reason, {
        type: notification.type,
      });
  });
}

async function projectEmailDetails(projectId: number): Promise<{
  details: Array<{ label: string; value: string }>;
  variables: Record<string, string | number>;
}> {
  const project = await db.projectTracking.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      progress: true,
      currentStage: true,
      jobId: true,
      requestId: true,
      startedAt: true,
      completedAt: true,
      client: { select: { firstName: true, lastName: true, email: true } },
      professional: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!project) return { details: [], variables: {} };
  const [job, request, latestMilestone] = await Promise.all([
    db.clientJob.findUnique({
      where: { id: project.jobId },
      select: {
        title: true,
        deadline: true,
        jobDate: true,
        category: true,
        budgetMin: true,
        budgetMax: true,
      },
    }),
    db.projectRequest.findUnique({
      where: { id: project.requestId },
      select: { bidAmount: true, duration: true },
    }),
    db.projectMilestone.findFirst({
      where: { trackingId: projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, amount: true, status: true },
    }),
  ]);
  const date = (value: Date | null | undefined) =>
    value?.toLocaleDateString("en-IN") ?? "Not specified";
  const clientName =
    [project.client?.firstName, project.client?.lastName].filter(Boolean).join(" ").trim() ||
    "Client";
  const profName =
    [project.professional?.firstName, project.professional?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Professional";
  const projectTitle = job?.title?.trim() || `Project #${projectId}`;
  const amountStr =
    request?.bidAmount != null ? `₹${request.bidAmount.toLocaleString("en-IN")}` : "Not specified";
  const milestoneAmountStr =
    latestMilestone?.amount != null
      ? `₹${latestMilestone.amount.toLocaleString("en-IN")}`
      : amountStr;

  const details = [
    { label: "Project", value: projectTitle },
    { label: "Project amount", value: amountStr },
    { label: "Project timeline", value: request?.duration?.trim() || "Not specified" },
    { label: "Status", value: project.status.replaceAll("_", " ") },
    { label: "Progress", value: `${project.progress}%` },
    { label: "Current stage", value: project.currentStage?.trim() || "Not specified" },
    { label: "Preferred job date", value: date(job?.jobDate) },
    { label: "Deadline", value: date(job?.deadline) },
    { label: "Started", value: date(project.startedAt) },
    { label: "Completed", value: date(project.completedAt) },
  ];

  if (latestMilestone?.title) {
    details.splice(2, 0, { label: "Milestone", value: latestMilestone.title });
    details.splice(3, 0, { label: "Milestone amount", value: milestoneAmountStr });
  }

  const variables: Record<string, string | number> = {
    client_name: clientName,
    professional_name: profName,
    prof_name: profName,
    user_name: clientName,
    project_title: projectTitle,
    job_title: projectTitle,
    category_name: job?.category || "Services",
    project_id: projectId,
    job_id: project.jobId,
    bid_amount: amountStr,
    accepted_amount: amountStr,
    agreed_amount: amountStr,
    amount: amountStr,
    budget: amountStr,
    delivery_time: request?.duration || "As scheduled",
    timeline: request?.duration || "As scheduled",
    milestone_title: latestMilestone?.title || "Project Milestone",
    milestone_amount: milestoneAmountStr,
  };

  return { details, variables };
}

async function jobEmailDetails(jobId: number): Promise<{
  details: Array<{ label: string; value: string }>;
  variables: Record<string, string | number>;
}> {
  const job = await db.clientJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      category: true,
      budgetMin: true,
      budgetMax: true,
      locationLabel: true,
      status: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });
  if (!job) return { details: [], variables: {} };

  const clientName =
    [job.user?.firstName, job.user?.lastName].filter(Boolean).join(" ").trim() || "Client";
  const jobTitle = job.title?.trim() || "Job Posting";
  const categoryName = job.category?.trim() || "General Services";
  const jobLocation = job.locationLabel?.trim() || "Remote";
  const budgetStr =
    job.budgetMin != null && job.budgetMax != null
      ? `₹${job.budgetMin.toLocaleString("en-IN")} - ₹${job.budgetMax.toLocaleString("en-IN")}`
      : job.budgetMax != null
        ? `₹${job.budgetMax.toLocaleString("en-IN")}`
        : "Not specified";

  const details = [
    { label: "Job Title", value: jobTitle },
    { label: "Job Category", value: categoryName },
    { label: "Job Budget", value: budgetStr },
    { label: "Job ID", value: String(job.id) },
  ];

  const variables: Record<string, string | number> = {
    client_name: clientName,
    user_name: clientName,
    job_title: jobTitle,
    project_title: jobTitle,
    category_name: categoryName,
    budget: budgetStr,
    job_id: job.id,
    job_location: jobLocation,
  };

  return { details, variables };
}

async function notifyRole(
  role: "ADMIN" | "CLIENT" | "PROFESSIONAL",
  notification: BroadcastNotification,
) {
  try {
    const projectIdMatch =
      notification.href.match(/\/project\/(\d+)/)?.[1] ||
      notification.href.match(/project=(\d+)/)?.[1];
    const jobIdMatch = !projectIdMatch
      ? notification.href.match(/\/jobs?\/(\d+)/)?.[1] || notification.href.match(/job=(\d+)/)?.[1]
      : null;

    const contextualInfo = projectIdMatch
      ? await projectEmailDetails(Number(projectIdMatch))
      : jobIdMatch
        ? await jobEmailDetails(Number(jobIdMatch))
        : { details: [], variables: {} };

    const emailDetails = [...contextualInfo.details, ...(notification.emailDetails ?? [])];
    const templateVariables = {
      ...contextualInfo.variables,
      ...(notification.templateVariables ?? {}),
    };

    const { emailDetails: _emailDetails, ...storedNotification } = notification;
    const recipients = await db.user.findMany({
      where: { role, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        emailNotificationsEnabled: true,
      },
    });
    if (!recipients.length) return;

    const created = await db.userNotification.createManyAndReturn({
      data: recipients.map((recipient) => ({ userId: recipient.id, ...storedNotification })),
    });
    created.forEach((notification) =>
      emitRealtimeNotification([notification.userId], {
        ...storedNotification,
        id: notification.id,
        createdAt: notification.createdAt.toISOString(),
      }),
    );
    if (role === "ADMIN") {
      emitAdminNotification(storedNotification);
      emitAdminOverviewUpdate();
      if (storedNotification.type.includes("ACCOUNT") || storedNotification.type.includes("USER")) {
        emitAdminUsersUpdate();
      }
      if (
        storedNotification.type.includes("JOB") ||
        storedNotification.type.includes("DISPUTE") ||
        storedNotification.type.includes("PROJECT")
      ) {
        emitAdminOperationsUpdate();
      }
      if (storedNotification.type.includes("VERIFICATION")) {
        emitAdminVerificationsUpdate();
      }
    }
    // Email leaves the request path: SMTP delivery must not hold the response open.
    enqueueBackgroundJob(
      "notification.email.role",
      () => sendEmails(recipients, { ...storedNotification, emailDetails, templateVariables }),
      {
        type: notification.type,
      },
    );
  } catch (error) {
    // A failed notification must never block account creation or job publishing.
    logServerError("marketplace.notification.broadcast.failed", error, {
      role,
      type: notification.type,
    });
  }
}

export function notifyAdminsOfNewAccount(user: {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || "A new user";
  const roleLabel = user.role === "PROFESSIONAL" ? "professional" : "client";
  return notifyRole("ADMIN", {
    type: "NEW_ACCOUNT",
    title: `New ${roleLabel} registration`,
    description: `${name} registered as a ${roleLabel}.`,
    href: `/admin/users?id=${user.id}`,
    templateVariables: {
      user_name: name,
      client_name: name,
    },
  });
}

export async function notifyUsers(userIds: number[], notification: BroadcastNotification) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  try {
    const projectIdMatch =
      notification.href.match(/\/project\/(\d+)/)?.[1] ||
      notification.href.match(/project=(\d+)/)?.[1];
    const jobIdMatch = !projectIdMatch
      ? notification.href.match(/\/jobs?\/(\d+)/)?.[1] || notification.href.match(/job=(\d+)/)?.[1]
      : null;

    const contextualInfo = projectIdMatch
      ? await projectEmailDetails(Number(projectIdMatch))
      : jobIdMatch
        ? await jobEmailDetails(Number(jobIdMatch))
        : { details: [], variables: {} };

    const emailDetails = [...contextualInfo.details, ...(notification.emailDetails ?? [])];
    const templateVariables = {
      ...contextualInfo.variables,
      ...(notification.templateVariables ?? {}),
    };

    const { emailDetails: _storedEmailDetails, ...storedNotification } = notification;
    const recipients = await db.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        emailNotificationsEnabled: true,
      },
    });
    const created = await db.userNotification.createManyAndReturn({
      data: recipients.map((recipient) => ({ userId: recipient.id, ...storedNotification })),
    });
    created.forEach((notification) =>
      emitRealtimeNotification([notification.userId], {
        ...storedNotification,
        id: notification.id,
        createdAt: notification.createdAt.toISOString(),
      }),
    );
    enqueueBackgroundJob(
      "notification.email.direct",
      () => sendEmails(recipients, { ...storedNotification, emailDetails, templateVariables }),
      { type: notification.type },
    );
  } catch (error) {
    logServerError("marketplace.notification.direct.failed", error, {
      userIds: ids.join(","),
      type: notification.type,
    });
  }
}

export async function notifyDisputeRaised(input: {
  disputeId: number;
  trackingId: number;
  jobTitle: string | null;
  issueType: string;
  reporterRole: "CLIENT" | "PROFESSIONAL";
  reporterName: string;
  clientId: number;
  professionalId: number;
}) {
  const jobLabel = input.jobTitle?.trim() || "your project";
  const reporterLabel = input.reporterRole === "CLIENT" ? "the client" : "the professional";
  await notifyRole("ADMIN", {
    type: "DISPUTE_RAISED",
    title: "New dispute raised",
    description: `${input.reporterName} (${reporterLabel}) raised a ${input.issueType} dispute on ${jobLabel}.`,
    href: `/admin/operations?dispute=${input.disputeId}&project=${input.trackingId}`,
  });
  await notifyUsers(
    [input.clientId, input.professionalId].filter(
      (id) => id !== (input.reporterRole === "CLIENT" ? input.clientId : input.professionalId),
    ),
    {
      type: "DISPUTE_RAISED",
      title: "A dispute was raised on your project",
      description: `${input.reporterName} raised a ${input.issueType} dispute on ${jobLabel}. Our team will review it and follow up soon.`,
      href: `/project/${input.trackingId}/tracking`,
    },
  );
}

export async function notifyDisputeResolved(input: {
  trackingId: number;
  jobTitle: string | null;
  status: "OPEN" | "RESOLVED";
  clientId: number;
  professionalId: number;
}) {
  const jobLabel = input.jobTitle?.trim() || "your project";
  await notifyUsers([input.clientId, input.professionalId], {
    type: "DISPUTE_UPDATED",
    title: input.status === "RESOLVED" ? "Dispute resolved" : "Dispute reopened",
    description:
      input.status === "RESOLVED"
        ? `Klick-Pro support marked the dispute on ${jobLabel} as resolved.`
        : `Klick-Pro support reopened the dispute on ${jobLabel} for further review.`,
    href: `/project/${input.trackingId}/tracking`,
  });
}

export async function notifyDisputeAccepted(input: {
  disputeId: number;
  trackingId: number;
  jobTitle: string | null;
  complainantId: number;
  respondentName: string;
}) {
  const jobLabel = input.jobTitle?.trim() || "your project";
  await notifyUsers([input.complainantId], {
    type: "DISPUTE_UPDATED",
    title: "Dispute accepted by other party",
    description: `${input.respondentName} accepted your dispute claim on ${jobLabel}. The dispute has been mutually settled.`,
    href: `/project/${input.trackingId}/tracking`,
  });
  await notifyRole("ADMIN", {
    type: "DISPUTE_UPDATED",
    title: `Dispute #${input.disputeId} mutually accepted`,
    description: `${input.respondentName} accepted the dispute claim on ${jobLabel}. Mutually settled.`,
    href: `/admin/operations?dispute=${input.disputeId}&project=${input.trackingId}`,
  });
}

export async function notifyDisputeContested(input: {
  disputeId: number;
  trackingId: number;
  jobTitle: string | null;
  complainantId: number;
  respondentName: string;
}) {
  const jobLabel = input.jobTitle?.trim() || "your project";
  await notifyUsers([input.complainantId], {
    type: "DISPUTE_UPDATED",
    title: "Dispute contested - Escalated to Admin Review",
    description: `${input.respondentName} submitted counter-evidence for the dispute on ${jobLabel}. An admin is now reviewing the case.`,
    href: `/project/${input.trackingId}/tracking`,
  });
  await notifyRole("ADMIN", {
    type: "DISPUTE_UPDATED",
    title: `Action Required: Dispute #${input.disputeId} contested`,
    description: `${input.respondentName} rejected the dispute on ${jobLabel} and submitted counter-evidence. Requires Admin Review.`,
    href: `/admin/operations?dispute=${input.disputeId}&project=${input.trackingId}`,
  });
}

export async function notifyDisputeDecided(input: {
  disputeId: number;
  trackingId: number;
  jobTitle: string | null;
  clientId: number;
  professionalId: number;
  decision: "CLIENT_WINS" | "PROFESSIONAL_WINS" | "PARTIAL_SETTLEMENT";
  refundAmount?: number;
  payoutAmount?: number;
  reason?: string;
}) {
  const jobLabel = input.jobTitle?.trim() || "your project";
  const decisionLabel =
    input.decision === "CLIENT_WINS"
      ? "Client Wins (Refund processed)"
      : input.decision === "PROFESSIONAL_WINS"
        ? "Professional Wins (Payment released)"
        : `Partial Settlement (Split: ₹${(input.refundAmount ?? 0).toLocaleString()} refund / ₹${(input.payoutAmount ?? 0).toLocaleString()} payout)`;

  await notifyUsers([input.clientId, input.professionalId], {
    type: "DISPUTE_UPDATED",
    title: `Dispute #${input.disputeId} Decided: ${decisionLabel}`,
    description: `Admin has reviewed and resolved the dispute on ${jobLabel}. ${input.reason ? `Notes: "${input.reason}".` : ""}`,
    href: `/project/${input.trackingId}/tracking`,
  });
}

export function notifyDisputeMessage(input: {
  disputeId: number;
  trackingId: number;
  recipientId: number;
  senderName: string;
  message: string;
}) {
  return notifyUsers([input.recipientId], {
    type: "DISPUTE_MESSAGE",
    title: `Message from Klick-Pro support about dispute #${input.disputeId}`,
    description: `${input.senderName}: ${input.message.slice(0, 180)}`,
    href: `/project/${input.trackingId}/tracking`,
  });
}

export async function notifyMilestoneFunded(input: {
  projectId: number;
  milestoneId: number;
  milestoneTitle: string;
  amount: number;
  clientId: number;
  professionalId: number;
}) {
  const href = `/project/${input.projectId}/tracking?tab=milestones&milestoneId=${input.milestoneId}`;
  const amount = `₹${input.amount.toLocaleString("en-IN")}`;
  await notifyUsers([input.professionalId], {
    type: "MILESTONE_FUNDED",
    title: "Milestone funded",
    description: `${input.milestoneTitle} is funded for ${amount}. Your payout is waiting for admin approval.`,
    href,
    templateVariables: {
      milestone_title: input.milestoneTitle,
      milestone_amount: amount,
      amount,
      project_id: input.projectId,
    },
    emailDetails: [
      { label: "Milestone", value: input.milestoneTitle },
      { label: "Milestone amount", value: amount },
    ],
  });
  await notifyRole("ADMIN", {
    type: "MILESTONE_FUNDED",
    title: "Milestone payout approval required",
    description: `${input.milestoneTitle} has received ${amount}. Review and approve the professional payout.`,
    href: `/admin/finance?project=${input.projectId}`,
    templateVariables: {
      milestone_title: input.milestoneTitle,
      milestone_amount: amount,
      amount,
      project_id: input.projectId,
    },
    emailDetails: [
      { label: "Milestone", value: input.milestoneTitle },
      { label: "Milestone amount", value: amount },
    ],
  });
}

export async function notifyMilestonePayoutApproved(input: {
  projectId: number;
  milestoneTitle: string;
  payoutAmount: number;
  platformEarnings: number;
  clientId: number;
  professionalId: number;
  jobTitle?: string | null;
}) {
  const href = `/project/${input.projectId}/tracking`;
  const payout = `₹${input.payoutAmount.toLocaleString("en-IN")}`;
  const jobTitle = input.jobTitle?.trim() || `Project #${input.projectId}`;
  // The client already sees the funded payment in project activity. Notify the professional
  // when the separate admin payout approval credits their wallet.
  await notifyUsers([input.professionalId], {
    type: "MILESTONE_PAYOUT_APPROVED",
    title: `${jobTitle} · Milestone payout released`,
    description: `Admin approved the payout for ${input.milestoneTitle}. ${payout} has been added to your wallet.`,
    href: "/professional/earnings",
    templateVariables: {
      milestone_title: input.milestoneTitle,
      payout_amount: payout,
      amount: payout,
      project_title: jobTitle,
      platform_fee: `₹${input.platformEarnings.toLocaleString("en-IN")}`,
    },
    emailDetails: [
      { label: "Project", value: jobTitle },
      { label: "Milestone", value: input.milestoneTitle },
      { label: "Payout credited", value: payout },
      { label: "Platform commission", value: `₹${input.platformEarnings.toLocaleString("en-IN")}` },
    ],
  });
  await notifyRole("ADMIN", {
    type: "MILESTONE_PAYOUT_APPROVED",
    title: `${jobTitle} · Milestone payout completed`,
    description: `${payout} was released for ${input.milestoneTitle}. Platform earnings: ₹${input.platformEarnings.toLocaleString("en-IN")}.`,
    href: `/admin/finance?project=${input.projectId}`,
    templateVariables: {
      milestone_title: input.milestoneTitle,
      payout_amount: payout,
      amount: payout,
      project_title: jobTitle,
      platform_fee: `₹${input.platformEarnings.toLocaleString("en-IN")}`,
    },
    emailDetails: [
      { label: "Project", value: jobTitle },
      { label: "Milestone", value: input.milestoneTitle },
      { label: "Payout released", value: payout },
      { label: "Platform commission", value: `₹${input.platformEarnings.toLocaleString("en-IN")}` },
    ],
  });
}
