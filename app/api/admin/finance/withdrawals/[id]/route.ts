import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  status: z.enum(["COMPLETED", "FAILED"]),
  failureReason: z.string().trim().max(300).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid withdrawal id." }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
  const withdrawal = await db.projectWithdrawal.findUnique({ where: { id } });
  if (!withdrawal || withdrawal.status !== "PENDING")
    return NextResponse.json(
      { error: "Only pending withdrawal requests can be updated." },
      { status: 409 },
    );
  try {
    const updated = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.professionalId } });
      if (!wallet) throw new Error("Professional wallet not found.");
      if (parsed.data.status === "COMPLETED") {
        const settled = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            balance: { gte: withdrawal.amount },
            pendingBalance: { gte: withdrawal.amount },
          },
          data: {
            balance: { decrement: withdrawal.amount },
            pendingBalance: { decrement: withdrawal.amount },
          },
        });
        if (settled.count !== 1)
          throw new Error("Professional wallet reservation is no longer available.");
      } else {
        await tx.wallet.updateMany({
          where: { id: wallet.id, pendingBalance: { gte: withdrawal.amount } },
          data: { pendingBalance: { decrement: withdrawal.amount } },
        });
      }
      return tx.projectWithdrawal.update({
        where: { id },
        data: {
          status: parsed.data.status,
          processedAt: new Date(),
          failureReason:
            parsed.data.status === "FAILED"
              ? (parsed.data.failureReason ?? "Rejected by admin.")
              : null,
        },
      });
    });
    return NextResponse.json({ withdrawal: updated });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Professional wallet reservation is no longer available."
    )
      return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
