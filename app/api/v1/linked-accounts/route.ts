import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { validateBankSpecificAccountNumber } from "@/lib/indian-banks";

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
  try {
    const session = await sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

    const accounts = await db.userLinkedAccount.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("GET /api/v1/linked-accounts error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve linked accounts." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
      if (!accountNumber) {
        return NextResponse.json(
          { error: "Please enter a valid bank account number." },
          { status: 400 },
        );
      }
      const accValidation = validateBankSpecificAccountNumber(accountNumber, bankName, ifscCode);
      if (!accValidation.valid) {
        return NextResponse.json(
          { error: accValidation.message ?? "Please enter a valid bank account number." },
          { status: 400 },
        );
      }
      if (!ifscCode || ifscCode.length !== 11) {
        return NextResponse.json(
          { error: "Please enter a valid 11-character IFSC code." },
          { status: 400 },
        );
      }
      last4 = accountNumber.slice(-4);
    } else if (accountType === "UPI") {
      if (!upiId || !upiId.includes("@")) {
        return NextResponse.json(
          { error: "Please enter a valid UPI ID (e.g. rahul@upi)." },
          { status: 400 },
        );
      }
      const { verifyUpiVpaViaNpci } = await import("@/lib/razorpayx");
      const npciCheck = await verifyUpiVpaViaNpci(upiId);
      if (!npciCheck.valid) {
        return NextResponse.json(
          { error: npciCheck.message || "Invalid UPI ID. Could not be verified on NPCI." },
          { status: 400 },
        );
      }
      const parts = upiId.split("@");
      last4 = parts[0]?.slice(-4) ?? null;
    } else if (accountType === "CARD") {
      const cleanCard = (accountNumber ?? "").replace(/\s/g, "");
      if (cleanCard.length < 15) {
        return NextResponse.json(
          { error: "Please enter a valid 16-digit debit card number." },
          { status: 400 },
        );
      }
      last4 = cleanCard.slice(-4);
    } else if (accountType === "RAZORPAY") {
      if (!razorpayAccountId || razorpayAccountId.length < 5) {
        return NextResponse.json(
          { error: "Please enter a valid Razorpay Account ID (e.g. acc_...)." },
          { status: 400 },
        );
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

    let razorpayFundAccountId: string | null = null;
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
          name: accountHolder || userName || "Professional",
          email: user.email,
          phone: user.phone,
        });

        if (accountType === "BANK" && accountNumber && ifscCode) {
          razorpayFundAccountId = await createBankFundAccount({
            contactId,
            accountHolder: accountHolder || userName || "Account Holder",
            accountNumber,
            ifsc: ifscCode,
          });
        } else if (accountType === "UPI" && upiId) {
          razorpayFundAccountId = await createUpiFundAccount({
            contactId,
            upiId,
          });
        }
      }
    } catch (err) {
      console.warn("Auto-register RazorpayX fund account error:", err);
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
        razorpayFundAccountId,
        isDefault: shouldBeDefault,
      },
    });

    return NextResponse.json({ account, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/linked-accounts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to link account." },
      { status: 500 },
    );
  }
}
