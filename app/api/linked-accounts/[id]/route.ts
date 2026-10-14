import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  }

  const account = await db.userLinkedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || account.userId !== session.userId) {
    return NextResponse.json({ error: "Linked account not found." }, { status: 404 });
  }

  await db.userLinkedAccount.delete({
    where: { id: accountId },
  });

  return NextResponse.json({ success: true, message: "Linked account removed." });
}

const patchSchema = z.object({
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await sessionFrom(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account ID." }, { status: 400 });
  }

  const account = await db.userLinkedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account || account.userId !== session.userId) {
    return NextResponse.json({ error: "Linked account not found." }, { status: 404 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  if (parsed.data.isDefault) {
    await db.userLinkedAccount.updateMany({
      where: { userId: session.userId },
      data: { isDefault: false },
    });
  }

  const updated = await db.userLinkedAccount.update({
    where: { id: accountId },
    data: {
      isDefault: parsed.data.isDefault ?? account.isDefault,
    },
  });

  return NextResponse.json({ account: updated });
}
