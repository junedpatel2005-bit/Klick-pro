import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ensureWallet, creditWalletFromVerifiedProvider } from "@/lib/wallet-ledger";
import { fetchRazorpayOrderPayments, isRazorpayConfigured } from "@/lib/razorpay";
import { getMinWithdrawalAmount, isAutoWithdrawalEnabled } from "@/lib/platform-settings";
import { Prisma } from "@generated/prisma/client";
import { encryptAccountNumber, maskAccountNumber } from "@/lib/encryption";
import { capitalizeWords } from "@/lib/utils";
import {
  emitRealtimeNotification,
  emitAdminNotification,
  emitAdminOverviewUpdate,
} from "@/lib/realtime";

async function sessionFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}
export async function GET(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const wallet = await ensureWallet(session.userId);

  // Resilient Auto-Reconciliation: If user closed their browser or lost network,
  // reconcile any uncompleted recent top-up directly with Razorpay on page load
  if (isRazorpayConfigured()) {
    try {
      const pendingTopUp = await db.walletTransaction.findFirst({
        where: {
          walletId: wallet.id,
          type: "WALLET_TOP_UP",
          status: "PENDING",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (pendingTopUp?.providerReference) {
        const payments = await fetchRazorpayOrderPayments(pendingTopUp.providerReference);
        const captured = payments.find(
          (p) =>
            p.status === "captured" &&
            p.amount === pendingTopUp.amount * 100 &&
            p.currency === "INR",
        );
        if (captured) {
          await db.$transaction((tx) =>
            creditWalletFromVerifiedProvider(tx, {
              userId: session.userId,
              amount: pendingTopUp.amount,
              providerReference: pendingTopUp.providerReference!,
              providerPaymentId: captured.id,
            }),
          );
        }
      }
    } catch (reconcileErr) {
      console.warn("Wallet auto-reconciliation warning:", reconcileErr);
    }
  }
  const transactions = await db.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const earned = await db.walletTransaction.aggregate({
    where: {
      walletId: wallet.id,
      type: { in: ["MILESTONE_EARNING", "DISPUTE_PAYOUT"] },
      status: "COMPLETED",
    },
    _sum: { amount: true },
  });
  const commissionDebits = await db.walletTransaction.aggregate({
    where: {
      walletId: wallet.id,
      type: "PLATFORM_COMMISSION",
      status: "COMPLETED",
    },
    _sum: { amount: true },
  });
  const paymentCommission = await db.payment.aggregate({
    where: { professionalId: session.userId, status: "COMPLETED" },
    _sum: { commissionAmount: true },
  });

  const canWithdraw = session.role === "PROFESSIONAL" || session.role === "CLIENT";
  const rawEarned = earned._sum.amount ?? 0;
  const rawCommissionDebits = Math.abs(commissionDebits._sum.amount ?? 0);
  const totalCommission =
    rawCommissionDebits > 0 ? rawCommissionDebits : (paymentCommission?._sum.commissionAmount ?? 0);

  // If commission was debited as a separate wallet transaction, rawEarned is the gross milestone amount
  const isGrossEarned = rawCommissionDebits > 0;
  const totalEarned = isGrossEarned ? Math.max(0, rawEarned - totalCommission) : rawEarned;
  const grossTotal = isGrossEarned ? rawEarned : totalEarned + totalCommission;

  const withdrawals = canWithdraw ? wallet.pendingBalance : 0;
  const rawWithdrawals = canWithdraw
    ? await db.projectWithdrawal.findMany({
        where: { professionalId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const withdrawalHistory = rawWithdrawals.map((w) => {
    if (!w.destinationLabel) return w;
    try {
      const parsed = JSON.parse(w.destinationLabel);
      if (parsed.type === "BANK") {
        return {
          ...w,
          destinationLabel: JSON.stringify({
            ...parsed,
            accountNumber: maskAccountNumber(parsed.last4 || parsed.accountNumber),
          }),
        };
      }
    } catch {
      // fallback
    }
    return w;
  });
  const available = canWithdraw ? Math.max(0, wallet.balance - withdrawals) : wallet.balance;
  const minWithdrawalAmount = await getMinWithdrawalAmount();

  // Active Locked / Frozen Milestones for Clients during Validity Period
  let lockedMilestones: Array<{
    id: number;
    title: string;
    amount: number;
    validityDays: number;
    releaseAt: Date | null;
    autoReleaseStatus: string;
    createdAt: Date;
    jobTitle: string;
    jobId: number;
    projectId: number;
    professionalName: string;
    hasDispute: boolean;
    disputeId: number | null;
    disputeStatus: string | null;
    disputeIssueType: string | null;
  }> = [];

  let frozenAmount = 0;
  let disputedFrozenAmount = 0;

  if (session.role === "CLIENT") {
    const [rawLocked, activeDisputes] = await Promise.all([
      db.projectMilestone.findMany({
        where: {
          clientId: session.userId,
          validityDays: { gt: 0 },
          autoReleaseStatus: { in: ["PENDING", "PAUSED_DISPUTE"] },
          payment: {
            status: { in: ["FUNDED", "PENDING"] },
          },
        },
        include: {
          tracking: {
            select: {
              id: true,
              job: { select: { id: true, title: true } },
              professional: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { releaseAt: "asc" },
      }),
      db.projectDispute.findMany({
        where: {
          clientId: session.userId,
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
        select: {
          id: true,
          trackingId: true,
          milestoneId: true,
          status: true,
          issueType: true,
          createdAt: true,
        },
      }),
    ]);

    lockedMilestones = rawLocked.map((m) => {
      const profName = `${m.tracking?.professional?.firstName ?? "Professional"} ${m.tracking?.professional?.lastName ?? ""}`.trim();
      const dispute = activeDisputes.find(
        (d) => d.trackingId === m.trackingId && (d.milestoneId === m.id || d.milestoneId === null),
      );
      const isDisputed = Boolean(dispute);

      if (!isDisputed && m.autoReleaseStatus === "PAUSED_DISPUTE") {
        void db.projectMilestone.update({
          where: { id: m.id },
          data: { autoReleaseStatus: "PENDING" },
        }).catch(() => {});
      }

      return {
        id: m.id,
        title: m.title,
        amount: m.amount,
        validityDays: m.validityDays,
        releaseAt: m.releaseAt,
        autoReleaseStatus: isDisputed ? "PAUSED_DISPUTE" : (m.autoReleaseStatus === "PAUSED_DISPUTE" ? "PENDING" : (m.autoReleaseStatus ?? "PENDING")),
        createdAt: m.createdAt,
        jobTitle: m.tracking?.job?.title ?? "Contract Milestone",
        jobId: m.tracking?.job?.id ?? 0,
        projectId: m.tracking?.id ?? m.trackingId,
        professionalName: profName,
        hasDispute: isDisputed,
        disputeId: dispute?.id ?? null,
        disputeStatus: dispute?.status ?? null,
        disputeIssueType: dispute?.issueType ?? null,
      };
    });

    frozenAmount = lockedMilestones.reduce((acc, curr) => acc + curr.amount, 0);
    disputedFrozenAmount = lockedMilestones
      .filter((m) => m.hasDispute)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }

  const totalFunds = session.role === "CLIENT" ? wallet.balance + frozenAmount : wallet.balance;

  return NextResponse.json({
    wallet,
    total: totalEarned,
    grossTotal,
    commission: totalCommission,
    available,
    reserved: withdrawals + frozenAmount,
    frozenAmount,
    disputedFrozenAmount,
    totalFunds,
    lockedMilestones,
    withdrawals: withdrawalHistory,
    transactions,
    minWithdrawalAmount,
  });
}
import {
  getOrCreateRazorpayXContact,
  createBankFundAccount,
  createUpiFundAccount,
  createRazorpayXPayout,
  validateUpiVpa,
  verifyUpiVpaViaNpci,
  validateIfsc,
  validateAccountNumber,
} from "@/lib/razorpayx";

export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session || (session.role !== "PROFESSIONAL" && session.role !== "CLIENT"))
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const rawBody = await request.json().catch(() => null);
  const parsed = z
    .object({
      amount: z.number().int().positive(),
      destinationType: z.enum(["BANK", "CARD", "UPI"]).default("BANK"),
      destinationLabel: z.string().trim().min(2).max(1000),
      saveDetails: z.boolean().optional().default(false),
      accountHolder: z.string().trim().optional(),
      accountNumber: z.string().trim().optional(),
      ifscCode: z.string().trim().optional(),
      bankName: z.string().trim().optional(),
      upiId: z.string().trim().optional(),
      upiHolder: z.string().trim().optional(),
    })
    .safeParse(rawBody);

  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid withdrawal amount and payout destination." },
      { status: 400 },
    );

  const minWithdrawalAmount = await getMinWithdrawalAmount();
  if (parsed.data.amount < minWithdrawalAmount) {
    return NextResponse.json(
      {
        error: `Minimum withdrawal amount is ₹${minWithdrawalAmount.toLocaleString("en-IN")}.`,
      },
      { status: 400 },
    );
  }

  // Parse structured destination details
  let destDetails: {
    type?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
    upiHolder?: string;
  } = {};

  try {
    destDetails = JSON.parse(parsed.data.destinationLabel);
  } catch {
    // plain string fallback
  }

  const destinationType = parsed.data.destinationType;
  const accountHolder = (parsed.data.accountHolder || destDetails.accountHolder || "").trim();
  let accountNumber = (parsed.data.accountNumber || destDetails.accountNumber || "").trim();
  let ifsc = (parsed.data.ifscCode || destDetails.ifsc || "").trim().toUpperCase();
  const bankName = (parsed.data.bankName || destDetails.bankName || "").trim();
  let upiId = (parsed.data.upiId || destDetails.upiId || "").trim().toLowerCase();
  let upiHolder = (parsed.data.upiHolder || destDetails.upiHolder || accountHolder).trim();

  // Smart fallback: If upiId was not supplied explicitly, extract from raw destinationLabel if it's a VPA
  if (!upiId && destinationType === "UPI") {
    const rawLabel = parsed.data.destinationLabel.trim().toLowerCase();
    if (rawLabel.includes("@") && !rawLabel.includes(" ")) {
      upiId = rawLabel;
    }
  }

  // Smart fallback: Extract bank account & IFSC from legacy format "1234567890 (IFSC: HDFC0001234)"
  if ((!accountNumber || !ifsc) && destinationType === "BANK" && parsed.data.destinationLabel.includes("IFSC:")) {
    const match = parsed.data.destinationLabel.match(/^(\d+)\s*\(IFSC:\s*([A-Z0-9]+)\)$/i);
    if (match) {
      if (!accountNumber && match[1]) accountNumber = match[1];
      if (!ifsc && match[2]) ifsc = match[2].toUpperCase();
    }
  }

  const wallet = await ensureWallet(session.userId);
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      razorpayContactId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }
  const userName = `${user.firstName} ${user.lastName}`.trim();

  // Validate method-specific formats
  if (destinationType === "BANK") {
    const accValidation = validateAccountNumber(accountNumber, bankName, ifsc);
    if (!accValidation.valid) {
      return NextResponse.json(
        { error: accValidation.message ?? "Please enter a valid bank account number." },
        { status: 400 },
      );
    }
    const ifscValidation = validateIfsc(ifsc);
    if (!ifscValidation.valid) {
      return NextResponse.json(
        { error: ifscValidation.message ?? "Please enter a valid 11-character IFSC code." },
        { status: 400 },
      );
    }
    if (!accountHolder || accountHolder.trim().length < 2) {
      return NextResponse.json(
        { error: "Please enter the account holder name as per bank records." },
        { status: 400 },
      );
    }
  } else if (destinationType === "UPI") {
    const vpaValidation = validateUpiVpa(upiId);
    if (!vpaValidation.valid) {
      return NextResponse.json(
        { error: vpaValidation.message ?? "Invalid UPI ID. Please check and try again." },
        { status: 400 },
      );
    }
    if (!upiHolder || upiHolder.trim().length < 2) {
      if (accountHolder && accountHolder.trim().length >= 2) {
        upiHolder = accountHolder.trim();
      } else {
        return NextResponse.json(
          { error: "Please enter your name as registered with your UPI account." },
          { status: 400 },
        );
      }
    }
  }

  // Format structured destination details with AES-256-GCM encryption for bank accounts
  const cleanAccForDest = accountNumber.replace(/\s+/g, "");
  const encAccForDest = destinationType === "BANK" && cleanAccForDest ? encryptAccountNumber(cleanAccForDest) : null;

  const structuredDestination = JSON.stringify(
    destinationType === "BANK"
      ? {
          type: "BANK",
          bankName: bankName ? capitalizeWords(bankName) : "Bank Transfer",
          accountHolder: accountHolder ? capitalizeWords(accountHolder) : "",
          accountNumber: encAccForDest ? encAccForDest.encrypted : cleanAccForDest,
          last4: encAccForDest ? encAccForDest.last4 : cleanAccForDest.slice(-4),
          ifsc: ifsc.trim().toUpperCase(),
        }
      : {
          type: "UPI",
          upiId: upiId.trim().toLowerCase(),
          upiHolder: upiHolder ? capitalizeWords(upiHolder) : "",
        },
  );

  const autoWithdrawal = await isAutoWithdrawalEnabled();

  // Phase 1: Atomically verify available balance and process withdrawal (COMPLETED if Auto-Pay ON, PENDING if OFF)
  let userNotificationPayload: {
    id: number;
    type: string;
    title: string;
    description: string;
    href: string;
  } | null = null;
  let withdrawal;
  try {
    withdrawal = await db.$transaction(async (tx) => {
      let created;
      if (autoWithdrawal) {
        // Auto-Pay is ON: directly deduct balance and mark COMPLETED immediately without manual admin approval
        const deducted = await tx.$executeRaw(
          Prisma.sql`UPDATE "Wallet"
            SET "balance" = "balance" - ${parsed.data.amount}
            WHERE "id" = ${wallet.id}
              AND "balance" - "pendingBalance" >= ${parsed.data.amount}`,
        );
        if (deducted !== 1) throw new Error("Withdrawal amount exceeds your available balance.");

        const autoUtr = `KP${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

        created = await tx.projectWithdrawal.create({
          data: {
            professionalId: session.userId,
            amount: parsed.data.amount,
            destinationType: destinationType,
            destinationLabel: structuredDestination,
            status: "COMPLETED",
            payoutMode: destinationType === "UPI" ? "UPI" : "IMPS",
            utr: autoUtr,
          },
        });

        // Record completed transaction ledger row
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -parsed.data.amount,
            type: "WITHDRAWAL",
            status: "COMPLETED",
            description: `Withdrawal of ₹${parsed.data.amount.toLocaleString(
              "en-IN",
            )} transferred via Instant ${destinationType === "UPI" ? "UPI" : "IMPS"} (Auto-Pay)`,
            idempotencyKey: `auto-payout-${created.id}`,
            metadataJson: JSON.stringify({
              withdrawalId: created.id,
              destinationType: destinationType,
              destinationLabel: structuredDestination,
              utr: autoUtr,
            }),
          },
        });

        // Record in-app notification for user
        const notif = await tx.userNotification.create({
          data: {
            userId: session.userId,
            type: "PAYOUT_COMPLETED",
            title: "Withdrawal Transferred Instantly",
            description: `Your withdrawal of ₹${parsed.data.amount.toLocaleString(
              "en-IN",
            )} has been processed and transferred automatically via Instant ${destinationType === "UPI" ? "UPI" : "IMPS"}. UTR: ${autoUtr}.`,
            href: session.role === "CLIENT" ? "/client/earnings" : "/professional/earnings",
          },
        });
        userNotificationPayload = {
          id: notif.id,
          type: notif.type,
          title: notif.title,
          description: notif.description ?? "",
          href: notif.href ?? "",
        };
      } else {
        // Auto-Pay is OFF: reserve funds and set status to PENDING for admin review
        const reserved = await tx.$executeRaw(
          Prisma.sql`UPDATE "Wallet"
            SET "pendingBalance" = "pendingBalance" + ${parsed.data.amount}
            WHERE "id" = ${wallet.id}
              AND "balance" - "pendingBalance" >= ${parsed.data.amount}`,
        );
        if (reserved !== 1) throw new Error("Withdrawal amount exceeds your available balance.");

        created = await tx.projectWithdrawal.create({
          data: {
            professionalId: session.userId,
            amount: parsed.data.amount,
            destinationType: destinationType,
            destinationLabel: structuredDestination,
            status: "PENDING",
            payoutMode: destinationType === "UPI" ? "UPI" : "IMPS",
          },
        });
      }

      // Optional: Save to linked accounts for future 1-click requests
      if (parsed.data.saveDetails) {
        if (destinationType === "BANK" && accountNumber) {
          const cleanAcc = accountNumber.replace(/\s+/g, "");
          const enc = encryptAccountNumber(cleanAcc);
          const existingAcc = await tx.userLinkedAccount.findFirst({
            where: {
              userId: session.userId,
              accountType: "BANK",
              last4: enc.last4,
            },
          });
          if (existingAcc) {
            await tx.userLinkedAccount.update({
              where: { id: existingAcc.id },
              data: {
                bankName: bankName ? capitalizeWords(bankName) : existingAcc.bankName,
                accountHolder: accountHolder ? capitalizeWords(accountHolder) : existingAcc.accountHolder,
                accountNumber: enc.encrypted,
                ifscCode: ifsc,
              },
            });
          } else {
            await tx.userLinkedAccount.create({
              data: {
                userId: session.userId,
                accountType: "BANK",
                accountHolder: accountHolder ? capitalizeWords(accountHolder) : null,
                accountNumber: enc.encrypted,
                last4: enc.last4,
                ifscCode: ifsc,
                bankName: bankName ? capitalizeWords(bankName) : null,
                isDefault: false,
              },
            });
          }
        } else if (destinationType === "UPI" && upiId) {
          const cleanUpi = upiId.trim().toLowerCase();
          const existingAcc = await tx.userLinkedAccount.findFirst({
            where: { userId: session.userId, upiId: cleanUpi },
          });
          if (existingAcc) {
            await tx.userLinkedAccount.update({
              where: { id: existingAcc.id },
              data: {
                accountHolder: upiHolder ? capitalizeWords(upiHolder) : existingAcc.accountHolder,
              },
            });
          } else {
            const parts = cleanUpi.split("@");
            await tx.userLinkedAccount.create({
              data: {
                userId: session.userId,
                accountType: "UPI",
                accountHolder: upiHolder ? capitalizeWords(upiHolder) : null,
                upiId: cleanUpi,
                last4: parts[0]?.slice(-4) ?? null,
                isDefault: false,
              },
            });
          }
        }
      }

      return created;
    });

    if (userNotificationPayload) {
      emitRealtimeNotification([session.userId], userNotificationPayload);
    }

    if (!autoWithdrawal) {
      // Notify all active admins that a withdrawal request is pending their approval
      const admins = await db.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      if (admins.length > 0) {
        const userRow = await db.user.findUnique({
          where: { id: session.userId },
          select: { firstName: true, lastName: true },
        });
        const senderName =
          `${userRow?.firstName ?? ""} ${userRow?.lastName ?? ""}`.trim() ||
          `User #${session.userId}`;
        const adminNotif = {
          type: "WITHDRAWAL_REQUESTED",
          title: "New Withdrawal Request",
          description: `${senderName} requested a withdrawal of ₹${parsed.data.amount.toLocaleString(
            "en-IN",
          )} (${destinationType === "UPI" ? `UPI: ${upiId}` : `Bank: ${bankName || "Bank"}`}).`,
          href: "/admin/finance",
        };
        await db.userNotification.createMany({
          data: admins.map((a) => ({ userId: a.id, ...adminNotif })),
        });
        emitAdminNotification(adminNotif);
      }
    }
    emitAdminOverviewUpdate();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Withdrawal amount exceeds your available balance."
    )
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  const destinationText =
    destinationType === "UPI"
      ? `UPI ID (${upiId})`
      : `Bank Account (${bankName || "Bank"}, ending in ${accountNumber.slice(-4)})`;

  const responseMessage = autoWithdrawal
    ? `Withdrawal of ₹${parsed.data.amount.toLocaleString(
        "en-IN",
      )} transferred automatically to your ${destinationText}! UTR: ${withdrawal.utr}`
    : `Withdrawal request of ₹${parsed.data.amount.toLocaleString(
        "en-IN",
      )} to ${destinationText} submitted successfully! Your request has been forwarded to Admin for approval in the Finance portal.`;

  return NextResponse.json(
    {
      withdrawal,
      message: responseMessage,
    },
    { status: 201 },
  );
}
