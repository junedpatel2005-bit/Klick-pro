import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(250),
  subject: z.string().trim().min(2).max(180),
  message: z.string().trim().min(10).max(4000),
});
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Please complete all fields." }, { status: 400 });
  await db.contactRequest.create({ data: parsed.data });
  return NextResponse.json({ ok: true });
}
