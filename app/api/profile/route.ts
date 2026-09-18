import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  address: z.string().trim().min(1, "Address is required.").max(300),
  profilePhotoUrl: z
    .string()
    .url("Enter a valid photo URL.")
    .max(2048)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().min(7).max(25).optional().or(z.literal("")),
});

async function getSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

async function getClient(request: NextRequest) {
  const session = await getSession(request);
  if (!session)
    return { error: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) };
  if (session.role !== "CLIENT")
    return {
      error: NextResponse.json(
        { error: "This profile is only available to clients." },
        { status: 403 },
      ),
    };
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user?.isActive)
    return { error: NextResponse.json({ error: "Account is unavailable." }, { status: 401 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const result = await getClient(request);
  if ("error" in result) return result.error;
  const { user } = result;
  const profile = await db.clientProfile.findFirst({
    where: { userId: user.id },
    include: { savedLocations: true },
  });
  return NextResponse.json({
    account: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt,
      avatarUrl: user.avatarUrl,
      address: user.address,
    },
    profile,
  });
}

export async function POST(request: NextRequest) {
  const result = await getClient(request);
  if ("error" in result) return result.error;
  const { user } = result;
  if (!user.emailVerifiedAt)
    return NextResponse.json(
      { error: "Please verify your email before completing your profile." },
      { status: 403 },
    );
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please review your profile details." },
      { status: 400 },
    );
  const data = parsed.data;
  if (data.phone && data.phone !== user.phone) {
    const duplicate = await db.user.findFirst({
      where: { phone: data.phone, id: { not: user.id } },
    });
    if (duplicate)
      return NextResponse.json(
        { error: "This phone number is already registered." },
        { status: 409 },
      );
  }
  const companyName = data.companyName || null;
  const profilePhotoUrl = data.profilePhotoUrl || null;
  const fullName = `${data.firstName} ${data.lastName}`;
  const profileData = {
    fullName,
    phone: data.phone || user.phone || "",
    companyName,
    address: data.address,
    profilePhotoUrl,
  };
  const existing = await db.clientProfile.findFirst({ where: { userId: user.id } });
  const primaryLocation = await db.$transaction(async (tx) => {
    const profile = existing
      ? await tx.clientProfile.update({ where: { id: existing.id }, data: profileData })
      : await tx.clientProfile.create({
          data: { userId: user.id, email: user.email, ...profileData },
        });
    await tx.user.update({
      where: { id: user.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        companyName,
        address: data.address,
        avatarUrl: profilePhotoUrl,
        phone: data.phone || null,
      },
    });
    const sameAddress = await tx.clientSavedLocation.findFirst({
      where: { clientProfileId: profile.id, address: data.address },
    });
    if (sameAddress) {
      await tx.clientSavedLocation.updateMany({
        where: { clientProfileId: profile.id },
        data: { isPrimary: false },
      });
      return tx.clientSavedLocation.update({
        where: { id: sameAddress.id },
        data: { isPrimary: true },
      });
    }
    const existingPrimary = await tx.clientSavedLocation.findFirst({
      where: { clientProfileId: profile.id, label: "Primary Address" },
    });
    await tx.clientSavedLocation.updateMany({
      where: { clientProfileId: profile.id },
      data: { isPrimary: false },
    });
    return existingPrimary
      ? tx.clientSavedLocation.update({
          where: { id: existingPrimary.id },
          data: { address: data.address, isPrimary: true },
        })
      : tx.clientSavedLocation.create({
          data: {
            clientProfileId: profile.id,
            label: "Primary Address",
            address: data.address,
            isPrimary: true,
          },
        });
  });
  return NextResponse.json({ success: true, primaryLocation });
}
