import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { EMAIL_TEMPLATE_REGISTRY } from "@/lib/email-templates/registry";

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const def = EMAIL_TEMPLATE_REGISTRY[key];
  if (!def) {
    return NextResponse.json({ error: "Invalid template key." }, { status: 404 });
  }

  try {
    await db.emailTemplate.deleteMany({
      where: { key },
    });

    return NextResponse.json({
      success: true,
      message: `Template "${def.name}" reset to system default.`,
      template: {
        key: def.key,
        name: def.name,
        description: def.description,
        audience: def.audience,
        category: def.category,
        subject: def.defaultSubject,
        heading: def.defaultHeading,
        bodyText: def.defaultBodyText,
        actionText: def.defaultActionText ?? null,
        actionUrl: def.defaultActionUrl ?? null,
        isActive: true,
        isCustomized: false,
        variables: def.variables,
        sampleData: def.sampleData,
      },
    });
  } catch (error) {
    console.error("Failed to reset email template:", error);
    return NextResponse.json(
      { error: "Failed to reset template.", details: String(error) },
      { status: 500 },
    );
  }
}
