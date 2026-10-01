import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function auditDatabase() {
  console.log("=========================================");
  console.log("         DATABASE INTEGRITY AUDIT        ");
  console.log("=========================================");

  // 1. Connection check
  const connResult = await db.$queryRawUnsafe<
    { total_conn: string; active_conn: string; idle_in_tx: string }[]
  >(
    "SELECT count(*) as total_conn, count(*) FILTER (WHERE state = 'active') as active_conn, count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_tx FROM pg_stat_activity WHERE datname = current_database()",
  );
  console.log("\n[1] Connection Pool Status:");
  console.log(`    Total connections: ${connResult[0].total_conn}`);
  console.log(`    Active connections: ${connResult[0].active_conn}`);
  console.log(`    Idle in transaction (hung): ${connResult[0].idle_in_tx}`);

  // 2. Transaction status audit
  const [failedWT, pendingWT, compWT] = await Promise.all([
    db.walletTransaction.count({ where: { status: "FAILED" } }),
    db.walletTransaction.count({ where: { status: "PENDING" } }),
    db.walletTransaction.count({ where: { status: "COMPLETED" } }),
  ]);
  console.log("\n[2] Wallet Transactions:");
  console.log(`    COMPLETED: ${compWT}`);
  console.log(`    PENDING:   ${pendingWT}`);
  console.log(`    FAILED:    ${failedWT}`);

  const [failedPay, fundedPay, compPay] = await Promise.all([
    db.payment.count({ where: { status: "FAILED" } }),
    db.payment.count({ where: { status: "FUNDED" } }),
    db.payment.count({ where: { status: "COMPLETED" } }),
  ]);
  console.log("\n[3] Payments:");
  console.log(`    COMPLETED: ${compPay}`);
  console.log(`    FUNDED:    ${fundedPay}`);
  console.log(`    FAILED:    ${failedPay}`);

  const [failedWithdraw, pendingWithdraw, compWithdraw] = await Promise.all([
    db.projectWithdrawal.count({ where: { status: "FAILED" } }),
    db.projectWithdrawal.count({ where: { status: "PENDING" } }),
    db.projectWithdrawal.count({ where: { status: "COMPLETED" } }),
  ]);
  console.log("\n[4] Withdrawals:");
  console.log(`    COMPLETED: ${compWithdraw}`);
  console.log(`    PENDING:   ${pendingWithdraw}`);
  console.log(`    FAILED:    ${failedWithdraw}`);

  // 3. Foreign key & orphan check
  console.log("\n[5] Relational Integrity & Orphan Check:");

  const orphanedWallets = await db.$queryRawUnsafe<
    { id: number; userId: number; balance: number }[]
  >(
    'SELECT w.id, w."userId", w.balance FROM "Wallet" w LEFT JOIN "User" u ON w."userId" = u.id WHERE u.id IS NULL',
  );
  console.log(`    Orphaned Wallets (no user): ${orphanedWallets.length}`, orphanedWallets);

  const orphanedWT = await db.$queryRawUnsafe<{ id: number }[]>(
    'SELECT wt.id FROM "WalletTransaction" wt LEFT JOIN "Wallet" w ON wt."walletId" = w.id WHERE w.id IS NULL',
  );
  console.log(`    Orphaned Wallet Transactions (no wallet): ${orphanedWT.length}`);

  const orphanedMilestones = await db.$queryRawUnsafe<{ id: number }[]>(
    'SELECT pm.id FROM "ProjectMilestone" pm LEFT JOIN "ProjectTracking" pt ON pm."trackingId" = pt.id WHERE pt.id IS NULL',
  );
  console.log(`    Orphaned Milestones (no tracking): ${orphanedMilestones.length}`);

  const orphanedPayments = await db.payment.findMany({
    where: {
      milestoneId: { not: null },
      milestone: null,
    },
    select: { id: true, milestoneId: true },
  });
  console.log(`    Orphaned Payments (no milestone): ${orphanedPayments.length}`);

  // 4. Wallet balance vs ledger consistency check
  console.log("\n[6] Wallet Balance vs Ledger Audit:");
  const wallets = await db.wallet.findMany();
  let balanceMismatches = 0;
  for (const w of wallets) {
    const sumResult = await db.walletTransaction.aggregate({
      where: { walletId: w.id, status: "COMPLETED" },
      _sum: { amount: true },
    });
    const ledgerSum = sumResult._sum.amount ?? 0;
    if (w.balance !== ledgerSum) {
      balanceMismatches++;
      console.log(
        `    Wallet ID ${w.id} (User ${w.userId}): cached balance = ${w.balance}, ledger sum = ${ledgerSum}`,
      );
    }
  }
  if (balanceMismatches === 0) {
    console.log(
      `    All ${wallets.length} wallets are in 100% mathematical balance with their ledger!`,
    );
  } else {
    console.log(
      `    ${balanceMismatches} wallet(s) have discrepancy between cached balance and ledger sum.`,
    );
  }

  // 5. Index and table size audit
  console.log("\n[7] Database Storage & Engine Health:");
  const dbSizeRes = await db.$queryRawUnsafe<{ db_size: string }[]>(
    "SELECT pg_size_pretty(pg_database_size(current_database())) as db_size",
  );
  console.log(`    Database Size: ${dbSizeRes[0].db_size}`);

  const engineStats = await db.$queryRawUnsafe<
    {
      xact_commit: string;
      xact_rollback: string;
      conflicts: string;
      deadlocks: string;
      cache_hit_pct: number | null;
    }[]
  >(
    "SELECT xact_commit, xact_rollback, conflicts, deadlocks, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) as cache_hit_pct FROM pg_stat_database WHERE datname = current_database()",
  );
  console.log(`    Committed Transactions: ${engineStats[0].xact_commit}`);
  console.log(`    Rolled Back Transactions: ${engineStats[0].xact_rollback}`);
  console.log(`    Deadlocks Encountered: ${engineStats[0].deadlocks}`);
  console.log(`    Buffer Cache Hit Ratio: ${engineStats[0].cache_hit_pct}%`);

  console.log("\n=========================================");
  console.log("            AUDIT COMPLETED              ");
  console.log("=========================================");
}

auditDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit error:", err);
    process.exit(1);
  });
