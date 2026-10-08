import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const s = await db.platformSetting.findMany();
  console.log(JSON.stringify(s, null, 2));
}

main().finally(() => db.$disconnect());
