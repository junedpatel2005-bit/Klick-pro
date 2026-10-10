import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { JobDossierDocument } from "@/lib/reports/pdf/JobDossierDocument";
import { fetchJobDossierData } from "@/lib/reports/pdf/job-dossier-builder";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn } from "@/lib/reports/pdf/types";

export const runtime = "nodejs";

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
  category: string;
  milestonesProgress: string;
  deadline: Date | null;
  budget: string;
};

function money(value: number | null, timingType: string) {
  if (value == null) return "Amount pending";
  return timingType === "HOURLY"
    ? `INR ${value.toLocaleString("en-IN")}/hr`
    : `INR ${value.toLocaleString("en-IN")}`;
}

const columns: ReportColumn<ProjectRow>[] = [
  {
    key: "jobTitle",
    header: "Project Title",
    width: 2.6,
    format: (row) => `#JOB-${row.jobId} · ${row.jobTitle}`,
  },
  { key: "clientName", header: "Client", width: 1.5, format: (row) => row.clientName },
  { key: "category", header: "Category", width: 1.3, format: (row) => row.category },
  { key: "status", header: "Status", width: 1.3, format: (row) => row.status.replaceAll("_", " ") },
  {
    key: "milestonesProgress",
    header: "Milestones",
    width: 1.4,
    format: (row) => row.milestonesProgress,
  },
  {
    key: "budget",
    header: "Agreed Value",
    width: 1.5,
    align: "right",
    format: (row) => row.budget,
  },
  {
    key: "progress",
    header: "Progress",
    width: 1,
    align: "right",
    format: (row) => `${row.progress}%`,
  },
  {
    key: "acceptedAt",
    header: "Accepted",
    width: 1.2,
    format: (row) => row.acceptedAt.toLocaleDateString("en-IN"),
  },
  {
    key: "deadline",
    header: "Deadline",
    width: 1.2,
    format: (row) => (row.deadline ? row.deadline.toLocaleDateString("en-IN") : "Flexible"),
  },
];

export async function POST(request: NextRequest) {
  const user = await getProfessional(request);
  if (!user)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
    const isSingleSelected =
      reportRequest.scope === "selected" && reportRequest.ids && reportRequest.ids.length === 1;

    const tracking = await db.projectTracking.findMany({
      where: {
        professionalId: user.id,
        ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
      },
      include: {
        milestones: true,
      },
      orderBy: { acceptedAt: "desc" },
    });

    // If single project selected, return the full comprehensive Job Dossier PDF!
    const firstProject = tracking[0];
    if (isSingleSelected && tracking.length === 1 && firstProject) {
      const dossierData = await fetchJobDossierData(firstProject.jobId, {
        userId: user.id,
        role: "PROFESSIONAL",
      });

      if (dossierData) {
        const buffer = await renderReportPdf(
          createElement(JobDossierDocument, { data: dossierData }) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        const safeTitle = (dossierData.title || `project-${firstProject.id}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        return pdfResponse(buffer, `klick-pro-${safeTitle}.pdf`);
      }
    }

    const jobs = await db.clientJob.findMany({
      where: { id: { in: tracking.map((project) => project.jobId) } },
      select: {
        id: true,
        title: true,
        category: true,
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
      const doneMilestones = project.milestones.filter(
        (m) => m.status === "APPROVED" || m.status === "COMPLETED",
      ).length;
      const progressText =
        project.milestones.length > 0
          ? `${doneMilestones}/${project.milestones.length} Done`
          : `${project.progress}%`;

      const budgetVal = job
        ? job.timingType === "HOURLY"
          ? job.hourlyRate
          : (job.budgetMax ?? job.budgetMin)
        : null;

      return {
        id: project.id,
        jobId: project.jobId,
        status: project.status,
        acceptedAt: project.acceptedAt,
        progress: project.progress,
        currentStage: project.currentStage,
        jobTitle: job?.title ?? `Job #${project.jobId}`,
        clientName: job ? (clientMap.get(job.userId) ?? "Client") : "Client",
        category: job?.category ?? "General",
        milestonesProgress: progressText,
        deadline: job?.deadline ?? null,
        budget: money(budgetVal, job?.timingType ?? "FIXED"),
      };
    });

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "Professional Engagements",
        subtitle: "Professional Workspace — Active Engagements & Portfolio Progress",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary:
          reportRequest.scope === "selected" ? `${rows.length} selected` : `${rows.length} total`,
        columns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: reportRequest.orientation,
      }),
    );

    return pdfResponse(buffer, `professional-projects-${reportRequest.scope}.pdf`);
  } catch (error) {
    console.error("Professional jobs export failed:", error);
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
