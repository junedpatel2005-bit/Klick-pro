import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verifyUpiVpaViaNpci } from "@/lib/razorpayx";

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
  vpa: z.string().trim().min(3).max(256),
});

export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid UPI ID (e.g. rahul@upi)." },
      { status: 400 },
    );
  }

  const result = await verifyUpiVpaViaNpci(parsed.data.vpa);

  if (!result.valid) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: result.message || "Invalid UPI ID. Could not be verified on NPCI.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    valid: true,
    vpa: parsed.data.vpa.toLowerCase(),
    customerName: result.customerName,
    message: result.customerName
      ? `Verified on NPCI: ${result.customerName}`
      : "UPI ID verified successfully via NPCI.",
  });
}
