import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
  });

  console.log(`Found ${admins.length} admin accounts.`);

  for (const admin of admins) {
    // Unread the recent 120 notifications for each admin
    const recentNotifs = await db.userNotification.findMany({
      where: { userId: admin.id, clearedAt: null },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: { id: true },
    });

    if (recentNotifs.length > 0) {
      const ids = recentNotifs.map((n) => n.id);
      await db.userNotification.updateMany({
        where: { id: { in: ids } },
        data: { readAt: null },
      });
      console.log(
        `Reset ${ids.length} notifications to UNREAD for admin ${admin.email} (ID: ${admin.id}).`,
      );
    }
  }

  const unreadCount = await db.userNotification.count({
    where: { readAt: null, clearedAt: null },
  });

  console.log(`\n🎉 Total unread notifications across platform: ${unreadCount}`);
}

main()
  .catch((err) => {
    console.error("Error resetting unread notifications:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
