import "dotenv/config";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Fetching all open jobs from database...");

  const allJobs = await db.clientJob.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      userId: true,
      title: true,
      category: true,
      jobDate: true,
      deadline: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`Found ${allJobs.length} open jobs in total across all clients.`);

  const now = new Date();
  const openTodayIds: number[] = [];
  const scheduledJobs: Array<{ id: number; jobDate: Date; deadline: Date }> = [];

  // Group jobs by client so every client has at least one OPEN TODAY job
  const jobsByClient = new Map<number, typeof allJobs>();
  allJobs.forEach((job) => {
    const list = jobsByClient.get(job.userId) ?? [];
    list.push(job);
    jobsByClient.set(job.userId, list);
  });

  for (const [, clientJobs] of jobsByClient) {
    clientJobs.forEach((job, idx) => {
      // First job for client is always OPEN TODAY (Immediate), second job alternates
      if (idx === 0 || idx % 2 === 0) {
        openTodayIds.push(job.id);
      } else {
        const daysInFuture = faker.number.int({ min: 1, max: 21 });
        const futureJobDate = new Date(now.getTime() + daysInFuture * 24 * 60 * 60 * 1000);
        const futureDeadline = new Date(futureJobDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        scheduledJobs.push({
          id: job.id,
          jobDate: futureJobDate,
          deadline: futureDeadline,
        });
      }
    });
  }

  console.log(`Updating ${openTodayIds.length} jobs to be OPEN TODAY (Immediate / Active)...`);
  const thirtyDaysFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.clientJob.updateMany({
    where: { id: { in: openTodayIds } },
    data: {
      jobDate: null, // jobDate null indicates Open Today / Immediate execution
      deadline: thirtyDaysFuture,
      status: "OPEN",
    },
  });

  console.log(`Updating ${scheduledJobs.length} jobs to be SCHEDULED for upcoming future dates...`);
  for (const sJob of scheduledJobs) {
    await db.clientJob.update({
      where: { id: sJob.id },
      data: {
        jobDate: sJob.jobDate,
        deadline: sJob.deadline,
        status: "OPEN",
      },
    });
  }

  // Verification Counts
  const totalOpenToday = await db.clientJob.count({
    where: {
      status: "OPEN",
      OR: [{ jobDate: null }, { jobDate: { lte: now } }],
    },
  });

  const totalScheduled = await db.clientJob.count({
    where: {
      status: "OPEN",
      jobDate: { gt: now },
    },
  });

  console.log("\n=======================================================");
  console.log("🎉 SUCCESS: Balanced all jobs between Open Today & Scheduled!");
  console.log("=======================================================");
  console.log(`🟢 Total Jobs Open Today (Immediate): ${totalOpenToday}`);
  console.log(`📅 Total Jobs Scheduled for Future Dates: ${totalScheduled}`);
  console.log(`📊 Total Active Marketplace Jobs: ${totalOpenToday + totalScheduled}`);
}

main()
  .catch((err) => {
    console.error("Error balancing jobs:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
