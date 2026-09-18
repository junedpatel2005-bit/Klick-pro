import "server-only";
import nodemailer from "nodemailer";

let emailConfigurationWarningShown = false;

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
  const safeDescription = escapeHtml(input.description);
  const actionHtml = input.href
    ? `<p style="margin:28px 0 0;text-align:center"><a href="${escapeHtml(input.href)}" style="display:inline-block;background:#2454d6;color:#ffffff;font-size:16px;font-weight:600;padding:15px 24px;border-radius:8px;text-decoration:none">View in Klick-Pro</a></p><p style="margin:24px 0 0;color:#829ab1;font-size:13px;line-height:1.6;text-align:center">If the button does not work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#486581">${escapeHtml(input.href)}</span></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0b1f4d">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${safeTitle}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc">
      <tr><td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
          <tr><td style="padding:28px 32px;border-bottom:1px solid #eef2f7"><a href="${escapeHtml(input.websiteUrl ?? "#")}" style="font-size:24px;font-weight:700;letter-spacing:-.4px;color:#1748b5;text-decoration:none">Klick-Pro</a></td></tr>
          <tr><td style="padding:48px 32px;text-align:left">
            <h1 style="margin:0;color:#0b1f4d;font-size:30px;line-height:1.2">${safeTitle}</h1>
            <p style="margin:20px 0 0;color:#334e68;font-size:16px;line-height:1.6;white-space:pre-line">${safeDescription}</p>
            ${input.detailsHtml}
            ${actionHtml}
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #eef2f7;text-align:center;color:#829ab1;font-size:12px;line-height:1.5">You are receiving this email from Klick-Pro.<br>&copy; 2026 Klick-Pro, Inc.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendAuthEmail(
  to: string,
  subject: string,
  heading: string,
  actionUrl: string,
  action: string,
) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const websiteUrl = publicAppOrigin();
  const safeHeading = escapeHtml(heading);
  const safeAction = escapeHtml(action);
  const safeActionUrl = escapeHtml(actionUrl);
  const textActionUrl = actionUrl;
  await transporter.sendMail({
    from: klickProSender(),
    to,
    subject: `Klick-Pro | ${subject}`,
    text: `${heading}\n\nUse the secure link below. It expires in 24 hours.\n\n${action}: ${textActionUrl}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0b1f4d">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Confirm your Klick-Pro account email.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc">
      <tr><td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
          <tr><td style="padding:28px 32px;border-bottom:1px solid #eef2f7">
            <a href="${escapeHtml(websiteUrl ?? "#")}" style="font-size:24px;font-weight:700;letter-spacing:-.4px;color:#1748b5;text-decoration:none">Klick-Pro</a>
          </td></tr>
          <tr><td style="padding:56px 32px 48px;text-align:center">
            <h1 style="margin:0;color:#0b1f4d;font-size:32px;line-height:1.2">${safeHeading}</h1>
            <p style="margin:24px 0 8px;color:#334e68;font-size:16px;line-height:1.6">Use the secure link below. It expires in 24 hours.</p>
            <p style="margin:0 0 28px;color:#627d98;font-size:14px;line-height:1.5">Click the button to activate your Klick-Pro account.</p>
            <a href="${safeActionUrl}" style="display:inline-block;background:#2454d6;color:#ffffff;font-size:16px;font-weight:600;padding:15px 24px;border-radius:8px;text-decoration:none">${safeAction}</a>
            <p style="margin:32px 0 0;color:#829ab1;font-size:13px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#486581">${safeActionUrl}</span></p>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #eef2f7;text-align:center;color:#829ab1;font-size:12px;line-height:1.5">If you did not create this account, you can safely ignore this email.<br>© 2026 Klick-Pro, Inc.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
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

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  description: string;
  href?: string;
  details?: Array<{ label: string; value: string }>;
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
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const origin = publicAppOrigin();
  const websiteUrl = origin ?? undefined;
  const actionUrl = absoluteAppUrl(input.href, origin);
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
