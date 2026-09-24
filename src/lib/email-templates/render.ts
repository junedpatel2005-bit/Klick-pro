/**
 * Pure isomorphic rendering helpers for email templates.
 * Zero database or server-only dependencies: safe to import in client components
 * for zero-latency live preview and on the server for SMTP dispatch.
 */

/**
 * Escapes characters that are unsafe inside HTML content.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

/**
 * Safely replaces {{key}} placeholders in template text with data dictionary values.
 */
export function interpolateVariables(
  text: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const val = variables[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
    return match; // Keep unmatched token in preview
  });
}

/**
 * Generates enterprise-ready, cross-client HTML email markup.
 */
export function renderEmailHtml(input: {
  subject?: string;
  heading: string;
  bodyText: string;
  actionText?: string | null;
  actionUrl?: string | null;
  websiteUrl?: string;
}): string {
  const safeHeading = escapeHtml(input.heading);
  const safeWebsiteUrl = escapeHtml(input.websiteUrl || "https://klick-pro.com");

  // Format paragraphs from plain text with newlines
  const paragraphs = input.bodyText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // Escape HTML and preserve single line breaks
      const formatted = escapeHtml(p).replace(/\n/g, "<br>");
      return `<p style="margin: 0 0 16px; color: #334e68; font-size: 15px; line-height: 1.65;">${formatted}</p>`;
    })
    .join("");

  const actionButton =
    input.actionText && input.actionUrl
      ? `
    <div style="margin: 32px 0 28px; text-align: center;">
      <a href="${escapeHtml(input.actionUrl)}"
         target="_blank"
         style="display: inline-block; background-color: #2454d6; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(36, 84, 214, 0.2);">
        ${escapeHtml(input.actionText)}
      </a>
    </div>
    <p style="margin: 16px 0 0; color: #829ab1; font-size: 12px; line-height: 1.5; text-align: center;">
      If the button above does not work, copy and paste this URL into your browser:<br>
      <span style="color: #486581; word-break: break-all;">${escapeHtml(input.actionUrl)}</span>
    </p>
  `
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(input.subject || input.heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0b1f4d;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    ${safeHeading}
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
                ${safeHeading}
              </h1>

              ${paragraphs}

              ${actionButton}
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

