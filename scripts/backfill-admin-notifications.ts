import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type AdminNotification = {
  type: string;
  title: string;
  description: string;
  href: string;
  createdAt: Date;
};

async function main() {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  if (!admins.length) throw new Error("No active admin account exists.");

  const [existing, users, jobs, proposals] = await Promise.all([
    db.userNotification.findMany({
      where: { userId: { in: admins.map((admin) => admin.id) } },
      select: { type: true, href: true },
    }),
    db.user.findMany({
      where: { role: { in: ["CLIENT", "PROFESSIONAL"] } },
      select: { id: true, firstName: true, lastName: true, role: true, createdAt: true },
    }),
    db.clientJob.findMany({
      where: { status: { not: "DRAFT" } },
      select: { id: true, title: true, category: true, createdAt: true },
    }),
    db.projectRequest.findMany({
      where: { origin: "PROFESSIONAL_PROPOSAL" },
      select: { id: true, jobId: true, professionalId: true, createdAt: true },
    }),
  ]);

  const existingKeys = new Set(
    existing.map((notification) => `${notification.type}:${notification.href}`),
  );
  const userById = new Map(users.map((user) => [user.id, user]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const notifications: AdminNotification[] = [];

  for (const user of users) {
    const roleLabel = user.role === "PROFESSIONAL" ? "professional" : "client";
    const href = `/admin/users/${user.id}`;
    const key = `NEW_ACCOUNT:${href}`;
    if (existingKeys.has(key)) continue;
    notifications.push({
      type: "NEW_ACCOUNT",
      title: `New ${roleLabel} registration`,
      description: `${`${user.firstName} ${user.lastName}`.trim() || "A user"} registered as a ${roleLabel}.`,
      href,
      createdAt: user.createdAt,
    });
  }

  for (const job of jobs) {
    const href = `/admin/operations?job=${job.id}`;
    const key = `NEW_JOB:${href}`;
    if (existingKeys.has(key)) continue;
    notifications.push({
      type: "NEW_JOB",
      title: "New job posted",
      description: `${job.title?.trim() || "A client"}${job.category ? ` · ${job.category}` : ""} is now open.`,
      href,
      createdAt: job.createdAt,
    });
  }

  for (const proposal of proposals) {
    const href = `/admin/operations?job=${proposal.jobId}&proposal=${proposal.id}`;
    const key = `HISTORICAL_PROPOSAL:${href}`;
    if (existingKeys.has(key)) continue;
    const professional = userById.get(proposal.professionalId);
    const job = jobById.get(proposal.jobId);
    notifications.push({
      type: "HISTORICAL_PROPOSAL",
      title: "New professional proposal",
      description: `${professional ? `${professional.firstName} ${professional.lastName}`.trim() : "A professional"} sent a proposal for ${job?.title?.trim() || `job #${proposal.jobId}`}.`,
      href,
      createdAt: proposal.createdAt,
    });
  }

  if (notifications.length) {
    await db.userNotification.createMany({
      data: admins.flatMap((admin) =>
        notifications.map((notification) => ({ userId: admin.id, ...notification })),
      ),
    });
  }
  console.log(JSON.stringify({ admins: admins.length, added: notifications.length }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
