import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { isRazorpayRouteConfigured, verifyRazorpayLinkedAccount } from "@/lib/razorpay";

const schema = z.object({
  razorpayAccountId: z
    .string()
    .trim()
    .regex(/^acc_[A-Za-z0-9]+$/, "Enter a valid Razorpay Linked Account ID.")
    .nullable(),
});

async function professional(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "PROFESSIONAL" ? session : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await professional(request);
  if (!session)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { razorpayAccountId: true },
  });
  return NextResponse.json({ razorpayAccountId: user?.razorpayAccountId ?? null });
}

export async function PUT(request: NextRequest) {
  const session = await professional(request);
  if (!session)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid Razorpay account ID." },
      { status: 400 },
    );

  // Clearing the saved account always stays possible.
  if (parsed.data.razorpayAccountId === null) {
    const cleared = await db.user.update({
      where: { id: session.userId },
      data: { razorpayAccountId: null },
    });
    return NextResponse.json({ razorpayAccountId: cleared.razorpayAccountId });
  }

  // A format-valid `acc_*` proves nothing: without this check a professional
  // could store an account they do not own and an admin payout would be
  // routed there. Verification only needs the live call when Route payouts
  // are actually enabled, so local and preview environments are not blocked.
  if (isRazorpayRouteConfigured()) {
    const check = await verifyRazorpayLinkedAccount(parsed.data.razorpayAccountId);
    if (!check.ok) {
      const message =
        check.reason === "not_found"
          ? "That Razorpay account could not be found on our account. Complete Razorpay onboarding first."
          : check.reason === "inactive"
            ? "That Razorpay account is not activated yet, so it cannot receive payouts."
            : "Razorpay could not verify that account. Try again in a moment.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const user = await db.user.update({
    where: { id: session.userId },
    data: { razorpayAccountId: parsed.data.razorpayAccountId },
  });
  return NextResponse.json({ razorpayAccountId: user.razorpayAccountId });
}
