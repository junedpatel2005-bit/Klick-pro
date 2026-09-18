import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  isProjectFileNotFound,
  readProjectFile,
  storeProjectFile,
} from "@/lib/project-file-storage";

const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const maxAvatarSize = 5 * 1024 * 1024;

async function getSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || (session.role !== "CLIENT" && session.role !== "PROFESSIONAL")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  const extension = allowedTypes.get(file.type);
  if (!extension)
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  if (file.size <= 0 || file.size > maxAvatarSize)
    return NextResponse.json(
      { error: "Profile images must be smaller than 5 MB." },
      { status: 400 },
    );

  const storageKey = `avatars/${session.userId}/${randomUUID()}${extension}`;
  await storeProjectFile(storageKey, new Uint8Array(await file.arrayBuffer()), file.type);
  const avatarUrl = `/api/profile/avatar?key=${encodeURIComponent(storageKey)}`;
  await db.user.update({ where: { id: session.userId }, data: { avatarUrl } });
  if (session.role === "CLIENT") {
    await db.clientProfile.updateMany({
      where: { userId: session.userId },
      data: { profilePhotoUrl: avatarUrl },
    });
  }
  return NextResponse.json({ avatarUrl });
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true },
  });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !key.startsWith(`avatars/${session.userId}/`))
    return new NextResponse(null, { status: 404 });
  try {
    const bytes = await readProjectFile(key);
    const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
    const contentType =
      extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(bytes as BodyInit, {
      headers: { "content-type": contentType, "cache-control": "private, max-age=3600" },
    });
  } catch (error) {
    if (isProjectFileNotFound(error)) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, { status: 500 });
  }
}
