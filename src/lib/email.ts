import "server-only";
import nodemailer from "nodemailer";
import { getTemplateByKey, interpolateVariables, renderEmailHtml } from "@/lib/email-templates/engine";

let emailConfigurationWarningShown = false;

// One pooled SMTP connection for the whole process. Building a transport per
// message opened a fresh SMTP connection inside the HTTP response path.
const globalForMail = globalThis as typeof globalThis & {
  __servioMailTransporter?: nodemailer.Transporter;
};

function mailTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  globalForMail.__servioMailTransporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
  return globalForMail.__servioMailTransporter;
}

function klickProSender() {
  const configuredSender = process.env.SMTP_FROM?.trim();
  if (!configuredSender) return configuredSender;
  const address = configuredSender.match(/<([^<>]+)>/)?.[1] ?? configuredSender;
  return `Klick-Pro <${address}>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

function publicAppOrigin() {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

function absoluteAppUrl(path: string | undefined, origin: string | null) {
  if (!path || !origin) return path;
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

function renderNotificationEmailHtml(input: {
  title: string;
  description: string;
  href?: string;
  websiteUrl?: string;
  detailsHtml: string;
}) {
  const safeTitle = escapeHtml(input.title);
  const safeWebsiteUrl = escapeHtml(input.websiteUrl || "https://klick-pro.com");

  const paragraphs = input.description
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const formatted = escapeHtml(p).replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 16px; color: #334e68; font-size: 15px; line-height: 1.65;">${formatted}</p>`;
    })
    .join("");

  const actionHtml = input.href
    ? `
    <div style="margin: 32px 0 28px; text-align: center;">
      <a href="${escapeHtml(input.href)}"
         target="_blank"
         style="display: inline-block; background-color: #2454d6; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(36, 84, 214, 0.2);">
        View in Klick-Pro
      </a>
    </div>
    <p style="margin: 16px 0 0; color: #829ab1; font-size: 12px; line-height: 1.5; text-align: center;">
      If the button above does not work, copy and paste this URL into your browser:<br>
      <span style="color: #486581; word-break: break-all;">${escapeHtml(input.href)}</span>
    </p>
  `
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0b1f4d;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    ${safeTitle}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <a href="${safeWebsiteUrl}" style="text-decoration: none;">
                      <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #1748b5;">Klick<span style="color: #2454d6;">-Pro</span></span>
                    </a>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">Official Notification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 40px 32px 32px;">
              <h1 style="margin: 0 0 20px; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.35; letter-spacing: -0.3px;">
                ${safeTitle}
              </h1>

              ${paragraphs}

              ${input.detailsHtml}

              ${actionHtml}
            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; line-height: 1.5;">
                You received this transactional email from Klick-Pro regarding your account activity.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.4;">
                &copy; ${new Date().getFullYear()} Klick-Pro Technologies Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type SendAuthEmailOptions = {
  templateKey?: string;
  userName?: string;
  variables?: Record<string, string | number | undefined | null>;
  appOrigin?: string;
};

