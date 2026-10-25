import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const jobs = await db.clientJob.findMany({
    where: { status: "OPEN" },
    select: { id: true, title: true, budgetMin: true, budgetMax: true, userId: true },
    take: 5,
  });
  console.log("OPEN JOBS:", JSON.stringify(jobs, null, 2));
}

main().finally(() => db.$disconnect());
