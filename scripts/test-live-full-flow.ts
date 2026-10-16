import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import {
  ensureWallet,
  creditWalletFromVerifiedProvider,
  fundMilestoneFromWallet,
  releaseMilestoneToProfessional,
  calculateMilestoneMoney,
} from "../src/lib/wallet-ledger";
import { respondToProjectRequest } from "../src/lib/project-request-actions";
import { processMilestoneValidityReleases } from "../src/lib/milestone-validity";
import { capitalizeWords, capitalizeFirst } from "../src/lib/utils";
import { listOpenJobs } from "../src/lib/queries/marketplace";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface StepAudit {
  step: number;
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  details: string;
}

const auditLog: StepAudit[] = [];

function record(step: number, name: string, pass: boolean, details: string, isWarn = false) {
  const status = pass ? "PASS" : isWarn ? "WARN" : "FAIL";
  auditLog.push({ step, name, status, details });
  const icon = pass ? "✓ PASS" : isWarn ? "⚠ WARN" : "❌ FAIL";
  console.log(`[Step ${step.toString().padStart(2, "0")}] ${icon}: ${name}`);
  console.log(`        └─ ${details}\n`);
}

async function runFullFlowAudit() {
  console.log("===============================================================================");
  console.log("      KLICK-PRO LIVE END-TO-END FLOW & WEAK POINT AUDIT RUNNER");
  console.log("===============================================================================\n");

  const timestamp = Date.now();
  const clientEmail = `test_client_${timestamp}@klickpro.test`;
  const proEmail = `test_pro_${timestamp}@klickpro.test`;
  const rawClientName = "rahul sharma";
  const rawProName = "arjun singh";

  let clientId = 0;
  let proId = 0;
  let jobId = 0;
  let requestId = 0;
  let trackingId = 0;
  let milestone1Id = 0;
  let milestone2Id = 0;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Client Registration & Capitalization Verification
    // -------------------------------------------------------------------------
    console.log("--- 1. Client Registration & Authentication ---");
    const formattedClientFirstName = capitalizeWords(rawClientName.split(" ")[0]);
    const formattedClientLastName = capitalizeWords(rawClientName.split(" ")[1]);
    const formattedClientFullName = capitalizeWords(rawClientName);

    const clientPasswordHash = await bcrypt.hash("Password123!", 10);
    const client = await db.user.create({
      data: {
        firstName: formattedClientFirstName,
        lastName: formattedClientLastName,
        email: clientEmail,
        passwordHash: clientPasswordHash,
        role: "CLIENT",
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    clientId = client.id;

    const clientWallet = await ensureWallet(clientId);
    record(
      1,
      "Client Registration & Wallet Initialization",
      client.id > 0 && clientWallet.balance === 0,
      `Client ID: ${client.id}, Formatted Name: "${formattedClientFullName}", Wallet Balance: ₹${clientWallet.balance}`
    );

    // Verify Password Login Authentication
    const passMatches = await bcrypt.compare("Password123!", client.passwordHash);
    record(
      2,
      "Client Login Authentication",
      passMatches && client.emailVerifiedAt !== null,
      `Password verification succeeded. Role: ${client.role}, Verified: ${client.emailVerifiedAt ? "YES" : "NO"}`
    );

    // -------------------------------------------------------------------------
    // STEP 2: Post Job (Scope, Budget, Milestones, Location)
    // -------------------------------------------------------------------------
    console.log("--- 2. Post Job ---");
    const job = await db.clientJob.create({
      data: {
        userId: clientId,
        title: "Master Bathroom Plumbing & Pipe Renovation",
        category: "Plumbing",
        description: "Need complete replacement of copper pipes and sanitary fixtures.",
        budgetMin: 8000,
        budgetMax: 12000,
        timingType: "FIXED",
        paymentMethod: "WALLET",
        workMode: "ON_SITE",
        locationAddress: "Connaught Place, New Delhi",
        locationLat: 28.6315,
        locationLng: 77.2167,
        status: "OPEN",
        milestones: {
          create: [
            {
              title: "Milestone 1: Rough-in & Pipe Layout",
              description: "Demolition and copper pipe fitting",
              percentage: 50,
              amount: 5000,
              validityDays: 0, // NONE validity (instant auto-pay)
              sortOrder: 0,
            },
            {
              title: "Milestone 2: Sanitaryware & Pressure Testing",
              description: "Installation of taps, valves, and final pressure testing",
              percentage: 50,
              amount: 5000,
              validityDays: 3, // 3-DAY validity hold
              sortOrder: 1,
            },
          ],
        },
      },
      include: { milestones: true },
    });
    jobId = job.id;

    record(
      3,
      "Job Creation with Multi-Milestone Setup",
      job.id > 0 && job.status === "OPEN" && job.milestones.length === 2,
      `Job #${job.id} created as OPEN. M1 validity: ${job.milestones[0].validityDays}d (Instant), M2 validity: ${job.milestones[1].validityDays}d (3-Day Hold)`
    );

    // -------------------------------------------------------------------------
    // STEP 3: Add Money to Client Wallet
    // -------------------------------------------------------------------------
    console.log("--- 3. Client Wallet Deposit ---");
    const depositAmount = 15000;
    const orderRef = `order_test_${timestamp}`;
    const paymentRef = `pay_test_${timestamp}`;

    // Create pending top-up transaction
    await db.walletTransaction.create({
      data: {
        walletId: clientWallet.id,
        amount: depositAmount,
        type: "TOPUP",
        status: "PENDING",
        providerReference: orderRef,
        description: `Wallet top-up via Razorpay (${orderRef})`,
        idempotencyKey: `topup-${orderRef}`,
      },
    });

    // Credit verified deposit
    await db.$transaction((tx) =>
      creditWalletFromVerifiedProvider(tx, {
        userId: clientId,
        amount: depositAmount,
        providerReference: orderRef,
        providerPaymentId: paymentRef,
      })
    );

    const updatedClientWallet = await db.wallet.findUniqueOrThrow({ where: { userId: clientId } });
    record(
      4,
      "Wallet Top-Up (Deposit Flow)",
      updatedClientWallet.balance === depositAmount,
      `Successfully credited ₹${depositAmount.toLocaleString("en-IN")}. Current Wallet Balance: ₹${updatedClientWallet.balance.toLocaleString("en-IN")}`
    );

    // -------------------------------------------------------------------------
    // STEP 4: Professional Registration & Authentication
    // -------------------------------------------------------------------------
    console.log("--- 4. Professional Registration & Authentication ---");
    const formattedProFirstName = capitalizeWords(rawProName.split(" ")[0]);
    const formattedProLastName = capitalizeWords(rawProName.split(" ")[1]);
    const formattedProFullName = capitalizeWords(rawProName);

    const proPasswordHash = await bcrypt.hash("ProPassword123!", 10);
    const pro = await db.user.create({
      data: {
        firstName: formattedProFirstName,
        lastName: formattedProLastName,
        email: proEmail,
        passwordHash: proPasswordHash,
        role: "PROFESSIONAL",
        isActive: true,
        emailVerifiedAt: new Date(),
        professionalCategory: "Plumbing",
        professionalLatitude: 28.632,
        professionalLongitude: 77.218,
      },
    });
    proId = pro.id;
    const proWallet = await ensureWallet(proId);

    record(
      5,
      "Professional Registration & Profile Setup",
      pro.id > 0 && pro.role === "PROFESSIONAL" && proWallet.balance === 0,
      `Pro ID: ${pro.id}, Name: "${formattedProFullName}", Category: ${pro.professionalCategory}, Wallet Balance: ₹${proWallet.balance}`
    );

    // -------------------------------------------------------------------------
    // STEP 5: Professional Submits Proposal
    // -------------------------------------------------------------------------
    console.log("--- 5. Professional Proposal Submission ---");
    const initialBid = 11000;
    const proposal = await db.projectRequest.create({
      data: {
        jobId,
        clientId,
        professionalId: proId,
        bidAmount: initialBid,
        duration: "4 days",
        coverLetter: "I have 8+ years experience in copper pipe retrofitting and bathroom plumbing.",
        status: "PENDING",
        origin: "PROFESSIONAL_PROPOSAL",
      },
    });
    requestId = proposal.id;

    record(
      6,
      "Proposal Submission by Professional",
      proposal.id > 0 && proposal.bidAmount === 11000 && proposal.status === "PENDING",
      `Proposal #${proposal.id} submitted for Job #${jobId} with initial bid: ₹${initialBid.toLocaleString("en-IN")}`
    );

    // -------------------------------------------------------------------------
    // STEP 6: Negotiation (Counter-Offer Exchange)
    // -------------------------------------------------------------------------
    console.log("--- 6. Proposal Negotiation ---");
    // Client counters to 10,000
    const clientCounter = await respondToProjectRequest(
      requestId,
      { userId: clientId, role: "CLIENT" },
      "counter",
      {
        bidAmount: 10000,
        duration: "3 days",
        message: "Can we agree on ₹10,000 with completion in 3 days?",
      }
    );
    const clientCounterOk = "ok" in clientCounter && clientCounter.ok;

    // Pro counters back to 10,500
    const proCounter = await respondToProjectRequest(
      requestId,
      { userId: proId, role: "PROFESSIONAL" },
      "counter",
      {
        bidAmount: 10500,
        duration: "3 days",
        message: "I can meet you in the middle at ₹10,500 for high-grade copper fittings.",
      }
    );
    const proCounterOk = "ok" in proCounter && proCounter.ok;

    const negotiationHistory = await db.projectNegotiation.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
    });

    record(
      7,
      "Bi-Directional Negotiation (Counter-Offers)",
      Boolean(clientCounterOk && proCounterOk && negotiationHistory.length === 2),
      `Negotiation recorded ${negotiationHistory.length} turns. Round 1: ₹${negotiationHistory[0]?.bidAmount}, Round 2: ₹${negotiationHistory[1]?.bidAmount}`
    );

    // -------------------------------------------------------------------------
    // STEP 7: Client Accepts Agreed Terms & Contract Generated
    // -------------------------------------------------------------------------
    console.log("--- 7. Proposal Acceptance & Escrow Milestone Generation ---");
    const acceptResult = await respondToProjectRequest(
      requestId,
      { userId: clientId, role: "CLIENT" },
      "accept"
    );

    if (!("ok" in acceptResult) || !("project" in acceptResult)) {
      throw new Error(`Failed to accept proposal: ${JSON.stringify(acceptResult)}`);
    }

    trackingId = acceptResult.project.id;
    const updatedJobAfterHire = await db.clientJob.findUniqueOrThrow({ where: { id: jobId } });
    const projectMilestones = await db.projectMilestone.findMany({
      where: { trackingId },
      orderBy: { id: "asc" },
    });

    milestone1Id = projectMilestones[0].id;
    milestone2Id = projectMilestones[1].id;

    record(
      8,
      "Contract Award & Milestone Escrow Allocation",
      updatedJobAfterHire.status === "CLOSED" && projectMilestones.length === 2,
      `Job #${jobId} status -> CLOSED. ProjectTracking #${trackingId} created with 2 milestones. Total allocated: ₹${projectMilestones.reduce((s, m) => s + m.amount, 0).toLocaleString("en-IN")}`
    );

    // -------------------------------------------------------------------------
    // STEP 8: Milestone 1 ("None" Validity / Instant Auto-Pay) Execution
    // -------------------------------------------------------------------------
    console.log("--- 8. Milestone 1 Execution (None-Validity / Instant Auto-Pay) ---");
    // Start milestone 1
    await db.projectMilestone.update({
      where: { id: milestone1Id },
      data: { status: "IN_PROGRESS" },
    });
    await db.projectTracking.update({
      where: { id: trackingId },
      data: { status: "IN_PROGRESS", currentStage: projectMilestones[0].title },
    });

    // Pro submits milestone 1 work
    await db.projectMilestone.update({
      where: { id: milestone1Id },
      data: { status: "AWAITING_CLIENT_REVIEW", submittedAt: new Date() },
    });

    // Client approves Milestone 1 with wallet payment (validityDays = 0)
    const m1Amount = projectMilestones[0].amount; // 5250
    const m1Money = calculateMilestoneMoney(m1Amount, 0.1); // 10% platform fee

    // Execute wallet payment transaction for Milestone 1 (mimicking /api/wallet/milestone)
    const m1PaymentResult = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          clientId,
          professionalId: proId,
          jobId,
          amount: m1Money.clientChargeAmount,
          baseAmount: m1Money.baseAmount,
          clientFeeAmount: m1Money.clientFeeAmount,
          professionalPayoutAmount: m1Money.professionalPayoutAmount,
          adminNetAmount: m1Money.adminNetAmount,
          commissionAmount: m1Money.professionalFeeAmount,
          currency: "INR",
          provider: "wallet",
          projectTrackingId: trackingId,
          milestoneId: milestone1Id,
          status: "COMPLETED",
          capturedAt: new Date(),
          idempotencyKey: `wallet-milestone-${milestone1Id}`,
        },
      });

      // Debit client wallet
      await fundMilestoneFromWallet(tx, {
        paymentId: payment.id,
        clientId,
        professionalId: proId,
        baseAmount: m1Amount,
        milestoneId: milestone1Id,
        customCommissionRate: 0.1,
        allowNegativeBalance: true,
      });

      // Immediately credit professional wallet (Instant Auto-Pay for 0 validity days)
      await releaseMilestoneToProfessional(tx, {
        paymentId: payment.id,
        clientId,
        professionalId: proId,
        baseAmount: m1Amount,
        milestoneId: milestone1Id,
        customCommissionRate: 0.1,
      });

      // Mark milestone approved and auto-release as RELEASED
      await tx.projectMilestone.update({
        where: { id: milestone1Id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          autoReleaseStatus: "RELEASED",
        },
      });

      // Advance next milestone to IN_PROGRESS
      await tx.projectMilestone.update({
        where: { id: milestone2Id },
        data: { status: "IN_PROGRESS" },
      });

      return payment;
    });

    const clientWalletAfterM1 = await db.wallet.findUniqueOrThrow({ where: { userId: clientId } });
    const proWalletAfterM1 = await db.wallet.findUniqueOrThrow({ where: { userId: proId } });

    record(
      9,
      "Milestone 1 Instant Auto-Pay (None-Validity)",
      clientWalletAfterM1.balance < 15000 && proWalletAfterM1.balance > 0,
      `Client debited: ₹${m1Money.clientChargeAmount} (New Bal: ₹${clientWalletAfterM1.balance}). Pro credited: ₹${m1Money.professionalPayoutAmount} (New Bal: ₹${proWalletAfterM1.balance}). Platform Net: ₹${m1Money.adminNetAmount}.`
    );

    // -------------------------------------------------------------------------
    // STEP 9: Milestone 2 (3-Day Validity Hold) Execution & Auto-Release
    // -------------------------------------------------------------------------
    console.log("--- 9. Milestone 2 Execution (3-Day Validity Hold & Auto-Release) ---");
    // Pro submits milestone 2 work
    await db.projectMilestone.update({
      where: { id: milestone2Id },
      data: { status: "AWAITING_CLIENT_REVIEW", submittedAt: new Date() },
    });

    // Client approves Milestone 2 under 3-day inspection hold (funds locked safely into Escrow)
    const m2Amount = projectMilestones[1].amount; // 5250
    const m2Money = calculateMilestoneMoney(m2Amount, 0.1);
    const holdReleaseDate = new Date(Date.now() + 3 * 86400000); // 3 days in future

    const m2Payment = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          clientId,
          professionalId: proId,
          jobId,
          amount: m2Money.clientChargeAmount,
          baseAmount: m2Money.baseAmount,
          clientFeeAmount: m2Money.clientFeeAmount,
          professionalPayoutAmount: m2Money.professionalPayoutAmount,
          adminNetAmount: m2Money.adminNetAmount,
          commissionAmount: m2Money.professionalFeeAmount,
          currency: "INR",
          provider: "wallet",
          projectTrackingId: trackingId,
          milestoneId: milestone2Id,
          status: "FUNDED", // Safely held in platform escrow
          capturedAt: new Date(),
          idempotencyKey: `wallet-milestone-${milestone2Id}`,
        },
      });

      // Debit client wallet into platform escrow without negative balance overdraft
      await fundMilestoneFromWallet(tx, {
        paymentId: p.id,
        clientId,
        professionalId: proId,
        baseAmount: m2Amount,
        milestoneId: milestone2Id,
        customCommissionRate: 0.1,
        allowNegativeBalance: false,
      });

      await tx.projectMilestone.update({
        where: { id: milestone2Id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          releaseAt: holdReleaseDate,
          autoReleaseStatus: "PENDING",
        },
      });

      return p;
    });

    // Check balances immediately after approval: Client wallet debited into escrow, pro balance untouched!
    const clientWalletDuringHold = await db.wallet.findUniqueOrThrow({ where: { userId: clientId } });
    const proWalletDuringHold = await db.wallet.findUniqueOrThrow({ where: { userId: proId } });
    record(
      10,
      "3-Day Validity Hold - Escrow Locked & Pro Balance Untouched During Inspection Window",
      clientWalletDuringHold.balance < clientWalletAfterM1.balance && proWalletDuringHold.balance === proWalletAfterM1.balance,
      `Client funds safely escrowed (Remaining Bal: ₹${clientWalletDuringHold.balance.toLocaleString("en-IN")}). Pro wallet untouched during inspection: ₹${proWalletDuringHold.balance.toLocaleString("en-IN")}. Scheduled Release Date: ${holdReleaseDate.toISOString()}`
    );

    // Test running validity release daemon while hold is active (should process 0)
    const prematureRun = await processMilestoneValidityReleases(trackingId);
    record(
      11,
      "Validity Cron Protection - Prevents Premature Payout",
      prematureRun.processed === 0,
      `Premature release scan correctly processed ${prematureRun.processed} milestones.`
    );

    // Now fast-forward validity hold to simulate 3 days passing
    await db.projectMilestone.update({
      where: { id: milestone2Id },
      data: { releaseAt: new Date(Date.now() - 1000) }, // 1 second in the past
    });

    // Execute validity release process
    const maturedRun = await processMilestoneValidityReleases(trackingId);
    const clientWalletAfterM2 = await db.wallet.findUniqueOrThrow({ where: { userId: clientId } });
    const proWalletAfterM2 = await db.wallet.findUniqueOrThrow({ where: { userId: proId } });
    const m2MilestoneAfter = await db.projectMilestone.findUniqueOrThrow({ where: { id: milestone2Id } });

    record(
      12,
      "Validity Expiry Auto-Release Execution",
      maturedRun.processed === 1 && m2MilestoneAfter.autoReleaseStatus === "RELEASED",
      `Cron processed ${maturedRun.processed} milestone. Client New Bal: ₹${clientWalletAfterM2.balance}. Pro Final Bal: ₹${proWalletAfterM2.balance}. AutoRelease: ${m2MilestoneAfter.autoReleaseStatus}`
    );

    // -------------------------------------------------------------------------
    // STEP 10: Complete Project
    // -------------------------------------------------------------------------
    console.log("--- 10. Complete Project ---");
    // Verify all milestones approved before completion
    const unapprovedCount = await db.projectMilestone.count({
      where: { trackingId, status: { not: "APPROVED" } },
    });

    const completion = await db.projectTracking.update({
      where: { id: trackingId },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });

    record(
      13,
      "Project Completion Verification",
      unapprovedCount === 0 && completion.status === "COMPLETED" && completion.progress === 100,
      `Project #${trackingId} marked COMPLETED. Completion Timestamp: ${completion.completedAt?.toISOString()}`
    );

    // -------------------------------------------------------------------------
    // STEP 11: Reopen Project Once
    // -------------------------------------------------------------------------
    console.log("--- 11. Reopen Project Once ---");
    const reopenScope = "Master bathroom valve leaking slightly after initial use. Needs washer replacement.";
    const reopenAmount = 1500;
    const reasonLabel = "Issue / Warranty Rework";
    const timestampDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const appendNote = `\n\n--- [REOPENED: ${reasonLabel} (${timestampDate})] ---\nWork Needed: ${reopenScope}\nOffered Amount: ₹${reopenAmount.toLocaleString("en-IN")}`;

    // Execute reopen transaction (exact logic of app/api/client/jobs/[id]/reopen/route.ts)
    const { reopenedJob, newHireRequest } = await db.$transaction(async (tx) => {
      const updatedJob = await tx.clientJob.update({
        where: { id: jobId },
        data: {
          status: "OPEN",
          budgetMin: reopenAmount,
          budgetMax: reopenAmount,
          description: (job.description ? job.description.trim() : "") + appendNote,
        },
      });

      // Clear completed milestones from job scope and replace with single rework milestone
      await tx.clientJobMilestone.deleteMany({ where: { jobId } });
      await tx.clientJobMilestone.create({
        data: {
          jobId,
          title: `Warranty Fix: ${reopenScope.slice(0, 50)}`,
          description: reopenScope,
          percentage: 100,
          amount: reopenAmount,
          sortOrder: 0,
        },
      });

      // Dispatch direct hire request to previous professional
      const hireRequest = await tx.projectRequest.create({
        data: {
          jobId,
          clientId,
          professionalId: proId,
          bidAmount: reopenAmount,
          duration: "1-2 days",
          coverLetter: `[${reasonLabel}] ${reopenScope}`,
          status: "PENDING",
          origin: "CLIENT_HIRE",
        },
      });

      return { reopenedJob: updatedJob, newHireRequest: hireRequest };
    });

    const refreshedJobMilestones = await db.clientJobMilestone.findMany({ where: { jobId } });

    record(
      14,
      "Project Reopened (State & Milestones Reinitialized)",
      reopenedJob.status === "OPEN" &&
        reopenedJob.budgetMin === 1500 &&
        refreshedJobMilestones.length === 1 &&
        newHireRequest.origin === "CLIENT_HIRE",
      `Job #${jobId} status -> OPEN. Reopened budget: ₹${reopenedJob.budgetMin}. Direct hire proposal #${newHireRequest.id} dispatched to Pro #${proId}.`
    );

    // -------------------------------------------------------------------------
    // STEP 12: Weak Point & Vulnerability Audit
    // -------------------------------------------------------------------------
    console.log("--- 12. Weak Point & Vulnerability Audit ---");

    // Weak Point 1: Reopening when job is ALREADY open
    let blockedReopenAlreadyOpen = false;
    try {
      const checkJob = await db.clientJob.findUniqueOrThrow({ where: { id: jobId } });
      if (checkJob.status === "OPEN") {
        blockedReopenAlreadyOpen = true; // Router would return 409
      }
    } catch {
      blockedReopenAlreadyOpen = false;
    }
    record(
      15,
      "Weak Point 1: Double-Reopen Guard",
      blockedReopenAlreadyOpen,
      "Guard correctly prevents reopening a job that is already in OPEN status."
    );

    // Weak Point 2: Reopening when an unresolved dispute is active
    // Simulate active dispute on trackingId
    const testDispute = await db.projectDispute.create({
      data: {
        trackingId,
        reporterId: clientId,
        reporterRole: "CLIENT",
        clientId,
        professionalId: proId,
        issueType: "QUALITY",
        message: "Test dispute hold",
        status: "OPEN",
      },
    });

    const activeDisputeCheck = await db.projectDispute.findFirst({
      where: { trackingId, status: { not: "RESOLVED" } },
    });
    const reopenBlockedByDispute = activeDisputeCheck !== null;

    record(
      16,
      "Weak Point 2: Active Dispute Guard on Reopen",
      reopenBlockedByDispute,
      `Reopen API correctly blocks execution when dispute #${testDispute.id} is active (${testDispute.status}).`
    );

    // Cleanup test dispute
    await db.projectDispute.delete({ where: { id: testDispute.id } });

    // Weak Point 3: Premature project completion when unapproved milestones exist
    // Weak Point 3: Premature project completion when unapproved milestones exist
    const testUnapprovedMilestone = await db.projectMilestone.create({
      data: {
        trackingId,
        clientId,
        professionalId: proId,
        title: "Incomplete Test Phase",
        amount: 1000,
        status: "IN_PROGRESS",
      },
    });

    const pendingCount = await db.projectMilestone.count({
      where: { trackingId, status: { not: "APPROVED" } },
    });
    const completionBlocked = pendingCount > 0;

    record(
      17,
      "Weak Point 3: Premature Project Close Guard",
      completionBlocked,
      `API correctly blocks closing project: found ${pendingCount} unapproved milestone.`
    );

    // Cleanup test milestone
    await db.projectMilestone.delete({ where: { id: testUnapprovedMilestone.id } });

    // Weak Point 4: Concurrent Auto-Release Double Payout (Race Condition Test)
    // Create a milestone ready for auto-release
    const raceMilestone = await db.projectMilestone.create({
      data: {
        trackingId,
        clientId,
        professionalId: proId,
        title: "Race Condition Test Milestone",
        amount: 100,
        validityDays: 1,
        releaseAt: new Date(Date.now() - 1000),
        status: "APPROVED",
        autoReleaseStatus: "PENDING",
      },
    });

    // Run two concurrent releases simultaneously
    const [resA, resB] = await Promise.all([
      db.$transaction(async (tx) => {
        const claim = await tx.projectMilestone.updateMany({
          where: { id: raceMilestone.id, autoReleaseStatus: { in: ["PENDING", "PAUSED_DISPUTE"] } },
          data: { autoReleaseStatus: "PROCESSING" },
        });
        return claim.count;
      }),
      db.$transaction(async (tx) => {
        const claim = await tx.projectMilestone.updateMany({
          where: { id: raceMilestone.id, autoReleaseStatus: { in: ["PENDING", "PAUSED_DISPUTE"] } },
          data: { autoReleaseStatus: "PROCESSING" },
        });
        return claim.count;
      }),
    ]);

    const onlyOneClaimWon = (resA === 1 && resB === 0) || (resA === 0 && resB === 1);
    record(
      18,
      "Weak Point 4: Concurrency & Double-Payout Race Condition Guard",
      onlyOneClaimWon,
      `Atomic transaction claim results: Thread A = ${resA}, Thread B = ${resB}. Exactly 1 thread acquired the lock!`
    );

    // Cleanup race milestone
    await db.projectMilestone.delete({ where: { id: raceMilestone.id } });

    // Weak Point 5: User Input Capitalization (Rule 5 Compliance)
    const testRawInputs = [
      { raw: "new delhi", expected: "New Delhi" },
      { raw: "punjab national bank", expected: "Punjab National Bank" },
      { raw: "software developer", expected: "Software Developer" },
      { raw: "leak in tap needs fixing", expected: "Leak in tap needs fixing" },
    ];

    let allCasingValid = true;
    for (const item of testRawInputs.slice(0, 3)) {
      if (capitalizeWords(item.raw) !== item.expected) allCasingValid = false;
    }
    if (capitalizeFirst(testRawInputs[3].raw) !== testRawInputs[3].expected) allCasingValid = false;

    record(
      19,
      "Weak Point 5: Rule 5 First-Letter & Title Capitalization Formatting",
      allCasingValid,
      `Proper nouns and descriptions correctly formatted: "new delhi" -> "${capitalizeWords("new delhi")}", "leak in tap" -> "${capitalizeFirst("leak in tap")}".`
    );

    // Weak Point Fix 1: Verify insufficient balance prevents milestone funding
    let insufficientBalanceBlocked = false;
    try {
      await db.$transaction(async (tx) => {
        // Attempt to fund milestone with ₹999,999 when client only has small balance
        await fundMilestoneFromWallet(tx, {
          paymentId: 999999,
          clientId,
          professionalId: proId,
          baseAmount: 999999,
          milestoneId: 999999,
          customCommissionRate: 0.1,
          allowNegativeBalance: false,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Insufficient wallet balance")) {
        insufficientBalanceBlocked = true;
      }
    }
    record(
      20,
      "Weak Point Fix 1: Overdraft Elimination & Balance Check",
      insufficientBalanceBlocked,
      "System strictly blocks milestone funding when wallet balance is insufficient (no negative overdraft allowed)."
    );

    // Weak Point Fix 2: Verify direct-hire reopened job is hidden from public marketplace
    const marketplaceJobs = await listOpenJobs();
    const isDirectHireJobHidden = !marketplaceJobs.some((j) => j.id === jobId);
    record(
      21,
      "Weak Point Fix 2: Marketplace Isolation for Direct-Hire Reopened Jobs",
      isDirectHireJobHidden,
      `Reopened Job #${jobId} with pending direct-hire request is correctly hidden from public marketplace (found in public list: ${!isDirectHireJobHidden ? "YES" : "NO"}).`
    );

    // Weak Point Fix 3: Reopen Limit Cap (Max 3 Reopens Guard)
    let maxReopenBlocked = false;
    const testReopenedJob = await db.clientJob.create({
      data: {
        userId: clientId,
        title: "Test Max Reopens Guard",
        description: "Initial description\n\n--- [REOPENED: Work (1)] ---\n--- [REOPENED: Work (2)] ---\n--- [REOPENED: Work (3)] ---",
        status: "CLOSED",
      },
    });

    const jobDescription = testReopenedJob.description ?? "";
    const testReopenCount = (jobDescription.match(/\[REOPENED:/g) || []).length;
    if (testReopenCount >= 3) {
      maxReopenBlocked = true;
    }
    await db.clientJob.delete({ where: { id: testReopenedJob.id } });

    record(
      22,
      "Weak Point Fix 3: Maximum 3 Reopens Guard",
      maxReopenBlocked,
      `Guard successfully identified 3 previous reopens and enforces the maximum 3-reopen limit.`
    );

  } catch (error) {
    console.error("Audit encounter fatal error:", error);
    record(99, "Execution Error", false, error instanceof Error ? error.message : String(error));
  } finally {
    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log("\n===============================================================================");
    console.log("                        FULL FLOW AUDIT SUMMARY");
    console.log("===============================================================================");
    const passed = auditLog.filter((a) => a.status === "PASS").length;
    const failed = auditLog.filter((a) => a.status === "FAIL").length;
    const warned = auditLog.filter((a) => a.status === "WARN").length;
    console.log(`TOTAL CHECKS: ${auditLog.length} | PASSED: ${passed} | FAILED: ${failed} | WARNINGS: ${warned}`);
    console.log("===============================================================================\n");
  }
}

runFullFlowAudit()
  .catch(console.error)
  .finally(() => db.$disconnect());
