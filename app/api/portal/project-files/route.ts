import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  createProjectStorageKey,
  maxProjectFiles,
  removeProjectFile,
  storeProjectFile,
  validateProjectFile,
} from "@/lib/project-file-storage";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL")
      return NextResponse.json({ error: "Professional access required." }, { status: 403 });

    const form = await request.formData();
    const projectId = Number(form.get("projectId"));
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (
      !Number.isSafeInteger(projectId) ||
      projectId < 1 ||
      !files.length ||
      files.length > maxProjectFiles
    )
      return NextResponse.json({ error: "Choose between 1 and 10 valid files." }, { status: 400 });
    const uploadFiles = await Promise.all(
      files.map(async (file) => ({ file, bytes: new Uint8Array(await file.arrayBuffer()) })),
    );
    for (const { file, bytes } of uploadFiles) {
      const error = validateProjectFile(file, bytes);
      if (error) return NextResponse.json({ error: `${file.name}: ${error}` }, { status: 400 });
    }
    const project = await db.projectTracking.findFirst({
      where: { id: projectId, professionalId: session.userId },
      select: { id: true, status: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    // A milestone can already be active while the parent project still has its
    // initial READY_TO_START status. The upload action will transition the project
    // to IN_PROGRESS after the files are stored.
    if (!["READY_TO_START", "IN_PROGRESS", "REVISION_REQUESTED"].includes(project.status))
      return NextResponse.json(
        { error: "Files can only be uploaded while work or a revision is in progress." },
        { status: 409 },
      );

    const stored: { id?: number; storageKey: string }[] = [];
    try {
      const attachments = [];
      for (const { file, bytes } of uploadFiles) {
        const storageKey = createProjectStorageKey(project.id, file.name);
        await storeProjectFile(storageKey, bytes, file.type || "application/octet-stream");
        const storedFile: { id?: number; storageKey: string } = { storageKey };
        stored.push(storedFile);
        const record = await db.storedFile.create({
          data: {
            ownerId: session.userId,
            purpose: `project-work:${project.id}`,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            storageKey,
            isPublic: false,
          },
        });
        storedFile.id = record.id;
        attachments.push({
          id: record.id,
          name: record.fileName,
          mimeType: record.mimeType,
          sizeBytes: record.sizeBytes,
          url: `/api/v1/portal/project-files/${record.id}`,
        });
      }
      return NextResponse.json({ attachments }, { status: 201 });
    } catch (error) {
      await Promise.all(stored.map((item) => removeProjectFile(item.storageKey)));
      await db.storedFile.deleteMany({
        where: { id: { in: stored.flatMap((item) => item.id ?? []) } },
      });
      throw error;
    }
  } catch (error) {
    logServerError("project.file.upload.failed", error, {
      requestId: request.headers.get("x-request-id"),
    });
    return NextResponse.json(
      { error: "Unable to store the selected files. Please try again." },
      { status: 500 },
    );
  }
}
