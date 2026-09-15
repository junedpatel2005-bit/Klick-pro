import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  console.log("Cleaning all notifications from database...");
  const result = await db.userNotification.deleteMany({});
  console.log(`Deleted ${result.count} notification records.`);
}

main()
  .catch((err) => {
    console.error("Clean error:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
