import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let userId: number;
  let role: string;
  try {
    ({ userId, role } = await verifySession(token));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    if (role !== "CLIENT")
      return NextResponse.json({ error: "Client access required" }, { status: 403 });
    const [user, jobs, proposals, hireRequests, notifications, spent, runningProjects] =
      await Promise.all([
        db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { firstName: true, averageRating: true, phoneVerifiedAt: true },
        }),
        db.clientJob.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { favoriteJobs: true } } },
        }),
        db.projectRequest.findMany({
          where: { clientId: userId, origin: "PROFESSIONAL_PROPOSAL" },
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
        db.projectRequest.findMany({
          where: { clientId: userId, origin: "CLIENT_HIRE" },
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
        db.userNotification.findMany({
          where: {
            userId,
            clearedAt: null,
            type: {
              notIn: ["PROPOSAL_SENT", "PROPOSAL_UPDATE_SENT", "HIRE_REQUEST_SENT"],
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        db.projectTransaction.aggregate({
          where: {
            clientId: userId,
            status: "COMPLETED",
            createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
          _sum: { amount: true },
        }),
        db.projectTracking.findMany({
          where: { clientId: userId, status: { not: "COMPLETED" } },
          select: { jobId: true },
        }),
      ]);
    const runningJobIds = new Set(runningProjects.map((project) => project.jobId));
    const professionalIds = [
      ...new Set([...proposals, ...hireRequests].map((item) => item.professionalId)),
    ];
    const professionals = await db.user.findMany({
      where: { id: { in: professionalIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const professionalNames = new Map(
      professionals.map((professional) => [
        professional.id,
        `${professional.firstName} ${professional.lastName}`.trim(),
      ]),
    );
    const jobsWithStatus = jobs.map((job) => ({
      ...job,
      status: runningJobIds.has(job.id) ? "RUNNING" : job.status,
    }));
    return NextResponse.json({
      user,
      jobs: jobsWithStatus.slice(0, 4),
      projectSummary: {
        total: jobsWithStatus.length,
        open: jobsWithStatus.filter((job) => job.status === "OPEN").length,
        running: jobsWithStatus.filter((job) => job.status === "RUNNING").length,
        drafts: jobsWithStatus.filter((job) => job.status === "DRAFT").length,
      },
      proposals: proposals.map((proposal) => ({
        ...proposal,
        professionalName: professionalNames.get(proposal.professionalId) ?? "Professional",
      })),
      hireRequests: hireRequests.map((hireRequest) => ({
        ...hireRequest,
        professionalName: professionalNames.get(hireRequest.professionalId) ?? "Professional",
      })),
      notifications,
      spent: spent._sum.amount ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load dashboard." }, { status: 500 });
  }
}
