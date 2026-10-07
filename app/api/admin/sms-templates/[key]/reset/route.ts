import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { SMS_TEMPLATE_REGISTRY } from "@/lib/sms/registry";
import { interpolateVariables, calculateSmsCredits } from "@/lib/sms/engine";

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
  const def = SMS_TEMPLATE_REGISTRY[key];
  if (!def) {
    return NextResponse.json({ error: "Invalid template key." }, { status: 404 });
  }

  try {
    await db.smsTemplate.deleteMany({
      where: { key },
    });

    const sampleBody = interpolateVariables(def.defaultBodyText, def.sampleData);
    const creditStats = calculateSmsCredits(sampleBody);

    return NextResponse.json({
      success: true,
      template: {
        key: def.key,
        name: def.name,
        description: def.description,
        audience: def.audience,
        category: def.category,
        bodyText: def.defaultBodyText,
        senderId: def.defaultSenderId || "KLKPRO",
        dltTemplateId: def.defaultDltTemplateId || null,
        isActive: true,
        isCustomized: false,
        variables: def.variables,
        sampleData: def.sampleData,
      },
      preview: {
        renderedBody: sampleBody,
        ...creditStats,
      },
    });
  } catch (error) {
    console.error("Failed to reset SMS template:", error);
    return NextResponse.json(
      { error: "Failed to reset template.", details: String(error) },
      { status: 500 },
    );
  }
}
