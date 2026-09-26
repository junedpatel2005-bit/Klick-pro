import { NextResponse } from "next/server";
import { verificationService } from "@/services/verification.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("X-AuthBridge-Signature") ?? request.headers.get("AuthBridge-Signature");

    const result = await verificationService.processWebhook(rawBody, signature, "authbridge");
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
    console.error("webhooks.authbridge.unhandled_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Unable to process AuthBridge webhook." }, { status: 500 });
  }
}

