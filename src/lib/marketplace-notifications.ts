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
};

async function sendEmails(
  recipients: Array<{ email: string; emailNotificationsEnabled: boolean }>,
  notification: BroadcastNotification,
) {
  const results = await Promise.allSettled(
    recipients
      .filter((recipient) => recipient.emailNotificationsEnabled && recipient.email.trim())
      .map((recipient) =>
        sendNotificationEmail({
          // SMTP_USER/SMTP_FROM identify the sender only. The notification must
          // always be delivered to the specific user's registered address.
          to: recipient.email.trim(),
          ...notification,
          details: notification.emailDetails,
        }),
      ),
  );
  results.forEach((result) => {
    if (result.status === "rejected")
      logServerError("marketplace.notification.email.failed", result.reason, {
        type: notification.type,
      });
  });
}

async function projectEmailDetails(projectId: number) {
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
    },
  });
  if (!project) return [];
  const [job, request] = await Promise.all([
    db.clientJob.findUnique({
      where: { id: project.jobId },
      select: { title: true, deadline: true, jobDate: true },
    }),
    db.projectRequest.findUnique({
      where: { id: project.requestId },
      select: { bidAmount: true, duration: true },
    }),
  ]);
  const date = (value: Date | null | undefined) =>
    value?.toLocaleDateString("en-IN") ?? "Not specified";
  return [
    { label: "Project", value: job?.title?.trim() || `Project #${projectId}` },
    {
      label: "Project amount",
      value:
        request?.bidAmount == null
          ? "Not specified"
          : `₹${request.bidAmount.toLocaleString("en-IN")}`,
    },
    { label: "Project timeline", value: request?.duration?.trim() || "Not specified" },
    { label: "Status", value: project.status.replaceAll("_", " ") },
    { label: "Progress", value: `${project.progress}%` },
    { label: "Current stage", value: project.currentStage?.trim() || "Not specified" },
    { label: "Preferred job date", value: date(job?.jobDate) },
    { label: "Deadline", value: date(job?.deadline) },
    { label: "Started", value: date(project.startedAt) },
    { label: "Completed", value: date(project.completedAt) },
  ];
}

async function notifyRole(
  role: "ADMIN" | "CLIENT" | "PROFESSIONAL",
  notification: BroadcastNotification,
) {
  try {
    const { emailDetails: _emailDetails, ...storedNotification } = notification;
    const recipients = await db.user.findMany({
      where: { role, isActive: true },
      select: { id: true, email: true, emailNotificationsEnabled: true },
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
    enqueueBackgroundJob("notification.email.role", () => sendEmails(recipients, notification), {
      type: notification.type,
    });
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
  });
}

export async function notifyUsers(userIds: number[], notification: BroadcastNotification) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  try {
    const projectId = notification.href.match(/^\/project\/(\d+)\/tracking/)?.[1];
    const details = projectId ? await projectEmailDetails(Number(projectId)) : [];
    const emailDetails = [...details, ...(notification.emailDetails ?? [])];
    const { emailDetails: _storedEmailDetails, ...storedNotification } = notification;
    const recipients = await db.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, email: true, emailNotificationsEnabled: true },
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
      () => sendEmails(recipients, { ...storedNotification, emailDetails }),
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
  const href = `/project/${input.projectId}/tracking`;
  const amount = `₹${input.amount.toLocaleString("en-IN")}`;
  await notifyUsers([input.professionalId], {
    type: "MILESTONE_FUNDED",
    title: "Milestone funded",
    description: `${input.milestoneTitle} is funded for ${amount}. Your payout is waiting for admin approval.`,
    href,
  });
  await notifyRole("ADMIN", {
    type: "MILESTONE_FUNDED",
    title: "Milestone payout approval required",
    description: `${input.milestoneTitle} has received ${amount}. Review and approve the professional payout.`,
    href: `/admin/finance?project=${input.projectId}`,
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
  });
  await notifyRole("ADMIN", {
    type: "MILESTONE_PAYOUT_APPROVED",
    title: `${jobTitle} · Milestone payout completed`,
    description: `${payout} was released for ${input.milestoneTitle}. Platform earnings: ₹${input.platformEarnings.toLocaleString("en-IN")}.`,
    href: `/admin/finance?project=${input.projectId}`,
  });
}
