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

export function resolveNotificationTemplate(
  type?: string,
  audience?: "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM",
): string | undefined {
  if (!type) return undefined;
  const isProf = audience === "PROFESSIONAL";

  if (type.startsWith("PROJECT_ACTIVITY_")) {
    if (type.includes("MILESTONE") || type.includes("DELIVERABLE") || type.includes("WORK")) {
      return "client_milestone_submitted";
    }
    if (type.includes("DISPUTE")) {
      return isProf ? "prof_dispute_opened" : "client_dispute_opened";
    }
    if (type.includes("PAYOUT") || type.includes("PAYMENT")) {
      return "prof_payout_released";
    }
    return isProf ? "prof_proposal_accepted" : "client_milestone_submitted";
  }

  switch (type) {
    case "WELCOME_CLIENT":
    case "CLIENT_WELCOME":
      return "client_welcome";
    case "WELCOME_PROFESSIONAL":
    case "PROF_WELCOME":
      return "prof_welcome";
    case "NEW_ACCOUNT":
      return isProf ? "prof_welcome" : "client_welcome";
    case "JOB_POSTED":
      return "client_job_posted";
    case "JOB_MATCH":
      return "prof_job_match";
    case "PROPOSAL_RECEIVED":
    case "PROPOSAL_UPDATED":
    case "REQUEST_COUNTERED":
      return "client_proposal_received";
    case "PROPOSAL_ACCEPTED":
    case "REQUEST_ACCEPTED":
      return isProf ? "prof_proposal_accepted" : "client_welcome";
    case "REQUEST_DECLINED":
      return "client_job_posted";
    case "MILESTONE_SUBMITTED":
    case "PROJECT_COMPLETED":
    case "PROJECT_REOPENED":
    case "PROJECT_REOPEN_REQUESTED":
    case "PROJECT_REQUEST":
      return isProf ? "prof_proposal_accepted" : "client_milestone_submitted";
    case "MILESTONE_FUNDED":
    case "WALLET_MILESTONE_FUNDED":
      return "prof_milestone_funded";
    case "PAYOUT_RELEASED":
    case "MILESTONE_PAYOUT_APPROVED":
      return "prof_payout_released";
    case "DISPUTE_RAISED":
    case "DISPUTE_OPENED":
      return isProf ? "prof_dispute_opened" : "client_dispute_opened";
    case "DISPUTE_UPDATED":
    case "DISPUTE_RESOLVED":
      return "client_dispute_resolved";
    case "DISPUTE_MESSAGE":
      return isProf ? "prof_dispute_opened" : "client_dispute_opened";
    case "REFUND_PROCESSED":
      return "client_refund_processed";
    case "VERIFICATION_APPROVED":
      return "prof_verification_approved";
    case "VERIFICATION_REJECTED":
      return "prof_verification_rejected";
    case "PASSWORD_RESET":
      return "auth_password_reset";
    case "EMAIL_VERIFICATION":
      return "auth_email_verification";
    default:
      return NOTIFICATION_TYPE_MAP[type];
  }
}

