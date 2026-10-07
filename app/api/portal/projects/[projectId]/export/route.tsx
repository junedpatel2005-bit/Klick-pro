import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  ProjectArchiveDocument,
  type ArchiveEntry,
  type ProjectArchiveData,
} from "@/lib/reports/pdf/ProjectArchiveDocument";
import { pdfResponse, renderReportPdf } from "@/lib/reports/pdf/render";

export const runtime = "nodejs";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function formatDate(value: Date | string | null | undefined) {
  return value ? `${dateFormatter.format(new Date(value))} IST` : "Not recorded";
}

function formatStatus(value: string | null | undefined) {
  return value
    ? value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not recorded";
}

function formatMoney(amount: number | null | undefined, currency = "INR") {
  if (amount == null) return "Not recorded";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function extractFileNames(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const candidate = record.name ?? record.fileName ?? record.filename;
        return typeof candidate === "string" ? candidate : null;
      })
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
}

function safeFilename(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return slug || "completed-project";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const projectId = Number((await params).projectId);
  if (!Number.isInteger(projectId) || projectId < 1)
    return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });

  const project = await db.projectTracking.findUnique({
    where: { id: projectId },
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
          address: true,
        },
      },
      professional: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          professionalCategory: true,
          professionalCity: true,
        },
      },
      job: { include: { attachments: { orderBy: { createdAt: "asc" } } } },
      request: true,
      milestones: { orderBy: { createdAt: "asc" }, include: { payment: true } },
      timelineEvents: { orderBy: { createdAt: "asc" } },
      workUploads: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (
    session.role !== "ADMIN" &&
    session.userId !== project.clientId &&
    session.userId !== project.professionalId
  )
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  if (!["COMPLETED", "CLOSED"].includes(project.status))
    return NextResponse.json(
      { error: "The full project PDF is available after project completion." },
      { status: 409 },
    );

  const [
    negotiations,
    revisions,
    completionRequests,
    reviewRequests,
    transactions,
    review,
    dispute,
  ] = await Promise.all([
    db.projectNegotiation.findMany({
      where: { requestId: project.requestId },
      orderBy: { createdAt: "asc" },
    }),
    db.projectRevisionRequest.findMany({
      where: { trackingId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    db.projectCompletionRequest.findMany({
      where: { trackingId: project.id },
      orderBy: { submittedAt: "asc" },
    }),
    db.projectReviewRequest.findMany({
      where: { trackingId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    db.projectTransaction.findMany({
      where: { trackingId: project.id },
      orderBy: { createdAt: "asc" },
    }),
    db.projectReview.findUnique({ where: { trackingId: project.id } }),
    db.projectDispute.findFirst({
      where: { trackingId: project.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const disputeMessages = dispute
    ? await db.projectDisputeMessage.findMany({
        where: { disputeId: dispute.id },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const clientName = fullName(project.client);
  const professionalName = fullName(project.professional);
  const viewerName =
    session.userId === project.clientId
      ? clientName
      : session.userId === project.professionalId
        ? professionalName
        : "Klick-Pro administrator";

  const requestEntries = [
    ...revisions.map((item) => ({
      sortDate: item.createdAt,
      entry: {
        title: "Revision requested",
        meta: formatDate(item.createdAt),
        details: [{ label: "Status", value: formatStatus(item.status) }],
        body: item.note ?? "No note provided.",
      } satisfies ArchiveEntry,
    })),
    ...completionRequests.map((item) => ({
      sortDate: item.submittedAt,
      entry: {
        title: "Project completion requested",
        meta: formatDate(item.submittedAt),
        details: [{ label: "Status", value: formatStatus(item.status) }],
        body: item.note ?? "No note provided.",
      } satisfies ArchiveEntry,
    })),
    ...reviewRequests.map((item) => ({
      sortDate: item.createdAt,
      entry: {
        title: "Client review requested",
        meta: formatDate(item.createdAt),
        body: item.note ?? "No note provided.",
      } satisfies ArchiveEntry,
    })),
  ]
    .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    .map((item) => item.entry);

  const reviews: ArchiveEntry[] = [];
  if (review?.rating != null) {
    reviews.push({
      title: `Client review of ${professionalName}`,
      meta: formatDate(review.clientReviewedAt ?? review.createdAt),
      details: [{ label: "Rating", value: `${review.rating} / 5` }],
      body: [
        review.comment ?? "No comment provided.",
        review.professionalResponse
          ? `Professional response: ${review.professionalResponse}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }
  if (review?.professionalRating != null) {
    reviews.push({
      title: `Professional review of ${clientName}`,
      meta: formatDate(review.professionalReviewedAt ?? review.createdAt),
      details: [{ label: "Rating", value: `${review.professionalRating} / 5` }],
      body: review.professionalComment ?? "No comment provided.",
    });
  }

  const archive: ProjectArchiveData = {
    projectId: project.id,
    title: project.job.title?.trim() || `Project #${project.id}`,
    status: formatStatus(project.status),
    generatedFor: viewerName,
    completedAt: formatDate(project.completedAt),
    overview: [
      { label: "Project ID", value: String(project.id) },
      { label: "Job ID", value: String(project.jobId) },
      { label: "Category", value: project.job.category ?? "Not provided" },
      { label: "Work mode", value: formatStatus(project.job.workMode) },
      { label: "Payment method", value: formatStatus(project.job.paymentMethod) },
      { label: "Progress", value: `${project.progress}%` },
      { label: "Posted", value: formatDate(project.job.createdAt) },
      { label: "Proposal accepted", value: formatDate(project.acceptedAt) },
      { label: "Work started", value: formatDate(project.startedAt) },
      { label: "Completed", value: formatDate(project.completedAt) },
      { label: "Job date", value: formatDate(project.job.jobDate) },
      { label: "Deadline", value: formatDate(project.job.deadline) },
      {
        label: "Original budget",
        value:
          project.job.budgetMin != null || project.job.budgetMax != null
            ? `${formatMoney(project.job.budgetMin)} - ${formatMoney(project.job.budgetMax)}`
            : "Not provided",
      },
      { label: "Agreed proposal", value: formatMoney(project.request.bidAmount) },
      {
        label: "Location",
        value: project.job.locationAddress ?? project.job.locationLabel ?? "Not provided",
      },
      { label: "Current/final stage", value: project.currentStage ?? "Not provided" },
    ],
    client: [
      { label: "Name", value: clientName },
      { label: "Email", value: project.client.email },
      { label: "Phone", value: project.client.phone ?? "Not provided" },
      { label: "Company", value: project.client.companyName ?? "Not provided" },
      { label: "Address", value: project.client.address ?? "Not provided" },
    ],
    professional: [
      { label: "Name", value: professionalName },
      { label: "Email", value: project.professional.email },
      { label: "Phone", value: project.professional.phone ?? "Not provided" },
      {
        label: "Category",
        value: project.professional.professionalCategory ?? "Not provided",
      },
      { label: "City", value: project.professional.professionalCity ?? "Not provided" },
    ],
    description: project.job.description ?? undefined,
    proposal: {
      title: `${professionalName}'s accepted proposal`,
      meta: `Submitted ${formatDate(project.request.createdAt)}`,
      details: [
        { label: "Bid", value: formatMoney(project.request.bidAmount) },
        { label: "Duration", value: project.request.duration },
        { label: "Status", value: formatStatus(project.request.status) },
        { label: "Origin", value: formatStatus(project.request.origin) },
        { label: "Last updated", value: formatDate(project.request.updatedAt) },
      ],
      body: project.request.coverLetter || "No cover letter provided.",
      files: extractFileNames(project.request.attachmentsJson),
    },
    negotiations: negotiations.map((item) => ({
      title: `${formatStatus(item.senderRole)} message`,
      meta: formatDate(item.createdAt),
      details: [
        { label: "Offered bid", value: formatMoney(item.bidAmount) },
        { label: "Offered duration", value: item.duration ?? "Not changed" },
        { label: "Previous bid", value: formatMoney(item.previousBidAmount) },
        { label: "Previous duration", value: item.previousDuration ?? "Not recorded" },
      ],
      body: item.message,
    })),
    milestones: project.milestones.map((item, index) => ({
      title: `${index + 1}. ${item.title}`,
      meta: formatStatus(item.status),
      details: [
        { label: "Amount", value: formatMoney(item.amount) },
        { label: "Due", value: formatDate(item.dueDate) },
        { label: "Submitted", value: formatDate(item.submittedAt) },
        { label: "Approved", value: formatDate(item.approvedAt) },
        {
          label: "Payment",
          value: item.payment ? formatStatus(item.payment.status) : "No payment record",
        },
      ],
      body: item.description ?? "No description provided.",
    })),
    workUploads: project.workUploads.map((item) => ({
      title: item.title,
      meta: formatDate(item.createdAt),
      details: [
        { label: "Round", value: String(item.roundNumber) },
        { label: "Status", value: formatStatus(item.status) },
        {
          label: "Milestone",
          value: item.milestoneId ? `Milestone #${item.milestoneId}` : "Final/general upload",
        },
      ],
      body: item.note ?? "No note provided.",
      files: [item.fileName, ...extractFileNames(item.filesJson)].filter(
        (value, index, values): value is string =>
          Boolean(value) && values.indexOf(value) === index,
      ),
    })),
    requests: requestEntries,
    payments: project.payments.map((item) => {
      const roleSpecificAmounts =
        session.role === "ADMIN"
          ? [
              { label: "Charged", value: formatMoney(item.amount, item.currency) },
              { label: "Base amount", value: formatMoney(item.baseAmount, item.currency) },
              { label: "Client fee", value: formatMoney(item.clientFeeAmount, item.currency) },
              {
                label: "Professional payout",
                value: formatMoney(item.professionalPayoutAmount, item.currency),
              },
              {
                label: "Platform amount",
                value: formatMoney(item.adminNetAmount, item.currency),
              },
            ]
          : session.userId === project.clientId
            ? [
                { label: "Charged", value: formatMoney(item.amount, item.currency) },
                {
                  label: "Milestone amount",
                  value: formatMoney(item.baseAmount, item.currency),
                },
                {
                  label: "Client service fee",
                  value: formatMoney(item.clientFeeAmount, item.currency),
                },
              ]
            : [
                {
                  label: "Client milestone payment",
                  value: formatMoney(item.baseAmount, item.currency),
                },
                {
                  label: "Platform commission",
                  value: formatMoney(item.commissionAmount, item.currency),
                },
                {
                  label: "Net earnings",
                  value: formatMoney(item.professionalPayoutAmount, item.currency),
                },
              ];
      return {
        title: `Payment #${item.id}`,
        meta: formatDate(item.createdAt),
        details: [
          { label: "Status", value: formatStatus(item.status) },
          ...roleSpecificAmounts,
          { label: "Provider", value: formatStatus(item.provider) },
          {
            label: "Reference",
            value: item.razorpayPaymentId ?? item.providerReference ?? "Not recorded",
          },
          { label: "Captured", value: formatDate(item.capturedAt) },
        ],
        body: item.failureReason ? `Failure reason: ${item.failureReason}` : undefined,
      };
    }),
    transactions: transactions.map((item) => ({
      title: item.description,
      meta: formatDate(item.createdAt),
      details: [
        { label: "Type", value: formatStatus(item.type) },
        { label: "Status", value: formatStatus(item.status) },
        { label: "Amount", value: formatMoney(item.amount, item.currency) },
        {
          label: "Milestone",
          value: item.milestoneId ? `Milestone #${item.milestoneId}` : "Not linked",
        },
      ],
    })),
    timeline: project.timelineEvents.map((item) => ({
      title: item.title,
      meta: formatDate(item.createdAt),
      details: [
        { label: "Actor", value: formatStatus(item.actorRole) },
        { label: "Event", value: formatStatus(item.type) },
        { label: "Progress", value: item.progress != null ? `${item.progress}%` : "Not changed" },
        { label: "Stage", value: item.stage ?? "Not changed" },
      ],
      body: item.description ?? undefined,
      files: extractFileNames(item.attachmentJson),
    })),
    reviews,
    dispute: dispute
      ? {
          title: `${formatStatus(dispute.issueType)} dispute`,
          meta: `Opened ${formatDate(dispute.createdAt)}`,
          details: [
            { label: "Status", value: formatStatus(dispute.status) },
            { label: "Priority", value: formatStatus(dispute.priority) },
            { label: "Reported by", value: formatStatus(dispute.reporterRole) },
            { label: "Last updated", value: formatDate(dispute.updatedAt) },
          ],
          body: dispute.message,
          files: extractFileNames(dispute.attachmentsJson),
        }
      : undefined,
    disputeMessages: disputeMessages.map((item) => ({
      title: `${formatStatus(item.senderRole)} message`,
      meta: formatDate(item.createdAt),
      body: item.message,
    })),
  };

  try {
    const buffer = await renderReportPdf(<ProjectArchiveDocument data={archive} />);
    return pdfResponse(
      buffer,
      `project-${project.id}-${safeFilename(archive.title)}-complete-record.pdf`,
    );
  } catch (error) {
    console.error("project.archive_pdf.failed", { projectId: project.id, error });
    return NextResponse.json({ error: "Unable to generate the project PDF." }, { status: 500 });
  }
}
