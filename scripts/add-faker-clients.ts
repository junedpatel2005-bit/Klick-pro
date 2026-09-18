import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to seed clients.");

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

const INDUSTRIES = [
  "Information Technology",
  "Real Estate & Property Management",
  "Retail & Consumer Goods",
  "Healthcare & Wellness",
  "Financial & Investment Services",
  "Hospitality & Food Services",
  "Manufacturing & Engineering",
  "Education & Training",
  "Architecture & Interior Construction",
  "Digital Media & Advertising",
  "Facility Management & Security",
  "E-commerce & Logistics",
];

const HIRING_NEEDS_OPTIONS = [
  "Residential Deep Cleaning",
  "Commercial Facility Maintenance",
  "Full Stack Web & Mobile Development",
  "Electrical & Solar Installation",
  "Interior Design & Renovation",
  "Security & Surveillance Systems",
  "HVAC & Cooling Systems",
  "Plumbing & Sanitation Works",
  "Brand Identity & UI/UX Design",
  "Corporate Event Management",
];

const CLIENT_COUNT = 60;
const CLIENT_DEFAULT_PASSWORD = "ClientPass#2026";

async function main() {
  console.log(`Starting generation of ${CLIENT_COUNT} clients with Faker...`);

  const passwordHash = await bcrypt.hash(CLIENT_DEFAULT_PASSWORD, 12);
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  const timestamp = Date.now();
  const rawUsersData: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: "CLIENT";
    authProvider: string;
    emailVerifiedAt: Date;
    companyName: string | null;
    companyWebsite: string | null;
    industry: string | null;
    teamSize: string;
    companyDescription: string | null;
    address: string;
    hiringNeedsJson: string;
    savedLocationsJson: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    city: string;
    state: string;
    lat: number;
    lng: number;
    selectedNeeds: string[];
  }> = [];

  for (let i = 1; i <= CLIENT_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const safeEmailFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeEmailLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `client.${safeEmailFirst}.${safeEmailLast}.${timestamp.toString().slice(-4)}${i}@klickpro.example`;
    const phone = `+9198${String(10000000 + (timestamp % 100000) * 100 + i * 31).slice(-8)}`;

    const cityObj = INDIAN_CITIES[i % INDIAN_CITIES.length]!;
    const hasCompany = i % 3 !== 0;
    const companyName = hasCompany ? faker.company.name() : null;
    const companyWebsite = hasCompany
      ? `https://www.${companyName?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "biz"}.in`
      : null;
    const industry = hasCompany ? INDUSTRIES[i % INDUSTRIES.length]! : null;
    const teamSize = hasCompany
      ? faker.helpers.arrayElement(["1-10", "11-50", "51-200"])
      : "Just me";
    const companyDescription = hasCompany ? faker.company.catchPhrase() : null;
    const streetAddress = `${faker.location.buildingNumber()}, ${faker.location.street()}, ${cityObj.city}, ${cityObj.state}`;
    const createdAt = faker.date.recent({ days: 90 });

    const selectedNeeds = faker.helpers.arrayElements(HIRING_NEEDS_OPTIONS, { min: 1, max: 3 });

    rawUsersData.push({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      role: "CLIENT",
      authProvider: "LOCAL",
      emailVerifiedAt: createdAt,
      companyName,
      companyWebsite,
      industry,
      teamSize,
      companyDescription,
      address: streetAddress,
      hiringNeedsJson: JSON.stringify(selectedNeeds),
      savedLocationsJson: JSON.stringify([
        {
          label: "Primary Site / HQ",
          address: streetAddress,
          city: cityObj.city,
          state: cityObj.state,
          lat: cityObj.lat,
          lng: cityObj.lng,
        },
      ]),
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      city: cityObj.city,
      state: cityObj.state,
      lat: cityObj.lat,
      lng: cityObj.lng,
      selectedNeeds,
    });
  }

  // 1. Bulk create users and return created records
  console.log("Creating User records in database...");
  const createdUsers = await db.user.createManyAndReturn({
    data: rawUsersData.map(({ city, state, lat, lng, selectedNeeds, ...userData }) => userData),
  });

  console.log(`Created ${createdUsers.length} User records.`);

  // 2. Prepare and bulk create ClientProfiles
  console.log("Creating Client Profiles...");
  const profilesData = createdUsers.map((user) => ({
    userId: user.id,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    phone: user.phone ?? `+919800000000`,
    companyName: user.companyName,
    companyWebsite: user.companyWebsite,
    industry: user.industry,
    teamSize: user.teamSize,
    companyDescription: user.companyDescription,
    address: user.address ?? "India",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));

  const createdProfiles = await db.clientProfile.createManyAndReturn({
    data: profilesData,
  });

  console.log(`Created ${createdProfiles.length} Client Profile records.`);

  // 3. Bulk create Wallets
  console.log("Creating Client Wallets...");
  await db.wallet.createMany({
    data: createdUsers.map((user) => ({
      userId: user.id,
      balance: faker.helpers.arrayElement([0, 5000, 15000, 25000, 50000]),
    })),
  });

  // 4. Bulk create Saved Locations & Hiring Needs
  console.log("Creating Saved Locations & Hiring Needs...");
  const savedLocationsData: Array<{
    clientProfileId: number;
    label: string;
    address: string;
    isPrimary: boolean;
    createdAt: Date;
  }> = [];

  const hiringNeedsData: Array<{
    clientProfileId: number;
    value: string;
    createdAt: Date;
  }> = [];

  createdProfiles.forEach((profile, idx) => {
    const raw = rawUsersData[idx]!;
    savedLocationsData.push({
      clientProfileId: profile.id,
      label: "Office / Primary Site",
      address: profile.address,
      isPrimary: true,
      createdAt: profile.createdAt,
    });

    raw.selectedNeeds.forEach((need) => {
      hiringNeedsData.push({
        clientProfileId: profile.id,
        value: need,
        createdAt: profile.createdAt,
      });
    });
  });

  await db.clientSavedLocation.createMany({ data: savedLocationsData });
  await db.clientHiringNeed.createMany({ data: hiringNeedsData });

  // 5. Bulk create Admin Notifications
  if (admins.length > 0) {
    console.log("Creating Admin Notifications for new client accounts...");
    const adminNotifData: Array<{
      userId: number;
      type: string;
      title: string;
      description: string;
      href: string;
      createdAt: Date;
    }> = [];

    createdUsers.forEach((user, idx) => {
      const raw = rawUsersData[idx]!;
      admins.forEach((admin) => {
        adminNotifData.push({
          userId: admin.id,
          type: "NEW_ACCOUNT",
          title: "New client registration",
          description: `${user.firstName} ${user.lastName}${user.companyName ? ` from ${user.companyName}` : ""} registered as a client from ${raw.city}.`,
          href: `/admin/users?id=${user.id}`,
          createdAt: user.createdAt,
        });
      });
    });

    await db.userNotification.createMany({ data: adminNotifData });
  }

  console.log(`\n======================================================`);
  console.log(`🎉 SUCCESS: Added ${createdUsers.length} Clients with Faker!`);
  console.log(`======================================================`);
  console.log(`Sample of created clients:`);
  createdUsers.slice(0, 10).forEach((c, idx) => {
    console.log(` ${idx + 1}. [ID: ${c.id}] ${c.firstName} ${c.lastName} (${c.email})`);
  });
  console.log(`\nDefault password for seeded accounts: ${CLIENT_DEFAULT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Error creating clients:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
