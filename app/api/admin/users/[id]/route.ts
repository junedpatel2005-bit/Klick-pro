import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  try {
    if ((await verifySession(token)).role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const body = z.object({ isActive: z.boolean() }).safeParse(await request.json());
    const { id } = await params;
    if (!body.success || !Number.isInteger(Number(id)))
      return NextResponse.json({ error: "Invalid account update." }, { status: 400 });
    const user = await db.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: Number(id) },
        data: { isActive: body.data.isActive },
        select: { id: true, isActive: true },
      });
      if (!body.data.isActive) {
        await transaction.session.updateMany({
          where: { userId: updated.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unable to update account." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  try {
    if ((await verifySession(token)).role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId))
      return NextResponse.json({ error: "Invalid user." }, { status: 400 });
    await db.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete account. It may have related records." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  try {
    if ((await verifySession(token)).role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isInteger(userId))
      return NextResponse.json({ error: "Invalid user." }, { status: 400 });
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        professionalCategory: true,
        professionalCity: true,
        hourlyRate: true,
        fixedRate: true,
        averageRating: true,
        reviewCount: true,
        companyName: true,
        companyWebsite: true,
        industry: true,
        teamSize: true,
        companyDescription: true,
        address: true,
        serviceArea: true,
        workMode: true,
        serviceRadiusKm: true,
        availabilityStatus: true,
        experienceYears: true,
        professionalSkillsJson: true,
        professionalLatitude: true,
        professionalLongitude: true,
        updatedAt: true,
        clientProfiles: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            companyName: true,
            companyWebsite: true,
            industry: true,
            teamSize: true,
            companyDescription: true,
            address: true,
            savedLocations: {
              select: { label: true, address: true, isPrimary: true },
            },
          },
        },
        services: { select: { id: true } },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const userRoleFilter =
      user.role === "CLIENT" ? { clientId: userId } : { professionalId: userId };
    const [jobsPosted, proposals, allProjects, completedPayments] = await Promise.all([
      db.clientJob.count({ where: { userId } }),
      db.projectRequest.count({ where: userRoleFilter }),
      db.projectTracking.findMany({
        where: userRoleFilter,
        select: {
          id: true,
          status: true,
          progress: true,
          createdAt: true,
          updatedAt: true,
          job: { select: { id: true, title: true, category: true } },
          milestones: { select: { id: true, status: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.projectTransaction.aggregate({
        where: {
          ...userRoleFilter,
          status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const completedProjects = allProjects.filter(
      (p) => p.status === "COMPLETED" || p.status.toUpperCase().includes("COMPLETED"),
    ).length;
    const closedProjects = allProjects.filter(
      (p) =>
        p.status === "CLOSED" ||
        p.status.toUpperCase().includes("CLOSED") ||
        p.status.toUpperCase().includes("CANCELLED"),
    ).length;
    return NextResponse.json({
      user,
      stats: {
        jobsPosted,
        proposals,
        projects: allProjects.length,
        completedProjects,
        closedProjects,
        completedPayments: completedPayments._count,
        money: completedPayments._sum.amount ?? 0,
        services: user.services.length,
      },
      projects: allProjects.map((p) => ({
        id: p.id,
        jobId: p.job.id,
        title: p.job.title,
        category: p.job.category,
        status: p.status,
        progress: p.progress,
        totalMilestones: p.milestones.length,
        completedMilestones: p.milestones.filter((m) => m.status === "APPROVED").length,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load user details." }, { status: 500 });
  }
}
