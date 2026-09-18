import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyDisputeMessage } from "@/lib/marketplace-notifications";

async function admin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await admin(request);
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const disputeId = Number((await params).id);
  const parsed = z
    .object({
      recipient: z.enum(["CLIENT", "PROFESSIONAL"]),
      message: z.string().trim().min(2).max(4000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(disputeId) || disputeId < 1 || !parsed.success)
    return NextResponse.json({ error: "Invalid dispute message." }, { status: 400 });
  const dispute = await db.projectDispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
  const recipientId =
    parsed.data.recipient === "CLIENT" ? dispute.clientId : dispute.professionalId;
  const sender = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const record = await db.projectDisputeMessage.create({
    data: {
      disputeId,
      senderId: session.userId,
      senderRole: "ADMIN",
      recipientId,
      message: parsed.data.message,
    },
  });
  await notifyDisputeMessage({
    disputeId,
    trackingId: dispute.trackingId,
    recipientId,
    senderName: `${sender?.firstName ?? "Klick-Pro"} ${sender?.lastName ?? "Support"}`.trim(),
    message: record.message,
  });
  return NextResponse.json({ message: record }, { status: 201 });
}
