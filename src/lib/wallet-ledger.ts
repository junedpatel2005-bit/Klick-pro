import "server-only";
import { db } from "@/lib/db";
import { calculateMilestoneMoney } from "@/lib/payment-fees";
import { Prisma } from "@generated/prisma/client";

export {
  CLIENT_FEE_RATE,
  PROFESSIONAL_FEE_RATE,
  calculateMilestoneMoney,
} from "@/lib/payment-fees";

type LedgerClient = Prisma.TransactionClient;

export async function ensureWallet(userId: number) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await db.wallet.create({ data: { userId } });
  } catch {
    // Another request may have created the unique user wallet between the read and create.
    return db.wallet.findUniqueOrThrow({ where: { userId } });
  }
}

async function walletForUser(tx: LedgerClient, userId: number) {
  return tx.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function recordTransaction(
  tx: LedgerClient,
  input: {
    userId: number;
    amount: number;
    type: string;
    status?: string;
    description: string;
    idempotencyKey: string;
    paymentId?: number;
    metadata?: Record<string, number | string>;
  },
) {
  const wallet = await walletForUser(tx, input.userId);
  if (input.amount < 0) {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { role: true } });
    if (user?.role === "ADMIN" && wallet.balance < Math.abs(input.amount)) {
      const topUp = Math.abs(input.amount) - wallet.balance;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: topUp } },
      });
    }
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: Math.abs(input.amount) } },
      data: { balance: { decrement: Math.abs(input.amount) } },
    });
    if (result.count !== 1) throw new Error("Insufficient wallet balance.");
  } else if (input.amount > 0) {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: input.amount } },
    });
  }
  return tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      paymentId: input.paymentId,
      type: input.type,
      amount: input.amount,
      status: input.status ?? "COMPLETED",
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function creditWalletFromVerifiedProvider(
  tx: LedgerClient,
  input: { userId: number; amount: number; providerReference: string; providerPaymentId: string },
) {
  const wallet = await walletForUser(tx, input.userId);
  const transaction = await tx.walletTransaction.findUnique({
    where: { providerReference: input.providerReference },
  });
  if (!transaction || transaction.walletId !== wallet.id || transaction.status !== "PENDING")
    throw new Error("Wallet top-up is invalid or already processed.");
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: input.amount } },
  });
  return tx.walletTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "COMPLETED",
      metadataJson: JSON.stringify({ providerPaymentId: input.providerPaymentId }),
    },
  });
}

export async function fundMilestoneFromWallet(
  tx: LedgerClient,
  input: {
    paymentId: number;
    clientId: number;
    professionalId: number;
    baseAmount: number;
    milestoneId: number;
  },
) {
  const admin = await tx.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin account is configured for settlement.");
  const money = calculateMilestoneMoney(input.baseAmount);
  await recordTransaction(tx, {
    userId: input.clientId,
    amount: -money.clientChargeAmount,
    type: "MILESTONE_PAYMENT",
    description: `Milestone payment debited: ${money.baseAmount}`,
    idempotencyKey: `payment-${input.paymentId}-client-debit`,
    paymentId: input.paymentId,
    metadata: { milestoneId: input.milestoneId, baseAmount: money.baseAmount },
  });
  await recordTransaction(tx, {
    userId: admin.id,
    amount: money.clientChargeAmount,
    type: "ADMIN_MILESTONE_RECEIPT",
    description: `Client milestone receipt: ${money.clientChargeAmount}`,
    idempotencyKey: `payment-${input.paymentId}-admin-credit`,
    paymentId: input.paymentId,
    metadata: { milestoneId: input.milestoneId, baseAmount: money.baseAmount },
  });
  return money;
}

export async function releaseMilestoneToProfessional(
  tx: LedgerClient,
  input: {
    paymentId: number;
    clientId: number;
    professionalId: number;
    baseAmount: number;
    milestoneId: number;
  },
) {
  const admin = await tx.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin account is configured for settlement.");
  const money = calculateMilestoneMoney(input.baseAmount);
  await recordTransaction(tx, {
    userId: admin.id,
    amount: -money.professionalPayoutAmount,
    type: "PROFESSIONAL_PAYOUT",
    description: `Professional payout: ${money.professionalPayoutAmount}`,
    idempotencyKey: `payment-${input.paymentId}-admin-debit`,
    paymentId: input.paymentId,
    metadata: { milestoneId: input.milestoneId, baseAmount: money.baseAmount },
  });
  await recordTransaction(tx, {
    userId: input.professionalId,
    amount: money.professionalPayoutAmount,
    type: "MILESTONE_EARNING",
    description: `Milestone earning: ${money.professionalPayoutAmount}`,
    idempotencyKey: `payment-${input.paymentId}-professional-credit`,
    paymentId: input.paymentId,
    metadata: { milestoneId: input.milestoneId, baseAmount: money.baseAmount },
  });
  return money;
}

