import { db } from "@/lib/db";
import { sanitizeCell } from "../csv/export-csv";
import { capitalizeWords, capitalizeFirst } from "@/lib/utils";
import type {
  JobDossierData,
  DossierParty,
  DossierProposal,
  DossierNegotiation,
  DossierMilestone,
  DossierPayment,
} from "./JobDossierDocument";

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(new Date(date));
  } catch {
    return "";
  }
}

function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return "Pending";
  return `INR ${amount.toLocaleString("en-IN")}`;
}

export async function fetchJobDossierData(
  jobId: number,
  session: { userId: number; role: string },
): Promise<JobDossierData | null> {
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

  if (!job) return null;

  const isOwner = job.userId === session.userId;
  const isAdmin = session.role === "ADMIN";
  const trackingProject = job.projectTrackings[0];
  const isAssignedPro = trackingProject?.professionalId === session.userId;
  const hasSubmittedProposal = job.projectRequests.some((r) => r.professionalId === session.userId);

  if (!isOwner && !isAdmin && !isAssignedPro && !hasSubmittedProposal) {
    return null;
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
        validityDays: m.validityDays ?? undefined,
        releaseAt: m.releaseAt ? formatDate(m.releaseAt) : undefined,
        paymentStatus: m.autoReleaseStatus || m.status,
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
      title: `Milestone settlement`,
      amount: displayAmount,
      status: p.status,
      paidAt: formatDate(p.createdAt),
    };
  });

  const clientName = `${job.user.firstName} ${job.user.lastName}`.trim();
  const proUser = trackingProject?.professional;
  const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : undefined;

  return {
    jobId: job.id,
    title: job.title || `Job #${job.id}`,
    status: job.status,
    category: job.category || "General",
    workMode: job.workMode,
    timingType: job.timingType,
    urgency: job.urgency,
    postedAt: formatDate(job.createdAt),
    hiredAt: trackingProject?.acceptedAt ? formatDate(trackingProject.acceptedAt) : undefined,
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
}

