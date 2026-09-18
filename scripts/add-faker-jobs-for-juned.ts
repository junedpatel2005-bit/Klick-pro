import "dotenv/config";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = "junedpatel2005@gmail.com";
const marker = "[Demo Faker Job]";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const templates = [
  {
    title: "Modern landing page for a local business",
    category: "Design",
    timingType: "FIXED",
    budgetMin: 800,
    budgetMax: 1400,
    city: { label: "Surat, Gujarat", address: "Surat, Gujarat, India", lat: 21.1702, lng: 72.8311 },
  },
  {
    title: "Home office electrical upgrade",
    category: "Home Services",
    timingType: "FIXED",
    budgetMin: 450,
    budgetMax: 900,
    city: {
      label: "Ahmedabad, Gujarat",
      address: "Ahmedabad, Gujarat, India",
      lat: 23.0225,
      lng: 72.5714,
    },
  },
  {
    title: "Product photos for an online store",
    category: "Photography",
    timingType: "FIXED",
    budgetMin: 300,
    budgetMax: 650,
    city: {
      label: "Vadodara, Gujarat",
      address: "Vadodara, Gujarat, India",
      lat: 22.3072,
      lng: 73.1812,
    },
  },
  {
    title: "Website conversion audit",
    category: "Marketing",
    timingType: "FIXED",
    budgetMin: 500,
    budgetMax: 950,
    city: null,
  },
  {
    title: "React dashboard improvements",
    category: "Development",
    timingType: "HOURLY",
    budgetMin: null,
    budgetMax: null,
    hourlyRate: 65,
    city: null,
  },
  {
    title: "Brand identity and design system",
    category: "Design",
    timingType: "FIXED",
    budgetMin: 1200,
    budgetMax: 2400,
    city: {
      label: "Mumbai, Maharashtra",
      address: "Mumbai, Maharashtra, India",
      lat: 19.076,
      lng: 72.8777,
    },
  },
];

async function main() {
  faker.seed(20260813);
  const client = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!client) throw new Error(`No account found for ${email}.`);
  const existing = await db.clientJob.findMany({
    where: { userId: client.id, description: { startsWith: marker } },
    select: { id: true, title: true },
  });
  const existingIds = existing.map((job) => job.id);
  if (existingIds.length) {
    await db.projectTracking.deleteMany({
      where: { clientId: client.id, jobId: { in: existingIds } },
    });
    await db.projectRequest.deleteMany({
      where: { clientId: client.id, jobId: { in: existingIds } },
    });
    await db.clientJob.updateMany({ where: { id: { in: existingIds } }, data: { status: "OPEN" } });
  }
  const existingTitles = new Set(existing.map((job) => job.title));
  const existingByTitle = new Map(existing.map((job) => [job.title, job.id]));
  let created = 0;
  let updated = 0;

  for (const item of templates) {
    const title = `${marker} ${item.title}`;
    const isRemote = item.city === null;

    if (existingTitles.has(title)) {
      const jobId = existingByTitle.get(title);
      if (jobId) {
        await db.clientJob.update({
          where: { id: jobId },
          data: {
            locationLabel: isRemote ? "Remote" : item.city.label,
            locationAddress: isRemote ? "Remote" : item.city.address,
            locationLat: isRemote ? null : item.city.lat,
            locationLng: isRemote ? null : item.city.lng,
          },
        });
        updated += 1;
      }
      continue;
    }

    await db.clientJob.create({
      data: {
        userId: client.id,
        title,
        category: item.category,
        description: `${marker}\n${faker.lorem.paragraphs(2)}`,
        status: "OPEN",
        timingType: item.timingType,
        budgetMin: item.budgetMin,
        budgetMax: item.budgetMax,
        hourlyRate: item.hourlyRate ?? null,
        urgency: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"]),
        workMode: isRemote ? "REMOTE" : "ON_SITE",
        locationLabel: isRemote ? "Remote" : item.city.label,
        locationAddress: isRemote ? "Remote" : item.city.address,
        locationLat: isRemote ? null : item.city.lat,
        locationLng: isRemote ? null : item.city.lng,
        deadline: faker.date.soon({ days: 35 }),
      },
    });
    created += 1;
  }

  console.info("faker.jobs.added", { account: email, created, updated, existing: existing.length });
}

main()
  .catch((error: unknown) => {
    console.error("faker.jobs.failed", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
