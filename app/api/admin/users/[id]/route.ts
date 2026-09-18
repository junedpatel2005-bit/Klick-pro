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
    const [jobsPosted, proposals, projects, completedPayments] = await Promise.all([
      db.clientJob.count({ where: { userId } }),
      db.projectRequest.count({
        where: user.role === "CLIENT" ? { clientId: userId } : { professionalId: userId },
      }),
      db.projectTracking.count({
        where: user.role === "CLIENT" ? { clientId: userId } : { professionalId: userId },
      }),
      db.projectTransaction.aggregate({
        where: {
          ...(user.role === "CLIENT" ? { clientId: userId } : { professionalId: userId }),
          status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return NextResponse.json({
      user,
      stats: {
        jobsPosted,
        proposals,
        projects,
        completedPayments: completedPayments._count,
        money: completedPayments._sum.amount ?? 0,
        services: user.services.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load user details." }, { status: 500 });
  }
}
