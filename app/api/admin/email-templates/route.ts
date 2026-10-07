import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getAllTemplates } from "@/lib/email-templates/engine";

async function getAdminSession(request: NextRequest) {
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
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  try {
    const templates = await getAllTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load email templates.", details: String(error) },
      { status: 500 },
    );
  }
}
