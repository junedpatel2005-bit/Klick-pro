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
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val);
    }
    // Clean fallbacks so raw {{tokens}} are never sent to recipient inboxes
    if (key === "client_name") return String(variables["user_name"] || "Client");
    if (key === "professional_name" || key === "prof_name") return String(variables["user_name"] || "Professional");
    if (key === "user_name") return "there";
    if (key === "project_title" || key === "job_title") return String(variables["title"] || "your project");
    if (key === "milestone_title") return "the project milestone";
    if (
      key === "milestone_amount" ||
      key === "amount" ||
      key === "budget" ||
      key === "bid_amount" ||
      key === "accepted_amount" ||
      key === "payout_amount"
    ) {
      return String(variables["milestone_amount"] || variables["amount"] || "the agreed amount");
    }
    if (key === "delivery_time" || key === "timeline") return "as agreed";
    if (key === "action_url") return String(variables["website_url"] || "https://klick-pro.com");
    if (key === "website_url") return "https://klick-pro.com";
    if (key === "support_email") return "support@klick-pro.com";
    return "";
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
  details?: Array<{ label: string; value: string }>;
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

  // Clean Info Box (details table)
  const details = input.details?.filter((d) => d && d.value && String(d.value).trim()) ?? [];
  const detailsBox = details.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 28px; width: 100%; border: 1px solid #e2e8f0; border-collapse: separate; border-spacing: 0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        ${details
          .map(
            (detail, idx) =>
              `<tr>
                <td class="info-label" style="width: 36%; padding: 12px 16px; border-bottom: ${idx === details.length - 1 ? "none" : "1px solid #f1f5f9"}; background: #f8fafc; vertical-align: top; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px;">
                  ${escapeHtml(detail.label)}
                </td>
                <td style="padding: 12px 16px; border-bottom: ${idx === details.length - 1 ? "none" : "1px solid #f1f5f9"}; vertical-align: top; font-size: 14px; color: #0f172a; line-height: 1.5; font-weight: 500; white-space: pre-line;">
                  ${escapeHtml(String(detail.value))}
                </td>
              </tr>`,
          )
          .join("")}
      </table>`
    : "";

  // Ensure actionUrl is absolute for Gmail
  const rawActionUrl = input.actionUrl?.trim() || null;
  const safeActionUrl = rawActionUrl
    ? rawActionUrl.startsWith("http://") || rawActionUrl.startsWith("https://")
      ? rawActionUrl
      : `${safeWebsiteUrl.replace(/\/$/, "")}/${rawActionUrl.replace(/^\//, "")}`
    : null;

  const actionButton =
    input.actionText && safeActionUrl
      ? `
    <div style="margin: 32px 0 28px; text-align: center;">
      <a href="${escapeHtml(safeActionUrl)}"
         target="_blank"
         style="display: inline-block; background-color: #2454d6; color: #ffffff; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(36, 84, 214, 0.2);">
        ${escapeHtml(input.actionText)}
      </a>
    </div>
    <p style="margin: 16px 0 0; color: #829ab1; font-size: 12px; line-height: 1.5; text-align: center;">
      If the button above does not work, copy and paste this URL into your browser:<br>
      <span style="color: #486581; word-break: break-all;">${escapeHtml(safeActionUrl)}</span>
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
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        margin: auto !important;
      }
      .email-padding {
        padding: 24px 16px !important;
      }
      .info-label {
        width: 40% !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0b1f4d;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
    ${safeHeading}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; width: 100% !important; table-layout: fixed; margin: 0; padding: 0;">
    <tr>
      <td align="center" valign="top" style="padding: 32px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width: 600px;">
        <tr><td align="center" valign="top">
        <![endif]-->
        <div style="max-width: 600px; width: 100%; margin: 0 auto; text-align: left;" class="email-container">
          <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; border-collapse: separate; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
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
              <td style="padding: 36px 32px 32px;" class="email-padding">
                <h1 style="margin: 0 0 20px; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.35; letter-spacing: -0.3px;">
                  ${safeHeading}
                </h1>

                ${paragraphs}

                ${detailsBox}

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
        </div>
        <!--[if (gte mso 9)|(IE)]>
        </td></tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

