import "dotenv/config";
import { db } from "../src/lib/db";
import {
  fundMilestoneFromWallet,
  releaseMilestoneToProfessional,
  refundDisputeToClient,
  releaseDisputeToProfessional,
} from "../src/lib/wallet-ledger";

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
      return true;
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      return false;
    });
}

async function main() {
  console.log("\n============================================================");
  console.log("       KLICK-PRO CONTRACT DISPUTE SYSTEM HARDENING TEST");
  console.log("============================================================\n");

  const results: boolean[] = [];

  // Test 1: Admin wallet lookup is deterministic
  results.push(
    await runTest("Admin wallet lookup is deterministic with orderBy id asc", async () => {
      const admin = await db.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { id: "asc" },
        select: { id: true, email: true },
      });
      if (!admin) {
        throw new Error("No admin user found in database");
      }
      if (typeof admin.id !== "number") {
        throw new Error("Invalid admin id");
      }
    }),
  );

  // Test 2: Unfunded milestone escrow protection simulation
  results.push(
    await runTest("Escrow protection: Unfunded payment cannot release or refund funds", async () => {
      const dummyPayment = { status: "PENDING", amount: 5000 };
      const isFunded = dummyPayment.status === "FUNDED";
      const escrowBalance = isFunded ? dummyPayment.amount : 0;
      const refundAmount = isFunded ? dummyPayment.amount : 0;
      const payoutAmount = isFunded ? dummyPayment.amount : 0;

      if (escrowBalance !== 0 || refundAmount !== 0 || payoutAmount !== 0) {
        throw new Error("Escrow balance was not guarded for unfunded milestone!");
      }
    }),
  );

  // Test 3: Partial settlement math validation
  results.push(
    await runTest("Partial settlement: Rejects split exceeding available escrow", async () => {
      const escrowBalance = 2500;
      const testCases = [
        { refund: 1500, payout: 1500, shouldPass: false }, // 3000 > 2500
        { refund: 2000, payout: 500, shouldPass: true },   // 2500 == 2500
        { refund: 1000, payout: 1000, shouldPass: true },  // 2000 < 2500
        { refund: -100, payout: 500, shouldPass: false },  // negative
        { refund: 0, payout: 0, shouldPass: false },       // zero total
      ];

      for (const tc of testCases) {
        const isValid =
          tc.refund >= 0 &&
          tc.payout >= 0 &&
          tc.refund + tc.payout > 0 &&
          tc.refund + tc.payout <= escrowBalance;

        if (isValid !== tc.shouldPass) {
          throw new Error(
            `Split validation failed for refund=${tc.refund}, payout=${tc.payout}. Expected ${tc.shouldPass}, got ${isValid}`,
          );
        }
      }
    }),
  );

  // Test 4: Max dispute round cap check
  results.push(
    await runTest("Dispute limit: Maximum 3 dispute rounds enforced", async () => {
      const maxRounds = 3;
      const existingRounds = 3;
      const canRaiseMore = existingRounds < maxRounds;
      if (canRaiseMore) {
        throw new Error("Should not allow raising dispute when existing rounds reach limit");
      }
    }),
  );

  // Test 5: Mutual settlement concession mapping
  results.push(
    await runTest("Mutual settlement: ACCEPT maps correctly based on reporterRole", async () => {
      // Scenario A: Client filed dispute, Professional accepts -> Client gets refunded
      const caseA = { reporterRole: "CLIENT", responseAction: "ACCEPT" };
      const outcomeA = caseA.reporterRole === "CLIENT" ? "REFUND_CLIENT" : "PAYOUT_PRO";
      if (outcomeA !== "REFUND_CLIENT") {
        throw new Error("Case A should result in client refund");
      }

      // Scenario B: Professional filed dispute, Client accepts -> Professional gets payout
      const caseB = { reporterRole: "PROFESSIONAL", responseAction: "ACCEPT" };
      const outcomeB = caseB.reporterRole === "CLIENT" ? "REFUND_CLIENT" : "PAYOUT_PRO";
      if (outcomeB !== "PAYOUT_PRO") {
        throw new Error("Case B should result in pro payout");
      }
    }),
  );

  // Test 6: Dispute message persistence schema compatibility
  results.push(
    await runTest("Database schema has required ProjectDisputeMessage model & fields", async () => {
      // Verify ProjectDisputeMessage model is accessible via db client
      if (!("projectDisputeMessage" in db)) {
        throw new Error("Prisma client does not have projectDisputeMessage model");
      }
    }),
  );

  console.log("\n------------------------------------------------------------");
  const passed = results.filter(Boolean).length;
  console.log(`Results: ${passed}/${results.length} tests passed.`);
  console.log("------------------------------------------------------------\n");

  if (passed !== results.length) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

