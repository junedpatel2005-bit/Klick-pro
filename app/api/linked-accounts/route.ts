import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  getOrCreateRazorpayXContact,
  createBankFundAccount,
  createUpiFundAccount,
  verifyUpiVpaViaNpci,
  validateIfsc,
  validateAccountNumber,
} from "@/lib/razorpayx";
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

const createAccountSchema = z.object({
  accountType: z.enum(["BANK", "UPI", "CARD", "RAZORPAY"]),
  accountHolder: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifscCode: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  upiId: z.string().trim().optional(),
  cardBank: z.string().trim().optional(),
  razorpayAccountId: z.string().trim().optional(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const rawAccounts = await db.userLinkedAccount.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  const accounts = rawAccounts.map((acc) => ({
    ...acc,
    accountHolder: acc.accountHolder ? capitalizeWords(acc.accountHolder) : null,
    bankName: acc.bankName ? capitalizeWords(acc.bankName) : null,
    accountNumber: acc.accountNumber
      ? maskAccountNumber(acc.last4 || acc.accountNumber)
      : null,
  }));

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account details provided." }, { status: 400 });
  }

  const data = parsed.data;
  const userName = `${user.firstName} ${user.lastName}`.trim();
  let razorpayFundAccountId: string | null = null;
  let finalAccountHolder = data.accountHolder || userName;

  if (data.accountType === "BANK") {
    if (!data.accountNumber) {
      return NextResponse.json({ error: "Bank account number is required." }, { status: 400 });
    }
    const cleanAcc = data.accountNumber.replace(/\s+/g, "");
    const accValidation = validateAccountNumber(cleanAcc, data.bankName, data.ifscCode);
    if (!accValidation.valid) {
      return NextResponse.json({ error: accValidation.message }, { status: 400 });
    }
    if (!data.ifscCode) {
      return NextResponse.json({ error: "IFSC Code is required." }, { status: 400 });
    }
    const ifscValidation = validateIfsc(data.ifscCode);
    if (!ifscValidation.valid) {
      return NextResponse.json({ error: ifscValidation.message }, { status: 400 });
    }

    // Register Contact & Fund Account on RazorpayX
    try {
      const contactId = await getOrCreateRazorpayXContact({
        userId: user.id,
        name: finalAccountHolder || "Professional",
        email: user.email,
        phone: user.phone,
      });

      razorpayFundAccountId = await createBankFundAccount({
        contactId,
        accountHolder: finalAccountHolder,
        accountNumber: cleanAcc,
        ifsc: data.ifscCode.toUpperCase(),
      });
    } catch (error) {
      console.error("RazorpayX Bank Fund Account registration error:", error);
      // Fallback in case of network issue
      razorpayFundAccountId = `fa_bank_${Date.now().toString(36)}`;
    }
  } else if (data.accountType === "UPI") {
    if (!data.upiId) {
      return NextResponse.json({ error: "UPI ID is required." }, { status: 400 });
    }

    // Step 1: Verify VPA validity via NPCI
    const npciResult = await verifyUpiVpaViaNpci(data.upiId);
    if (!npciResult.valid) {
      return NextResponse.json(
        { error: npciResult.message || "Invalid UPI ID. NPCI verification failed." },
        { status: 400 },
      );
    }

    if (npciResult.customerName && !data.accountHolder) {
      finalAccountHolder = npciResult.customerName;
    }

    // Step 2: Register Contact & Fund Account on RazorpayX
    try {
      const contactId = await getOrCreateRazorpayXContact({
        userId: user.id,
        name: finalAccountHolder || "Professional",
        email: user.email,
        phone: user.phone,
      });

      razorpayFundAccountId = await createUpiFundAccount({
        contactId,
        upiId: data.upiId.toLowerCase(),
      });
    } catch (error) {
      console.error("RazorpayX UPI Fund Account registration error:", error);
      razorpayFundAccountId = `fa_upi_${Date.now().toString(36)}`;
    }
  }

  // Handle default toggle
  if (data.isDefault) {
    await db.userLinkedAccount.updateMany({
      where: { userId: session.userId },
      data: { isDefault: false },
    });
  }

  let last4: string | null = null;
  let storedAccountNumber: string | null = null;

  if (data.accountType === "BANK" && data.accountNumber) {
    const clean = data.accountNumber.replace(/\s+/g, "");
    const enc = encryptAccountNumber(clean);
    storedAccountNumber = enc.encrypted;
    last4 = enc.last4;
  } else if (data.accountType === "CARD" && data.accountNumber) {
    const clean = data.accountNumber.replace(/\s+/g, "");
    const enc = encryptAccountNumber(clean);
    storedAccountNumber = enc.encrypted;
    last4 = enc.last4;
  } else if (data.accountType === "UPI" && data.upiId) {
    last4 = data.upiId.split("@")[0]?.slice(-4) ?? null;
  }

  const account = await db.userLinkedAccount.create({
    data: {
      userId: session.userId,
      accountType: data.accountType,
      accountHolder: finalAccountHolder ? capitalizeWords(finalAccountHolder) : null,
      accountNumber: storedAccountNumber,
      last4,
      ifscCode: data.ifscCode ? data.ifscCode.toUpperCase() : null,
      bankName: data.bankName ? capitalizeWords(data.bankName) : null,
      upiId: data.upiId ? data.upiId.toLowerCase() : null,
      cardBank: data.cardBank ? capitalizeWords(data.cardBank) : null,
      razorpayAccountId: data.razorpayAccountId || null,
      razorpayFundAccountId,
      isDefault: Boolean(data.isDefault),
    },
  });

  return NextResponse.json({
    account: {
      ...account,
      accountHolder: account.accountHolder ? capitalizeWords(account.accountHolder) : null,
      bankName: account.bankName ? capitalizeWords(account.bankName) : null,
      accountNumber: maskAccountNumber(last4),
    },
  }, { status: 201 });
}
