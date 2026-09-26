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

function parseProfessionalId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ professionalId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required to save professionals." }, { status: 401 });
  }

  const { professionalId: rawId } = await params;
  const professionalId = parseProfessionalId(rawId);
  if (!professionalId) {
    return NextResponse.json({ error: "Invalid professional ID." }, { status: 400 });
  }

  // Ensure target professional exists and is a professional
  const pro = await db.user.findFirst({
    where: { id: professionalId, role: "PROFESSIONAL", isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!pro) {
    return NextResponse.json({ error: "Professional not found." }, { status: 404 });
  }

  try {
    await db.savedProfessional.upsert({
      where: {
        userId_professionalId: {
          userId: session.userId,
          professionalId,
        },
      },
      create: {
        userId: session.userId,
        professionalId,
      },
      update: {},
    });

    return NextResponse.json({ saved: true, professionalId });
  } catch (error) {
    console.error("api.client.saved-professionals.POST.error", error);
    return NextResponse.json({ error: "Failed to save professional." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ professionalId: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const { professionalId: rawId } = await params;
  const professionalId = parseProfessionalId(rawId);
  if (!professionalId) {
    return NextResponse.json({ error: "Invalid professional ID." }, { status: 400 });
  }

  try {
    await db.savedProfessional.deleteMany({
      where: {
        userId: session.userId,
        professionalId,
      },
    });

    return NextResponse.json({ saved: false, professionalId });
  } catch (error) {
    console.error("api.client.saved-professionals.DELETE.error", error);
    return NextResponse.json({ error: "Failed to remove saved professional." }, { status: 500 });
  }
}
