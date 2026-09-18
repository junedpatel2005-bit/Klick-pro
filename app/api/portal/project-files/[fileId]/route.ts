import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { isProjectFileNotFound, readProjectFile } from "@/lib/project-file-storage";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const session = await verifySession(token);
    const fileId = Number((await params).fileId);
    if (!Number.isSafeInteger(fileId) || fileId < 1)
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    const file = await db.storedFile.findUnique({ where: { id: fileId } });
    if (!file || !file.purpose.startsWith("project-work:"))
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    const projectId = Number(file.purpose.slice("project-work:".length));
    const project = await db.projectTracking.findFirst({
      where: {
        id: projectId,
        OR: [{ clientId: session.userId }, { professionalId: session.userId }],
      },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const bytes = await readProjectFile(file.storageKey);
    const safeName = file.fileName.replace(/[\\\r\n"]/g, "_");
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new NextResponse(body.buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isProjectFileNotFound(error))
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    logServerError("project.file.read.failed", error, {
      requestId: request.headers.get("x-request-id"),
    });
    return NextResponse.json(
      { error: "Unable to access this file right now. Please try again." },
      { status: 500 },
    );
  }
}
