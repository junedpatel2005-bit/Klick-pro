import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getSmsTemplateByKey, interpolateVariables, calculateSmsCredits } from "@/lib/sms/engine";
import { SMS_TEMPLATE_REGISTRY } from "@/lib/sms/registry";

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

const updateSmsTemplateSchema = z.object({
  bodyText: z.string().trim().min(5, "SMS body must be at least 5 characters").max(1000),
  senderId: z.string().trim().max(11).nullable().optional(),
  dltTemplateId: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const template = await getSmsTemplateByKey(key);
  if (!template) {
    return NextResponse.json({ error: "SMS template not found." }, { status: 404 });
  }

  const sampleBody = interpolateVariables(template.bodyText, template.sampleData);
  const creditStats = calculateSmsCredits(sampleBody);

  return NextResponse.json({
    template,
    preview: {
      renderedBody: sampleBody,
      ...creditStats,
    },
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const def = SMS_TEMPLATE_REGISTRY[key];
  if (!def) {
    return NextResponse.json({ error: "Invalid template key." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSmsTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { bodyText, senderId, dltTemplateId, isActive } = parsed.data;

  try {
    const updated = await db.smsTemplate.upsert({
      where: { key },
      create: {
        key,
        name: def.name,
        description: def.description,
        audience: def.audience,
        category: def.category,
        bodyText,
        senderId: senderId || def.defaultSenderId || "KLKPRO",
        dltTemplateId: dltTemplateId || def.defaultDltTemplateId || null,
        isActive,
        isCustomized: true,
        updatedBy: admin.userId,
      },
      update: {
        bodyText,
        senderId: senderId || def.defaultSenderId || "KLKPRO",
        dltTemplateId: dltTemplateId || def.defaultDltTemplateId || null,
        isActive,
        isCustomized: true,
        updatedBy: admin.userId,
      },
    });

    const sampleBody = interpolateVariables(updated.bodyText, def.sampleData);
    const creditStats = calculateSmsCredits(sampleBody);

    return NextResponse.json({
      success: true,
      template: {
        key: updated.key,
        name: updated.name,
        description: updated.description,
        audience: updated.audience,
        category: updated.category,
        bodyText: updated.bodyText,
        senderId: updated.senderId,
        dltTemplateId: updated.dltTemplateId,
        isActive: updated.isActive,
        isCustomized: updated.isCustomized,
        updatedAt: updated.updatedAt.toISOString(),
        variables: def.variables,
        sampleData: def.sampleData,
      },
      preview: {
        renderedBody: sampleBody,
        ...creditStats,
      },
    });
  } catch (error) {
    console.error("Failed to update SMS template:", error);
    return NextResponse.json(
      { error: "Failed to update SMS template.", details: String(error) },
      { status: 500 },
    );
  }
}