/** @deprecated Use fundMilestoneFromWallet and releaseMilestoneToProfessional separately. */
export async function settleMilestoneFromWallet(
  tx: LedgerClient,
  input: {
    paymentId: number;
    clientId: number;
    professionalId: number;
    baseAmount: number;
    milestoneId: number;
  },
) {
  const money = await fundMilestoneFromWallet(tx, input);
  await releaseMilestoneToProfessional(tx, input);
  return money;
}

export async function refundDisputeToClient(
  tx: LedgerClient,
  input: {
    disputeId: number;
    paymentId?: number;
    clientId: number;
    amount: number;
    reason: string;
  },
) {
  if (input.amount <= 0) return { refundAmount: 0 };
  const admin = await tx.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin account is configured for settlement.");
  await recordTransaction(tx, {
    userId: admin.id,
    amount: -input.amount,
    type: "DISPUTE_REFUND_DEBIT",
    description: `Dispute refund debit: ₹${input.amount} (${input.reason})`,
    idempotencyKey: `dispute-${input.disputeId}-admin-refund-debit`,
    paymentId: input.paymentId,
    metadata: { disputeId: input.disputeId, amount: input.amount },
  });
  await recordTransaction(tx, {
    userId: input.clientId,
    amount: input.amount,
    type: "DISPUTE_REFUND",
    description: `Dispute refund credited: ₹${input.amount}`,
    idempotencyKey: `dispute-${input.disputeId}-client-refund-credit`,
    paymentId: input.paymentId,
    metadata: { disputeId: input.disputeId, amount: input.amount },
  });
  return { refundAmount: input.amount };
}

export async function releaseDisputeToProfessional(
  tx: LedgerClient,
  input: {
    disputeId: number;
    paymentId?: number;
    professionalId: number;
    amount: number;
    reason: string;
  },
) {
  if (input.amount <= 0) return { payoutAmount: 0 };
  const admin = await tx.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin account is configured for settlement.");
  await recordTransaction(tx, {
    userId: admin.id,
    amount: -input.amount,
    type: "DISPUTE_PAYOUT_DEBIT",
    description: `Dispute payout debit: ₹${input.amount} (${input.reason})`,
    idempotencyKey: `dispute-${input.disputeId}-admin-payout-debit`,
    paymentId: input.paymentId,
    metadata: { disputeId: input.disputeId, amount: input.amount },
  });
  await recordTransaction(tx, {
    userId: input.professionalId,
    amount: input.amount,
    type: "DISPUTE_PAYOUT",
    description: `Dispute payout credited: ₹${input.amount}`,
    idempotencyKey: `dispute-${input.disputeId}-professional-payout-credit`,
    paymentId: input.paymentId,
    metadata: { disputeId: input.disputeId, amount: input.amount },
  });
  return { payoutAmount: input.amount };
}

export async function settlePartialDispute(
  tx: LedgerClient,
  input: {
    disputeId: number;
    paymentId?: number;
    clientId: number;
    professionalId: number;
    refundAmount: number;
    payoutAmount: number;
    reason: string;
  },
) {
  if (input.refundAmount > 0) {
    await refundDisputeToClient(tx, {
      disputeId: input.disputeId,
      paymentId: input.paymentId,
      clientId: input.clientId,
      amount: input.refundAmount,
      reason: input.reason,
    });
  }
  if (input.payoutAmount > 0) {
    await releaseDisputeToProfessional(tx, {
      disputeId: input.disputeId,
      paymentId: input.paymentId,
      professionalId: input.professionalId,
      amount: input.payoutAmount,
      reason: input.reason,
    });
  }
  return { refundAmount: input.refundAmount, payoutAmount: input.payoutAmount };
}

export { db };
