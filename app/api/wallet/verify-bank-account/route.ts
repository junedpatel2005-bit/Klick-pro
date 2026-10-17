import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verifyBankAccountViaPennyDrop } from "@/lib/razorpayx";
import { lookupIfscCode, findIfscByBankAndLocation, type CommonBranch } from "@/lib/indian-banks";
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
      const bankQuery = (bank || "").trim();
      const locQuery = (location || "").trim();

      // Check if user entered an exact 11-char IFSC code in either field
      const possibleIfsc = (locQuery || bankQuery).toUpperCase().replace(/\s+/g, "");
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(possibleIfsc)) {
        const directLookup = await lookupIfscCode(possibleIfsc);
        if (directLookup.valid && directLookup.bank) {
          return NextResponse.json({
            valid: true,
            results: [
              {
                bankCode: possibleIfsc.slice(0, 4),
                bankName: directLookup.bank,
                branch: directLookup.branch || "Main Branch",
                city: directLookup.city || "",
                state: directLookup.state || "",
                ifsc: possibleIfsc,
                address: directLookup.address || "",
              },
            ],
          });
        }
      }

      // Step 1: Local curated directory matches (instant)
      const localMatches = findIfscByBankAndLocation(bankQuery, locQuery);

      // Step 2: Determine bankCode from bank name or code if possible
      let bankCode = "";
      if (bankQuery) {
        const bUpper = bankQuery.toUpperCase();
        if (bUpper === "SBI" || bUpper.includes("STATE BANK")) bankCode = "SBIN";
        else if (bUpper === "HDFC" || bUpper.includes("HDFC")) bankCode = "HDFC";
        else if (bUpper === "ICICI" || bUpper.includes("ICICI")) bankCode = "ICIC";
        else if (bUpper === "BOB" || bUpper.includes("BARODA")) bankCode = "BARB";
        else if (bUpper === "AXIS" || bUpper.includes("AXIS")) bankCode = "UTIB";
        else if (bUpper === "KOTAK" || bUpper.includes("KOTAK")) bankCode = "KKBK";
        else if (bUpper === "PNB" || bUpper.includes("PUNJAB NATIONAL")) bankCode = "PUNB";
        else if (bUpper === "CANARA" || bUpper.includes("CANARA")) bankCode = "CNRB";
        else if (bUpper === "UNION" || bUpper.includes("UNION BANK")) bankCode = "UBIN";
        else if (bUpper.length === 4 && /^[A-Z]{4}$/.test(bUpper)) bankCode = bUpper;
      }

      // Step 3: Query live national Razorpay IFSC directory across all 185,000+ branches
      const onlineResults: CommonBranch[] = [];

      if (locQuery) {
        // Normalize city / district query
        const targetCity = locQuery.replace(/[^a-zA-Z\s]/g, "").trim().toUpperCase();
        if (targetCity) {
          try {
            const searchParams = new URLSearchParams();
            searchParams.set("city", targetCity);
            if (bankCode) searchParams.set("bankcode", bankCode);
            searchParams.set("limit", "50");

            const res = await fetch(`https://ifsc.razorpay.com/search?${searchParams.toString()}`, {
              cache: "force-cache",
              signal: AbortSignal.timeout(3500),
            });

            if (res.ok) {
              const data = await res.json().catch(() => null);
              const items = data?.data || [];
              for (const item of items) {
                if (item?.IFSC) {
                  onlineResults.push({
                    bankCode: item.BANKCODE || item.IFSC.slice(0, 4),
                    bankName: item.BANK || bankQuery || "Bank",
                    branch: item.BRANCH || "",
                    city: item.CITY || item.DISTRICT || item.CENTRE || "",
                    state: item.STATE || "",
                    ifsc: item.IFSC,
                    address: item.ADDRESS || "",
                  });
                }
              }
            }
          } catch {
            // Ignore API timeout/network failure
          }
        }
      }

      // Step 4: Merge results, prioritizing local matches, then online results
      const merged: CommonBranch[] = [...localMatches];
      for (const item of onlineResults) {
        if (!merged.some((m) => m.ifsc === item.ifsc)) {
          merged.push(item);
        }
      }

      return NextResponse.json({ valid: true, results: merged });
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
