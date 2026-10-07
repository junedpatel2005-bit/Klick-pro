import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getPlatformSettings, setPlatformSetting } from "@/lib/platform-settings";

async function verifyAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const settings = await getPlatformSettings();
  return NextResponse.json({ settings });
}

const updateSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }

  try {
    for (const [key, value] of Object.entries(parsed.data.settings)) {
      await setPlatformSetting(key, String(value).trim());
    }

    const updated = await getPlatformSettings();
    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    console.error("admin.settings.update.failed", error);
    return NextResponse.json({ error: "Failed to update platform settings." }, { status: 500 });
  }
}