export async function fetchBatchJobDossierData(
  jobIds: number[],
  session: { userId: number; role: string },
): Promise<JobDossierData[]> {
  if (!jobIds || jobIds.length === 0) return [];

  const isAdmin = session.role === "ADMIN";
  const viewerRole = session.role as "CLIENT" | "PROFESSIONAL" | "ADMIN";

  const jobs = await db.clientJob.findMany({
    where: { id: { in: jobIds } },
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

  const allRequestIds: number[] = [];
  const allTrackingIds: number[] = [];

  for (const j of jobs) {
    for (const r of j.projectRequests) {
      allRequestIds.push(r.id);
    }
    for (const t of j.projectTrackings) {
      allTrackingIds.push(t.id);
    }
  }

  const [allNegotiations, allReviews] = await Promise.all([
    allRequestIds.length > 0
      ? db.projectNegotiation.findMany({
          where: { requestId: { in: allRequestIds } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    allTrackingIds.length > 0
      ? db.projectReview.findMany({
          where: { trackingId: { in: allTrackingIds } },
        })
      : Promise.resolve([]),
  ]);

  const negotiationsByRequestId = new Map<number, typeof allNegotiations>();
  for (const neg of allNegotiations) {
    const list = negotiationsByRequestId.get(neg.requestId) ?? [];
    list.push(neg);
    negotiationsByRequestId.set(neg.requestId, list);
  }

  const reviewByTrackingId = new Map<number, (typeof allReviews)[0]>();
  for (const rev of allReviews) {
    reviewByTrackingId.set(rev.trackingId, rev);
  }

  const jobMap = new Map<number, JobDossierData>();

  for (const job of jobs) {
    const isOwner = job.userId === session.userId;
    const trackingProject = job.projectTrackings[0];
    const isAssignedPro = trackingProject?.professionalId === session.userId;
    const hasSubmittedProposal = job.projectRequests.some((r) => r.professionalId === session.userId);

    if (!isOwner && !isAdmin && !isAssignedPro && !hasSubmittedProposal) {
      continue;
    }

    const review = trackingProject ? reviewByTrackingId.get(trackingProject.id) : undefined;
    const reviewsData = review
      ? {
          clientRating: review.rating ? String(review.rating) : undefined,
          clientComment: review.comment || undefined,
          proRating: review.professionalRating ? String(review.professionalRating) : undefined,
          proComment: review.professionalComment || undefined,
        }
      : undefined;

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

    const jobNegotiations: DossierNegotiation[] = [];
    for (const req of visibleRequests) {
      const negs = negotiationsByRequestId.get(req.id) ?? [];
      for (const n of negs) {
        jobNegotiations.push({
          senderRole: n.senderRole,
          senderName: n.senderRole,
          bidAmount: formatMoney(n.bidAmount),
          previousBidAmount: n.previousBidAmount ? formatMoney(n.previousBidAmount) : undefined,
          duration: n.duration || undefined,
          message: n.message,
          createdAt: formatDate(n.createdAt),
        });
      }
    }

    const milestones: DossierMilestone[] = trackingProject?.milestones?.length
      ? trackingProject.milestones.map((m, idx) => ({
          number: idx + 1,
          title: m.title,
          amount: formatMoney(m.amount),
          status: m.status,
          dueDate: formatDate(m.dueDate),
          approvedAt: formatDate(m.approvedAt),
          description: m.description || undefined,
          validityDays: m.validityDays ?? undefined,
          releaseAt: m.releaseAt ? formatDate(m.releaseAt) : undefined,
          paymentStatus: m.autoReleaseStatus || m.status,
        }))
      : job.milestones.map((m, idx) => ({
          number: idx + 1,
          title: m.title,
          amount: m.amount != null ? formatMoney(m.amount) : `${m.percentage}%`,
          percentage: `${m.percentage}%`,
          status: "PLANNED",
          description: m.description || undefined,
        }));

    const payments: DossierPayment[] = (trackingProject?.payments || []).map((p) => {
      let displayAmount = formatMoney(p.amount);
      if (viewerRole === "PROFESSIONAL" && p.professionalPayoutAmount != null) {
        displayAmount = formatMoney(p.professionalPayoutAmount);
      } else if (viewerRole === "CLIENT" && p.amount != null) {
        displayAmount = formatMoney(p.amount);
      }

      return {
        id: p.id,
        title: `Milestone settlement`,
        amount: displayAmount,
        status: p.status,
        paidAt: formatDate(p.createdAt),
      };
    });

    const clientName = `${job.user.firstName} ${job.user.lastName}`.trim();
    const proUser = trackingProject?.professional;
    const proName = proUser ? `${proUser.firstName} ${proUser.lastName}`.trim() : undefined;

    jobMap.set(job.id, {
      jobId: job.id,
      title: job.title || `Job #${job.id}`,
      status: job.status,
      category: job.category || "General",
      workMode: job.workMode,
      timingType: job.timingType,
      urgency: job.urgency,
      postedAt: formatDate(job.createdAt),
      hiredAt: trackingProject?.acceptedAt ? formatDate(trackingProject.acceptedAt) : undefined,
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
      negotiations: jobNegotiations,
      milestones,
      payments,
      reviews: reviewsData,
    });
  }

  return jobIds.map((id) => jobMap.get(id)).filter((item): item is JobDossierData => item != null);
}

export function generateJobDossierCsv(data: JobDossierData): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  // Header Title
  lines.push(sanitizeCell(`Klick-Pro · Official Project Dossier Statement #JOB-${data.jobId}`));
  lines.push(sanitizeCell(`Generated Date: ${dateStr}, ${timeStr} IST`));
  lines.push('""');

  // Section 1: Executive Overview Key-Values
  lines.push([sanitizeCell("Section"), sanitizeCell("Executive Overview & Specifications")].join(","));
  const overviewPairs: [string, string][] = [
    ["Job Reference", `#JOB-${data.jobId}`],
    ["Project Title", capitalizeWords(data.title)],
    ["Marketplace Status", capitalizeWords(data.status)],
    ["Project Execution Status", capitalizeWords(data.projectStatus || data.status)],
    ["Execution Progress", data.projectProgress || (data.status === "COMPLETED" ? "100%" : "0%")],
    ["Category", capitalizeWords(data.category)],
    ["Work Mode", capitalizeWords(data.workMode)],
    ["Timing Type", capitalizeWords(data.timingType)],
    ["Urgency", capitalizeWords(data.urgency)],
    ["Budget Estimate / Rate", data.budget],
    ["Location", capitalizeWords(data.location)],
    ["Date Posted", data.postedAt],
    ["Deadline / Scheduled Date", data.deadline || data.jobDate || "Flexible"],
    ["Completed Date", data.completedAt || (data.status === "COMPLETED" ? "Completed" : "In Progress / Pending")],
    ["Client Name", capitalizeWords(data.client.name)],
    ["Client Email", data.client.email || "—"],
    ["Client Phone", data.client.phone || "—"],
    ["Client Company", data.client.company ? capitalizeWords(data.client.company) : "Individual"],
    ["Client Location / Address", data.client.location ? capitalizeWords(data.client.location) : "—"],
    ["Hired Professional", data.professional?.name ? capitalizeWords(data.professional.name) : "Not Assigned / Open"],
    ["Professional Specialization", data.professional?.category ? capitalizeWords(data.professional.category) : "—"],
    ["Professional Email", data.professional?.email || "—"],
    ["Professional Phone", data.professional?.phone || "—"],
    ["Professional City", data.professional?.location ? capitalizeWords(data.professional.location) : "—"],
    ["Hired Date", data.hiredAt || "—"],
    ["Scope of Work / Description", capitalizeFirst(data.description || "No description provided")],
  ];

  for (const [k, v] of overviewPairs) {
    lines.push([sanitizeCell(k), sanitizeCell(v)].join(","));
  }
  lines.push('""');

  // Section 2: Milestones Breakdown
  lines.push([sanitizeCell("Section"), sanitizeCell(`Contract Milestones (${data.milestones.length})`)].join(","));
  lines.push(
    [
      sanitizeCell("Milestone #"),
      sanitizeCell("Milestone Title"),
      sanitizeCell("Amount"),
      sanitizeCell("Status"),
      sanitizeCell("Validity Window"),
      sanitizeCell("Settled / Due Date"),
      sanitizeCell("Description"),
    ].join(","),
  );
  if (data.milestones.length === 0) {
    lines.push([sanitizeCell("—"), sanitizeCell("No formal milestones created yet"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—")].join(","));
  } else {
    for (const m of data.milestones) {
      lines.push(
        [
          sanitizeCell(m.number),
          sanitizeCell(capitalizeWords(m.title)),
          sanitizeCell(m.amount),
          sanitizeCell(capitalizeWords(m.status)),
          sanitizeCell(m.validityDays ? `${m.validityDays} Days hold` : "Standard"),
          sanitizeCell(m.approvedAt || m.releaseAt || m.dueDate || "—"),
          sanitizeCell(capitalizeFirst(m.description || "—")),
        ].join(","),
      );
    }
  }
  lines.push('""');

  // Section 3: Proposals & Bids
  lines.push([sanitizeCell("Section"), sanitizeCell(`Proposals & Bids (${data.proposals.length})`)].join(","));
  lines.push(
    [
      sanitizeCell("Professional Name"),
      sanitizeCell("Offered Bid"),
      sanitizeCell("Estimated Duration"),
      sanitizeCell("Proposal Status"),
      sanitizeCell("Submission Date"),
      sanitizeCell("Cover Letter"),
    ].join(","),
  );
  if (data.proposals.length === 0) {
    lines.push([sanitizeCell("—"), sanitizeCell("No proposals submitted"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—")].join(","));
  } else {
    for (const p of data.proposals) {
      lines.push(
        [
          sanitizeCell(capitalizeWords(p.proName)),
          sanitizeCell(p.bidAmount),
          sanitizeCell(p.duration),
          sanitizeCell(capitalizeWords(p.status)),
          sanitizeCell(p.submittedAt),
          sanitizeCell(capitalizeFirst(p.coverLetter || "—")),
        ].join(","),
      );
    }
  }
  lines.push('""');

  // Section 4: Negotiations
  if (data.negotiations.length > 0) {
    lines.push([sanitizeCell("Section"), sanitizeCell(`Negotiation & Counter-Offers (${data.negotiations.length})`)].join(","));
    lines.push(
      [
        sanitizeCell("Sender Role"),
        sanitizeCell("Offered Bid"),
        sanitizeCell("Previous Bid"),
        sanitizeCell("Negotiation Message"),
        sanitizeCell("Date"),
      ].join(","),
    );
    for (const n of data.negotiations) {
      lines.push(
        [
          sanitizeCell(capitalizeWords(n.senderRole)),
          sanitizeCell(n.bidAmount),
          sanitizeCell(n.previousBidAmount || "—"),
          sanitizeCell(capitalizeFirst(n.message)),
          sanitizeCell(n.createdAt),
        ].join(","),
      );
    }
    lines.push('""');
  }

  // Section 5: Financial Settlements & Payments
  lines.push([sanitizeCell("Section"), sanitizeCell(`Financial Settlements & Payments (${data.payments.length})`)].join(","));
  lines.push(
    [
      sanitizeCell("Transaction Reference"),
      sanitizeCell("Description"),
      sanitizeCell("Amount"),
      sanitizeCell("Status"),
      sanitizeCell("Settlement Date"),
    ].join(","),
  );
  if (data.payments.length === 0) {
    lines.push([sanitizeCell("—"), sanitizeCell("No payment settlements recorded"), sanitizeCell("—"), sanitizeCell("—"), sanitizeCell("—")].join(","));
  } else {
    for (const p of data.payments) {
      lines.push(
        [
          sanitizeCell(`#TXN-${p.id}`),
          sanitizeCell(capitalizeWords(p.title)),
          sanitizeCell(p.amount),
          sanitizeCell(capitalizeWords(p.status)),
          sanitizeCell(p.paidAt || "—"),
        ].join(","),
      );
    }
  }
  lines.push('""');

  // Section 6: Project Verification & Reviews
  lines.push([sanitizeCell("Section"), sanitizeCell("Project Delivery Verification & Reviews")].join(","));
  lines.push(
    [
      sanitizeCell("Party"),
      sanitizeCell("Rating (out of 5)"),
      sanitizeCell("Feedback Comment"),
      sanitizeCell("Execution Status"),
    ].join(","),
  );
  lines.push(
    [
      sanitizeCell("Client Review"),
      sanitizeCell(data.reviews?.clientRating ? `${data.reviews.clientRating} / 5` : "Not Reviewed"),
      sanitizeCell(capitalizeFirst(data.reviews?.clientComment || "—")),
      sanitizeCell(data.status === "COMPLETED" ? "Verified" : "Pending"),
    ].join(","),
  );
  lines.push(
    [
      sanitizeCell("Professional Review"),
      sanitizeCell(data.reviews?.proRating ? `${data.reviews.proRating} / 5` : "Not Reviewed"),
      sanitizeCell(capitalizeFirst(data.reviews?.proComment || "—")),
      sanitizeCell(data.status === "COMPLETED" ? "Verified" : "Pending"),
    ].join(","),
  );

  return lines.join("\r\n");
}

export function generateJobsBatchCsv(dossiers: JobDossierData[]): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  lines.push(sanitizeCell(`Klick-Pro · Complete Marketplace Jobs & Project Operations Audit (${dossiers.length} Projects)`));
  lines.push(sanitizeCell(`Generated Date: ${dateStr}, ${timeStr} IST`));
  lines.push('""');

  const headers = [
    "Job ID",
    "Project Title",
    "Category",
    "Marketplace Status",
    "Project Execution Status",
    "Execution Progress",
    "Date Posted",
    "Target Date / Deadline",
    "Completed Date",
    "Work Mode",
    "Timing Type",
    "Urgency",
    "Budget Estimate / Rate",
    "Location",
    "Client Name",
    "Client Email",
    "Client Phone",
    "Client Company",
    "Client Address",
    "Hired Professional",
    "Professional Specialization",
    "Professional Email",
    "Professional Phone",
    "Professional City",
    "Hired Date",
    "Total Proposals Count",
    "Total Milestones Count",
    "Completed Milestones Count",
    "Milestones Detail Breakdown",
    "Total Payments Count",
    "Total Amount Settled / Paid",
    "Payments Detail Breakdown",
    "Client Rating",
    "Client Feedback",
    "Professional Rating",
    "Professional Feedback",
    "Scope Description",
  ];

  lines.push(headers.map(sanitizeCell).join(","));

  for (const d of dossiers) {
    const completedMilestones = d.milestones.filter(
      (m) => m.status.toUpperCase() === "COMPLETED" || m.status.toUpperCase() === "RELEASED",
    ).length;

    const milestonesBreakdown = d.milestones.length > 0
      ? d.milestones.map((m) => `M${m.number}: ${capitalizeWords(m.title)} (${m.amount} - ${capitalizeWords(m.status)})`).join(" | ")
      : "No milestones created";

    const paymentsBreakdown = d.payments.length > 0
      ? d.payments.map((p) => `#TXN-${p.id}: ${p.amount} (${capitalizeWords(p.status)})`).join(" | ")
      : "No payments recorded";

    const row = [
      `#JOB-${d.jobId}`,
      capitalizeWords(d.title),
      capitalizeWords(d.category),
      capitalizeWords(d.status),
      capitalizeWords(d.projectStatus || d.status),
      d.projectProgress || (d.status === "COMPLETED" ? "100%" : "0%"),
      d.postedAt,
      d.deadline || d.jobDate || "Flexible",
      d.completedAt || (d.status === "COMPLETED" ? "Completed" : "In Progress / Pending"),
      capitalizeWords(d.workMode),
      capitalizeWords(d.timingType),
      capitalizeWords(d.urgency),
      d.budget,
      capitalizeWords(d.location),
      capitalizeWords(d.client.name),
      d.client.email || "—",
      d.client.phone || "—",
      d.client.company ? capitalizeWords(d.client.company) : "Individual",
      d.client.location ? capitalizeWords(d.client.location) : "—",
      d.professional?.name ? capitalizeWords(d.professional.name) : "Not Assigned / Open",
      d.professional?.category ? capitalizeWords(d.professional.category) : "—",
      d.professional?.email || "—",
      d.professional?.phone || "—",
      d.professional?.location ? capitalizeWords(d.professional.location) : "—",
      d.hiredAt || "—",
      d.proposals.length,
      d.milestones.length,
      completedMilestones,
      milestonesBreakdown,
      d.payments.length,
      d.payments.length > 0 ? d.payments.map((p) => p.amount).join(" + ") : "₹0",
      paymentsBreakdown,
      d.reviews?.clientRating ? `${d.reviews.clientRating} / 5` : "Not Reviewed",
      capitalizeFirst(d.reviews?.clientComment || "—"),
      d.reviews?.proRating ? `${d.reviews.proRating} / 5` : "Not Reviewed",
      capitalizeFirst(d.reviews?.proComment || "—"),
      capitalizeFirst(d.description || "No description provided"),
    ];

    lines.push(row.map(sanitizeCell).join(","));
  }

  return lines.join("\r\n");
}
