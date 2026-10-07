import { db } from "@/lib/db";

export async function getClientAccountSummary(userId: number) {
  const user = await db.user.findUnique({
    where: { id: userId },
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
  if (!user || !user.isActive) return null;

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

  const savedLocations = profile
    ? await db.clientSavedLocation.findMany({
        where: { clientProfileId: profile.id },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, label: true, address: true, isPrimary: true },
      })
    : [];

  const [openJobs, draftJobs, closedJobs] = await Promise.all([
    db.clientJob.count({ where: { userId: user.id, status: "OPEN" } }),
    db.clientJob.count({ where: { userId: user.id, status: "DRAFT" } }),
    db.clientJob.count({ where: { userId: user.id, status: "CLOSED" } }),
  ]);

  return {
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
    profile: profile ? { ...profile, address: profile.address || user.address } : null,
    savedLocations,
    jobCounts: { open: openJobs, draft: draftJobs, closed: closedJobs },
    role: "CLIENT" as const,
  };
}
