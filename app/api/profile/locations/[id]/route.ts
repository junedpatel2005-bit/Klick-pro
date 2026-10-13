import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getClientSession } from "@/lib/client-profile-auth";

const locationSchema = z.object({
  label: z
    .string({ required_error: "Location label is required." })
    .trim()
    .min(1, "Location label cannot be empty.")
    .max(120, "Location label must be 120 characters or fewer."),
  address: z
    .string({ required_error: "Address is required." })
    .trim()
    .min(1, "Address cannot be empty.")
    .max(1000, "Address must be 1000 characters or fewer."),
  isPrimary: z.boolean().optional(),
});

async function getOwnedLocation(request: NextRequest, id: string) {
  const session = await getClientSession(request);
  const locationId = Number(id);
  if (!session || !Number.isInteger(locationId) || locationId < 1) return null;
  return db.clientSavedLocation.findFirst({
    where: { id: locationId, clientProfile: { userId: session.userId } },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const location = await getOwnedLocation(request, (await params).id);
  if (!location) return NextResponse.json({ error: "Saved location not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Please enter a valid label and address.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const updated = await db.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.clientSavedLocation.updateMany({
        where: { clientProfileId: location.clientProfileId },
        data: { isPrimary: false },
      });
      await tx.clientProfile.update({
        where: { id: location.clientProfileId },
        data: { address: parsed.data.address },
      });
    }
    return tx.clientSavedLocation.update({
      where: { id: location.id },
      data: {
        label: parsed.data.label,
        address: parsed.data.address,
        isPrimary: parsed.data.isPrimary ?? location.isPrimary,
      },
    });
  });
  return NextResponse.json({ location: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const location = await getOwnedLocation(request, (await params).id);
  if (!location) return NextResponse.json({ error: "Saved location not found." }, { status: 404 });
  await db.$transaction(async (tx) => {
    await tx.clientSavedLocation.delete({ where: { id: location.id } });
    if (location.isPrimary) {
      const replacement = await tx.clientSavedLocation.findFirst({
        where: { clientProfileId: location.clientProfileId },
        orderBy: { createdAt: "asc" },
      });
      if (replacement) {
        await tx.clientSavedLocation.update({
          where: { id: replacement.id },
          data: { isPrimary: true },
        });
      }
    }
  });
  return NextResponse.json({ success: true });
}
