import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

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
  const user = await db.user.update({
    where: { id: session.userId },
    data: { razorpayAccountId: parsed.data.razorpayAccountId },
  });
  return NextResponse.json({ razorpayAccountId: user.razorpayAccountId });
}
