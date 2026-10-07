import { NextResponse } from "next/server";
import { verificationService } from "@/services/verification.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("Persona-Signature");

    const result = await verificationService.processWebhook(rawBody, signature);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate ?? false,
      stale: result.stale ?? false,
      ignored: result.ignored ?? false,
    });
  } catch (error) {
    console.error("webhooks.persona.unhandled_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Unable to process Persona webhook." }, { status: 500 });
  }
}
