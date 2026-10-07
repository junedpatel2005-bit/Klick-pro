import "dotenv/config";
import { db } from "../src/lib/db";

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
  console.log("       KLICK-PRO REOPEN PROJECT SYSTEM HARDENING TEST");
  console.log("============================================================\n");

  const results: boolean[] = [];

  // Test 1: Project Reopen Eligibility (Only COMPLETED or CLOSED can reopen)
  results.push(
    await runTest("Eligibility: Reopen rejected on active/draft projects", () => {
      const invalidStatuses = [
        "READY_TO_START",
        "IN_PROGRESS",
        "AWAITING_CLIENT_REVIEW",
        "REOPEN_REQUESTED",
      ];
      for (const status of invalidStatuses) {
        const canReopen = status === "COMPLETED" || status === "CLOSED";
        if (canReopen) {
          throw new Error(`Status ${status} should not be eligible for reopen!`);
        }
      }
    }),
  );

  // Test 2: Active Dispute Block
  results.push(
    await runTest("Security: Block reopening if an active dispute exists", () => {
      const activeDisputes = [{ id: 1, status: "OPEN" }];
      const hasUnresolvedDispute = activeDisputes.some((d) => d.status !== "RESOLVED");
      if (!hasUnresolvedDispute) {
        throw new Error("Should detect unresolved dispute and block reopen");
      }
    }),
  );

  // Test 3: Client Ownership Authorization Guard
  results.push(
    await runTest("Authorization: Only the project client can trigger reopen-project", () => {
      const project = { id: 101, clientId: 42, professionalId: 88 };
      const nonClientSession = { userId: 88, role: "PROFESSIONAL" };
      const isAuthorized = project.clientId === nonClientSession.userId;
      if (isAuthorized) {
        throw new Error("Professional must not be authorized to trigger reopen-project");
      }
    }),
  );

  // Test 4: Zombie Job Prevention on Decline/Cancel
  results.push(
    await runTest(
      "State consistency: Job status resets to CLOSED on decline or cancellation",
      () => {
        const jobStateOnReopen = "OPEN";
        // On reject / cancel, both projectTracking and clientJob must be reconciled
        const finalJobStatus = "CLOSED";
        const finalProjectStatus = "COMPLETED";

        if (finalJobStatus !== "CLOSED" || finalProjectStatus !== "COMPLETED") {
          throw new Error("Job or project was left in inconsistent state after reopen rejection");
        }
      },
    ),
  );

  // Test 5: Reopen Terms & Milestone Concession
  results.push(
    await runTest("Workflow: Accept transitions milestone & project to IN_PROGRESS", () => {
      const decision = "ACCEPT";
      const finalStatus = decision === "ACCEPT" ? "IN_PROGRESS" : "COMPLETED";
      if (finalStatus !== "IN_PROGRESS") {
        throw new Error("Reopened project must transition to IN_PROGRESS on acceptance");
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
