import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

const profileSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().min(2).max(100).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).nullable(),
  hourlyRate: z.coerce.number().int().min(0).max(1_000_000).nullable(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(500).nullable().optional(),
  state: z.string().trim().min(2).max(100),
  district: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  workMode: z.enum(["on_site", "remote", "both"]),
  bio: z.string().trim().max(2_000).optional().or(z.literal("")),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
});

async function professionalIdFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "PROFESSIONAL" ? session.userId : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await professionalIdFrom(request);
    if (!userId)
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
    const profile = await db.user.findUnique({
      where: { id: userId },
      select: {
        professionalCategory: true,
        professionalCategoryId: true,
        experienceYears: true,
        hourlyRate: true,
        serviceRadiusKm: true,
        professionalState: true,
        professionalDistrict: true,
        professionalCity: true,
        address: true,
        professionalLatitude: true,
        professionalLongitude: true,
        workMode: true,
        companyDescription: true,
        professionalSkillsJson: true,
        phone: true,
        phoneVerifiedAt: true,
      },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Failed to load professional profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load profile." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await professionalIdFrom(request);
    if (!userId)
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Complete the required professional details." },
        { status: 400 },
      );
    const validCategory = parsed.data.categoryId
      ? await db.serviceCategory.findUnique({
          where: { id: parsed.data.categoryId },
          select: { id: true, name: true },
        })
      : parsed.data.category
        ? await db.serviceCategory.findFirst({
            where: { name: parsed.data.category },
            select: { id: true, name: true },
          })
        : null;
    if (!validCategory)
      return NextResponse.json({ error: "Choose a valid service category." }, { status: 400 });

    const cityOrDistrict = (parsed.data.city?.trim() ||
      parsed.data.district?.trim() ||
      "") as string;
    const profile = await db.user.update({
      where: { id: userId },
      data: {
        professionalCategory: validCategory.name,
        professionalCategoryId: validCategory.id,
        experienceYears: parsed.data.experienceYears,
        hourlyRate: parsed.data.hourlyRate,
        serviceRadiusKm: parsed.data.serviceRadiusKm,
        professionalState: parsed.data.state,
        professionalDistrict: parsed.data.district || cityOrDistrict || null,
        professionalCity: cityOrDistrict || null,
        address: parsed.data.address?.trim() || null,
        serviceArea: null,
        professionalLatitude: parsed.data.latitude,
        professionalLongitude: parsed.data.longitude,
        workMode: parsed.data.workMode,
        companyDescription: parsed.data.bio || null,
        professionalSkillsJson: JSON.stringify(parsed.data.skills),
      },
    });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Failed to save professional profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save profile." },
      { status: 500 },
    );
  }
}
