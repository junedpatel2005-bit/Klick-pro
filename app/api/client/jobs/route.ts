import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyAdminsOfNewJob, notifyProfessionalsOfNewJob } from "@/lib/marketplace-notifications";

const milestoneInput = z.object({
  title: z.string().trim().min(1, "Enter a milestone title.").max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  percentage: z.coerce
    .number()
    .int()
    .min(1, "Percentage must be at least 1%.")
    .max(100, "Percentage cannot exceed 100%."),
});
const milestonesInput = z.array(milestoneInput).superRefine((milestones, context) => {
  const total = milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
  if (total > 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total milestone percentage cannot exceed 100% (currently ${total}%).`,
    });
  }
});

const jobInput = z.object({
  title: z.string().trim().max(160).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  budgetMin: z.coerce.number().int().min(0).max(10000000).nullable().optional(),
  budgetMax: z.coerce.number().int().min(0).max(10000000).nullable().optional(),
  hourlyRate: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  timingType: z.enum(["FIXED", "HOURLY"]).optional(),
  paymentMethod: z.enum(["WALLET", "OFFLINE"]).optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  jobDate: z.string().date().nullable().optional(),
  deadline: z.string().date().nullable().optional(),
  workMode: z.enum(["ON_SITE", "REMOTE", "BOTH"]).optional(),
  locationLabel: z.string().trim().max(100).nullable().optional(),
  locationAddress: z.string().trim().max(300).nullable().optional(),
  locationState: z.string().trim().max(100).nullable().optional(),
  locationDistrict: z.string().trim().max(100).nullable().optional(),
  locationLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  locationLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  milestones: milestonesInput.optional().default([]),
  mode: z.enum(["draft", "publish"]),
});

async function getClient(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = bearerToken || request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    if (session.role !== "CLIENT") return null;
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, isActive: true },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

function normalized(data: z.infer<typeof jobInput>) {
  return {
    title: data.title || null,
    category: data.category || null,
    description: data.description || null,
    budgetMin: data.budgetMin ?? null,
    budgetMax: data.budgetMax ?? null,
    hourlyRate: data.hourlyRate ?? null,
    timingType: data.timingType ?? "FIXED",
    paymentMethod: data.paymentMethod ?? "WALLET",
    urgency: data.urgency ?? "MEDIUM",
    workMode: data.workMode ?? "BOTH",
    jobDate: data.jobDate ? new Date(`${data.jobDate}T00:00:00.000Z`) : null,
    deadline: data.deadline ? new Date(`${data.deadline}T00:00:00.000Z`) : null,
    locationLabel: data.locationLabel || null,
    locationAddress: data.locationAddress || null,
    locationState: data.locationState || null,
    locationDistrict: data.locationDistrict || null,
    locationLat: data.locationLat ?? null,
    locationLng: data.locationLng ?? null,
  };
}

async function publishErrors(data: z.infer<typeof jobInput>) {
  const fields: Record<string, string> = {};
  if (!data.title?.trim()) fields.title = "Enter a job title.";
  if (!data.category?.trim()) fields.category = "Choose a category.";
  if (!data.description?.trim()) fields.description = "Describe the work needed.";
  if (!data.deadline) fields.deadline = "Choose a deadline.";
  if (data.workMode !== "REMOTE") {
    if (!data.locationAddress?.trim()) fields.locationAddress = "Choose a job location.";
    else if (data.locationLat == null || data.locationLng == null)
      fields.locationAddress =
        "Select the address from the search results or drop a pin on the map so professionals can find you nearby.";
  }
  if (data.timingType === "HOURLY" && !data.hourlyRate) fields.hourlyRate = "Enter an hourly rate.";
  if (data.timingType !== "HOURLY" && (data.budgetMin == null || data.budgetMax == null))
    fields.budgetMin = "Enter a budget range.";
  if (data.budgetMin != null && data.budgetMax != null && data.budgetMin > data.budgetMax)
    fields.budgetMax = "Maximum budget must be at least the minimum.";
  if (data.jobDate && data.deadline && data.deadline < data.jobDate)
    fields.deadline = "Deadline cannot be before the preferred job date.";
  if (data.category?.trim()) {
    const exists = await db.serviceCategory.findFirst({
      where: { name: data.category.trim() },
      select: { id: true },
    });
    if (!exists) fields.category = "Choose a valid category.";
  }
  if (data.milestones && data.milestones.length > 0) {
    const totalPercentage = data.milestones.reduce((acc, m) => acc + (m.percentage || 0), 0);
    if (totalPercentage > 100) {
      fields.milestones = `Total percentage of all milestones must not exceed 100% (currently ${totalPercentage}%).`;
    }
    const hasEmpty = data.milestones.some((m) => !m.title?.trim());
    if (hasEmpty) {
      fields.milestones = "All milestones must have a title.";
    }
  }
  return fields;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getClient(request);
    if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
    const jobs = await db.clientJob.findMany({
      where: { userId: user.id },
      include: {
        milestones: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    const tracking = await db.projectTracking.findMany({
      where: {
        clientId: user.id,
        jobId: { in: jobs.map((job) => job.id) },
        status: { not: "COMPLETED" },
      },
      select: { id: true, jobId: true, status: true },
    });
    const proposalCounts = await db.projectRequest.groupBy({
      by: ["jobId"],
      where: { clientId: user.id, origin: "PROFESSIONAL_PROPOSAL" },
      _count: { id: true },
    });
    const trackingByJob = new Map(tracking.map((project) => [project.jobId, project]));
    const proposalCountByJob = new Map(proposalCounts.map((item) => [item.jobId, item._count.id]));

    return NextResponse.json({
      jobs: jobs.map((job) => {
        const project = trackingByJob.get(job.id);
        const status = project
          ? project.status === "COMPLETED"
            ? "CLOSED"
            : "RUNNING"
          : job.status;
        return {
          ...job,
          status,
          projectId: project?.id ?? null,
          proposalCount: status === "RUNNING" ? 0 : (proposalCountByJob.get(job.id) ?? 0),
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load client jobs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load jobs." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getClient(request);
    if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
    const parsed = jobInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please review the job details.", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    const fields = parsed.data.mode === "publish" ? await publishErrors(parsed.data) : {};
    if (Object.keys(fields).length)
      return NextResponse.json(
        { error: "Please correct the highlighted fields.", fields },
        { status: 400 },
      );

    let rawMilestones = (parsed.data.milestones || []).filter((m) => m.title?.trim());
    if (rawMilestones.length === 0) {
      rawMilestones = [
        {
          title: "Project Completion",
          description: "Full project delivery and completion",
          percentage: 100,
        },
      ];
    }
    const budgetRef = parsed.data.budgetMax ?? parsed.data.budgetMin ?? null;
    const preparedMilestones = rawMilestones.map((m, index) => ({
      title: m.title.trim(),
      description: m.description?.trim() || null,
      percentage: m.percentage,
      amount: budgetRef ? Math.round((budgetRef * m.percentage) / 100) : null,
      sortOrder: index,
    }));

    const job = await db.clientJob.create({
      data: {
        userId: user.id,
        ...normalized(parsed.data),
        status: parsed.data.mode === "publish" ? "OPEN" : "DRAFT",
        milestones: {
          create: preparedMilestones,
        },
      },
      include: {
        milestones: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (job.status === "OPEN" && (!job.jobDate || job.jobDate <= new Date())) {
      try {
        await Promise.all([notifyProfessionalsOfNewJob(job), notifyAdminsOfNewJob(job)]);
      } catch (notifyErr) {
        console.error("Job notification error:", notifyErr);
      }
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Failed to create job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post job." },
      { status: 500 },
    );
  }
}
