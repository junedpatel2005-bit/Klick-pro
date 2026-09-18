import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn } from "@/lib/reports/pdf/types";

async function getProfessional(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL") return null;
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

type ProjectRow = {
  id: number;
  jobId: number;
  status: string;
  acceptedAt: Date;
  progress: number;
  currentStage: string | null;
  jobTitle: string;
  clientName: string;
  deadline: Date | null;
  budget: number | null;
  timingType: string;
};

function money(value: number | null, timingType: string) {
  if (value == null) return "Amount pending";
  return timingType === "HOURLY"
    ? `₹${value.toLocaleString("en-US")}/hr`
    : `₹${value.toLocaleString("en-US")}`;
}

const columns: ReportColumn<ProjectRow>[] = [
  { key: "jobTitle", header: "Job title", width: 2.6, format: (row) => row.jobTitle },
  { key: "clientName", header: "Client", width: 1.6, format: (row) => row.clientName },
  { key: "status", header: "Status", width: 1.4, format: (row) => row.status.replaceAll("_", " ") },
  {
    key: "acceptedAt",
    header: "Accepted",
    width: 1.3,
    format: (row) => row.acceptedAt.toLocaleDateString("en-US"),
  },
  {
    key: "deadline",
    header: "Deadline",
    width: 1.3,
    format: (row) => (row.deadline ? row.deadline.toLocaleDateString("en-US") : "—"),
  },
  {
    key: "budget",
    header: "Budget",
    width: 1.4,
    align: "right",
    format: (row) => money(row.budget, row.timingType),
  },
  {
    key: "progress",
    header: "Progress",
    width: 1,
    align: "right",
    format: (row) => `${row.progress}%`,
  },
];

export async function POST(request: NextRequest) {
  const user = await getProfessional(request);
  if (!user)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  const tracking = await db.projectTracking.findMany({
    where: {
      professionalId: user.id,
      status: { not: "COMPLETED" },
      ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
    },
    orderBy: { acceptedAt: "desc" },
  });

  const jobs = await db.clientJob.findMany({
    where: { id: { in: tracking.map((project) => project.jobId) } },
    select: {
      id: true,
      title: true,
      deadline: true,
      budgetMin: true,
      budgetMax: true,
      hourlyRate: true,
      timingType: true,
      userId: true,
    },
  });
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const clients = await db.user.findMany({
    where: { id: { in: jobs.map((job) => job.userId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const clientMap = new Map(
    clients.map((client) => [client.id, `${client.firstName} ${client.lastName}`.trim()]),
  );

  const rows: ProjectRow[] = tracking.map((project) => {
    const job = jobMap.get(project.jobId);
    return {
      id: project.id,
      jobId: project.jobId,
      status: project.status,
      acceptedAt: project.acceptedAt,
      progress: project.progress,
      currentStage: project.currentStage,
      jobTitle: job?.title ?? `Job #${project.jobId}`,
      clientName: job ? (clientMap.get(job.userId) ?? "Client") : "Client",
      deadline: job?.deadline ?? null,
      budget: job
        ? job.timingType === "HOURLY"
          ? job.hourlyRate
          : (job.budgetMax ?? job.budgetMin)
        : null,
      timingType: job?.timingType ?? "FIXED",
    };
  });

  const buffer = await renderReportPdf(
    ReportDocument({
      title: "Running projects",
      subtitle: "Professional workspace — your active projects",
      generatedFor: `${user.firstName} ${user.lastName}`,
      filterSummary:
        reportRequest.scope === "selected" ? `${rows.length} selected` : `${rows.length} total`,
      columns,
      rows,
      pageSize: reportRequest.pageSize,
      orientation: reportRequest.orientation,
    }),
  );

  return pdfResponse(buffer, `running-projects-${reportRequest.scope}.pdf`);
}
