import { db } from "@/lib/db";
import type { InvoiceParty } from "./InvoiceDocument";

export type PaymentReceiptData = {
  invoiceNumber: string;
  issuedAt: Date;
  status: string;
  description: string;
  from: { name: string; tagline?: string };
  billedTo: InvoiceParty;
  paidTo: InvoiceParty;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  grossLabel?: string;
  feeLabel?: string;
  netLabel?: string;
  lineDescription?: string;
  note?: string;
  currency: string;
  paymentReference?: string | null;
  jobTitle?: string;
  milestoneTitle?: string;
};

export async function fetchPaymentReceiptData(
  id: number,
  session: { userId: number; role: string },
): Promise<PaymentReceiptData | null> {
  // First attempt: Lookup in Payment table
  let payment = await db.payment.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          companyName: true,
        },
      },
      professional: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          professionalCategory: true,
          professionalCity: true,
        },
      },
      job: { select: { id: true, title: true, description: true } },
      milestone: {
        select: { id: true, title: true, description: true, amount: true, status: true },
      },
    },
  });

  // Second attempt: Lookup in ProjectTransaction table if not found by Payment ID
  let transaction = null;
  if (!payment) {
    transaction = await db.projectTransaction.findUnique({
      where: { id },
    });

    if (transaction) {
      // Find matching payment by milestoneId or tracking
      if (transaction.milestoneId) {
        payment = await db.payment.findFirst({
          where: { milestoneId: transaction.milestoneId },
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
                companyName: true,
              },
            },
            professional: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
                professionalCategory: true,
                professionalCity: true,
              },
            },
            job: { select: { id: true, title: true, description: true } },
            milestone: {
              select: { id: true, title: true, description: true, amount: true, status: true },
            },
          },
        });
      }
    }
  }

  // If still no payment but we have a transaction, resolve manually through ProjectTracking
  if (!payment && transaction) {
    const tracking = await db.projectTracking.findUnique({
      where: { id: transaction.trackingId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            companyName: true,
          },
        },
        professional: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            address: true,
            professionalCategory: true,
            professionalCity: true,
          },
        },
        job: { select: { id: true, title: true, description: true } },
      },
    });

    const milestone = transaction.milestoneId
      ? await db.projectMilestone.findUnique({
          where: { id: transaction.milestoneId },
          select: { id: true, title: true, description: true, amount: true, status: true },
        })
      : null;

    if (!tracking) return null;

    // Check authorization
    if (
      session.role !== "ADMIN" &&
      session.userId !== transaction.clientId &&
      session.userId !== transaction.professionalId
    ) {
      return null;
    }

    const isClient = session.userId === transaction.clientId;
    const isPro = session.userId === transaction.professionalId;
    const clientName = `${tracking.client.firstName} ${tracking.client.lastName}`.trim();
    const proName = `${tracking.professional.firstName} ${tracking.professional.lastName}`.trim();

    const gross = transaction.amount;
    const fee = Math.round(gross * 0.1);
    const net = isPro ? gross - fee : gross;

    return {
      invoiceNumber: `INV-${new Date(transaction.createdAt).getFullYear()}-${String(transaction.id).padStart(6, "0")}`,
      issuedAt: transaction.createdAt,
      status: transaction.status === "COMPLETED" ? "Paid & Cleared" : transaction.status,
      description: tracking.job
        ? `${tracking.job.title ?? "Project Milestone"} — ${milestone?.title ?? transaction.description}`
        : transaction.description,
      from: {
        name: "Klick-Pro Technologies",
        tagline: "Verified Milestone Escrow & Settlement Services",
      },
      billedTo: {
        name: clientName,
        email: tracking.client.email,
        phone: tracking.client.phone,
        address: tracking.client.address || tracking.client.companyName,
      },
      paidTo: {
        name: proName,
        email: tracking.professional.email,
        phone: tracking.professional.phone,
        address: tracking.professional.professionalCity,
      },
      grossAmount: gross,
      commissionAmount: isClient ? 0 : fee,
      netAmount: net,
      grossLabel: isClient ? "Total Charged" : "Client Milestone Payment",
      feeLabel: isClient ? "Client Fee" : "Platform Commission",
      netLabel: isClient ? "Milestone Amount" : "Net Professional Earnings",
      lineDescription: milestone?.title ? `Milestone: ${milestone.title}` : transaction.description,
      note: "Official settlement receipt generated by Klick-Pro Escrow Platform.",
      currency: "INR",
      paymentReference: `#TXN-${transaction.id}`,
      jobTitle: tracking.job.title ?? "Job Record",
      milestoneTitle: milestone?.title,
    };
  }

  if (!payment) return null;

  // Authorization check
  if (
    session.role !== "ADMIN" &&
    session.userId !== payment.clientId &&
    session.userId !== payment.professionalId
  ) {
    return null;
  }

  const isClientView = session.userId === payment.clientId;
  const isProfessionalView = session.userId === payment.professionalId;

  const clientName = `${payment.client?.firstName ?? ""} ${payment.client?.lastName ?? ""}`.trim();
  const proName =
    `${payment.professional?.firstName ?? ""} ${payment.professional?.lastName ?? ""}`.trim();

  const visibleAmounts = isClientView
    ? {
        gross: payment.amount,
        fee: payment.clientFeeAmount,
        net: payment.baseAmount,
        grossLabel: "Total Charged",
        feeLabel: "Client Service Fee",
        netLabel: "Milestone Net Amount",
        lineDescription: payment.milestone?.title
          ? `Milestone: ${payment.milestone.title}`
          : "Milestone payment plus platform service fee",
        note: "This client receipt confirms the milestone escrow payment charged to your account.",
      }
    : isProfessionalView
      ? {
          gross: payment.baseAmount,
          fee: payment.commissionAmount,
          net: payment.professionalPayoutAmount,
          grossLabel: "Client Milestone Payment",
          feeLabel: "Platform Commission",
          netLabel: "Net Earnings Credited",
          lineDescription: payment.milestone?.title
            ? `Milestone: ${payment.milestone.title}`
            : "Agreed milestone earnings approved by client",
          note: "This professional payout voucher confirms the milestone earnings credited after settlement.",
        }
      : {
          gross: payment.amount,
          fee: payment.adminNetAmount,
          net: payment.professionalPayoutAmount,
          grossLabel: "Total Client Charge",
          feeLabel: "Retained Platform Margin",
          netLabel: "Professional Net Payout",
          lineDescription: payment.milestone?.title
            ? `Milestone: ${payment.milestone.title}`
            : "Full platform settlement record",
          note: "Administrative settlement record detailing gross intake, platform margin, and professional payout.",
        };

  return {
    invoiceNumber: `INV-${new Date(payment.createdAt).getFullYear()}-${String(payment.id).padStart(6, "0")}`,
    issuedAt: payment.createdAt,
    status: payment.status === "COMPLETED" ? "Paid & Cleared" : payment.status,
    description: payment.job?.title
      ? `${payment.job.title} — ${payment.milestone?.title ?? "Milestone Payment"}`
      : (payment.milestone?.title ?? "Marketplace Milestone Settlement"),
    from: {
      name: "Klick-Pro Technologies",
      tagline: "Verified Milestone Escrow & Settlement Services",
    },
    billedTo: {
      name: clientName || "Client",
      email: payment.client?.email,
      phone: payment.client?.phone,
      address: payment.client?.address || payment.client?.companyName,
    },
    paidTo: {
      name: proName || "Professional",
      email: payment.professional?.email,
      phone: payment.professional?.phone,
      address: payment.professional?.professionalCity,
    },
    grossAmount: visibleAmounts.gross,
    commissionAmount: visibleAmounts.fee,
    netAmount: visibleAmounts.net,
    grossLabel: visibleAmounts.grossLabel,
    feeLabel: visibleAmounts.feeLabel,
    netLabel: visibleAmounts.netLabel,
    lineDescription: visibleAmounts.lineDescription,
    note: visibleAmounts.note,
    currency: payment.currency || "INR",
    paymentReference:
      payment.razorpayPaymentId || payment.providerReference || `#PAY-${payment.id}`,
    jobTitle: payment.job?.title ?? undefined,
    milestoneTitle: payment.milestone?.title ?? undefined,
  };
}
