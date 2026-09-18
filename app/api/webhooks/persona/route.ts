import { NextResponse } from "next/server";
import { handlePersonaWebhook } from "@/lib/persona";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handlePersonaWebhook(rawBody, request.headers.get("Persona-Signature"));
    if (!result.ok)
      return NextResponse.json({ error: "Invalid Persona webhook." }, { status: result.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("webhooks.persona.failed", error);
    return NextResponse.json({ error: "Unable to process Persona webhook." }, { status: 500 });
  }
}
