import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ensureWallet, creditWalletFromVerifiedProvider } from "@/lib/wallet-ledger";
import { fetchRazorpayOrderPayments, isRazorpayConfigured } from "@/lib/razorpay";
import { getMinWithdrawalAmount } from "@/lib/platform-settings";
import { Prisma } from "@generated/prisma/client";

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
  const withdrawalHistory = canWithdraw
    ? await db.projectWithdrawal.findMany({
        where: { professionalId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const available = canWithdraw ? Math.max(0, wallet.balance - withdrawals) : wallet.balance;
  const minWithdrawalAmount = await getMinWithdrawalAmount();
  return NextResponse.json({
    wallet,
    total: totalEarned,
    grossTotal,
    commission: totalCommission,
    available,
    reserved: withdrawals,
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

  // Format structured destination details for clean admin verification
  const structuredDestination = JSON.stringify(
    destinationType === "BANK"
      ? {
          type: "BANK",
          bankName: bankName || "Bank Transfer",
          accountHolder: accountHolder.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim().toUpperCase(),
        }
      : {
          type: "UPI",
          upiId: upiId.trim().toLowerCase(),
          upiHolder: upiHolder.trim(),
        },
  );

  // Phase 1: Atomically verify available balance and reserve funds (status: PENDING for Admin Review)
  let withdrawal;
  try {
    withdrawal = await db.$transaction(async (tx) => {
      const reserved = await tx.$executeRaw(
        Prisma.sql`UPDATE "Wallet"
          SET "pendingBalance" = "pendingBalance" + ${parsed.data.amount}
          WHERE "id" = ${wallet.id}
            AND "balance" - "pendingBalance" >= ${parsed.data.amount}`,
      );
      if (reserved !== 1) throw new Error("Withdrawal amount exceeds your available balance.");

      const created = await tx.projectWithdrawal.create({
        data: {
          professionalId: session.userId,
          amount: parsed.data.amount,
          destinationType: destinationType,
          destinationLabel: structuredDestination,
          status: "PENDING",
          payoutMode: destinationType === "UPI" ? "UPI" : "IMPS",
        },
      });

      // Optional: Save to linked accounts for future 1-click requests
      if (parsed.data.saveDetails) {
        if (destinationType === "BANK" && accountNumber) {
          const existingAcc = await tx.userLinkedAccount.findFirst({
            where: { userId: session.userId, accountNumber },
          });
          if (existingAcc) {
            await tx.userLinkedAccount.update({
              where: { id: existingAcc.id },
              data: {
                bankName: bankName || existingAcc.bankName,
                accountHolder: accountHolder.trim(),
                ifscCode: ifsc,
              },
            });
          } else {
            await tx.userLinkedAccount.create({
              data: {
                userId: session.userId,
                accountType: "BANK",
                accountHolder: accountHolder.trim(),
                accountNumber,
                last4: accountNumber.slice(-4),
                ifscCode: ifsc,
                bankName: bankName || null,
                isDefault: false,
              },
            });
          }
        } else if (destinationType === "UPI" && upiId) {
          const existingAcc = await tx.userLinkedAccount.findFirst({
            where: { userId: session.userId, upiId },
          });
          if (existingAcc) {
            await tx.userLinkedAccount.update({
              where: { id: existingAcc.id },
              data: {
                accountHolder: upiHolder.trim(),
              },
            });
          } else {
            const parts = upiId.split("@");
            await tx.userLinkedAccount.create({
              data: {
                userId: session.userId,
                accountType: "UPI",
                accountHolder: upiHolder.trim(),
                upiId,
                last4: parts[0]?.slice(-4) ?? null,
                isDefault: false,
              },
            });
          }
        }
      }

      // Record in-app notification for user
      await tx.userNotification.create({
        data: {
          userId: session.userId,
          type: "PAYOUT_REQUESTED",
          title: "Withdrawal Request Received",
          description: `Your withdrawal request of ₹${parsed.data.amount.toLocaleString(
            "en-IN",
          )} has been submitted. It is pending review & approval by Admin in the Finance portal.`,
          href: session.role === "CLIENT" ? "/client/earnings" : "/professional/earnings",
        },
      });

      return created;
    });
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

  return NextResponse.json(
    {
      withdrawal,
      message: `Withdrawal request of ₹${parsed.data.amount.toLocaleString(
        "en-IN",
      )} to ${destinationText} submitted successfully! Your request has been forwarded to Admin for approval in the Finance portal.`,
    },
    { status: 201 },
  );
}