export async function sendNotificationEmail(input: {
  to: string;
  title: string;
  description: string;
  href?: string;
  type?: string;
  details?: Array<{ label: string; value: string }>;
  templateKey?: string;
  templateVariables?: Record<string, string | number | undefined | null>;
  audience?: "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";
  recipientName?: string;
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
    input.templateKey || resolveNotificationTemplate(input.type, input.audience);

  // If a template key is supplied or resolved from notification type, attempt template-driven email dispatch
  if (templateKey) {
    try {
      const template = await getTemplateByKey(templateKey);
      if (template && template.isActive) {
        // Auto-extract semantic variables from input.details
        const detailVariables: Record<string, string> = {};
        if (input.details) {
          for (const d of input.details) {
            if (!d.label || !d.value) continue;
            const key = d.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
            detailVariables[key] = d.value;
            if (key === "project" || key === "project_name") {
              detailVariables["project_title"] = d.value;
              detailVariables["job_title"] = d.value;
            }
            if (key === "project_amount" || key === "proposed_amount" || key === "bid_amount") {
              detailVariables["bid_amount"] = d.value;
              detailVariables["amount"] = d.value;
              detailVariables["agreed_amount"] = d.value;
              detailVariables["budget"] = d.value;
              detailVariables["accepted_amount"] = d.value;
            }
            if (key === "milestone") {
              detailVariables["milestone_title"] = d.value;
            }
            if (key === "milestone_amount") {
              detailVariables["milestone_amount"] = d.value;
              detailVariables["amount"] = d.value;
            }
            if (key === "project_timeline" || key === "delivery_time" || key === "timeline") {
              detailVariables["delivery_time"] = d.value;
              detailVariables["timeline"] = d.value;
            }
            if (key === "payout_credited") {
              detailVariables["payout_amount"] = d.value;
              detailVariables["amount"] = d.value;
            }
            if (key === "platform_commission") {
              detailVariables["platform_fee"] = d.value;
            }
          }
        }

        // Auto-extract project_id, job_id, dispute_id from href
        if (input.href) {
          const projectMatch = input.href.match(/\/project\/(\d+)/);
          if (projectMatch?.[1]) detailVariables["project_id"] = projectMatch[1];
          const jobMatch = input.href.match(/\/jobs?\/(\d+)/);
          if (jobMatch?.[1]) detailVariables["job_id"] = jobMatch[1];
          const disputeMatch = input.href.match(/dispute=(\d+)/);
          if (disputeMatch?.[1]) detailVariables["dispute_id"] = disputeMatch[1];
        }

        const recipientFallback = input.recipientName || "there";

        const mergedVariables: Record<string, string | number | undefined | null> = {
          client_name: input.recipientName || "Client",
          professional_name: input.recipientName || "Professional",
          prof_name: input.recipientName || "Professional",
          user_name: recipientFallback,
          project_title: detailVariables.project_title || input.title || "Project",
          job_title: detailVariables.job_title || input.title || "Job",
          milestone_title: detailVariables.milestone_title || "Project Milestone",
          milestone_amount: detailVariables.milestone_amount || detailVariables.amount || "Agreed Amount",
          amount: detailVariables.amount || "Agreed Amount",
          action_url: actionUrl ?? "",
          website_url: websiteUrl ?? "",
          title: input.title,
          description: input.description,
          ...detailVariables,
          ...input.templateVariables,
        };

        const resolvedSubject = interpolateVariables(template.subject, mergedVariables);
        const resolvedHeading = interpolateVariables(template.heading, mergedVariables);
        const resolvedBody = interpolateVariables(template.bodyText, mergedVariables);
        const resolvedActionUrl = template.actionUrl
          ? interpolateVariables(template.actionUrl, mergedVariables)
          : actionUrl;

        // Auto-generate Info Box details if not passed explicitly
        let effectiveDetails =
          input.details?.filter((d) => d && d.value && String(d.value).trim()) ?? [];

        if (effectiveDetails.length === 0 && template.variables?.length) {
          const nonInfoKeys = new Set([
            "client_name",
            "professional_name",
            "prof_name",
            "user_name",
            "support_email",
            "verification_token",
            "reset_token",
            "token",
            "action_url",
            "website_url",
            "title",
            "description",
          ]);
          effectiveDetails = template.variables
            .filter((v) => !nonInfoKeys.has(v.key))
            .map((v) => {
              const rawVal = mergedVariables[v.key];
              const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
              return {
                label: v.label,
                value: valStr,
              };
            })
            .filter((d) => d.value.length > 0 && !d.value.startsWith("{{"));
        }

        const html = renderEmailHtml({
          subject: resolvedSubject,
          heading: resolvedHeading,
          bodyText: resolvedBody,
          actionText: template.actionText,
          actionUrl: resolvedActionUrl,
          websiteUrl,
          details: effectiveDetails,
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

  // Consistent modern fallback: renders with the exact same 600px responsive box & brand layout
  const fallbackDetails = input.details?.filter((detail) => detail.value.trim()) ?? [];
  const textDetails = fallbackDetails.length
    ? `\n\n${fallbackDetails.map((detail) => `${detail.label}: ${detail.value}`).join("\n")}`
    : "";
  const textDescription = `\n\n${input.description}`;
  const actionText = actionUrl ? `\n\nView in Klick-Pro: ${actionUrl}` : "";
  await transporter.sendMail({
    from: klickProSender(),
    to: input.to,
    subject: input.title.startsWith("Klick-Pro") ? input.title : `Klick-Pro | ${input.title}`,
    text: `${input.title}${textDescription}${textDetails}${actionText}`,
    html: renderEmailHtml({
      subject: input.title,
      heading: input.title,
      bodyText: input.description,
      actionText: actionUrl ? "View in Klick-Pro" : null,
      actionUrl,
      websiteUrl,
      details: fallbackDetails,
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

