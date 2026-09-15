import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const plan: {
  name: string;
  description: string;
  iconName: string;
  segment: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";
  children: string[];
}[] = [
  {
    name: "Plumbing",
    description: "Repairs and installation for home water and drainage systems.",
    iconName: "Wrench",
    segment: "RESIDENTIAL",
    children: ["Pipe Repair", "Drain Cleaning", "Water Heater Installation"],
  },
  {
    name: "Office Cleaning",
    description: "Recurring and one-off cleaning for commercial spaces.",
    iconName: "Sparkles",
    segment: "COMMERCIAL",
    children: ["Daily Janitorial", "Carpet Cleaning", "Window Washing"],
  },
  {
    name: "Industrial Maintenance",
    description: "Upkeep and repair for factory and warehouse equipment.",
    iconName: "Hammer",
    segment: "INDUSTRIAL",
    children: ["Equipment Repair", "Preventive Maintenance", "Safety Inspection"],
  },
];

async function main() {
  let sortOrder = await db.serviceCategory.count();
  for (const category of plan) {
    const parentSlug = slugify(category.name);
    let parent = await db.serviceCategory.findUnique({ where: { slug: parentSlug } });
    if (!parent) {
      parent = await db.serviceCategory.create({
        data: {
          name: category.name,
          slug: parentSlug,
          description: category.description,
          iconName: category.iconName,
          segment: category.segment,
          parentId: null,
          sortOrder: sortOrder++,
        },
      });
      console.log(`Created category: ${parent.name}`);
    } else {
      console.log(`Category already exists: ${parent.name}`);
    }
    for (const childName of category.children) {
      const childSlug = slugify(childName);
      const existingChild = await db.serviceCategory.findUnique({ where: { slug: childSlug } });
      if (existingChild) {
        console.log(`  Sub-category already exists: ${childName}`);
        continue;
      }
      await db.serviceCategory.create({
        data: {
          name: childName,
          slug: childSlug,
          description: "",
          iconName: category.iconName,
          segment: category.segment,
          parentId: parent.id,
          sortOrder: sortOrder++,
        },
      });
      console.log(`  Created sub-category: ${childName}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
