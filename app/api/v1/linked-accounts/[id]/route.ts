import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { encryptAccountNumber, maskAccountNumber } from "@/lib/encryption";
import { capitalizeWords } from "@/lib/utils";

async function sessionFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

const updateLinkedAccountSchema = z.object({
  accountType: z.enum(["BANK", "UPI", "CARD", "RAZORPAY"]).optional(),
  accountHolder: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  ifscCode: z.string().trim().toUpperCase().optional().nullable(),
  bankName: z.string().trim().optional().nullable(),
  upiId: z.string().trim().toLowerCase().optional().nullable(),
  cardBank: z.string().trim().optional().nullable(),
  razorpayAccountId: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

    const { id } = await params;
    const accountId = Number(id);
    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
    }

    const existing = await db.userLinkedAccount.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    await db.userLinkedAccount.delete({
      where: { id: accountId },
    });

    // If deleted account was default, promote another account if any
    if (existing.isDefault) {
      const nextAccount = await db.userLinkedAccount.findFirst({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
      });
      if (nextAccount) {
        await db.userLinkedAccount.update({
          where: { id: nextAccount.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/v1/linked-accounts/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove account." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

    const { id } = await params;
    const accountId = Number(id);
    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
    }

    const existing = await db.userLinkedAccount.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Unset previous defaults
    await db.userLinkedAccount.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await db.userLinkedAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });

    return NextResponse.json({
      account: {
        ...updated,
        accountHolder: updated.accountHolder ? capitalizeWords(updated.accountHolder) : null,
        bankName: updated.bankName ? capitalizeWords(updated.bankName) : null,
        accountNumber: maskAccountNumber(updated.last4 || updated.accountNumber),
      },
      success: true,
    });
  } catch (error) {
    console.error("PATCH /api/v1/linked-accounts/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update default account." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

    const { id } = await params;
    const accountId = Number(id);
    if (!accountId || isNaN(accountId)) {
      return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
    }

    const existing = await db.userLinkedAccount.findFirst({
      where: { id: accountId, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = updateLinkedAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid account details provided.", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const {
      accountType = (existing.accountType as "BANK" | "UPI" | "CARD" | "RAZORPAY"),
      accountHolder,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
      cardBank,
      razorpayAccountId,
      isDefault,
    } = parsed.data;

    let last4: string | null = existing.last4;
    let storedAccountNumber: string | null = existing.accountNumber;

    if (accountType === "BANK") {
      if (accountNumber && accountNumber.trim()) {
        const cleanAcc = accountNumber.replace(/\s+/g, "");
        if (cleanAcc.length < 6) {
          return NextResponse.json(
            { error: "Please enter a valid bank account number." },
            { status: 400 },
          );
        }
        const enc = encryptAccountNumber(cleanAcc);
        storedAccountNumber = enc.encrypted;
        last4 = enc.last4;
      }
      const ifsc = ifscCode || existing.ifscCode;
      if (!ifsc || ifsc.length !== 11) {
        return NextResponse.json(
          { error: "Please enter a valid 11-character IFSC code." },
          { status: 400 },
        );
      }
    } else if (accountType === "UPI") {
      const vpa = upiId || existing.upiId;
      if (!vpa || !vpa.includes("@")) {
        return NextResponse.json(
          { error: "Please enter a valid UPI ID (e.g. rahul@upi)." },
          { status: 400 },
        );
      }
      const { verifyUpiVpaViaNpci } = await import("@/lib/razorpayx");
      const npciCheck = await verifyUpiVpaViaNpci(vpa);
      if (!npciCheck.valid) {
        return NextResponse.json(
          { error: npciCheck.message || "Invalid UPI ID. Could not be verified on NPCI." },
          { status: 400 },
        );
      }
      const parts = vpa.split("@");
      last4 = parts[0]?.slice(-4) ?? null;
    } else if (accountType === "CARD") {
      if (accountNumber && accountNumber.trim()) {
        const cleanCard = accountNumber.replace(/\s/g, "");
        if (cleanCard.length < 15) {
          return NextResponse.json(
            { error: "Please enter a valid 16-digit debit card number." },
            { status: 400 },
          );
        }
        const enc = encryptAccountNumber(cleanCard);
        storedAccountNumber = enc.encrypted;
        last4 = enc.last4;
      }
    } else if (accountType === "RAZORPAY") {
      const rzpId = razorpayAccountId || existing.razorpayAccountId;
      if (!rzpId || rzpId.length < 5) {
        return NextResponse.json(
          { error: "Please enter a valid Razorpay Account ID." },
          { status: 400 },
        );
      }
      last4 = rzpId.slice(-4);
    }

    if (isDefault) {
      await db.userLinkedAccount.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    let razorpayFundAccountId: string | null = existing.razorpayFundAccountId;
    try {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
      if (user) {
        const userName = `${user.firstName} ${user.lastName}`.trim();
        const {
          getOrCreateRazorpayXContact,
          createBankFundAccount,
          createUpiFundAccount,
        } = await import("@/lib/razorpayx");

        const contactId = await getOrCreateRazorpayXContact({
          userId: user.id,
          name: accountHolder || existing.accountHolder || userName || "Professional",
          email: user.email,
          phone: user.phone,
        });

        if (accountType === "BANK") {
          const finalAcc = accountNumber ? accountNumber.replace(/\s+/g, "") : null;
          const finalIfsc = ifscCode || existing.ifscCode;
          if (finalAcc && finalIfsc) {
            razorpayFundAccountId = await createBankFundAccount({
              contactId,
              accountHolder: accountHolder || existing.accountHolder || userName || "Account Holder",
              accountNumber: finalAcc,
              ifsc: finalIfsc,
            });
          }
        } else if (accountType === "UPI") {
          const finalUpi = upiId || existing.upiId;
          if (finalUpi) {
            razorpayFundAccountId = await createUpiFundAccount({
              contactId,
              upiId: finalUpi,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Auto-update RazorpayX fund account error:", err);
    }

    const updated = await db.userLinkedAccount.update({
      where: { id: accountId },
      data: {
        accountType,
        accountHolder: accountHolder !== undefined ? (accountHolder ? capitalizeWords(accountHolder) : null) : existing.accountHolder,
        accountNumber: storedAccountNumber,
        last4,
        ifscCode: ifscCode !== undefined ? ifscCode : existing.ifscCode,
        bankName: bankName !== undefined ? (bankName ? capitalizeWords(bankName) : null) : existing.bankName,
        upiId: upiId !== undefined ? upiId : existing.upiId,
        cardBank: cardBank !== undefined ? (cardBank ? capitalizeWords(cardBank) : null) : existing.cardBank,
        razorpayAccountId: razorpayAccountId !== undefined ? razorpayAccountId : existing.razorpayAccountId,
        razorpayFundAccountId,
        isDefault: isDefault !== undefined ? isDefault : existing.isDefault,
      },
    });

    return NextResponse.json({
      account: {
        ...updated,
        accountHolder: updated.accountHolder ? capitalizeWords(updated.accountHolder) : null,
        bankName: updated.bankName ? capitalizeWords(updated.bankName) : null,
        accountNumber: maskAccountNumber(last4),
      },
      success: true,
    });
  } catch (error) {
    console.error("PUT /api/v1/linked-accounts/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account." },
      { status: 500 },
    );
  }
}
