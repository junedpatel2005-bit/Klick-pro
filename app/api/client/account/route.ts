import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession, sessionCookie } from "@/lib/auth";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
  if (session.role !== "CLIENT")
    return NextResponse.json({ error: "Access denied for this account type." }, { status: 403 });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      phone: true,
      address: true,
      phoneVerifiedAt: true,
      emailVerifiedAt: true,
      isActive: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Client account not found." }, { status: 404 });

  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      address: true,
      profilePhotoUrl: true,
    },
  });

  const savedLocations = await db.clientSavedLocation.findMany({
    where: { clientProfileId: profile?.id ?? -1 },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, label: true, address: true },
  });

  const jobCounts = await db.clientJob.aggregate({
    where: { userId: user.id },
    _count: {
      _all: true,
    },
  });

  const openJobs = await db.clientJob.count({ where: { userId: user.id, status: "OPEN" } });
  const draftJobs = await db.clientJob.count({ where: { userId: user.id, status: "DRAFT" } });
  const closedJobs = await db.clientJob.count({ where: { userId: user.id, status: "CLOSED" } });

  return NextResponse.json({
    account: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      isActive: user.isActive,
    },
    profile,
    savedLocations,
    jobCounts: { open: openJobs, draft: draftJobs, closed: closedJobs },
    role: "CLIENT",
  });
}
