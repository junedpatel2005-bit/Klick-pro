import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { sessionCookie, verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  approximateAddress,
  createDisplayPoint,
  getDistanceBoundingBox,
  getDistanceKm,
} from "@/lib/geo";
import { attachLastActorRole } from "@/lib/project-request-actions";
import { inferLocationFromAddress } from "@/lib/india-locations";

async function sessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

function milestoneProgress(status: string, paymentStatus?: string) {
  if (status === "APPROVED" || paymentStatus === "COMPLETED") return 100;
  if (status === "SUBMITTED") return 75;
  if (status === "IN_PROGRESS") return 50;
  return 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { resource } = await params;
  try {
    if (resource === "notifications") {
      const notifications = await db.userNotification.findMany({
        where: {
          userId: session.userId,
          clearedAt: null,
          type: {
            notIn: ["PROPOSAL_SENT", "PROPOSAL_UPDATE_SENT", "HIRE_REQUEST_SENT"],
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const projectIdFor = (href: string | null) => {
        if (!href) return null;
        const pathMatch = href.match(/^\/project\/(\d+)/);
        if (pathMatch) return Number(pathMatch[1]);
        const queryMatch = href.match(/[?&]project=(\d+)(?:&|$)/);
        if (queryMatch) return Number(queryMatch[1]);
        const tabProjectMatch = href.match(/[?&]tab=projects&id=(\d+)(?:&|$)/);
        if (tabProjectMatch) return Number(tabProjectMatch[1]);
        return null;
      };
      const jobIdFor = (href: string | null) => {
        if (!href) return null;
        const jobPathMatch = href.match(/^\/job\/(\d+)/);
        if (jobPathMatch) return Number(jobPathMatch[1]);
        const queryMatch = href.match(/[?&]job=(\d+)(?:&|$)/);
        if (queryMatch) return Number(queryMatch[1]);
        const tabJobMatch = href.match(/[?&]tab=jobs&id=(\d+)(?:&|$)/);
        if (tabJobMatch) return Number(tabJobMatch[1]);
        return null;
      };
      const legacyDisputeIds = notifications.flatMap((notification) => {
        const match = notification.href?.match(/[?&]dispute=(\d+)(?:&|$)/);
        return match ? [Number(match[1])] : [];
      });
      const [disputes, milestones, allRecentJobs] = await Promise.all([
        db.projectDispute.findMany({
          where: { id: { in: legacyDisputeIds } },
          select: { id: true, trackingId: true },
        }),
        db.projectMilestone.findMany({
          select: { title: true, trackingId: true },
        }),
        db.clientJob.findMany({
          take: 100,
          orderBy: { id: "desc" },
          select: { id: true, title: true },
        }),
      ]);
      const disputeProjectMap = new Map(
        disputes.map((dispute) => [dispute.id, dispute.trackingId]),
      );
      const resolvedProjectIdFor = (notification: (typeof notifications)[number]) => {
        const directProjectId = projectIdFor(notification.href);
        if (directProjectId) return directProjectId;
        const disputeId = notification.href?.match(/[?&]dispute=(\d+)(?:&|$)/)?.[1];
        if (disputeId && disputeProjectMap.has(Number(disputeId))) {
          return disputeProjectMap.get(Number(disputeId)) ?? null;
        }
        if (notification.type.includes("MILESTONE") || notification.type.includes("PAYOUT")) {
          const text = `${notification.title} ${notification.description ?? ""}`;
          return milestones.find((milestone) => text.includes(milestone.title))?.trackingId ?? null;
        }
        return null;
      };
      const projectIds = notifications.flatMap((notification) => {
        const projectId = resolvedProjectIdFor(notification);
        return projectId ? [projectId] : [];
      });
      const directJobIds = notifications.flatMap((notification) => {
        const jobId = jobIdFor(notification.href);
        return jobId ? [jobId] : [];
      });
      const [projects, directJobs] = await Promise.all([
        db.projectTracking.findMany({
          where: {
            OR: [
              ...(projectIds.length > 0 ? [{ id: { in: projectIds } }] : []),
              ...(directJobIds.length > 0 ? [{ jobId: { in: directJobIds } }] : []),
            ],
          },
          include: {
            job: { select: { id: true, title: true, category: true, description: true } },
            client: { select: { firstName: true, lastName: true } },
            professional: { select: { firstName: true, lastName: true } },
            milestones: { select: { title: true } },
          },
        }),
        db.clientJob.findMany({
          where: { id: { in: directJobIds } },
          select: {
            id: true,
            title: true,
            category: true,
            description: true,
            user: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);
      const jobToProjectTrackingMap = new Map<number, (typeof projects)[number]>();
      const projectToJobIdMap = new Map<number, number>();
      for (const p of projects) {
        if (p.jobId) {
          jobToProjectTrackingMap.set(p.jobId, p);
          projectToJobIdMap.set(p.id, p.jobId);
        }
        if (p.job?.id) {
          jobToProjectTrackingMap.set(p.job.id, p);
          projectToJobIdMap.set(p.id, p.job.id);
        }
      }
      const jobMap = new Map<number, string | null>();
      const jobClientMap = new Map<number, string>();
      for (const job of allRecentJobs) {
        if (job.title?.trim()) jobMap.set(job.id, job.title.trim());
      }
      for (const job of directJobs) {
        const title = job.title?.trim() || job.category?.trim() || null;
        if (title) jobMap.set(job.id, title);
        const clientName = `${job.user.firstName} ${job.user.lastName}`.trim();
        if (clientName) jobClientMap.set(job.id, clientName);
      }
      for (const project of projects) {
        if (project.job) {
          const title = project.job.title?.trim() || project.job.category?.trim() || null;
          if (title) jobMap.set(project.job.id, title);
          const clientName = `${project.client.firstName} ${project.client.lastName}`.trim();
          if (clientName) jobClientMap.set(project.job.id, clientName);
        }
      }
      const projectMap = new Map<number, string | null>();
      for (const project of projects) {
        const title =
          project.job?.title?.trim() ||
          project.job?.category?.trim() ||
          (project.job?.description?.trim() ? project.job.description.trim().slice(0, 45) : null) ||
          project.milestones[0]?.title?.trim() ||
          null;
        projectMap.set(project.id, title);
      }

      return NextResponse.json(
        notifications.map((notification) => {
          let projectId = resolvedProjectIdFor(notification);
          let jobId = jobIdFor(notification.href);

          if (!projectId && jobId && jobToProjectTrackingMap.has(jobId)) {
            projectId = jobToProjectTrackingMap.get(jobId)!.id;
          }
          if (!jobId && projectId && projectToJobIdMap.has(projectId)) {
            jobId = projectToJobIdMap.get(projectId)!;
          }

          const matchedProject =
            (projectId ? projects.find((item) => item.id === projectId) : null) ??
            (jobId ? jobToProjectTrackingMap.get(jobId) : null) ??
            null;

          const hasProjectOrProposalEngagement =
            projectId !== null ||
            notification.type.startsWith("PROJECT_") ||
            notification.type.startsWith("MILESTONE_") ||
            notification.type.startsWith("DISPUTE_") ||
            notification.type.startsWith("REVISION_") ||
            notification.type.startsWith("WORK_") ||
            notification.type.startsWith("PROPOSAL_") ||
            notification.type.startsWith("NEW_PROPOSAL") ||
            notification.type.startsWith("REQUEST_") ||
            notification.type.startsWith("COUNTER_") ||
            notification.type.startsWith("OFFER_");

          const isProjectOrJob =
            hasProjectOrProposalEngagement || (jobId !== null && projectId !== null);

          const desc = `${notification.title} ${notification.description ?? ""}`;

          let resolvedTitle: string | null = null;
          if (matchedProject?.job?.title?.trim()) {
            resolvedTitle = matchedProject.job.title.trim();
          } else if (projectId && projectMap.get(projectId)) {
            resolvedTitle = projectMap.get(projectId)!;
          } else if (jobId && jobMap.get(jobId)) {
            resolvedTitle = jobMap.get(jobId)!;
          }

          if (!resolvedTitle) {
            const proposalMatch = desc.match(/sent a proposal for\s+(.+?)\.?$/i);
            if (
              proposalMatch &&
              proposalMatch[1] &&
              !proposalMatch[1].toLowerCase().startsWith("job #")
            ) {
              resolvedTitle = proposalMatch[1].trim();
            } else {
              const descOnly = notification.description ?? "";
              const newJobMatch = descOnly.match(/^(.+?)\s+is now open/i);
              if (newJobMatch && newJobMatch[1]) {
                resolvedTitle = newJobMatch[1].replace(/^New job posted\s+/i, "").trim();
              } else {
                const disputeMatch = desc.match(/dispute on\s+(.+?)\.?$/i);
                if (disputeMatch && disputeMatch[1]) {
                  resolvedTitle = disputeMatch[1].trim();
                } else {
                  const milestoneMatch = desc.match(
                    /(?:for|on)\s+(.+?)\s+(?:has been|is funded|was released|is waiting)/i,
                  );
                  if (milestoneMatch && milestoneMatch[1]) {
                    resolvedTitle = milestoneMatch[1].trim();
                  }
                }
              }
            }
          }

          if (!resolvedTitle) {
            for (const [, jTitle] of jobMap) {
              if (jTitle && desc.includes(jTitle)) {
                resolvedTitle = jTitle;
                break;
              }
            }
          }

          if (resolvedTitle?.toLowerCase().startsWith("new job posted ")) {
            resolvedTitle = resolvedTitle.slice(15).trim();
          }

          if (!resolvedTitle && isProjectOrJob) {
            if (projectId) resolvedTitle = `Project #${projectId}`;
            else if (jobId) resolvedTitle = `Job #${jobId}`;
          }

          let clientName: string | null = null;
          if (matchedProject) {
            clientName =
              `${matchedProject.client.firstName} ${matchedProject.client.lastName}`.trim() || null;
          } else if (jobId && jobClientMap.has(jobId)) {
            clientName = jobClientMap.get(jobId) ?? null;
          }

          let professionalName: string | null = null;
          if (matchedProject) {
            professionalName =
              `${matchedProject.professional.firstName} ${matchedProject.professional.lastName}`.trim() ||
              null;
          }

          return {
            ...notification,
            projectId,
            jobId,
            isProject: isProjectOrJob,
            projectTitle: resolvedTitle,
            clientName,
            professionalName,
          };
        }),
      );
    }
    if (resource === "earnings") {
      if (!["PROFESSIONAL", "CLIENT"].includes(session.role))
        return NextResponse.json({ error: "Account access required." }, { status: 403 });
      const transactions = await db.projectTransaction.findMany({
        where:
          session.role === "PROFESSIONAL"
            ? { professionalId: session.userId }
            : { clientId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      const payments = await db.payment.findMany({
        where: {
          milestoneId: {
            in: transactions
              .map((transaction) => transaction.milestoneId)
              .filter((id): id is number => id !== null),
          },
          status: "COMPLETED",
        },
        select: { id: true, milestoneId: true },
      });
      const paymentByMilestone = new Map(
        payments.map((payment) => [payment.milestoneId, payment.id]),
      );
      return NextResponse.json(
        transactions.map((transaction) => ({
          ...transaction,
          invoicePaymentId: transaction.milestoneId
            ? (paymentByMilestone.get(transaction.milestoneId) ?? null)
            : null,
        })),
      );
    }
    if (resource === "messages")
      return NextResponse.json(
        await db.messageConversation.findMany({
          where: { OR: [{ clientId: session.userId }, { professionalId: session.userId }] },
          orderBy: { lastMessageAt: "desc" },
          take: 50,
          include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
        }),
      );
    if (resource === "reviews") {
      if (session.role !== "PROFESSIONAL")
        return NextResponse.json({ error: "Professional access required." }, { status: 403 });
      const reviews = await db.projectReview.findMany({
        where: { professionalId: session.userId },
        orderBy: { createdAt: "desc" },
      });
      const [clients, projects] = await Promise.all([
        db.user.findMany({
          where: { id: { in: [...new Set(reviews.map((review) => review.clientId))] } },
          select: { id: true, firstName: true, lastName: true },
        }),
        db.projectTracking.findMany({
          where: { id: { in: reviews.map((review) => review.trackingId) } },
          select: { id: true, job: { select: { id: true, title: true } } },
        }),
      ]);
      const clientMap = new Map(
        clients.map((client) => [client.id, `${client.firstName} ${client.lastName}`.trim()]),
      );
      const projectMap = new Map(projects.map((project) => [project.id, project]));
      return NextResponse.json(
        reviews.map((review) => ({
          id: review.id,
          trackingId: review.trackingId,
          rating: review.rating,
          comment: review.comment,
          professionalResponse: review.professionalResponse,
          clientName: clientMap.get(review.clientId) ?? null,
          projectId: projectMap.get(review.trackingId)?.job.id ?? null,
          projectTitle: projectMap.get(review.trackingId)?.job.title ?? null,
          createdAt: review.createdAt.toISOString(),
        })),
      );
    }
    if (resource === "professional-jobs") {
      if (session.role !== "PROFESSIONAL")
        return NextResponse.json({ error: "Professional access required." }, { status: 403 });

      const professional = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          firstName: true,
          lastName: true,
          avatarUrl: true,
          professionalCategory: true,
          professionalCity: true,
          averageRating: true,
          reviewCount: true,
          isVerified: true,
          availabilityStatus: true,
          experienceYears: true,
          professionalLatitude: true,
          professionalLongitude: true,
          serviceRadiusKm: true,
        },
      });
      const hasServiceArea =
        professional?.professionalLatitude != null &&
        professional?.professionalLongitude != null &&
        professional?.serviceRadiusKm != null;
      const bbox = hasServiceArea
        ? getDistanceBoundingBox(
            professional!.professionalLatitude!,
            professional!.serviceRadiusKm!,
          )
        : null;

      const blockedJobs = await db.$transaction(async (tx) => {
        const [trackingJobs, acceptedRequests] = await Promise.all([
          tx.projectTracking.findMany({
            where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            select: { jobId: true },
          }),
          tx.projectRequest.findMany({
            where: { status: "ACCEPTED" },
            select: { jobId: true },
          }),
        ]);
        return new Set([
          ...trackingJobs.map((job) => job.jobId),
          ...acceptedRequests.map((request) => request.jobId),
        ]);
      });
      const availabilityFilter: Prisma.ClientJobWhereInput = bbox
        ? {
            OR: [
              { workMode: { in: ["REMOTE", "BOTH"] } },
              { locationLat: null },
              {
                locationLat: {
                  gte: professional!.professionalLatitude! - bbox.latDelta,
                  lte: professional!.professionalLatitude! + bbox.latDelta,
                },
                locationLng: {
                  gte: professional!.professionalLongitude! - bbox.lngDelta,
                  lte: professional!.professionalLongitude! + bbox.lngDelta,
                },
              },
            ],
          }
        : {};

      const [openJobs, savedJobs, proposals, offers, activeProjects, completedProjects] =
        await Promise.all([
          db.clientJob.findMany({
            where: {
              status: "OPEN",
              id: { notIn: [...blockedJobs] },
              AND: [
                { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
                { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
                availabilityFilter,
              ],
            },
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  averageRating: true,
                  isVerified: true,
                },
              },
            },
          }),
          db.favoriteJob.findMany({
            where: {
              userId: session.userId,
              job: {
                status: "OPEN",
                AND: [
                  { OR: [{ jobDate: null }, { jobDate: { lte: new Date() } }] },
                  { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] },
                ],
              },
            },
            take: 20,
            include: {
              job: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      averageRating: true,
                      isVerified: true,
                    },
                  },
                },
              },
            },
          }),
          db.projectRequest.findMany({
            where: { professionalId: session.userId, origin: "PROFESSIONAL_PROPOSAL" },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
          db.projectRequest.findMany({
            where: { professionalId: session.userId, origin: "CLIENT_HIRE" },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
          db.projectTracking.findMany({
            where: { professionalId: session.userId, status: { not: "COMPLETED" } },
            orderBy: { acceptedAt: "desc" },
            take: 20,
            include: {
              milestones: {
                orderBy: { createdAt: "asc" },
                include: { payment: { select: { status: true } } },
              },
            },
          }),
          db.projectTracking.findMany({
            where: { professionalId: session.userId, status: "COMPLETED" },
            orderBy: { completedAt: "desc" },
            take: 20,
          }),
        ]);

      // Revision requests are actionable for professionals. Keep them first so the dashboard
      // preview does not hide a project that needs the professional's response.
      activeProjects.sort(
        (a, b) =>
          Number(b.status === "REVISION_REQUESTED") - Number(a.status === "REVISION_REQUESTED"),
      );

      const hiddenJobIds = blockedJobs;

      function distanceKmFor(locationLat: number | null, locationLng: number | null) {
        if (
          !hasServiceArea ||
          locationLat === null ||
          locationLng === null ||
          professional?.professionalLatitude == null ||
          professional?.professionalLongitude == null
        )
          return null;
        return (
          Math.round(
            getDistanceKm(
              professional.professionalLatitude,
              professional.professionalLongitude,
              locationLat,
              locationLng,
            ) * 10,
          ) / 10
        );
      }

      const visibleOpenJobs = openJobs
        .filter((job) => !hiddenJobIds.has(job.id))
        .map((job) => ({ ...job, distanceKm: distanceKmFor(job.locationLat, job.locationLng) }))
        .filter(
          (job) =>
            ["REMOTE", "BOTH"].includes(job.workMode) ||
            job.distanceKm === null ||
            job.distanceKm <= (professional?.serviceRadiusKm ?? Infinity),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const visibleSavedJobs = savedJobs
        .filter((favorite) => !hiddenJobIds.has(favorite.job.id))
        .map((favorite) => ({
          ...favorite,
          distanceKm: distanceKmFor(favorite.job.locationLat, favorite.job.locationLng),
        }));

      const clientIds = [
        ...new Set([
          ...visibleOpenJobs.map((job) => job.userId),
          ...visibleSavedJobs.map((favorite) => favorite.job.userId),
          ...proposals.map((request) => request.clientId),
          ...activeProjects.map((project) => project.clientId),
          ...completedProjects.map((project) => project.clientId),
          ...offers.map((request) => request.clientId),
        ]),
      ];
      const clients = await db.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const clientMap = new Map(
        clients.map((client) => [client.id, `${client.firstName} ${client.lastName}`.trim()]),
      );

      const jobIds = [
        ...new Set([
          ...visibleOpenJobs.map((job) => job.id),
          ...visibleSavedJobs.map((favorite) => favorite.jobId),
          ...proposals.map((request) => request.jobId),
          ...activeProjects.map((project) => project.jobId),
          ...completedProjects.map((project) => project.jobId),
          ...offers.map((request) => request.jobId),
        ]),
      ];
      const jobs = await db.clientJob.findMany({
        where: { id: { in: jobIds } },
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          locationAddress: true,
          locationState: true,
          locationDistrict: true,
          budgetMin: true,
          budgetMax: true,
          hourlyRate: true,
          timingType: true,
          deadline: true,
        },
      });
      const jobMap = new Map(jobs.map((job) => [job.id, job]));
      const activeJobIds = new Set(activeProjects.map((project) => project.jobId));
      const [visibleProposals, visibleOffers] = await Promise.all([
        attachLastActorRole(proposals.filter((request) => !activeJobIds.has(request.jobId))),
        attachLastActorRole(offers.filter((request) => !activeJobIds.has(request.jobId))),
      ]);

      const favoriteCounts = await db.favoriteJob.groupBy({
        by: ["jobId"],
        where: {
          jobId: {
            in: [
              ...new Set([
                ...visibleOpenJobs.map((job) => job.id),
                ...visibleSavedJobs.map((favorite) => favorite.job.id),
              ]),
            ],
          },
        },
        _count: { _all: true },
      });
      const favoriteCountMap = new Map(
        favoriteCounts.map((entry) => [entry.jobId, entry._count._all]),
      );

      return NextResponse.json({
        professional,
        openJobs: visibleOpenJobs
          .filter((job) => !activeJobIds.has(job.id))
          .map((job) => {
            const displayPoint =
              job.locationLat !== null && job.locationLng !== null
                ? createDisplayPoint(job.id, job.locationLat, job.locationLng)
                : null;
            const inferredLocation = inferLocationFromAddress(job.locationAddress);
            return {
              id: job.id,
              title: job.title,
              category: job.category,
              status: job.status,
              budgetMin: job.budgetMin,
              budgetMax: job.budgetMax,
              hourlyRate: job.hourlyRate,
              timingType: job.timingType,
              locationAddress: approximateAddress(job.locationAddress),
              locationState: job.locationState?.trim() || inferredLocation.state,
              locationDistrict: job.locationDistrict?.trim() || inferredLocation.district,
              locationLat: displayPoint?.lat ?? null,
              locationLng: displayPoint?.lng ?? null,
              distanceKm: job.distanceKm,
              description: job.description,
              clientName: clientMap.get(job.userId) ?? "Client",
              clientRating: job.user.averageRating ?? 0,
              clientVerified: job.user.isVerified ?? false,
              createdAt: job.createdAt.toISOString(),
              proposalCount: favoriteCountMap.get(job.id) ?? 0,
            };
          }),
        savedJobs: visibleSavedJobs
          .filter((favorite) => !activeJobIds.has(favorite.job.id))
          .map((favorite) => {
            const displayPoint =
              favorite.job.locationLat !== null && favorite.job.locationLng !== null
                ? createDisplayPoint(
                    favorite.job.id,
                    favorite.job.locationLat,
                    favorite.job.locationLng,
                  )
                : null;
            const inferredLocation = inferLocationFromAddress(favorite.job.locationAddress);
            return {
              id: favorite.job.id,
              title: favorite.job.title,
              category: favorite.job.category,
              status: favorite.job.status,
              budgetMin: favorite.job.budgetMin,
              budgetMax: favorite.job.budgetMax,
              hourlyRate: favorite.job.hourlyRate,
              timingType: favorite.job.timingType,
              locationAddress: approximateAddress(favorite.job.locationAddress),
              locationState: favorite.job.locationState?.trim() || inferredLocation.state,
              locationDistrict: favorite.job.locationDistrict?.trim() || inferredLocation.district,
              locationLat: displayPoint?.lat ?? null,
              locationLng: displayPoint?.lng ?? null,
              distanceKm: favorite.distanceKm,
              description: favorite.job.description,
              clientName: clientMap.get(favorite.job.userId) ?? "Client",
              clientRating: favorite.job.user.averageRating ?? 0,
              clientVerified: favorite.job.user.isVerified ?? false,
              createdAt: favorite.job.createdAt.toISOString(),
              proposalCount: favoriteCountMap.get(favorite.job.id) ?? 0,
            };
          }),
        proposals: visibleProposals.map((request) => {
          const job = jobMap.get(request.jobId);
          return {
            id: request.id,
            jobId: request.jobId,
            jobTitle: job?.title ?? `Job #${request.jobId}`,
            clientName: clientMap.get(request.clientId) ?? "Client",
            bidAmount: request.bidAmount,
            duration: request.duration,
            coverLetter: request.coverLetter,
            status: request.status,
            lastActorRole: request.lastActorRole,
            createdAt: request.createdAt.toISOString(),
          };
        }),
        offers: visibleOffers.map((request) => {
          const job = jobMap.get(request.jobId);
          return {
            id: request.id,
            jobId: request.jobId,
            jobTitle: job?.title ?? `Job #${request.jobId}`,
            clientName: clientMap.get(request.clientId) ?? "Client",
            bidAmount: request.bidAmount,
            duration: request.duration,
            coverLetter: request.coverLetter,
            status: request.status,
            lastActorRole: request.lastActorRole,
            createdAt: request.createdAt.toISOString(),
          };
        }),
        activeProjects: activeProjects.map((project) => ({
          id: project.id,
          jobId: project.jobId,
          jobTitle: jobMap.get(project.jobId)?.title ?? `Job #${project.jobId}`,
          clientName: clientMap.get(project.clientId) ?? "Client",
          status: project.status,
          acceptedAt: project.acceptedAt.toISOString(),
          deadline: jobMap.get(project.jobId)?.deadline?.toISOString() ?? null,
          budget:
            jobMap.get(project.jobId)?.timingType === "HOURLY"
              ? (jobMap.get(project.jobId)?.hourlyRate ?? null)
              : (jobMap.get(project.jobId)?.budgetMax ??
                jobMap.get(project.jobId)?.budgetMin ??
                null),
          timingType: jobMap.get(project.jobId)?.timingType ?? "FIXED",
          progress:
            project.status === "COMPLETED"
              ? 100
              : project.milestones.length > 0
                ? Math.round(
                    project.milestones.reduce(
                      (total, milestone) =>
                        total + milestoneProgress(milestone.status, milestone.payment?.status),
                      0,
                    ) / project.milestones.length,
                  )
                : 0,
          milestones: project.milestones.map((milestone) => ({
            id: milestone.id,
            title: milestone.title,
            status: milestone.status,
            isCompleted:
              milestone.status === "APPROVED" || milestone.payment?.status === "COMPLETED",
          })),
          currentStage: project.currentStage,
        })),
        completedProjects: await Promise.all(
          completedProjects.map(async (project) => {
            const earnings = await db.projectTransaction.aggregate({
              where: {
                trackingId: project.id,
                professionalId: session.userId,
                status: "COMPLETED",
              },
              _sum: { amount: true },
            });
            return {
              id: project.id,
              jobId: project.jobId,
              jobTitle: jobMap.get(project.jobId)?.title ?? `Job #${project.jobId}`,
              clientName: clientMap.get(project.clientId) ?? "Client",
              completedAt: project.completedAt?.toISOString() ?? project.updatedAt.toISOString(),
              amount: earnings._sum.amount ?? 0,
              currency: "INR",
            };
          }),
        ),
      });
    }
    if (resource === "project") {
      const id = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(request.nextUrl.searchParams.get("id"));
      const jobId = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(request.nextUrl.searchParams.get("jobId"));
      if (!id.success && !jobId.success)
        return NextResponse.json(
          { error: "A valid project or job id is required." },
          { status: 400 },
        );
      let project = null;
      if (id.success) {
        project = await db.projectTracking.findUnique({ where: { id: id.data } });
        if (
          session.role !== "ADMIN" &&
          project &&
          project.clientId !== session.userId &&
          project.professionalId !== session.userId
        ) {
          project = null;
        }
      } else {
        project = await db.projectTracking.findFirst({
          where: {
            jobId: jobId.data,
            ...(session.role === "ADMIN"
              ? {}
              : { OR: [{ clientId: session.userId }, { professionalId: session.userId }] }),
          },
        });
      }
      if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
      const viewerRole = session.userId === project.clientId ? "CLIENT" : "PROFESSIONAL";
      const milestones = await db.projectMilestone.findMany({
        where: { trackingId: project.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { payment: { select: { status: true, professionalPayoutAmount: true } } },
      });
      const [
        job,
        professional,
        client,
        uploads,
        revisions,
        timeline,
        projectRequest,
        review,
        dispute,
      ] = await Promise.all([
        db.clientJob.findUnique({
          where: { id: project.jobId },
          select: {
            title: true,
            category: true,
            urgency: true,
            workMode: true,
            jobDate: true,
            deadline: true,
            locationAddress: true,
            locationLat: true,
            locationLng: true,
            description: true,
            budgetMin: true,
            budgetMax: true,
            hourlyRate: true,
            timingType: true,
            paymentMethod: true,
          },
        }),
        db.user.findUnique({
          where: { id: project.professionalId },
          select: { firstName: true, lastName: true },
        }),
        db.user.findUnique({
          where: { id: project.clientId },
          select: { firstName: true, lastName: true },
        }),
        db.projectWorkUpload.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "desc" },
        }),
        db.projectRevisionRequest.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "desc" },
        }),
        db.projectTimelineEvent.findMany({
          where: { trackingId: project.id },
          orderBy: { createdAt: "desc" },
        }),
        db.projectRequest.findUnique({
          where: { id: project.requestId },
          select: { bidAmount: true },
        }),
        db.projectReview.findUnique({ where: { trackingId: project.id } }),
        db.projectDispute.findFirst({
          where: {
            trackingId: project.id,
            OR: [{ reporterId: project.clientId }, { reporterId: project.professionalId }],
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return NextResponse.json({
        project,
        milestones,
        job,
        professional,
        client,
        viewerRole,
        uploads,
        revisions,
        timeline,
        agreedAmount: projectRequest?.bidAmount ?? null,
        review,
        dispute,
      });
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (error) {
    console.error("portal.request.failed", { resource, userId: session.userId, error });
    return NextResponse.json({ error: "Unable to load portal data." }, { status: 500 });
  }
}

const markReadSchema = z
  .object({ id: z.number().int().positive(), unread: z.boolean().optional() })
  .or(
    z.object({
      ids: z.array(z.number().int().positive()).min(1).max(100),
      unread: z.boolean().optional(),
    }),
  )
  .or(z.object({ all: z.literal(true), unread: z.boolean().optional() }));

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { resource } = await params;
  if (resource !== "notifications")
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "A notification id is required." }, { status: 400 });

  const isUnread = Boolean("unread" in parsed.data && parsed.data.unread);
  const targetReadAt = isUnread ? null : new Date();

  if ("all" in parsed.data && parsed.data.all) {
    await db.userNotification.updateMany({
      where: {
        userId: session.userId,
        ...(isUnread ? { readAt: { not: null } } : { readAt: null }),
      },
      data: { readAt: targetReadAt },
    });
  } else if ("ids" in parsed.data && parsed.data.ids) {
    await db.userNotification.updateMany({
      where: { id: { in: parsed.data.ids }, userId: session.userId },
      data: { readAt: targetReadAt },
    });
  } else if ("id" in parsed.data && parsed.data.id) {
    await db.userNotification.updateMany({
      where: { id: parsed.data.id, userId: session.userId },
      data: { readAt: targetReadAt },
    });
  }
  return NextResponse.json({ success: true, unread: isUnread });
}

const deleteNotificationSchema = z
  .object({ id: z.number().int().positive() })
  .or(z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }))
  .or(z.object({ all: z.literal(true) }));

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { resource } = await params;
  if (resource !== "notifications")
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const parsed = deleteNotificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid delete notification request." }, { status: 400 });
  if ("all" in parsed.data) {
    await db.userNotification.updateMany({
      where: { userId: session.userId, clearedAt: null },
      data: { clearedAt: new Date() },
    });
  } else if ("ids" in parsed.data) {
    await db.userNotification.updateMany({
      where: { id: { in: parsed.data.ids }, userId: session.userId },
      data: { clearedAt: new Date() },
    });
  } else {
    await db.userNotification.updateMany({
      where: { id: parsed.data.id, userId: session.userId },
      data: { clearedAt: new Date() },
    });
  }
  return NextResponse.json({ success: true });
}
