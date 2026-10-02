import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platform-settings";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";

async function verifyAdmin(request: NextRequest) {
  if (!ENABLE_ADMIN_EXTRA_SECTION) return null;
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!ENABLE_ADMIN_EXTRA_SECTION) {
    return NextResponse.json({
      enabled: false,
      message: "",
      type: "INFO",
      target: "ALL",
      link: "",
      dismissible: true,
    });
  }

  try {
    const [enabledStr, message, type, target, link, dismissibleStr] = await Promise.all([
      getPlatformSetting("announcement_banner_enabled", "false"),
      getPlatformSetting("announcement_banner_message", ""),
      getPlatformSetting("announcement_banner_type", "INFO"),
      getPlatformSetting("announcement_banner_target", "ALL"),
      getPlatformSetting("announcement_banner_link", ""),
      getPlatformSetting("announcement_banner_dismissible", "true"),
    ]);

    return NextResponse.json({
      enabled: enabledStr === "true",
      message: message || "",
      type: type || "INFO",
      target: target || "ALL",
      link: link || "",
      dismissible: dismissibleStr !== "false",
    });
  } catch (error) {
    console.error("Failed to read announcement banner settings:", error);
    return NextResponse.json({
      enabled: false,
      message: "",
      type: "INFO",
      target: "ALL",
      link: "",
      dismissible: true,
    });
  }
}

const announcementSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(300),
  type: z.enum(["INFO", "WARNING", "CRITICAL", "SUCCESS"]),
  target: z.enum(["ALL", "CLIENT", "PROFESSIONAL"]),
  link: z.string().max(200).optional().default(""),
  dismissible: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid banner configuration", details: parsed.error },
      { status: 400 },
    );
  }

  try {
    await Promise.all([
      setPlatformSetting("announcement_banner_enabled", String(parsed.data.enabled)),
      setPlatformSetting("announcement_banner_message", parsed.data.message.trim()),
      setPlatformSetting("announcement_banner_type", parsed.data.type),
      setPlatformSetting("announcement_banner_target", parsed.data.target),
      setPlatformSetting("announcement_banner_link", parsed.data.link.trim()),
      setPlatformSetting("announcement_banner_dismissible", String(parsed.data.dismissible)),
    ]);

    return NextResponse.json({ success: true, banner: parsed.data });
  } catch (error) {
    console.error("Failed to update announcement banner:", error);
    return NextResponse.json({ error: "Failed to save announcement banner" }, { status: 500 });
  }
}
