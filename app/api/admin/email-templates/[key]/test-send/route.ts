import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { sendCustomEmail, isEmailConfigured } from "@/lib/email";
import { interpolateVariables, renderEmailHtml } from "@/lib/email-templates/render";
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

const testSendSchema = z.object({
  recipientEmail: z.string().email("Valid email address is required"),
  subject: z.string().min(1),
  heading: z.string().min(1),
  bodyText: z.string().min(1),
  actionText: z.string().nullable().optional(),
  actionUrl: z.string().nullable().optional(),
});

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

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "SMTP is not configured on this server. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = testSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { recipientEmail, subject, heading, bodyText, actionText, actionUrl } = parsed.data;

  // Hydrate with sample data
  const renderedSubject = `[TEST PREVIEW] ${interpolateVariables(subject, def.sampleData)}`;
  const renderedHeading = interpolateVariables(heading, def.sampleData);
  const renderedBody = interpolateVariables(bodyText, def.sampleData);
  const renderedActionUrl = actionUrl ? interpolateVariables(actionUrl, def.sampleData) : null;

  const appOrigin = process.env.APP_URL?.trim() || "https://klick-pro.com";

  // Build sample info box from template variables
  const sampleDetails = def.variables
    .filter((v) => !["client_name", "user_name", "support_email"].includes(v.key))
    .map((v) => ({
      label: v.label,
      value: String(def.sampleData[v.key] || v.sample),
    }))
    .filter((d) => d.value.trim());

  const html = renderEmailHtml({
    subject: renderedSubject,
    heading: renderedHeading,
    bodyText: renderedBody,
    actionText: actionText || null,
    actionUrl: renderedActionUrl,
    websiteUrl: appOrigin,
    details: sampleDetails,
  });

  try {
    const result = await sendCustomEmail({
      to: recipientEmail,
      subject: renderedSubject,
      html,
      text: renderedBody,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.reason || "Failed to dispatch test email." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${recipientEmail}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed sending test email", details: String(err) },
      { status: 500 },
    );
  }
}
