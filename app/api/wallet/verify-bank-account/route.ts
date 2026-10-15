import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verifyBankAccountViaPennyDrop } from "@/lib/razorpayx";
import { lookupIfscCode, findIfscByBankAndLocation } from "@/lib/indian-banks";
import { rateLimit } from "@/lib/rate-limit";

async function sessionFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

const schema = z.object({
  accountNumber: z.string().trim().min(6).max(25),
  ifscCode: z.string().trim().length(11),
  accountHolder: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await sessionFrom(request);
    if (!session) {
      return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    }

    if (!rateLimit(`penny-drop:${session.userId}`, 5, 10 * 60_000)) {
      return NextResponse.json(
        { error: "Too many bank verification attempts. Please wait 10 minutes before trying again." },
        { status: 429 },
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = schema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid Account Number (9-18 digits) and an 11-character IFSC code." },
        { status: 400 },
      );
    }

    const cleanIfsc = parsed.data.ifscCode.toUpperCase().replace(/\s+/g, "");

    // Live IFSC lookup first
    const ifscDetails = await lookupIfscCode(cleanIfsc);
    if (!ifscDetails.valid) {
      return NextResponse.json(
        { success: false, valid: false, error: ifscDetails.error || "Invalid IFSC code." },
        { status: 400 },
      );
    }

    const result = await verifyBankAccountViaPennyDrop({
      accountNumber: parsed.data.accountNumber,
      ifsc: cleanIfsc,
      accountHolder: parsed.data.accountHolder,
    });

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: result.message || "Bank account verification failed. Account does not exist.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      bankName: result.bankName || ifscDetails.bank,
      branch: result.branch || ifscDetails.branch,
      city: result.city || ifscDetails.city,
      state: result.state || ifscDetails.state,
      message: result.message || `Account verified at ${ifscDetails.bank}`,
    });
  } catch (error) {
    console.error("POST /api/wallet/verify-bank-account error:", error);
    return NextResponse.json(
      { success: false, valid: false, error: "Bank account verification service error." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const ifsc = request.nextUrl.searchParams.get("ifsc");
    const bank = request.nextUrl.searchParams.get("bank");
    const location = request.nextUrl.searchParams.get("location");

    if (bank !== null || location !== null) {
      const results = findIfscByBankAndLocation(bank || "", location || "");
      return NextResponse.json({ valid: true, results });
    }

    if (!ifsc) {
      return NextResponse.json({ error: "Missing ifsc query parameter." }, { status: 400 });
    }
    const result = await lookupIfscCode(ifsc);
    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ valid: true, data: result });
  } catch (error) {
    console.error("GET /api/wallet/verify-bank-account error:", error);
    return NextResponse.json(
      { valid: false, error: "Unable to complete IFSC lookup." },
      { status: 500 },
    );
  }
}
