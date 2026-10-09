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

async function getClient(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    if (session.role !== "CLIENT") return null;
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

type JobRow = {
  id: number;
  title: string | null;
  category: string | null;
  status: string;
  milestonesProgress: string;
  professionalName: string;
  budget: string;
  locationAddress: string | null;
  updatedAt: Date;
};

const columns: ReportColumn<JobRow>[] = [
  {
    key: "title",
    header: "Project Title",
    width: 2.8,
    format: (row) => `#JOB-${row.id} · ${row.title ?? "Untitled job"}`,
  },
  { key: "category", header: "Category", width: 1.4, format: (row) => row.category ?? "General" },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  {
    key: "milestonesProgress",
    header: "Milestones",
    width: 1.5,
    format: (row) => row.milestonesProgress,
  },
  {
    key: "professionalName",
    header: "Professional",
    width: 1.5,
    format: (row) => row.professionalName,
  },
  { key: "budget", header: "Budget", width: 1.5, align: "right", format: (row) => row.budget },
  {
    key: "locationAddress",
    header: "Location",
    width: 1.5,
    format: (row) => row.locationAddress ?? "Remote",
  },
  {
    key: "updatedAt",
    header: "Updated",
    width: 1.2,
    format: (row) => row.updatedAt.toLocaleDateString("en-IN"),
  },
];

function money(value: number | null) {
  return value == null ? "—" : `INR ${value.toLocaleString("en-IN")}`;
}

export async function POST(request: NextRequest) {
  const user = await getClient(request);
  if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
    const isSingleSelected =
      reportRequest.scope === "selected" && reportRequest.ids && reportRequest.ids.length === 1;

    // If single project selected, return the full comprehensive Job Dossier PDF!
    if (isSingleSelected && reportRequest.ids?.[0]) {
      const jobId = reportRequest.ids[0];
      const dossierData = await fetchJobDossierData(jobId, {
        userId: user.id,
        role: "CLIENT",
      });

      if (dossierData) {
        const buffer = await renderReportPdf(
          createElement(JobDossierDocument, { data: dossierData }) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        const safeTitle = (dossierData.title || `job-${jobId}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50);
        return pdfResponse(buffer, `klick-pro-job-${jobId}-${safeTitle}-dossier.pdf`);
      }
    }

    const jobs = await db.clientJob.findMany({
      where: {
        userId: user.id,
        ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
      },
      include: {
        milestones: true,
        projectTrackings: {
          include: {
            milestones: true,
            professional: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const firstJob = jobs[0];
    if (jobs.length === 1 && firstJob) {
      const dossierData = await fetchJobDossierData(firstJob.id, {
        userId: user.id,
        role: "CLIENT",
      });
      if (dossierData) {
        const buffer = await renderReportPdf(
          createElement(JobDossierDocument, { data: dossierData }) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        return pdfResponse(buffer, `klick-pro-job-${firstJob.id}-dossier.pdf`);
      }
    }

    const rows: JobRow[] = jobs.map((job) => {
      const tracking = job.projectTrackings[0];
      const trackingMilestones = tracking?.milestones ?? [];
      const totalMilestones =
        trackingMilestones.length > 0 ? trackingMilestones.length : job.milestones.length;
      const doneMilestones = trackingMilestones.filter(
        (m) => m.status === "APPROVED" || m.status === "COMPLETED",
      ).length;
      const progressText =
        totalMilestones > 0 ? `${doneMilestones}/${totalMilestones} Done` : "No milestones";

      const proName = tracking?.professional
        ? `${tracking.professional.firstName} ${tracking.professional.lastName}`.trim()
        : "Unassigned";

      const budgetStr =
        job.timingType === "HOURLY"
          ? `${money(job.hourlyRate)}/hr`
          : job.budgetMin && job.budgetMax
            ? `${money(job.budgetMin)} – ${money(job.budgetMax)}`
            : money(job.budgetMax || job.budgetMin);

      return {
        id: job.id,
        title: job.title,
        category: job.category,
        status: job.status,
        milestonesProgress: progressText,
        professionalName: proName,
        budget: budgetStr,
        locationAddress: job.locationAddress,
        updatedAt: job.updatedAt,
      };
    });

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "My Posted Projects",
        subtitle: "Client Workspace — Project Portfolios & Progress Audit",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary:
          reportRequest.scope === "selected" ? `${jobs.length} selected` : `${jobs.length} total`,
        columns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: reportRequest.orientation,
      }),
    );

    return pdfResponse(buffer, `client-projects-${reportRequest.scope}.pdf`);
  } catch (error) {
    console.error("Client jobs export failed:", error);
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
