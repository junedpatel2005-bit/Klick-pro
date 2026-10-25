import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const suratPro = await db.user.findUnique({
    where: { email: "surat.pro@servio.example" },
  });

  console.log("Found surat.pro user:", suratPro ? {
    id: suratPro.id,
    email: suratPro.email,
    firstName: suratPro.firstName,
    lastName: suratPro.lastName,
    role: suratPro.role,
  } : "Not found");

  const passwordHash = suratPro?.passwordHash || await bcrypt.hash("ServioSeed#2026", 12);

  const seedPro = await db.user.upsert({
    where: { email: "seed.pro@servio.example" },
    update: {
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
      role: "PROFESSIONAL",
    },
    create: {
      email: "seed.pro@servio.example",
      firstName: "Seed",
      lastName: "Professional",
      phone: "+919876543210",
      phoneVerifiedAt: new Date(),
      passwordHash,
      role: "PROFESSIONAL",
      isActive: true,
      emailVerifiedAt: new Date(),
      professionalCategory: suratPro?.professionalCategory ?? "Development",
      professionalIndustry: suratPro?.professionalIndustry ?? "Information Technology",
      professionalCity: suratPro?.professionalCity ?? "Surat",
      professionalServiceArea: suratPro?.professionalServiceArea ?? "Surat and nearby areas",
      professionalLatitude: suratPro?.professionalLatitude ?? 21.1702,
      professionalLongitude: suratPro?.professionalLongitude ?? 72.8311,
      professionalExperienceYears: 5,
      professionalHourlyRate: 75,
      professionalSkills: ["React", "TypeScript", "Node.js"],
      bio: "Experienced professional for web and mobile development.",
    },
  });

  console.log("Successfully seeded/verified seed.pro@servio.example:", {
    id: seedPro.id,
    email: seedPro.email,
    role: seedPro.role,
    isActive: seedPro.isActive,
    emailVerifiedAt: seedPro.emailVerifiedAt,
  });
}

main().finally(() => db.$disconnect());
