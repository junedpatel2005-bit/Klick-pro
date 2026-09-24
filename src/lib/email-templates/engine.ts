import { db } from "@/lib/db";
import { EMAIL_TEMPLATE_REGISTRY } from "./registry";
import { HydratedEmailTemplate } from "./types";
import {
  escapeHtml,
  interpolateVariables,
  renderEmailHtml,
} from "./render";

export { escapeHtml, interpolateVariables, renderEmailHtml };

/**
 * Retrieves all templates with DB overrides merged on top of the code registry defaults.
 */
export async function getAllTemplates(): Promise<HydratedEmailTemplate[]> {
  try {
    const overrides = await db.emailTemplate.findMany();
    const overrideMap = new Map(overrides.map((row) => [row.key, row]));

    return Object.values(EMAIL_TEMPLATE_REGISTRY).map((def) => {
      const dbRow = overrideMap.get(def.key);
      if (dbRow) {
        return {
          key: def.key,
          name: dbRow.name || def.name,
          description: dbRow.description || def.description,
          audience: def.audience,
          category: def.category,
          subject: dbRow.subject,
          heading: dbRow.heading,
          bodyText: dbRow.bodyText,
          actionText: dbRow.actionText,
          actionUrl: dbRow.actionUrl,
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
        subject: def.defaultSubject,
        heading: def.defaultHeading,
        bodyText: def.defaultBodyText,
        actionText: def.defaultActionText ?? null,
        actionUrl: def.defaultActionUrl ?? null,
        isActive: true,
        isCustomized: false,
        variables: def.variables,
        sampleData: def.sampleData,
      };
    });
  } catch (error) {
    console.error("Failed to load email templates from database, falling back to code defaults:", error);
    return Object.values(EMAIL_TEMPLATE_REGISTRY).map((def) => ({
      key: def.key,
      name: def.name,
      description: def.description,
      audience: def.audience,
      category: def.category,
      subject: def.defaultSubject,
      heading: def.defaultHeading,
      bodyText: def.defaultBodyText,
      actionText: def.defaultActionText ?? null,
      actionUrl: def.defaultActionUrl ?? null,
      isActive: true,
      isCustomized: false,
      variables: def.variables,
      sampleData: def.sampleData,
    }));
  }
}

/**
 * Retrieves a single hydrated template by key.
 */
export async function getTemplateByKey(key: string): Promise<HydratedEmailTemplate | null> {
  const def = EMAIL_TEMPLATE_REGISTRY[key];
  if (!def) return null;

  try {
    const dbRow = await db.emailTemplate.findUnique({
      where: { key },
    });

    if (dbRow) {
      return {
        key: def.key,
        name: dbRow.name || def.name,
        description: dbRow.description || def.description,
        audience: def.audience,
        category: def.category,
        subject: dbRow.subject,
        heading: dbRow.heading,
        bodyText: dbRow.bodyText,
        actionText: dbRow.actionText,
        actionUrl: dbRow.actionUrl,
        isActive: dbRow.isActive,
        isCustomized: dbRow.isCustomized,
        updatedAt: dbRow.updatedAt.toISOString(),
        variables: def.variables,
        sampleData: def.sampleData,
      };
    }
  } catch (err) {
    console.warn(`Failed reading DB template for ${key}, using code default`, err);
  }

  return {
    key: def.key,
    name: def.name,
    description: def.description,
    audience: def.audience,
    category: def.category,
    subject: def.defaultSubject,
    heading: def.defaultHeading,
    bodyText: def.defaultBodyText,
    actionText: def.defaultActionText ?? null,
    actionUrl: def.defaultActionUrl ?? null,
    isActive: true,
    isCustomized: false,
    variables: def.variables,
    sampleData: def.sampleData,
  };
}

