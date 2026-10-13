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

async function getProfile(request: NextRequest) {
  const session = await getClientSession(request);
  if (!session) return null;
  let profile = await db.clientProfile.findFirst({ where: { userId: session.userId } });
  if (!profile) {
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (user) {
      profile = await db.clientProfile.create({
        data: {
          userId: user.id,
          fullName: `${user.firstName} ${user.lastName}`.trim() || "Client",
          email: user.email,
          phone: user.phone || "",
          address: user.address || "",
        },
      });
    }
  }
  return { session, profile };
}

export async function GET(request: NextRequest) {
  const result = await getProfile(request);
  if (!result) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
  if (!result.profile)
    return NextResponse.json(
      { error: "Complete your client profile before adding locations." },
      { status: 409 },
    );
  const locations = await db.clientSavedLocation.findMany({
    where: { clientProfileId: result.profile.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ locations });
}

export async function POST(request: NextRequest) {
  const result = await getProfile(request);
  if (!result) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
  if (!result.profile)
    return NextResponse.json(
      { error: "Complete your client profile before adding locations." },
      { status: 409 },
    );

  const body = await request.json().catch(() => null);
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Please enter a valid label and address.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const locationCount = await db.clientSavedLocation.count({
    where: { clientProfileId: result.profile.id },
  });
  if (locationCount >= 3) {
    return NextResponse.json({ error: "You can save up to 3 locations." }, { status: 409 });
  }

  const shouldBePrimary = parsed.data.isPrimary ?? locationCount === 0;

  if (shouldBePrimary) {
    await db.clientSavedLocation.updateMany({
      where: { clientProfileId: result.profile.id },
      data: { isPrimary: false },
    });
  }

  const location = await db.clientSavedLocation.create({
    data: {
      clientProfileId: result.profile.id,
      label: parsed.data.label,
      address: parsed.data.address,
      isPrimary: shouldBePrimary,
    },
  });

  return NextResponse.json({ location }, { status: 201 });
}
