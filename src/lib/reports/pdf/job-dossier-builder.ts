import { db } from "@/lib/db";
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
