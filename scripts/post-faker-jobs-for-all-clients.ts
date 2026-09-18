import "dotenv/config";
import { faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to post jobs.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const INDIAN_CITIES = [
  { city: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { city: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { city: "Navsari", state: "Gujarat", lat: 20.9467, lng: 72.952 },
  { city: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812 },
  { city: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { city: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { city: "Delhi", state: "Delhi", lat: 28.7041, lng: 77.1025 },
  { city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.391 },
  { city: "Gurugram", state: "Haryana", lat: 28.4595, lng: 77.0266 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { city: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { city: "Chandigarh", state: "Punjab", lat: 30.7333, lng: 76.7794 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { city: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { city: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
];

function generateTitle(subcatName: string, catName: string, city: string): string {
  const templates = [
    `Professional ${subcatName} Required Urgently in ${city}`,
    `Need Experienced Specialist for ${subcatName} (${catName})`,
    `Looking for Certified Professional for ${subcatName}`,
    `Immediate Requirement: ${subcatName} Project in ${city}`,
    `${subcatName} — Installation & Maintenance Contract`,
    `Urgent: ${subcatName} for Commercial / Residential Property`,
    `Hire Trusted & Verified Expert for ${subcatName}`,
    `Contractor Needed: ${subcatName} (${city})`,
  ];
  return faker.helpers.arrayElement(templates);
}

function generateDescription(subcatName: string, catName: string, city: string): string {
  return (
    `We are looking for a qualified, highly skilled professional to handle ${subcatName} under ${catName} in ${city}.\n\n` +
    `Scope of Work & Objectives:\n` +
    `• High-quality execution of ${subcatName.toLowerCase()} adhering strictly to safety and industry standards.\n` +
    `• Punctual on-site arrival, proper equipment/tools, and use of genuine materials.\n` +
    `• Clear milestone updates and milestone-based signoff.\n` +
    `• Previous verifiable experience in ${city} or surrounding region is highly preferred.\n\n` +
    `Please submit your proposal with estimated completion timeline, budget quote, and references or past work samples.`
  );
}

async function main() {
  console.log("Fetching all client accounts and category catalog...");

  const [clients, categories, admins] = await Promise.all([
    db.user.findMany({
      where: { role: "CLIENT", isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        companyName: true,
        address: true,
      },
      orderBy: { id: "asc" },
    }),
    db.serviceCategory.findMany({
      where: { parentId: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        parent: { select: { id: true, name: true, segment: true } },
      },
    }),
    db.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    }),
  ]);

  if (clients.length === 0) {
    throw new Error("No active clients found in database.");
  }
  if (categories.length === 0) {
    throw new Error("No service categories found in database.");
  }

  console.log(`Found ${clients.length} clients and ${categories.length} categories.`);

  const jobsToCreate: Array<{
    userId: number;
    title: string;
    category: string;
    description: string;
    budgetMin: number | null;
    budgetMax: number | null;
    hourlyRate: number | null;
    timingType: string;
    urgency: "LOW" | "MEDIUM" | "HIGH";
    workMode: "ON_SITE" | "REMOTE" | "BOTH";
    locationLabel: string;
    locationAddress: string;
    locationState: string;
    locationLat: number;
    locationLng: number;
    deadline: Date;
    jobDate: Date;
    status: "OPEN";
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  let catIndex = 0;

  for (const client of clients) {
    // Determine how many jobs this client posts (1 or 2 jobs)
    const jobsCount = faker.helpers.arrayElement([1, 1, 2]);

    for (let j = 0; j < jobsCount; j++) {
      const selectedCategory = categories[catIndex % categories.length]!;
      catIndex++;

      const cityInfo = INDIAN_CITIES[(client.id + j) % INDIAN_CITIES.length]!;
      const title = generateTitle(
        selectedCategory.name,
        selectedCategory.parent?.name ?? "Services",
        cityInfo.city,
      );
      const description = generateDescription(
        selectedCategory.name,
        selectedCategory.parent?.name ?? "Services",
        cityInfo.city,
      );

      const isHourly = faker.datatype.boolean({ probability: 0.25 });
      const budgetMin = isHourly ? null : faker.number.int({ min: 1500, max: 8000 });
      const budgetMax = isHourly ? null : faker.number.int({ min: 10000, max: 45000 });
      const hourlyRate = isHourly ? faker.number.int({ min: 60, max: 250 }) : null;

      const urgency: "LOW" | "MEDIUM" | "HIGH" = faker.helpers.arrayElement([
        "MEDIUM",
        "HIGH",
        "LOW",
      ]);
      const workMode: "ON_SITE" | "REMOTE" | "BOTH" = faker.helpers.arrayElement([
        "ON_SITE",
        "ON_SITE",
        "BOTH",
        "REMOTE",
      ]);

      const createdAt = faker.date.recent({ days: 30 });
      const jobDate = faker.date.soon({ days: 14, refDate: createdAt });
      const deadline = faker.date.soon({ days: 30, refDate: jobDate });

      const streetAddress =
        client.address ||
        `${faker.location.buildingNumber()}, ${faker.location.street()}, ${cityInfo.city}, ${cityInfo.state}`;

      jobsToCreate.push({
        userId: client.id,
        title,
        category: selectedCategory.name,
        description,
        budgetMin,
        budgetMax,
        hourlyRate,
        timingType: isHourly ? "HOURLY" : "FIXED",
        urgency,
        workMode,
        locationLabel: workMode === "REMOTE" ? "Remote" : cityInfo.city,
        locationAddress: streetAddress,
        locationState: cityInfo.state,
        locationLat: cityInfo.lat,
        locationLng: cityInfo.lng,
        deadline,
        jobDate,
        status: "OPEN",
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  console.log(`Prepared ${jobsToCreate.length} jobs for ${clients.length} clients.`);
  console.log("Bulk creating jobs in database...");

  const createdJobs = await db.clientJob.createManyAndReturn({
    data: jobsToCreate,
  });

  console.log(`Successfully created ${createdJobs.length} active jobs!`);

  // Bulk create Admin Notifications for new job postings
  if (admins.length > 0) {
    console.log("Creating Admin Notifications for new jobs...");
    const adminNotifData: Array<{
      userId: number;
      type: string;
      title: string;
      description: string;
      href: string;
      createdAt: Date;
    }> = [];

    // Create notifications for a sample of the new jobs
    createdJobs.slice(0, 80).forEach((job) => {
      admins.forEach((admin) => {
        adminNotifData.push({
          userId: admin.id,
          type: "NEW_JOB",
          title: "New job posted",
          description: `${job.title} is now open for proposals in ${job.category}.`,
          href: `/admin/operations?job=${job.id}`,
          createdAt: job.createdAt,
        });
      });
    });

    await db.userNotification.createMany({ data: adminNotifData });
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS: Posted ${createdJobs.length} Jobs across all clients!`);
  console.log(`======================================================`);
  console.log(`Sample of posted jobs:`);
  createdJobs.slice(0, 10).forEach((j, idx) => {
    console.log(
      ` ${idx + 1}. [Job #${j.id}] ${j.title} | Category: ${j.category} | Mode: ${j.workMode}`,
    );
  });
}

main()
  .catch((err) => {
    console.error("Error posting jobs for clients:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
