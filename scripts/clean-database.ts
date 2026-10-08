import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PRESERVED_ACCOUNTS = [
  {
    email: "seed.admin@servio.example",
    username: "seed-admin",
    role: "ADMIN" as const,
    firstName: "Admin",
    lastName: "User",
  },
  {
    email: "seed.client@servio.example",
    username: "seed_client",
    role: "CLIENT" as const,
    firstName: "Client",
    lastName: "User",
  },
  {
    email: "surat.pro@servio.example",
    username: "surat_pro",
    role: "PROFESSIONAL" as const,
    firstName: "Professional",
    lastName: "User",
  },
];

async function main() {
  console.log("==================================================");
  console.log("       KLICK-PRO BRAND NEW WEBSITE CLEANUP        ");
  console.log("==================================================");

  // 1. Verify Category table is present and record count before starting
  const categoryCountBefore = await db.serviceCategory.count();
  console.log(`[PROTECTION CHECK] ServiceCategory records before: ${categoryCountBefore}`);
  if (categoryCountBefore === 0) {
    throw new Error("Safety check failed: ServiceCategory table has 0 records.");
  }

  // 2. Identify preserved user IDs
  const preservedUsers = await db.user.findMany({
    where: {
      email: {
        in: PRESERVED_ACCOUNTS.map((a) => a.email),
      },
    },
    select: { id: true, email: true, role: true },
  });

  const preservedUserIds = preservedUsers.map((u) => u.id);
  console.log(`Found ${preservedUsers.length} accounts to preserve:`, preservedUsers);

  if (preservedUserIds.length < 3) {
    throw new Error(
      `Safety check failed: Expected 3 preserved accounts, but found ${preservedUserIds.length}.`,
    );
  }

  console.log("\n[1/3] Purging all operational, transactional, messaging & faker records...");

  // Delete dispute messages and disputes
  await db.projectDisputeMessage.deleteMany({});
  await db.projectDispute.deleteMany({});

  // Delete invoices, transactions, payments, withdrawals
  await db.invoice.deleteMany({});
  await db.projectTransaction.deleteMany({});
  await db.payment.deleteMany({});
  await db.projectWithdrawal.deleteMany({});
  await db.walletTransaction.deleteMany({});

  // Delete project tracking milestones, work uploads, timeline events, reviews, requests
  await db.projectTimelineEvent.deleteMany({});
  await db.projectWorkUpload.deleteMany({});
  await db.projectMilestone.deleteMany({});
  await db.projectReview.deleteMany({});
  await db.projectCompletionRequest.deleteMany({});
  await db.projectRevisionRequest.deleteMany({});
  await db.projectReviewRequest.deleteMany({});
  await db.projectTracking.deleteMany({});

  // Delete project negotiations and requests (bids/proposals)
  await db.projectNegotiation.deleteMany({});
  await db.projectRequest.deleteMany({});

  // Delete job attachments, job milestones, favorite jobs, client jobs
  await db.clientJobMilestone.deleteMany({});
  await db.clientJobAttachment.deleteMany({});
  await db.favoriteJob.deleteMany({});
  await db.clientJob.deleteMany({});

  // Delete test Services linked to professionals
  await db.service.deleteMany({});

  // Delete chats, messages, notifications, audit logs, webhook events
  await db.socketMessage.deleteMany({});
  await db.socketConversationClear.deleteMany({});
  await db.socketConversation.deleteMany({});
  await db.callSession.deleteMany({});
  await db.message.deleteMany({});
  await db.messageConversation.deleteMany({});
  await db.userNotification.deleteMany({});
  await db.userNotificationState.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.razorpayWebhookEvent.deleteMany({});

  // Delete verification records, files, tokens
  await db.professionalVerification.deleteMany({});
  await db.verificationDocumentReview.deleteMany({});
  await db.personaVerification.deleteMany({});
  await db.personaWebhookEvent.deleteMany({});
  await db.storedFile.deleteMany({});
  await db.apiToken.deleteMany({});
  await db.otpCode.deleteMany({});
  await db.browserSubscription.deleteMany({});

  // Delete client profile specifics, linked accounts, saved pros, sessions
  await db.clientSavedLocation.deleteMany({});
  await db.clientHiringNeed.deleteMany({});
  await db.clientProfile.deleteMany({});
  await db.savedProfessional.deleteMany({});
  await db.userLinkedAccount.deleteMany({});
  await db.session.deleteMany({});

  // Delete wallets of non-preserved users
  await db.wallet.deleteMany({
    where: {
      userId: {
        notIn: preservedUserIds,
      },
    },
  });

  // Delete all non-preserved users
  await db.user.deleteMany({
    where: {
      id: {
        notIn: preservedUserIds,
      },
    },
  });

  console.log("\n[2/3] Resetting preserved accounts to a brand new clean state...");

  const passwordHash = await bcrypt.hash("ServioSeed#2026", 12);

  for (const acc of PRESERVED_ACCOUNTS) {
    const user = await db.user.update({
      where: { email: acc.email },
      data: {
        firstName: acc.firstName,
        lastName: acc.lastName,
        username: acc.username,
        role: acc.role,
        passwordHash,
        avatarUrl: null,
        companyName: null,
        companyWebsite: null,
        industry: null,
        teamSize: null,
        companyDescription: null,
        address: null,
        professionalCategory: null,
        professionalCity: null,
        professionalSkillsJson: null,
        experienceYears: null,
        hourlyRate: null,
        fixedRate: null,
        portfolioUrl: null,
        workPhotosJson: null,
        certificationsJson: null,
        tradeLicenseUrl: null,
        serviceArea: null,
        workMode: "both",
        serviceRadiusKm: null,
        averageRating: 0,
        reviewCount: 0,
        isVerified: false,
        availabilityStatus: "available",
        savedLocationsJson: null,
        hiringNeedsJson: null,
        professionalLatitude: null,
        professionalLongitude: null,
        biometricEnabled: false,
        biometricType: null,
        razorpayAccountId: null,
        professionalState: null,
        professionalDistrict: null,
        professionalCategoryId: null,
        isActive: true,
        lastLoginAt: null,
      },
    });

    // Ensure wallet exists and has zero balance
    await db.wallet.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        currency: "INR",
        balance: 0,
        pendingBalance: 0,
      },
      update: {
        balance: 0,
        pendingBalance: 0,
      },
    });

    console.log(`- Cleaned profile & reset wallet: [${acc.role}] ${acc.email} (${acc.username})`);
  }

  // 3. Final verification: Verify ServiceCategory count is 100% UNTOUCHED
  const categoryCountAfter = await db.serviceCategory.count();
  const totalUsersAfter = await db.user.count();
  const totalJobsAfter = await db.clientJob.count();
  const totalPaymentsAfter = await db.payment.count();
  const totalTxAfter = await db.walletTransaction.count();

  console.log("\n==================================================");
  console.log("             CLEANUP VERIFICATION SUMMARY        ");
  console.log("==================================================");
  console.log(
    `ServiceCategory count (UNTOUCHED): ${categoryCountAfter} (Before: ${categoryCountBefore})`,
  );
  console.log(`Remaining Users: ${totalUsersAfter} (Preserved clean accounts only)`);
  console.log(`Remaining ClientJobs: ${totalJobsAfter}`);
  console.log(`Remaining Payments: ${totalPaymentsAfter}`);
  console.log(`Remaining WalletTransactions: ${totalTxAfter}`);

  if (categoryCountBefore !== categoryCountAfter) {
    throw new Error("CRITICAL SAFETY ALERT: Category count changed!");
  }

  console.log("\nDATABASE IS NOW 100% CLEAN LIKE A BRAND NEW WEBSITE!");
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
