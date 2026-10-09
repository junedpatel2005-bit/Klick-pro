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
import { sendSms, resolveSmsTemplate } from "@/lib/sms/engine";
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

async function sendSmsNotifications(
  recipients: Array<{
    id: number;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
  }>,
  notification: BroadcastNotification,
) {
  const validRecipients = recipients.filter(
    (recipient) => recipient.phone && recipient.phone.trim().length >= 8,
  );
  if (!validRecipients.length) return;

  const results = await Promise.allSettled(
    validRecipients.map((recipient) => {
      const recipientName =
        [recipient.firstName, recipient.lastName].filter(Boolean).join(" ").trim() ||
        recipient.firstName ||
        "";

      const audience =
        (recipient.role as "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM") || undefined;
      const templateKey = resolveSmsTemplate(notification.type, audience);
      if (!templateKey) return Promise.resolve({ ok: true, provider: "noop" as const });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://klickpro.in";
      const shortUrl = notification.href.startsWith("http")
        ? notification.href
        : `${appUrl}${notification.href}`;

      return sendSms({
        to: recipient.phone!.trim(),
        templateKey,
        variables: {
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
          short_url: shortUrl,
          site_url: appUrl,
        },
      });
    }),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      logServerError("marketplace.notification.sms.failed", result.reason, {
        type: notification.type,
      });
    }
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

export async function notifyRole(
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

    const storedNotification = {
      type: notification.type,
      title: notification.title,
      description: notification.description,
      href: notification.href,
    };

    const recipients = await db.user.findMany({
      where: { role, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        phone: true,
        emailNotificationsEnabled: true,
      },
    });
    if (!recipients.length) return;

    const created = await db.userNotification.createManyAndReturn({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        ...storedNotification,
      })),
    });
    created.forEach((item) =>
      emitRealtimeNotification([item.userId], {
        type: item.type,
        title: item.title,
        description: item.description ?? "",
        href: item.href ?? "",
        id: item.id,
        createdAt: item.createdAt.toISOString(),
      }),
    );
    if (role === "ADMIN") {
      emitAdminNotification({
        type: notification.type,
        title: notification.title,
        description: notification.description,
        href: notification.href,
      });
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
    // SMS notification
    enqueueBackgroundJob(
      "notification.sms.role",
      () =>
        sendSmsNotifications(recipients, {
          ...storedNotification,
          emailDetails,
          templateVariables,
        }),
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
    href: `/admin/users/${user.id}`,
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

    const storedNotification = {
      type: notification.type,
      title: notification.title,
      description: notification.description,
      href: notification.href,
    };
    const recipients = await db.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        email: true,
        phone: true,
        emailNotificationsEnabled: true,
      },
    });
    if (!recipients.length) return;

    const created = await db.userNotification.createManyAndReturn({
      data: recipients.map((recipient) => ({ userId: recipient.id, ...storedNotification })),
    });
    created.forEach((item) =>
      emitRealtimeNotification([item.userId], {
        type: item.type,
        title: item.title,
        description: item.description ?? "",
        href: item.href ?? "",
        id: item.id,
        createdAt: item.createdAt.toISOString(),
      }),
    );
    enqueueBackgroundJob(
      "notification.email.direct",
      () => sendEmails(recipients, { ...storedNotification, emailDetails, templateVariables }),
      { type: notification.type },
    );
    enqueueBackgroundJob(
      "notification.sms.direct",
      () =>
        sendSmsNotifications(recipients, {
          ...storedNotification,
          emailDetails,
          templateVariables,
        }),
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

export async function notifyJobPosted(job: {
  id: number;
  title: string | null;
  category: string | null;
  userId: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
}) {
  const jobTitle = job.title?.trim() || `Job #${job.id}`;
  const categoryLabel = job.category?.trim() || "General Services";
  const clientUser = await db.user.findUnique({
    where: { id: job.userId },
    select: { firstName: true, lastName: true },
  });
  const clientName = clientUser
    ? `${clientUser.firstName} ${clientUser.lastName}`.trim()
    : "Client";

  // 1. Notify Client (confirmation)
  await notifyUsers([job.userId], {
    type: "JOB_POSTED",
    title: `${jobTitle} · Job posted successfully`,
    description: `Your job "${jobTitle}" has been posted and is now open for proposals.`,
    href: `/job/${job.id}`,
    templateVariables: {
      job_title: jobTitle,
      client_name: clientName,
    },
  });

  // 2. Notify Admins
  await notifyRole("ADMIN", {
    type: "NEW_JOB",
    title: `New job posted · ${jobTitle}`,
    description: `Client ${clientName} posted a new job "${jobTitle}" in ${categoryLabel}.`,
    href: `/admin/operations?job=${job.id}`,
    templateVariables: {
      job_title: jobTitle,
      client_name: clientName,
      category_name: categoryLabel,
    },
  });

  // 3. Notify Matching Professionals in that category
  let matchingPros: { id: number }[] = [];
  try {
    matchingPros = await db.user.findMany({
      where: {
        role: "PROFESSIONAL",
        isActive: true,
        id: { not: job.userId },
        ...(job.category
          ? {
              OR: [
                { professionalCategory: job.category },
                { professionalCategoryRecord: { name: job.category } },
                { services: { some: { category: { name: job.category } } } },
              ],
            }
          : {}),
      },
      select: { id: true },
      take: 50,
    });
  } catch (err) {
    console.error("Failed to query matching professionals for job notification:", err);
  }

  const targetProIds = matchingPros.map((p) => p.id);
  if (targetProIds.length > 0) {
    await notifyUsers(targetProIds, {
      type: "NEW_JOB",
      title: `New job available · ${jobTitle}`,
      description: `A new job matching your expertise was posted: "${jobTitle}" (${categoryLabel}). Submit a proposal now.`,
      href: `/job/${job.id}`,
      templateVariables: {
        job_title: jobTitle,
        category_name: categoryLabel,
      },
    });
  }
}

export async function notifyProposalSubmitted(input: {
  jobId: number;
  jobTitle?: string | null;
  clientId: number;
  professionalId: number;
  bidAmount: number;
  duration: string;
  coverLetter?: string | null;
}) {
  const jobTitle = input.jobTitle?.trim() || `Job #${input.jobId}`;
  const proUser = await db.user.findUnique({
    where: { id: input.professionalId },
    select: { firstName: true, lastName: true },
  });
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : "A professional";

  // 1. Notify Client
  await notifyUsers([input.clientId], {
    type: "NEW_PROPOSAL",
    title: `${jobTitle} · New Proposal`,
    description: `${proName} sent a proposal of ₹${input.bidAmount.toLocaleString("en-IN")} for ${jobTitle}.`,
    href: `/job/${input.jobId}`,
    emailDetails: [
      { label: "Professional", value: proName },
      { label: "Project", value: jobTitle },
      { label: "Proposed amount", value: `₹${input.bidAmount.toLocaleString("en-IN")}` },
      { label: "Delivery time", value: input.duration },
    ],
  });

  // 2. Notify Professional (confirmation)
  await notifyUsers([input.professionalId], {
    type: "PROPOSAL_SENT",
    title: `${jobTitle} · Proposal Submitted`,
    description: `Your proposal of ₹${input.bidAmount.toLocaleString("en-IN")} for "${jobTitle}" was submitted to the client.`,
    href: `/job/${input.jobId}`,
  });

  // 3. Notify Admins
  await notifyRole("ADMIN", {
    type: "NEW_PROPOSAL",
    title: `${jobTitle} · New Proposal Submitted`,
    description: `${proName} submitted a proposal of ₹${input.bidAmount.toLocaleString("en-IN")} for "${jobTitle}".`,
    href: `/admin/operations?job=${input.jobId}`,
  });
}

export async function notifyProposalUpdated(input: {
  jobId: number;
  jobTitle?: string | null;
  clientId: number;
  professionalId: number;
  bidAmount: number;
  duration: string;
}) {
  const jobTitle = input.jobTitle?.trim() || `Job #${input.jobId}`;
  const proUser = await db.user.findUnique({
    where: { id: input.professionalId },
    select: { firstName: true, lastName: true },
  });
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : "A professional";

  // Notify Client
  await notifyUsers([input.clientId], {
    type: "PROPOSAL_UPDATED",
    title: `${jobTitle} · Proposal Updated`,
    description: `${proName} updated their proposal for ${jobTitle} to ₹${input.bidAmount.toLocaleString("en-IN")}.`,
    href: `/job/${input.jobId}`,
  });

  // Notify Professional (confirmation)
  await notifyUsers([input.professionalId], {
    type: "PROPOSAL_UPDATED",
    title: `${jobTitle} · Proposal Updated`,
    description: `You updated your proposal for ${jobTitle} to ₹${input.bidAmount.toLocaleString("en-IN")}.`,
    href: `/job/${input.jobId}`,
  });
}

export async function notifyContractAwarded(input: {
  projectId: number;
  jobId: number;
  jobTitle?: string | null;
  clientId: number;
  professionalId: number;
  bidAmount: number;
  duration?: string | null;
}) {
  const jobTitle = input.jobTitle?.trim() || `Project #${input.projectId}`;
  const [clientUser, proUser] = await Promise.all([
    db.user.findUnique({
      where: { id: input.clientId },
      select: { firstName: true, lastName: true },
    }),
    db.user.findUnique({
      where: { id: input.professionalId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  const clientName = clientUser ? `${clientUser.firstName} ${clientUser.lastName}`.trim() : "Client";
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : "Professional";
  const amountStr = `₹${input.bidAmount.toLocaleString("en-IN")}`;

  // 1. Notify Professional
  await notifyUsers([input.professionalId], {
    type: "REQUEST_ACCEPTED",
    title: `${jobTitle} · Congratulations! You got the project`,
    description: `Congratulations! ${clientName} accepted your proposal for ${jobTitle} (${amountStr}). The project is now active.`,
    href: `/project/${input.projectId}/tracking`,
    emailDetails: [
      { label: "Project", value: jobTitle },
      { label: "Agreed amount", value: amountStr },
      { label: "Client", value: clientName },
    ],
  });

  // 2. Notify Client
  await notifyUsers([input.clientId], {
    type: "PROJECT_STARTED",
    title: `${jobTitle} · Project Started`,
    description: `You hired ${proName} for ${jobTitle} (${amountStr}). The project is now ready to start.`,
    href: `/project/${input.projectId}/tracking`,
    emailDetails: [
      { label: "Project", value: jobTitle },
      { label: "Agreed amount", value: amountStr },
      { label: "Professional", value: proName },
    ],
  });

  // 3. Notify Admins
  await notifyRole("ADMIN", {
    type: "PROFESSIONAL_HIRED",
    title: `${jobTitle} · Contract Awarded`,
    description: `Client ${clientName} awarded project ${jobTitle} to ${proName} for ${amountStr}.`,
    href: `/admin/operations?project=${input.projectId}`,
  });
}

export async function notifyHireRequestSent(input: {
  jobId: number;
  jobTitle?: string | null;
  requestId: number;
  clientId: number;
  professionalId: number;
  bidAmount: number;
  duration: string;
}) {
  const jobTitle = input.jobTitle?.trim() || `Job #${input.jobId}`;
  const [clientUser, proUser] = await Promise.all([
    db.user.findUnique({
      where: { id: input.clientId },
      select: { firstName: true, lastName: true },
    }),
    db.user.findUnique({
      where: { id: input.professionalId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  const clientName = clientUser ? `${clientUser.firstName} ${clientUser.lastName}`.trim() : "A client";
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : "A professional";

  // 1. Notify Professional
  await notifyUsers([input.professionalId], {
    type: "NEW_HIRE_REQUEST",
    title: `${jobTitle} · New hire request`,
    description: `${clientName} sent you a hire request for ${jobTitle}.`,
    href: `/job/${input.jobId}?requestId=${input.requestId}`,
    emailDetails: [
      { label: "Job", value: jobTitle },
      { label: "Offered amount", value: `₹${input.bidAmount.toLocaleString("en-IN")}` },
      { label: "Timeline", value: input.duration },
    ],
  });

  // 2. Notify Client (confirmation)
  await notifyUsers([input.clientId], {
    type: "HIRE_REQUEST_SENT",
    title: `${jobTitle} · Hire request sent`,
    description: `Your hire request of ₹${input.bidAmount.toLocaleString("en-IN")} was sent to ${proName} for ${jobTitle}.`,
    href: `/job/${input.jobId}`,
  });

  // 3. Notify Admins
  await notifyRole("ADMIN", {
    type: "NEW_HIRE_REQUEST",
    title: `${jobTitle} · Direct Hire Request`,
    description: `Client ${clientName} sent a hire request to ${proName} for ${jobTitle}.`,
    href: `/admin/operations?job=${input.jobId}`,
  });
}

export async function notifyVerificationStatus(input: {
  userId: number;
  provider: string;
  isApproved: boolean;
}) {
  const title = input.isApproved ? "Identity Verification Approved" : "Identity Verification Rejected";
  const description = input.isApproved
    ? `Your ${input.provider} verification has been approved. Your profile now shows the verified badge.`
    : `Your ${input.provider} verification was reviewed and not approved.`;

  await notifyUsers([input.userId], {
    type: "VERIFICATION_UPDATE",
    title,
    description,
    href: "/verification",
  });

  await notifyRole("ADMIN", {
    type: "VERIFICATION_REVIEWED",
    title: `Verification ${input.isApproved ? "Approved" : "Rejected"}`,
    description: `User verification #${input.userId} (${input.provider}) marked as ${input.isApproved ? "APPROVED" : "REJECTED"}.`,
    href: `/admin/verifications?userId=${input.userId}`,
  });
}

export async function notifyVerificationSubmitted(input: {
  userId: number;
  provider: string;
}) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { firstName: true, lastName: true, role: true },
  });
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : `User #${input.userId}`;
  const roleLabel = user?.role === "PROFESSIONAL" ? "Professional" : "Client";

  await notifyUsers([input.userId], {
    type: "VERIFICATION_SUBMITTED",
    title: "Verification Submitted",
    description: `Your ${input.provider} documents were submitted successfully and are under review.`,
    href: "/verification",
  });

  await notifyRole("ADMIN", {
    type: "VERIFICATION_SUBMITTED",
    title: `New Verification Submitted · ${name}`,
    description: `${name} (${roleLabel}) submitted identity verification documents for review.`,
    href: `/admin/verifications?userId=${input.userId}`,
  });
}

export async function notifyProjectCompleted(input: {
  projectId: number;
  jobTitle?: string | null;
  clientId: number;
  professionalId: number;
}) {
  const jobTitle = input.jobTitle?.trim() || `Project #${input.projectId}`;
  const [clientUser, proUser] = await Promise.all([
    db.user.findUnique({
      where: { id: input.clientId },
      select: { firstName: true, lastName: true },
    }),
    db.user.findUnique({
      where: { id: input.professionalId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  const clientName = clientUser ? `${clientUser.firstName} ${clientUser.lastName}`.trim() : "Client";
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : "Professional";

  await notifyUsers([input.clientId, input.professionalId], {
    type: "PROJECT_COMPLETED",
    title: `${jobTitle} · Project Completed`,
    description: `Project ${jobTitle} has been successfully completed. You can now leave a review.`,
    href: `/project/${input.projectId}/tracking`,
  });

  await notifyRole("ADMIN", {
    type: "PROJECT_COMPLETED",
    title: `${jobTitle} · Project Completed`,
    description: `Project ${jobTitle} between ${clientName} and ${proName} has been marked completed.`,
    href: `/admin/operations?project=${input.projectId}`,
  });
}

