import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyUsers } from "@/lib/marketplace-notifications";
import { emitRealtimeDisputeMessage } from "@/lib/realtime";

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
      recipient: z.enum(["CLIENT", "PROFESSIONAL", "ALL"]).optional().default("ALL"),
      message: z.string().trim().min(1).max(4000),
    })
    .safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(disputeId) || disputeId < 1 || !parsed.success)
    return NextResponse.json({ error: "Invalid dispute message." }, { status: 400 });
  const dispute = await db.projectDispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
  const recipientId =
    parsed.data.recipient === "PROFESSIONAL" ? dispute.professionalId : dispute.clientId;
  const sender = await db.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  const senderName = "Klick-Pro Dispute Team (Admin)";
  const record = await db.projectDisputeMessage.create({
    data: {
      disputeId,
      senderId: session.userId,
      senderRole: "ADMIN",
      recipientId,
      message: parsed.data.message,
    },
  });
  emitRealtimeDisputeMessage([dispute.clientId, dispute.professionalId], {
    disputeId,
    message: {
      ...record,
      senderName,
    },
  });
  await notifyUsers([dispute.clientId, dispute.professionalId], {
    type: "DISPUTE_MESSAGE",
    title: `Message from Klick-Pro Support regarding dispute #${disputeId}`,
    description: `${sender?.firstName ?? "Klick-Pro"} ${sender?.lastName ?? "Support"}: ${record.message.slice(0, 180)}`,
    href: `/project/${dispute.trackingId}/tracking`,
  });
  return NextResponse.json({ message: { ...record, senderName } }, { status: 201 });
}
