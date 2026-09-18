import { NextResponse } from "next/server";
import { razorpayConfig } from "@/lib/razorpay";

export function GET() {
  const config = razorpayConfig();
  return NextResponse.json({
    enabled: config.enabled && Boolean(config.keyId),
    keyId: config.keyId || null,
    currency: "INR",
  });
}
