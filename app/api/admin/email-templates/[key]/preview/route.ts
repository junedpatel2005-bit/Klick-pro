import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";
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

export async function POST(
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

  const payload = await request.json().catch(() => ({}));
  const subject = typeof payload.subject === "string" ? payload.subject : def.defaultSubject;
  const heading = typeof payload.heading === "string" ? payload.heading : def.defaultHeading;
  const bodyText = typeof payload.bodyText === "string" ? payload.bodyText : def.defaultBodyText;
  const actionText =
    typeof payload.actionText === "string" ? payload.actionText : def.defaultActionText;
  const actionUrl =
    typeof payload.actionUrl === "string" ? payload.actionUrl : def.defaultActionUrl;
  const customVariables = payload.variables && typeof payload.variables === "object" ? payload.variables : {};

  // Merge sample variables with any custom preview values
  const mergedData = { ...def.sampleData, ...customVariables };

  const renderedSubject = interpolateVariables(subject, mergedData);
  const renderedHeading = interpolateVariables(heading, mergedData);
  const renderedBody = interpolateVariables(bodyText, mergedData);
  const renderedActionUrl = actionUrl ? interpolateVariables(actionUrl, mergedData) : null;

  const html = renderEmailHtml({
    subject: renderedSubject,
    heading: renderedHeading,
    bodyText: renderedBody,
    actionText: actionText || null,
    actionUrl: renderedActionUrl,
  });

  return NextResponse.json({
    renderedSubject,
    renderedHeading,
    renderedHtml: html,
  });
}

