import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function getSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ savedIds: [], count: 0 });
  }

  try {
    const saved = await db.savedProfessional.findMany({
      where: { userId: session.userId },
      select: { professionalId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const savedIds = saved.map((s) => s.professionalId);

    return NextResponse.json({
      savedIds,
      count: savedIds.length,
    });
  } catch (error) {
    console.error("api.client.saved-professionals.GET.error", error);
    return NextResponse.json({ error: "Failed to load saved professionals." }, { status: 500 });
  }
}
