import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getIndiaDemoLocation } from "./india-demo-locations";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const KEEP_EMAILS = [
  "junedpatel2005@gmail.com",
  "seed.client@servio.example",
  "surat.pro@servio.example",
];
const JOB_OWNER_EMAIL = "seed.client@servio.example";
const PASSWORD = "Password@123";

async function main() {
  const preservedPasswordHash = await bcrypt.hash(PASSWORD, 12);
  await db.user.upsert({
    where: { email: "seed.client@servio.example" },
    update: { role: "CLIENT", isActive: true, emailVerifiedAt: new Date() },
    create: {
      role: "CLIENT",
      firstName: "Seed",
      lastName: "Client",
      email: "seed.client@servio.example",
      username: "seed_client",
      passwordHash: preservedPasswordHash,
      isActive: true,
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
    },
  });
  await db.user.upsert({
    where: { email: "surat.pro@servio.example" },
    update: { role: "PROFESSIONAL", isActive: true, emailVerifiedAt: new Date() },
    create: {
      role: "PROFESSIONAL",
      firstName: "Surat",
      lastName: "Professional",
      email: "surat.pro@servio.example",
      username: "surat_pro",
      passwordHash: preservedPasswordHash,
      professionalCategory: "General Services",
      professionalSkillsJson: JSON.stringify(["General Services"]),
      professionalCity: "Surat",
      professionalState: "Gujarat",
      isVerified: true,
      isActive: true,
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
    },
  });
  const keptUsers = await db.user.findMany({
    where: { email: { in: KEEP_EMAILS } },
    select: { id: true, email: true },
  });
  const missing = KEEP_EMAILS.filter((email) => !keptUsers.some((user) => user.email === email));
  if (missing.length) throw new Error(`Preserved accounts not found: ${missing.join(", ")}`);
  const jobOwner = keptUsers.find((user) => user.email === JOB_OWNER_EMAIL)!;

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const keepIds = [
    ...new Set([...admins.map((user) => user.id), ...keptUsers.map((user) => user.id)]),
  ];
  const oldIds = (
    await db.user.findMany({ where: { id: { notIn: keepIds } }, select: { id: true } })
  ).map((user) => user.id);

  const leafCategories = await db.serviceCategory.findMany({
    where: { children: { none: {} } },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  if (leafCategories.length < 270) {
    throw new Error(`Expected at least 270 leaf categories, found ${leafCategories.length}`);
  }

  await db.$transaction(
    async (tx) => {
      // Preserve every existing job, including its title, description, status and dates.
      await tx.clientJob.updateMany({
        where: { userId: { not: jobOwner.id } },
        data: { userId: jobOwner.id },
      });

      if (oldIds.length) {
        // Remove rows belonging to deleted users across both current and legacy user-data tables.
        // ClientJob is deliberately excluded above: jobs are the one preserved data set.
        const tables = await tx.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
          `SELECT DISTINCT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
         WHERE c.table_schema = 'public'
           AND t.table_type = 'BASE TABLE'
           AND c.data_type IN ('integer', 'bigint')
           AND c.column_name IN (
             'userId','user_id','clientId','client_id','professionalId','professional_id',
             'ownerId','owner_id','senderId','sender_id','recipientId','recipient_id',
             'actorId','actor_id','startedBy','started_by','uploadedBy','uploaded_by',
             'reviewedBy','reviewed_by'
           )
           AND c.table_name NOT IN ('ClientJob')`,
        );

        // Dependencies can be nested (messages -> conversations, milestones -> tracking).
        // Repeating the pass lets PostgreSQL remove children first and parents afterward.
        for (let pass = 0; pass < 8; pass += 1) {
          let deleted = 0;
          for (const table of tables) {
            try {
              deleted += await tx.$executeRawUnsafe(
                `DELETE FROM "${table.table_name.replaceAll('"', '""')}" WHERE "${table.column_name.replaceAll('"', '""')}" = ANY($1::int[])`,
                oldIds,
              );
            } catch (error) {
              // A parent row is retried after its dependent rows are removed.
              if (
                !(error instanceof Error) ||
                !error.message.includes("violates foreign key constraint")
              )
                throw error;
            }
          }
          if (!deleted) break;
        }

        await tx.user.deleteMany({ where: { id: { in: oldIds } } });
      }

      faker.seed(20260902);
      const passwordHash = await bcrypt.hash(PASSWORD, 12);
      const professionals = leafCategories.map((category, index) => {
        const email = `faker.pro.${category.id}@seed.servio.example`;
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const location = getIndiaDemoLocation(Math.floor((index + 1) / 3));
        return {
          role: "PROFESSIONAL" as const,
          firstName,
          lastName,
          email,
          username: `faker_pro_${category.id}`,
          passwordHash,
          professionalCategory: category.name,
          professionalCategoryId: category.id,
          professionalSkillsJson: JSON.stringify([category.name]),
          professionalCity: location.city,
          professionalState: location.state,
          professionalDistrict: location.city,
          professionalLatitude: location.lat,
          professionalLongitude: location.lng,
          address: `${faker.location.streetAddress()}, India`,
          hourlyRate: faker.number.int({ min: 250, max: 1800 }),
          fixedRate: faker.number.int({ min: 1500, max: 50000 }),
          experienceYears: faker.number.int({ min: 1, max: 15 }),
          companyDescription: `Verified specialist for ${category.name}.`,
          isVerified: true,
          isActive: true,
          availabilityStatus: "available",
          authProvider: "LOCAL",
        };
      });
      await tx.user.createMany({ data: professionals });
    },
    { timeout: 120000 },
  );

  // UserNotification has no database FK in the legacy schema, so remove orphan rows explicitly.
  const activeUserIds = (await db.user.findMany({ select: { id: true } })).map((user) => user.id);
  await db.userNotification.deleteMany({ where: { userId: { notIn: activeUserIds } } });
  await db.userNotificationState.deleteMany({ where: { userId: { notIn: activeUserIds } } });

  const [users, jobs, notifications, professionals] = await Promise.all([
    db.user.count(),
    db.clientJob.count(),
    db.userNotification.count(),
    db.user.count({ where: { role: "PROFESSIONAL" } }),
  ]);
  console.info(
    JSON.stringify({
      keptEmails: KEEP_EMAILS,
      jobOwner: JOB_OWNER_EMAIL,
      deletedUsers: oldIds.length,
      leafCategories: leafCategories.length,
      users,
      professionals,
      jobs,
      notifications,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