export async function sendAuthEmail(
  to: string,
  subject: string,
  heading: string,
  actionUrl: string,
  action: string,
  options?: SendAuthEmailOptions,
) {
  const transporter = mailTransporter();
  const websiteUrl = options?.appOrigin || publicAppOrigin() || undefined;

  // Determine template key (explicitly passed or auto-detected)
  let templateKey = options?.templateKey;
  if (!templateKey) {
    if (
      actionUrl.includes("reset-password") ||
      heading.toLowerCase().includes("reset") ||
      subject.toLowerCase().includes("reset")
    ) {
      templateKey = "auth_password_reset";
    } else if (
      actionUrl.includes("verify-email") ||
      heading.toLowerCase().includes("verify") ||
      subject.toLowerCase().includes("verify")
    ) {
      templateKey = "auth_email_verification";
    }
  }

  // Extract token from actionUrl if present
  let urlToken = "";
  try {
    const parsed = new URL(actionUrl, websiteUrl || "https://klick-pro.com");
    urlToken = parsed.searchParams.get("token") || "";
  } catch {}

  const userName = options?.userName || "there";

  const mergedVariables: Record<string, string | number | undefined | null> = {
    user_name: userName,
    email: to,
    user_email: to,
    reset_token: urlToken,
    verification_token: urlToken,
    token: urlToken,
    action_url: actionUrl,
    website_url: websiteUrl || "https://klick-pro.com",
    support_email: "support@klick-pro.com",
    ...options?.variables,
  };

  if (templateKey) {
    try {
      const template = await getTemplateByKey(templateKey);
      if (template && template.isActive) {
        const resolvedSubject = interpolateVariables(template.subject, mergedVariables);
        const resolvedHeading = interpolateVariables(template.heading, mergedVariables);
        const resolvedBody = interpolateVariables(template.bodyText, mergedVariables);

        let resolvedActionUrl = actionUrl;
        if (template.actionUrl) {
          const interpolated = interpolateVariables(template.actionUrl, mergedVariables);
          resolvedActionUrl = absoluteAppUrl(interpolated, websiteUrl ?? null) || actionUrl;
        }

        const actionText = template.actionText || action || "Continue";

        const html = renderEmailHtml({
          subject: resolvedSubject,
          heading: resolvedHeading,
          bodyText: resolvedBody,
          actionText,
          actionUrl: resolvedActionUrl,
          websiteUrl,
        });

        await transporter.sendMail({
          from: klickProSender(),
          to,
          subject: resolvedSubject.startsWith("Klick-Pro")
            ? resolvedSubject
            : `Klick-Pro | ${resolvedSubject}`,
          text: `${resolvedHeading}\n\n${resolvedBody}\n\n${actionText}: ${resolvedActionUrl}\n\nIf you did not request this, you can safely ignore this email.`,
          html,
        });
        return;
      }
    } catch (err) {
      console.warn(
        `Template dispatch for auth email ${templateKey} failed, falling back to standard layout`,
        err,
      );
    }
  }

  // Modern fallback if no template is found or template disabled
  const safeHeading = heading || subject;
  const fallbackBody = `Use the secure link below to proceed with your request. This security link expires in 60 minutes.\n\nIf you did not make this request, you can safely ignore this email.`;
  const fallbackHtml = renderEmailHtml({
    subject,
    heading: safeHeading,
    bodyText: fallbackBody,
    actionText: action,
    actionUrl,
    websiteUrl,
  });

  await transporter.sendMail({
    from: klickProSender(),
    to,
    subject: subject.startsWith("Klick-Pro") ? subject : `Klick-Pro | ${subject}`,
    text: `${safeHeading}\n\n${fallbackBody}\n\n${action}: ${actionUrl}`,
    html: fallbackHtml,
  });
}

export function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM,
  );
}

