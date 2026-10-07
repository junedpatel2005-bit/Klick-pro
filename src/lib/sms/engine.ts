import { db } from "@/lib/db";
import { SMS_TEMPLATE_REGISTRY } from "./registry";
import { HydratedSmsTemplate, SmsSendOptions, SmsSendResult } from "./types";
import { sendRawSms } from "./sender";
import { interpolateVariables, calculateSmsCredits } from "./format";

export { interpolateVariables, calculateSmsCredits };

/**
 * Retrieves all SMS templates with DB overrides merged on top of the code registry defaults.
 */
export async function getAllSmsTemplates(): Promise<HydratedSmsTemplate[]> {
  try {
    const overrides = await db.smsTemplate.findMany();
    const overrideMap = new Map(overrides.map((row) => [row.key, row]));

    return Object.values(SMS_TEMPLATE_REGISTRY).map((def) => {
      const dbRow = overrideMap.get(def.key);
      if (dbRow) {
        return {
          key: def.key,
          name: dbRow.name || def.name,
          description: dbRow.description || def.description,
          audience: def.audience,
          category: def.category,
          bodyText: dbRow.bodyText,
          senderId: dbRow.senderId || def.defaultSenderId || "KLKPRO",
          dltTemplateId: dbRow.dltTemplateId || def.defaultDltTemplateId || null,
          isActive: dbRow.isActive,
          isCustomized: dbRow.isCustomized,
          updatedAt: dbRow.updatedAt.toISOString(),
          variables: def.variables,
          sampleData: def.sampleData,
        };
      }

      return {
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
      };
    });
  } catch (error) {
    console.error(
      "Failed to load SMS templates from database, falling back to code defaults:",
      error,
    );
    return Object.values(SMS_TEMPLATE_REGISTRY).map((def) => ({
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
    }));
  }
}

/**
 * Retrieves a single hydrated SMS template by key.
 */
export async function getSmsTemplateByKey(key: string): Promise<HydratedSmsTemplate | null> {
  const def = SMS_TEMPLATE_REGISTRY[key];
  if (!def) return null;

  try {
    const dbRow = await db.smsTemplate.findUnique({
      where: { key },
    });

    if (dbRow) {
      return {
        key: def.key,
        name: dbRow.name || def.name,
        description: dbRow.description || def.description,
        audience: def.audience,
        category: def.category,
        bodyText: dbRow.bodyText,
        senderId: dbRow.senderId || def.defaultSenderId || "KLKPRO",
        dltTemplateId: dbRow.dltTemplateId || def.defaultDltTemplateId || null,
        isActive: dbRow.isActive,
        isCustomized: dbRow.isCustomized,
        updatedAt: dbRow.updatedAt.toISOString(),
        variables: def.variables,
        sampleData: def.sampleData,
      };
    }
  } catch (err) {
    console.warn(`Failed reading DB SMS template for ${key}, using code default`, err);
  }

  return {
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
  };
}

/**
 * High-level function to dispatch an SMS using either a registered template or raw text.
 */
export async function sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
  let messageBody = options.body || "";
  let senderId = options.senderId || "KLKPRO";
  let dltTemplateId = options.dltTemplateId;

  if (options.templateKey) {
    const tpl = await getSmsTemplateByKey(options.templateKey);
    if (!tpl) {
      console.warn(`[SMS Engine] Unknown template key "${options.templateKey}"`);
      if (!options.body) {
        return { ok: false, error: `Unknown template key "${options.templateKey}"` };
      }
    } else if (!tpl.isActive) {
      console.log(`[SMS Engine] Template "${options.templateKey}" is disabled. Skipping dispatch.`);
      return { ok: true, provider: "noop" };
    } else {
      const vars = {
        ...(tpl.sampleData || {}),
        ...(options.variables || {}),
      };
      messageBody = interpolateVariables(tpl.bodyText, vars);
      senderId = tpl.senderId || senderId;
      dltTemplateId = tpl.dltTemplateId || dltTemplateId;
    }
  } else if (options.variables) {
    messageBody = interpolateVariables(messageBody, options.variables);
  }

  return sendRawSms({
    to: options.to,
    body: messageBody,
    senderId,
    dltTemplateId,
  });
}

/**
 * Resolves an SMS template key from event notification type and audience.
 */
export function resolveSmsTemplate(
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
      return "dispute_urgent_alert";
    }
    if (type.includes("PAYOUT") || type.includes("PAYMENT")) {
      return "prof_payout_released";
    }
    return isProf ? "prof_proposal_accepted" : "client_milestone_submitted";
  }

  switch (type) {
    case "WELCOME_CLIENT":
    case "CLIENT_WELCOME":
    case "NEW_ACCOUNT":
      return "auth_welcome";
    case "JOB_MATCH":
    case "NEW_JOB_POSTED":
      return "prof_job_match";
    case "PROPOSAL_RECEIVED":
    case "PROPOSAL_UPDATED":
    case "REQUEST_COUNTERED":
      return "client_proposal_received";
    case "PROPOSAL_ACCEPTED":
    case "REQUEST_ACCEPTED":
      return isProf ? "prof_proposal_accepted" : undefined;
    case "MILESTONE_SUBMITTED":
      return "client_milestone_submitted";
    case "MILESTONE_FUNDED":
    case "WALLET_MILESTONE_FUNDED":
      return isProf ? "prof_milestone_funded" : "client_escrow_funded";
    case "PAYOUT_RELEASED":
    case "MILESTONE_PAYOUT_APPROVED":
      return "prof_payout_released";
    case "REVISION_REQUESTED":
    case "MILESTONE_REVISION_REQUESTED":
      return "prof_revision_requested";
    case "DISPUTE_RAISED":
    case "DISPUTE_OPENED":
      return "dispute_urgent_alert";
    case "DISPUTE_UPDATED":
    case "DISPUTE_RESOLVED":
    case "DISPUTE_DECIDED":
      return "dispute_resolved";
    default:
      return undefined;
  }
}
