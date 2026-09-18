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

function generateTitle(subcatName: string, catName: string): string {
  const templates = [
    `Professional ${subcatName} Required Urgently`,
    `Need Experienced Specialist for ${subcatName}`,
    `Looking for Certified Professional for ${subcatName}`,
    `Immediate Requirement: ${subcatName} Service`,
    `${subcatName} — Project Work & Maintenance`,
    `Urgent: ${subcatName} for Property`,
    `Hire Trusted Expert for ${subcatName}`,
  ];
  return faker.helpers.arrayElement(templates);
}

function generateDescription(subcatName: string, catName: string, city: string): string {
  return (
    `We are looking for a reliable, experienced professional for ${subcatName} under ${catName} in ${city}.\n\n` +
    `Scope of Work:\n` +
    `• High-quality execution of ${subcatName.toLowerCase()} adhering to safety standards.\n` +
    `• Prompt arrival and thorough completion with genuine parts / materials.\n` +
    `• Prior experience with similar projects in ${city} is preferred.\n\n` +
    `Please submit your quote, estimated completion time, and any relevant work samples.`
  );
}

async function main() {
  faker.seed(20260901);

  // 1. Get or create the client accounts
  const seedClient = await db.user.findUnique({
    where: { email: "seed.client@servio.example" },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!seedClient) throw new Error("Seed Client account (seed.client@servio.example) not found.");

  // Secondary clients
  let client2 = await db.user.findFirst({
    where: { email: "client.zub@yopmail.com", role: "CLIENT" },
    select: { id: true, email: true },
  });
  if (!client2) {
    client2 = await db.user.findFirst({
      where: { role: "CLIENT", id: { not: seedClient.id } },
      select: { id: true, email: true },
    });
  }

  let client3 = await db.user.findFirst({
    where: { email: "qa.tester.signup@servio.example", role: "CLIENT" },
    select: { id: true, email: true },
  });
  if (!client3 || client3.id === client2?.id) {
    client3 = await db.user.findFirst({
      where: { role: "CLIENT", id: { notIn: [seedClient.id, client2?.id ?? 0] } },
      select: { id: true, email: true },
    });
  }

  const clientAccounts = [seedClient, client2 ?? seedClient, client3 ?? seedClient];

  console.log("Using Client Accounts:");
  console.log(`  1. Seed Client (Primary): ID #${seedClient.id} (${seedClient.email})`);
  console.log(
    `  2. Secondary Client 1:    ID #${clientAccounts[1].id} (${clientAccounts[1].email})`,
  );
  console.log(
    `  3. Secondary Client 2:    ID #${clientAccounts[2].id} (${clientAccounts[2].email})`,
  );

  // 2. Fetch all subcategories (Tier 3) and categories (Tier 2)
  const categories = await db.serviceCategory.findMany({
    where: {
      parentId: { not: null }, // Only subcategories and main categories
    },
    include: { parent: true },
    orderBy: [{ segment: "asc" }, { sortOrder: "asc" }],
  });

  console.log(`\nFound ${categories.length} categories/subcategories to generate jobs for.`);

  let seedClientJobCount = 0;
  let client2JobCount = 0;
  let client3JobCount = 0;
  let createdCount = 0;

  const jobsToCreate = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]!;
    const loc = INDIAN_LOCATIONS[i % INDIAN_LOCATIONS.length]!;

    // Distribute: Every subcat gets a job.
    // 60% assigned to Seed Client, 20% to Client 2, 20% to Client 3
    let assignedClient = seedClient;
    if (i % 5 === 3) assignedClient = clientAccounts[1];
    else if (i % 5 === 4) assignedClient = clientAccounts[2];

    const budgetBase =
      cat.segment === "INDUSTRIAL"
        ? faker.number.int({ min: 15000, max: 75000 })
        : cat.segment === "COMMERCIAL"
          ? faker.number.int({ min: 8000, max: 40000 })
          : faker.number.int({ min: 1500, max: 12000 });

    const budgetMax =
      budgetBase + faker.number.int({ min: 500, max: Math.max(800, Math.ceil(budgetBase * 0.5)) });
    const isHourly = faker.datatype.boolean({ probability: 0.25 });
    const hourlyRate = isHourly ? faker.number.int({ min: 150, max: 1200 }) : null;

    const title = generateTitle(cat.name, cat.parent?.name ?? cat.name);
    const description = generateDescription(cat.name, cat.parent?.name ?? cat.name, loc.city);

    const now = Date.now();
    const jobDate = new Date(now + faker.number.int({ min: 1, max: 14 }) * 86400000);
    const deadline = new Date(jobDate.getTime() + faker.number.int({ min: 3, max: 21 }) * 86400000);

    const jobData = {
      userId: assignedClient.id,
      category: cat.name,
      title,
      description,
      status: "OPEN" as const,
      timingType: isHourly ? "HOURLY" : "FIXED",
      budgetMin: isHourly ? null : budgetBase,
      budgetMax: isHourly ? null : budgetMax,
      hourlyRate,
      urgency: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
      workMode: faker.helpers.arrayElement(["ON_SITE", "REMOTE", "BOTH"] as const),
      locationLabel: `${loc.city}, ${loc.state}`,
      locationAddress: `${faker.location.buildingNumber()}, ${faker.location.street()}, ${loc.city}, ${loc.state} 396445, India`,
      locationDistrict: loc.city,
      locationState: loc.state,
      locationLat: loc.lat + (Math.random() - 0.5) * 0.03,
      locationLng: loc.lng + (Math.random() - 0.5) * 0.03,
      jobDate,
      deadline,
      paymentMethod: "WALLET",
    };

    jobsToCreate.push(jobData);

    if (assignedClient.id === seedClient.id) seedClientJobCount++;
    else if (assignedClient.id === clientAccounts[1].id) client2JobCount++;
    else client3JobCount++;
  }

  console.log(`\nInserting ${jobsToCreate.length} jobs into the database...`);

  // Insert in batches of 50
  for (let i = 0; i < jobsToCreate.length; i += 50) {
    const batch = jobsToCreate.slice(i, i + 50);
    await db.clientJob.createMany({
      data: batch,
    });
    createdCount += batch.length;
    console.log(`  Inserted ${createdCount}/${jobsToCreate.length} jobs...`);
  }

  console.log("\n✅ ALL SUBCATEGORY JOBS CREATED SUCCESSFULLY!");
  console.log(`  - Total Jobs Created:              ${createdCount}`);
  console.log(`  - Seed Client (Your Account #30):  ${seedClientJobCount} jobs`);
  console.log(`  - Secondary Client 1 (#${clientAccounts[1].id}):       ${client2JobCount} jobs`);
  console.log(`  - Secondary Client 2 (#${clientAccounts[2].id}):       ${client3JobCount} jobs`);
  console.log(`  - Total Subcategories Covered:     ${categories.length}`);
}

main()
  .catch((err) => {
    console.error("Failed to seed subcategory jobs:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