const NOTIFICATION_TYPE_MAP: Record<string, string> = {
  CLIENT_WELCOME: "client_welcome",
  NEW_ACCOUNT: "client_welcome",
  JOB_POSTED: "client_job_posted",
  PROPOSAL_RECEIVED: "client_proposal_received",
  MILESTONE_SUBMITTED: "client_milestone_submitted",
  DISPUTE_RAISED: "client_dispute_opened",
  DISPUTE_OPENED: "client_dispute_opened",
  DISPUTE_RESOLVED: "client_dispute_resolved",
  REFUND_PROCESSED: "client_refund_processed",
  PROF_WELCOME: "prof_welcome",
  WELCOME_PROFESSIONAL: "prof_welcome",
  WELCOME_CLIENT: "client_welcome",
  VERIFICATION_APPROVED: "prof_verification_approved",
  VERIFICATION_REJECTED: "prof_verification_rejected",
  JOB_MATCH: "prof_job_match",
  PROPOSAL_ACCEPTED: "prof_proposal_accepted",
  MILESTONE_FUNDED: "prof_milestone_funded",
  PAYOUT_RELEASED: "prof_payout_released",
  PROF_DISPUTE_OPENED: "prof_dispute_opened",
  PASSWORD_RESET: "auth_password_reset",
  EMAIL_VERIFICATION: "auth_email_verification",
};

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  description: string;
  href?: string;
  type?: string;
  details?: Array<{ label: string; value: string }>;
  templateKey?: string;
  templateVariables?: Record<string, string | number | undefined | null>;
}) {
  if (!isEmailConfigured()) {
    if (!emailConfigurationWarningShown) {
      emailConfigurationWarningShown = true;
      console.warn(
        "Email notifications are disabled. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      );
    }
    return;
  }
  const transporter = mailTransporter();
  const origin = publicAppOrigin();
  const websiteUrl = origin ?? undefined;
  const actionUrl = absoluteAppUrl(input.href, origin);

  const templateKey =
    input.templateKey || (input.type ? NOTIFICATION_TYPE_MAP[input.type] : undefined);

  // If a template key is supplied or resolved from notification type, attempt template-driven email dispatch
  if (templateKey) {
    try {
      const template = await getTemplateByKey(templateKey);
      if (template && template.isActive) {
        const mergedVariables: Record<string, string | number | undefined | null> = {
          ...input.templateVariables,
          action_url: actionUrl ?? "",
          website_url: websiteUrl ?? "",
        };

        const resolvedSubject = interpolateVariables(template.subject, mergedVariables);
        const resolvedHeading = interpolateVariables(template.heading, mergedVariables);
        const resolvedBody = interpolateVariables(template.bodyText, mergedVariables);
        const resolvedActionUrl = template.actionUrl
          ? interpolateVariables(template.actionUrl, mergedVariables)
          : actionUrl;

        const html = renderEmailHtml({
          subject: resolvedSubject,
          heading: resolvedHeading,
          bodyText: resolvedBody,
          actionText: template.actionText,
          actionUrl: resolvedActionUrl,
          websiteUrl,
        });

        await transporter.sendMail({
          from: klickProSender(),
          to: input.to,
          subject: resolvedSubject.startsWith("Klick-Pro") ? resolvedSubject : `Klick-Pro | ${resolvedSubject}`,
          text: `${resolvedHeading}\n\n${resolvedBody}${resolvedActionUrl ? `\n\n${template.actionText || "View in Klick-Pro"}: ${resolvedActionUrl}` : ""}`,
          html,
        });
        return;
      }
    } catch (err) {
      console.warn(`Template dispatch for ${input.templateKey} failed, falling back to standard notification layout`, err);
    }
  }

  const details = input.details?.filter((detail) => detail.value.trim()) ?? [];
  const detailsHtml = details.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;border:1px solid #e2e8f0;border-collapse:separate;border-spacing:0;overflow:hidden">${details
        .map(
          (detail) =>
            `<tr><td style="width:34%;padding:13px 16px;border-bottom:1px solid #eef2f7;background:#f8fafc;vertical-align:top;font-size:12px;font-weight:700;color:#627d98">${escapeHtml(detail.label)}</td><td style="padding:13px 16px;border-bottom:1px solid #eef2f7;vertical-align:top;font-size:15px;color:#102a43;line-height:1.5;white-space:pre-line">${escapeHtml(detail.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const textDetails = details.length
    ? `\n\n${details.map((detail) => `${detail.label}: ${detail.value}`).join("\n")}`
    : "";
  const textDescription = `\n\n${input.description}`;
  const actionText = actionUrl ? `\n\nView in Klick-Pro: ${actionUrl}` : "";
  await transporter.sendMail({
    from: klickProSender(),
    to: input.to,
    subject: `Klick-Pro | ${input.title}`,
    text: `${input.title}${textDescription}${textDetails}${actionText}`,
    html: renderNotificationEmailHtml({
      title: input.title,
      description: input.description,
      href: actionUrl,
      websiteUrl,
      detailsHtml,
    }),
  });
}

export async function sendCustomEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!isEmailConfigured()) {
    return { success: false, reason: "SMTP not configured" };
  }
  const transporter = mailTransporter();
  await transporter.sendMail({
    from: klickProSender(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text || input.subject,
  });
  return { success: true };
}

