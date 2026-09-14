import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function runAudit() {
  console.log("=== LIVE DATABASE AUDIT REPORT ===\n");

  // 1. Table Counts & Inventory
  const tables = await db.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log(`Total Public Tables: ${tables.length}`);
  console.log("Tables:", tables.map((t) => t.table_name).join(", "));
  console.log("");

  // 2. Migration Status
  const migrations = await db.$queryRaw<
    Array<{ migration_name: string; finished_at: Date; rolled_back_at: Date | null }>
  >(Prisma.sql`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at;
  `);
  console.log(`Prisma Migrations Applied: ${migrations.length}`);
  const failedMigrations = migrations.filter((m) => m.rolled_back_at || !m.finished_at);
  if (failedMigrations.length > 0) {
    console.log("⚠️ Failed/Rolled-back Migrations:", failedMigrations);
  } else {
    console.log("✅ All migrations applied cleanly without rollbacks.");
  }
  console.log("");

  // 3. Row Counts
  console.log("--- Row Counts by Entity ---");
  const countQueries: Array<{ name: string; query: Promise<number> }> = [
    { name: "User", query: db.user.count() },
    { name: "Session", query: db.session.count() },
    { name: "ClientProfile", query: db.clientProfile.count() },
    { name: "ClientJob", query: db.clientJob.count() },
    { name: "ServiceCategory", query: db.serviceCategory.count() },
    { name: "Service", query: db.service.count() },
    { name: "ProjectRequest", query: db.projectRequest.count() },
    { name: "ProjectTracking", query: db.projectTracking.count() },
    { name: "ProjectMilestone", query: db.projectMilestone.count() },
    { name: "Payment", query: db.payment.count() },
    { name: "Wallet", query: db.wallet.count() },
    { name: "WalletTransaction", query: db.walletTransaction.count() },
    { name: "ProjectDispute", query: db.projectDispute.count() },
    { name: "AuditLog", query: db.auditLog.count() },
    { name: "CmsPage", query: db.cmsPage.count() },
  ];

  for (const { name, query } of countQueries) {
    try {
      const count = await query;
      console.log(`  ${name.padEnd(20)}: ${count} rows`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`  ${name.padEnd(20)}: ERROR (${message})`);
    }
  }
  console.log("");

  // 4. Orphan & Integrity Checks
  console.log("--- Relational Integrity & Orphan Checks ---");
  const orphanPayments = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT p.id FROM "Payment" p LEFT JOIN "User" u ON u.id = p."clientId" WHERE u.id IS NULL;
  `);
  console.log(`  Orphan Payments (Missing Client): ${orphanPayments.length}`);

  const orphanTrackings = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT t.id FROM "ProjectTracking" t LEFT JOIN "ProjectRequest" r ON r.id = t."requestId" WHERE r.id IS NULL;
  `);
  console.log(`  Orphan Trackings (Missing Request): ${orphanTrackings.length}`);

  const orphanMilestones = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT m.id FROM "ProjectMilestone" m LEFT JOIN "ProjectTracking" t ON t.id = m."trackingId" WHERE t.id IS NULL;
  `);
  console.log(`  Orphan Milestones (Missing Tracking): ${orphanMilestones.length}`);

  const orphanProfiles = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT p.id FROM "ClientProfile" p LEFT JOIN "User" u ON u.id = p."userId" WHERE u.id IS NULL;
  `);
  console.log(`  Orphan Client Profiles (Missing User): ${orphanProfiles.length}`);
  console.log("");

  // 5. Uniqueness & Duplicate Checks
  console.log("--- Duplicate & Uniqueness Checks ---");
  const duplicateEmails = await db.$queryRaw<
    Array<{ normalized_email: string; count: number }>
  >(Prisma.sql`
    SELECT lower(email) AS normalized_email, count(*) AS count
    FROM "User" WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1;
  `);
  console.log(`  Duplicate User Emails: ${duplicateEmails.length}`);

  const duplicateProfiles = await db.$queryRaw<Array<{ userId: number; count: number }>>(Prisma.sql`
    SELECT "userId", count(*) AS count FROM "ClientProfile" GROUP BY "userId" HAVING count(*) > 1;
  `);
  console.log(`  Duplicate Client Profiles per User: ${duplicateProfiles.length}`);

  const duplicatePrimaryLocations = await db.$queryRaw<
    Array<{ clientProfileId: number; count: number }>
  >(Prisma.sql`
    SELECT "clientProfileId", count(*) AS count FROM "ClientSavedLocation" WHERE "isPrimary" = true GROUP BY "clientProfileId" HAVING count(*) > 1;
  `);
  console.log(`  Duplicate Primary Locations per Profile: ${duplicatePrimaryLocations.length}`);
  console.log("");

  // 6. Financial Integrity Checks
  console.log("--- Financial Consistency Checks ---");
  const negativePayments = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT id FROM "Payment"
    WHERE amount < 0 OR base_amount < 0 OR client_fee_amount < 0
       OR professional_payout_amount < 0 OR admin_net_amount < 0;
  `);
  console.log(`  Negative Payment Fields: ${negativePayments.length}`);

  const negativeWallets = await db.$queryRaw<Array<{ id: number; balance: number }>>(Prisma.sql`
    SELECT id, balance FROM "Wallet" WHERE balance < 0 OR "pendingBalance" < 0;
  `);
  console.log(`  Negative Wallet Balances: ${negativeWallets.length}`);

  const feeMismatches = await db.$queryRaw<
    Array<{
      id: number;
      amount: number;
      base_amount: number;
      client_fee_amount: number;
      status: string;
    }>
  >(Prisma.sql`
    SELECT id, amount, base_amount, client_fee_amount, status FROM "Payment"
    WHERE amount <> base_amount + client_fee_amount
       OR professional_payout_amount + admin_net_amount <> amount;
  `);
  console.log(`  Payment Fee / Math Mismatches: ${feeMismatches.length}`);
  if (feeMismatches.length > 0) {
    console.log("  Mismatched rows:", feeMismatches);
  }
  console.log("");

  // 7. Foreign Key & Index Checks
  console.log("--- Database Constraints & Indexes ---");
  const fkeys = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*) AS count FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
  `);
  console.log(`  Total Active Foreign Keys: ${fkeys[0].count}`);

  const indexes = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*) AS count FROM pg_indexes WHERE schemaname = 'public';
  `);
  console.log(`  Total Active PostgreSQL Indexes: ${indexes[0].count}`);
  console.log("");

  // 8. RLS (Row Level Security) Status
  console.log("--- Row Level Security (RLS) Status ---");
  const rlsStatus = await db.$queryRaw<
    Array<{ tablename: string; rls_enabled: boolean }>
  >(Prisma.sql`
    SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY c.relname;
  `);
  const rlsEnabledTables = rlsStatus.filter((r) => r.rls_enabled);
  console.log(`  Tables with RLS Enabled: ${rlsEnabledTables.length} / ${rlsStatus.length}`);
  if (rlsEnabledTables.length > 0) {
    console.log(`  RLS Enabled On: ${rlsEnabledTables.map((t) => t.tablename).join(", ")}`);
  }

  await db.$disconnect();
  console.log("\n=== AUDIT COMPLETE ===");
}

runAudit().catch(console.error);
