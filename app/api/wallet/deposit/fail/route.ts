import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

const schema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payment order." }, { status: 400 });
  const transaction = await db.walletTransaction.findFirst({
    where: { providerReference: parsed.data.orderId, wallet: { userId: session.userId } },
  });
  if (!transaction)
    return NextResponse.json({ error: "Wallet payment not found." }, { status: 404 });
  if (transaction.status === "COMPLETED") return NextResponse.json({ ok: true });
  await db.walletTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "FAILED",
      metadataJson: JSON.stringify({ reason: parsed.data.reason ?? "Checkout cancelled." }),
    },
  });
  return NextResponse.json({ ok: true });
}
