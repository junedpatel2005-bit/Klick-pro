import "dotenv/config";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const INDIAN_LOCATIONS = [
  { city: "Navsari", state: "Gujarat", lat: 20.9467, lng: 72.952 },
  { city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { city: "Delhi", state: "Delhi", lat: 28.7041, lng: 77.1025 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { city: "Chandigarh", state: "Punjab", lat: 30.7333, lng: 76.7794 },
];

async function main() {
  faker.seed(20260902);

  // 1. Get client accounts
  const seedClient = await db.user.findUnique({
    where: { email: "seed.client@servio.example" },
    select: { id: true, email: true },
  });
  if (!seedClient) throw new Error("Seed Client not found.");

  const client2 =
    (await db.user.findFirst({
      where: { email: "client.zub@yopmail.com" },
      select: { id: true },
    })) ?? seedClient;

  const client3 =
    (await db.user.findFirst({
      where: { email: "qa.tester.signup@servio.example" },
      select: { id: true },
    })) ?? seedClient;

  const clients = [seedClient, client2, client3];

  console.log("=== BALANCING OPEN & SCHEDULED JOBS ===");

  // 2. Convert ~175 existing jobs from scheduled to OPEN (jobDate = null)
  const existingJobs = await db.clientJob.findMany({
    where: { status: "OPEN" },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const idsToMakeOpen = existingJobs.filter((_, idx) => idx % 2 === 0).map((j) => j.id);

  if (idsToMakeOpen.length > 0) {
    await db.clientJob.updateMany({
      where: { id: { in: idsToMakeOpen } },
      data: { jobDate: null },
    });
    console.log(
      `Updated ${idsToMakeOpen.length} existing jobs to have jobDate = null (Active Open Jobs).`,
    );
  }

  // 3. Create 100+ brand new OPEN jobs (jobDate = null) across various subcategories
  const categories = await db.serviceCategory.findMany({
    where: { parentId: { not: null } },
    include: { parent: true },
    take: 120,
    orderBy: [{ segment: "asc" }, { id: "asc" }],
  });

  console.log(`Creating ${categories.length} new Open Jobs (Today / Immediate)...`);
  const newJobs = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]!;
    const loc = INDIAN_LOCATIONS[i % INDIAN_LOCATIONS.length]!;
    const assignedClient = clients[i % clients.length]!;

    const budgetBase =
      cat.segment === "INDUSTRIAL"
        ? faker.number.int({ min: 20000, max: 80000 })
        : cat.segment === "COMMERCIAL"
          ? faker.number.int({ min: 10000, max: 45000 })
          : faker.number.int({ min: 2000, max: 15000 });

    const budgetMax =
      budgetBase + faker.number.int({ min: 500, max: Math.max(800, Math.ceil(budgetBase * 0.4)) });
    const isHourly = faker.datatype.boolean({ probability: 0.2 });
    const hourlyRate = isHourly ? faker.number.int({ min: 200, max: 1000 }) : null;

    const title = `Urgent: ${cat.name} Needed in ${loc.city}`;
    const description =
      `Immediate hiring for ${cat.name} (${cat.parent?.name ?? "General"}).\n\n` +
      `Job Details:\n` +
      `• Location: ${loc.city}, ${loc.state}\n` +
      `• Start Date: Immediately today / ASAP\n` +
      `• Requirements: Qualified expert with verified reviews\n\n` +
      `Please apply with your rates and earliest availability.`;

    const deadline = new Date(Date.now() + faker.number.int({ min: 7, max: 30 }) * 86400000);

    newJobs.push({
      userId: assignedClient.id,
      category: cat.name,
      title,
      description,
      status: "OPEN" as const,
      timingType: isHourly ? "HOURLY" : "FIXED",
      budgetMin: isHourly ? null : budgetBase,
      budgetMax: isHourly ? null : budgetMax,
      hourlyRate,
      urgency: faker.helpers.arrayElement(["MEDIUM", "HIGH"] as const),
      workMode: faker.helpers.arrayElement(["ON_SITE", "REMOTE", "BOTH"] as const),
      locationLabel: `${loc.city}, ${loc.state}`,
      locationAddress: `${faker.location.buildingNumber()}, ${faker.location.street()}, ${loc.city}, ${loc.state} 396445, India`,
      locationDistrict: loc.city,
      locationState: loc.state,
      locationLat: loc.lat + (Math.random() - 0.5) * 0.02,
      locationLng: loc.lng + (Math.random() - 0.5) * 0.02,
      jobDate: null, // null ensures it is categorized as "OPEN" (not "SCHEDULED")
      deadline,
      paymentMethod: "WALLET",
    });
  }

  // Batch insert
  for (let i = 0; i < newJobs.length; i += 50) {
    const batch = newJobs.slice(i, i + 50);
    await db.clientJob.createMany({ data: batch });
  }

  // 4. Verification summary
  const allJobs = await db.clientJob.findMany({
    select: { id: true, jobDate: true, status: true, userId: true },
  });

  const now = Date.now();
  const scheduledCount = allJobs.filter(
    (j) => j.status === "OPEN" && j.jobDate && new Date(j.jobDate).getTime() > now,
  ).length;
  const openImmediateCount = allJobs.filter(
    (j) => j.status === "OPEN" && (!j.jobDate || new Date(j.jobDate).getTime() <= now),
  ).length;
  const seedClientOpenJobs = allJobs.filter(
    (j) =>
      j.userId === seedClient.id &&
      j.status === "OPEN" &&
      (!j.jobDate || new Date(j.jobDate).getTime() <= now),
  ).length;
  const seedClientScheduledJobs = allJobs.filter(
    (j) =>
      j.userId === seedClient.id &&
      j.status === "OPEN" &&
      j.jobDate &&
      new Date(j.jobDate).getTime() > now,
  ).length;

  console.log("\n✅ DATABASE SUMMARY AFTER UPDATE:");
  console.log(`  - Total Jobs:                      ${allJobs.length}`);
  console.log(`  - Active OPEN Jobs (Open Tab):     ${openImmediateCount}`);
  console.log(`  - SCHEDULED Jobs (Scheduled Tab):  ${scheduledCount}`);
  console.log(`  - Seed Client OPEN Jobs:           ${seedClientOpenJobs}`);
  console.log(`  - Seed Client SCHEDULED Jobs:      ${seedClientScheduledJobs}`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
