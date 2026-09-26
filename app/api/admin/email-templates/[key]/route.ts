import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getTemplateByKey } from "@/lib/email-templates/engine";
import {
  interpolateVariables,
  renderEmailHtml,
} from "@/lib/email-templates/render";
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

const updateTemplateSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(255),
  heading: z.string().trim().min(3, "Heading must be at least 3 characters").max(255),
  bodyText: z.string().trim().min(10, "Body text must be at least 10 characters"),
  actionText: z.string().trim().max(80).nullable().optional(),
  actionUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const template = await getTemplateByKey(key);
  if (!template) {
    return NextResponse.json({ error: "Email template not found." }, { status: 404 });
  }

  // Generate preview with sample data
  const sampleSubject = interpolateVariables(template.subject, template.sampleData);
  const sampleHeading = interpolateVariables(template.heading, template.sampleData);
  const sampleBody = interpolateVariables(template.bodyText, template.sampleData);
  const sampleActionUrl = template.actionUrl
    ? interpolateVariables(template.actionUrl, template.sampleData)
    : null;

  const sampleDetails = template.variables
    .filter((v) => !["client_name", "user_name", "support_email"].includes(v.key))
    .map((v) => ({
      label: v.label,
      value: String(template.sampleData[v.key] || v.sample),
    }))
    .filter((d) => d.value.trim());

  const html = renderEmailHtml({
    subject: sampleSubject,
    heading: sampleHeading,
    bodyText: sampleBody,
    actionText: template.actionText,
    actionUrl: sampleActionUrl,
    details: sampleDetails,
  });

  return NextResponse.json({
    template,
    preview: {
      renderedSubject: sampleSubject,
      renderedHeading: sampleHeading,
      renderedHtml: html,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const def = EMAIL_TEMPLATE_REGISTRY[key];
  if (!def) {
    return NextResponse.json({ error: "Invalid template key." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { subject, heading, bodyText, actionText, actionUrl, isActive } = parsed.data;

  try {
    const updated = await db.emailTemplate.upsert({
      where: { key },
      create: {
        key,
        name: def.name,
        description: def.description,
        audience: def.audience,
        category: def.category,
        subject,
        heading,
        bodyText,
        actionText: actionText || null,
        actionUrl: actionUrl || null,
        isActive: isActive ?? true,
        isCustomized: true,
        updatedBy: admin.userId,
      },
      update: {
        subject,
        heading,
        bodyText,
        actionText: actionText || null,
        actionUrl: actionUrl || null,
        isActive: isActive ?? true,
        isCustomized: true,
        updatedBy: admin.userId,
      },
    });

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
        variables: def.variables,
        sampleData: def.sampleData,
      },
    });
  } catch (error) {
    console.error("Failed saving email template override:", error);
    return NextResponse.json(
      { error: "Failed to save template override.", details: String(error) },
      { status: 500 },
    );
  }
}

