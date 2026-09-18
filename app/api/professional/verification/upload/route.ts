import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit-log";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  createVerificationStorageKey,
  storeProjectFile,
  validateProjectFile,
} from "@/lib/project-file-storage";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token)
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });

    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "Professional access required." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "Choose a document first." }, { status: 400 });
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Document must be between 1 byte and 10 MB." },
        { status: 400 },
      );
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: "Upload a JPG, PNG, WEBP, or PDF document." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validationError = validateProjectFile(file, bytes);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const storageKey = createVerificationStorageKey(session.userId, file.name);
    await storeProjectFile(storageKey, bytes, file.type || "application/octet-stream");
    void recordAudit({
      action: "verification.document.uploaded",
      actorId: session.userId,
      entityId: storageKey,
      entityType: "VerificationDocument",
      metadata: { sizeBytes: file.size },
      requestId: request.headers.get("x-request-id"),
    });

    return NextResponse.json({
      url: `/api/v1/professional/verification/documents/${storageKey}`,
      name: file.name,
    });
  } catch (error) {
    logServerError("professional.verification.upload.failed", error, {
      requestId: request.headers.get("x-request-id"),
    });
    return NextResponse.json({ error: "Unable to upload document." }, { status: 500 });
  }
}
