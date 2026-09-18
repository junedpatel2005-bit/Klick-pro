import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn } from "@/lib/reports/pdf/types";

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
  title: string | null;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  locationAddress: string | null;
  updatedAt: Date;
};

function money(value: number | null) {
  return value == null ? "—" : `₹${value.toLocaleString("en-US")}`;
}

const columns: ReportColumn<JobRow>[] = [
  { key: "title", header: "Title", width: 3, format: (row) => row.title ?? "Untitled job" },
  { key: "status", header: "Status", width: 1.4, format: (row) => row.status },
  {
    key: "budget",
    header: "Budget",
    width: 1.6,
    align: "right",
    format: (row) =>
      row.timingType === "HOURLY"
        ? `${money(row.hourlyRate)}/hr`
        : money(row.budgetMax ?? row.budgetMin),
  },
  {
    key: "location",
    header: "Location",
    width: 2,
    format: (row) => row.locationAddress ?? "Remote",
  },
  {
    key: "updatedAt",
    header: "Updated",
    width: 1.4,
    format: (row) => row.updatedAt.toLocaleDateString("en-US"),
  },
];

export async function POST(request: NextRequest) {
  const user = await getClient(request);
  if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  const jobs = await db.clientJob.findMany({
    where: {
      userId: user.id,
      ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const buffer = await renderReportPdf(
    ReportDocument({
      title: "My jobs",
      subtitle: "Client workspace — your posted projects",
      generatedFor: `${user.firstName} ${user.lastName}`,
      filterSummary:
        reportRequest.scope === "selected" ? `${jobs.length} selected` : `${jobs.length} total`,
      columns,
      rows: jobs,
      pageSize: reportRequest.pageSize,
      orientation: reportRequest.orientation,
    }),
  );

  return pdfResponse(buffer, `my-jobs-${reportRequest.scope}.pdf`);
}
