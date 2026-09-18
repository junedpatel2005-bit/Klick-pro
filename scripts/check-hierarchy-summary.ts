import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const parents = await db.serviceCategory.findMany({
    where: { parentId: null, slug: { in: ["residential", "commercial", "industrial"] } },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  console.log("\n=== 3-TIER DATABASE CATEGORY SUMMARY ===");
  for (const parent of parents) {
    const totalSub = parent.children.reduce((sum, c) => sum + c.children.length, 0);
    console.log(
      `\n📌 Tier 1 Parent: [${parent.segment}] #${parent.id} ${parent.name} (${parent.children.length} categories, ${totalSub} subcategories)`,
    );
    for (const cat of parent.children) {
      console.log(`   📂 #${cat.id} ${cat.name} (${cat.children.length} subcategories)`);
      const sampleSubs = cat.children
        .slice(0, 4)
        .map((s) => s.name)
        .join(", ");
      console.log(
        `      ↳ ${sampleSubs}${cat.children.length > 4 ? ` ... (+${cat.children.length - 4} more)` : ""}`,
      );
    }
  }
}

main().finally(() => db.$disconnect());
