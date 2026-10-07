import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { sessionCookie, verifySession } from "@/lib/auth";
import { readProjectFile } from "@/lib/project-file-storage";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storageKey: string[] }> },
) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const session = await verifySession(token);
    const { storageKey: segments } = await context.params;
    const storageKey = segments.join("/");
    if (!storageKey.startsWith("verification/")) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    const ownDocumentPrefix = `verification/${session.userId}/`;
    if (
      session.role !== "ADMIN" &&
      (session.role !== "PROFESSIONAL" || !storageKey.startsWith(ownDocumentPrefix))
    ) {
      return NextResponse.json({ error: "You cannot access this document." }, { status: 403 });
    }

    const bytes = await readProjectFile(storageKey);
    const fileName = path.basename(storageKey);
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    void recordAudit({
      action: "verification.document.viewed",
      actorId: session.userId,
      entityId: storageKey,
      entityType: "VerificationDocument",
      requestId: request.headers.get("x-request-id"),
    });
    return new NextResponse(body.buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Type":
          contentTypes[path.extname(fileName).toLowerCase()] ?? "application/octet-stream",
      },
    });
  } catch (error) {
    logServerError("professional.verification.document.read.failed", error, {
      requestId: request.headers.get("x-request-id"),
    });
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
}
