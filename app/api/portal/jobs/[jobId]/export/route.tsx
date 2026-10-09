import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  JobDossierDocument,
  type JobDossierData,
  type DossierProposal,
  type DossierNegotiation,
  type DossierMilestone,
  type DossierPayment,
} from "@/lib/reports/pdf/JobDossierDocument";
import { pdfResponse, renderReportPdf } from "@/lib/reports/pdf/render";
import { generateCsvContent } from "@/lib/reports/csv/export-csv";

export const runtime = "nodejs";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) {
    return NextResponse.json({ error: "Sign-in required to export job dossier." }, { status: 401 });
  }

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { jobId: rawId } = await params;
  const jobId = Number(rawId);
  if (!Number.isInteger(jobId) || jobId < 1) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  const job = await db.clientJob.findUnique({
    where: { id: jobId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyName: true,
          address: true,
        },
      },
      attachments: true,
      milestones: { orderBy: { id: "asc" } },
      projectRequests: {
        include: {
          client: { select: { firstName: true, lastName: true } },
          professional: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              professionalCategory: true,
              professionalCity: true,
              averageRating: true,
            },
          },
        },
      },
      projectTrackings: {
        include: {
          professional: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              professionalCategory: true,
              professionalCity: true,
            },
          },
          milestones: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job record not found." }, { status: 404 });
  }

  // Authorization logic
  const isOwner = job.userId === session.userId;
  const isAdmin = session.role === "ADMIN";
  const trackingProject = job.projectTrackings[0];
  const isAssignedPro = trackingProject?.professionalId === session.userId;
  const hasSubmittedProposal = job.projectRequests.some((r) => r.professionalId === session.userId);

  if (!isOwner && !isAdmin && !isAssignedPro && !hasSubmittedProposal) {
    return NextResponse.json(
      { error: "Access denied to export this job record." },
      { status: 403 },
    );
  }

  const viewerRole = session.role as "CLIENT" | "PROFESSIONAL" | "ADMIN";

  // Negotiations
  const requestIds = job.projectRequests.map((r) => r.id);
  const negotiations = await db.projectNegotiation.findMany({
    where: { requestId: { in: requestIds } },
    orderBy: { createdAt: "asc" },
  });

  // Reviews if completed
  let reviewsData;
  if (trackingProject) {
    const review = await db.projectReview.findUnique({
      where: { trackingId: trackingProject.id },
    });
    if (review) {
      reviewsData = {
        clientRating: review.rating ? String(review.rating) : undefined,
        clientComment: review.comment || undefined,
        proRating: review.professionalRating ? String(review.professionalRating) : undefined,
        proComment: review.professionalComment || undefined,
      };
    }
  }

  // Filter proposals based on role (Client sees all; Pro sees their own; Admin sees all)
  const visibleRequests = job.projectRequests.filter((r) => {
    if (isAdmin || isOwner) return true;
    return r.professionalId === session.userId;
  });

  const proposals: DossierProposal[] = visibleRequests.map((r) => ({
    proName: `${r.professional.firstName} ${r.professional.lastName}`.trim(),
    bidAmount: formatMoney(r.bidAmount),
    duration: r.duration,
    status: r.status,
    submittedAt: formatDate(r.createdAt),
    coverLetter: r.coverLetter || undefined,
  }));

  const visibleNegotiations: DossierNegotiation[] = negotiations
    .filter((n) => {
      if (isAdmin || isOwner) return true;
      return n.professionalId === session.userId;
    })
    .map((n) => ({
      senderRole: n.senderRole,
      senderName: n.senderRole,
      bidAmount: formatMoney(n.bidAmount),
      previousBidAmount: n.previousBidAmount ? formatMoney(n.previousBidAmount) : undefined,
      duration: n.duration || undefined,
      message: n.message,
      createdAt: formatDate(n.createdAt),
    }));

  // Resolve milestones (prefer ProjectTracking milestones if present, else ClientJobMilestone)
  const milestones: DossierMilestone[] = trackingProject?.milestones?.length
    ? trackingProject.milestones.map((m, idx) => ({
        number: idx + 1,
        title: m.title,
        amount: formatMoney(m.amount),
        status: m.status,
        dueDate: formatDate(m.dueDate),
        approvedAt: formatDate(m.approvedAt),
        description: m.description || undefined,
      }))
    : job.milestones.map((m, idx) => ({
        number: idx + 1,
        title: m.title,
        amount: m.amount != null ? formatMoney(m.amount) : `${m.percentage}%`,
        percentage: `${m.percentage}%`,
        status: "PLANNED",
        description: m.description || undefined,
      }));

  // Payments
  const payments: DossierPayment[] = (trackingProject?.payments || []).map((p) => {
    let displayAmount = formatMoney(p.amount);
    if (viewerRole === "PROFESSIONAL" && p.professionalPayoutAmount != null) {
      displayAmount = formatMoney(p.professionalPayoutAmount);
    } else if (viewerRole === "CLIENT" && p.amount != null) {
      displayAmount = formatMoney(p.amount);
    }

    return {
      id: p.id,
      title: `Payment for milestone`,
      amount: displayAmount,
      status: p.status,
      paidAt: formatDate(p.createdAt),
    };
  });

  const clientName = `${job.user.firstName} ${job.user.lastName}`.trim();
  const proUser = trackingProject?.professional;
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : undefined;

  const dossierData: JobDossierData = {
    jobId: job.id,
    title: job.title || `Job #${job.id}`,
    status: job.status,
    category: job.category || "General",
    workMode: job.workMode,
    timingType: job.timingType,
    urgency: job.urgency,
    postedAt: formatDate(job.createdAt),
    jobDate: formatDate(job.jobDate),
    deadline: formatDate(job.deadline),
    budget:
      job.timingType === "HOURLY"
        ? `${formatMoney(job.hourlyRate)}/hr`
        : job.budgetMin && job.budgetMax
          ? `${formatMoney(job.budgetMin)} – ${formatMoney(job.budgetMax)}`
          : formatMoney(job.budgetMax || job.budgetMin),
    location: job.locationAddress || job.locationLabel || "Remote",
    description: job.description || undefined,
    viewerRole,
    generatedFor:
      viewerRole === "CLIENT"
        ? clientName
        : viewerRole === "PROFESSIONAL" && proName
          ? proName
          : "Klick-Pro Administrator",
    client: {
      name: clientName,
      role: "Client",
      company: job.user.companyName || undefined,
      email: isAdmin || isOwner ? job.user.email : undefined,
      phone: isAdmin || isOwner ? job.user.phone || undefined : undefined,
      location: job.user.address || undefined,
    },
    professional: proUser
      ? {
          name: proName || "Professional",
          role: "Professional",
          category: proUser.professionalCategory || undefined,
          location: proUser.professionalCity || undefined,
          email: isAdmin || isAssignedPro ? proUser.email : undefined,
          phone: isAdmin || isAssignedPro ? proUser.phone || undefined : undefined,
        }
      : undefined,
    projectStatus: trackingProject?.status,
    projectProgress: trackingProject ? `${trackingProject.progress}%` : undefined,
    completedAt: formatDate(trackingProject?.completedAt),
    proposals,
    negotiations: visibleNegotiations,
    milestones,
    payments,
    reviews: reviewsData,
  };

  const formatParam = request.nextUrl.searchParams.get("format")?.toLowerCase();

  if (formatParam === "csv") {
    // Generate CSV
    const csvHeaders = ["Field", "Value", "Additional Details"];

    const csvRows = [
      ["Job ID", `#JOB-${job.id}`, ""],
      ["Job Title", job.title || "", ""],
      ["Project Description", dossierData.description || "No description provided", ""],
      ["Status", job.status, trackingProject ? `Project status: ${trackingProject.status}` : ""],
      ["Category", job.category || "General", ""],
      ["Work Mode", job.workMode, ""],
      ["Timing Type", job.timingType, ""],
      ["Urgency", job.urgency, ""],
      ["Budget Estimate", dossierData.budget, ""],
      ["Location", dossierData.location, ""],
      ["Posted Date", dossierData.postedAt, ""],
      ["Deadline", dossierData.deadline || "Flexible", ""],
      ["Client Name", clientName, job.user.companyName || ""],
      ["Hired Professional", proName || "Not assigned", proUser?.professionalCategory || ""],
      ["Total Milestones", milestones.length, ""],
      ...milestones.map((m) => [`Milestone #${m.number}`, m.title, `${m.amount} (${m.status})`]),
      ["Total Proposals", proposals.length, ""],
      ...proposals.map((p) => [
        "Proposal Bid",
        p.proName,
        `${p.bidAmount} · Duration: ${p.duration} · Status: ${p.status}`,
      ]),
      ["Total Negotiations", visibleNegotiations.length, ""],
      ...visibleNegotiations.map((n) => [
        "Negotiation Round",
        `${n.senderRole}: ${n.bidAmount}`,
        n.message,
      ]),
      ["Total Payments", payments.length, ""],
      ...payments.map((p) => ["Payment Record", p.title, `${p.amount} · ${p.status}`]),
      ["Completed Date", dossierData.completedAt || "Not completed", ""],
    ];

    const csvContent = generateCsvContent({
      filename: `klick-pro-job-${job.id}-dossier`,
      title: `Job Dossier #${job.id} — ${job.title || "Untitled Job"}`,
      metadata: [
        { label: "Client", value: clientName },
        { label: "Viewer Role", value: viewerRole },
        { label: "Exported At", value: new Date().toISOString() },
      ],
      headers: csvHeaders,
      rows: csvRows,
    });

    return new NextResponse("\uFEFF" + csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="klick-pro-job-${job.id}-dossier.csv"`,
      },
    });
  }

  // PDF generation
  try {
    const buffer = await renderReportPdf(<JobDossierDocument data={dossierData} />);
    const safeTitle = (job.title || `job-${job.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 50);
    return pdfResponse(buffer, `klick-pro-job-${job.id}-${safeTitle}-dossier.pdf`);
  } catch (err) {
    console.error("Failed to render JobDossierDocument PDF:", err);
    return NextResponse.json({ error: "Failed to render PDF dossier." }, { status: 500 });
  }
}
