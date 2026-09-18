import "server-only";
import { db } from "@/lib/db";
import { logServerError } from "@/lib/server-logger";

type AuditMetadata = Record<string, boolean | number | string | null | undefined>;

type AuditEntry = {
  action: string;
  actorId?: number;
  entityId: number | string;
  entityType: string;
  metadata?: AuditMetadata;
  requestId?: string | null;
};

/**
 * Audit writes never block a successful marketplace action. Metadata must be non-sensitive:
 * do not include passwords, session tokens, payment details, documents, or exact coordinates.
 */
export async function recordAudit(entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        entityId: String(entry.entityId),
        entityType: entry.entityType,
        metadata: entry.metadata,
        requestId: entry.requestId ?? undefined,
      },
    });
  } catch (error) {
    logServerError("audit.write.failed", error, {
      action: entry.action,
      entityId: String(entry.entityId),
      entityType: entry.entityType,
      requestId: entry.requestId,
    });
  }
}
