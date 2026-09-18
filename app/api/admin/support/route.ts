import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

const input = z.object({
  question: z.string().trim().min(2).max(300),
  answer: z.string().trim().min(2).max(4000),
  displayOrder: z.coerce.number().int().min(0).default(0),
  category: z.string().trim().max(80).nullish(),
});

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Add both a question and an answer." }, { status: 400 });
  const faq = await db.faq.create({ data: parsed.data });
  return NextResponse.json({ faq }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Invalid FAQ item." }, { status: 400 });
  const parsed = input.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid FAQ update." }, { status: 400 });
  try {
    const faq = await db.faq.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ faq });
  } catch {
    return NextResponse.json({ error: "Unable to update FAQ item." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "Invalid FAQ item." }, { status: 400 });
  await db.faq.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
