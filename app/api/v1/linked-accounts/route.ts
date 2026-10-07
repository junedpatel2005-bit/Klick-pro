import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function sessionFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

const createLinkedAccountSchema = z.object({
  accountType: z.enum(["BANK", "UPI", "CARD", "RAZORPAY"]),
  accountHolder: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  ifscCode: z.string().trim().toUpperCase().optional().nullable(),
  bankName: z.string().trim().optional().nullable(),
  upiId: z.string().trim().toLowerCase().optional().nullable(),
  cardBank: z.string().trim().optional().nullable(),
  razorpayAccountId: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const accounts = await db.userLinkedAccount.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createLinkedAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid account details provided.", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const {
    accountType,
    accountHolder,
    accountNumber,
    ifscCode,
    bankName,
    upiId,
    cardBank,
    razorpayAccountId,
    isDefault,
  } = parsed.data;

  let last4: string | null = null;

  if (accountType === "BANK") {
    if (!accountNumber || accountNumber.length < 6) {
      return NextResponse.json({ error: "Please enter a valid bank account number." }, { status: 400 });
    }
    if (!ifscCode || ifscCode.length !== 11) {
      return NextResponse.json({ error: "Please enter a valid 11-character IFSC code." }, { status: 400 });
    }
    last4 = accountNumber.slice(-4);
  } else if (accountType === "UPI") {
    if (!upiId || !upiId.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid UPI ID (e.g. name@oksbi)." }, { status: 400 });
    }
    const parts = upiId.split("@");
    last4 = parts[0]?.slice(-4) ?? null;
  } else if (accountType === "CARD") {
    const cleanCard = (accountNumber ?? "").replace(/\s/g, "");
    if (cleanCard.length < 15) {
      return NextResponse.json({ error: "Please enter a valid 16-digit debit card number." }, { status: 400 });
    }
    last4 = cleanCard.slice(-4);
  } else if (accountType === "RAZORPAY") {
    if (!razorpayAccountId || razorpayAccountId.length < 5) {
      return NextResponse.json({ error: "Please enter a valid Razorpay Account ID (e.g. acc_...)." }, { status: 400 });
    }
    last4 = razorpayAccountId.slice(-4);
  }

  // Check if this is the first account for this user
  const count = await db.userLinkedAccount.count({ where: { userId: session.userId } });
  const shouldBeDefault = isDefault || count === 0;

  if (shouldBeDefault) {
    await db.userLinkedAccount.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const account = await db.userLinkedAccount.create({
    data: {
      userId: session.userId,
      accountType,
      accountHolder: accountHolder || null,
      accountNumber: accountNumber || null,
      last4,
      ifscCode: ifscCode || null,
      bankName: bankName || null,
      upiId: upiId || null,
      cardBank: cardBank || null,
      razorpayAccountId: razorpayAccountId || null,
      isDefault: shouldBeDefault,
    },
  });

  return NextResponse.json({ account, success: true }, { status: 201 });
}

