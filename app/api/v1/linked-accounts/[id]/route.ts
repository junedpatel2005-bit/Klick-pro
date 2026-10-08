import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const { id } = await params;
  const accountId = Number(id);
  if (!accountId || isNaN(accountId)) {
    return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  }

  const existing = await db.userLinkedAccount.findFirst({
    where: { id: accountId, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await db.userLinkedAccount.delete({
    where: { id: accountId },
  });

  // If deleted account was default, promote another account if any
  if (existing.isDefault) {
    const nextAccount = await db.userLinkedAccount.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    if (nextAccount) {
      await db.userLinkedAccount.update({
        where: { id: nextAccount.id },
        data: { isDefault: true },
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const { id } = await params;
  const accountId = Number(id);
  if (!accountId || isNaN(accountId)) {
    return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  }

  const existing = await db.userLinkedAccount.findFirst({
    where: { id: accountId, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Unset previous defaults
  await db.userLinkedAccount.updateMany({
    where: { userId: session.userId, isDefault: true },
    data: { isDefault: false },
  });

  const updated = await db.userLinkedAccount.update({
    where: { id: accountId },
    data: { isDefault: true },
  });

  return NextResponse.json({ account: updated, success: true });
}
