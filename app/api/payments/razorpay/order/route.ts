import { NextResponse } from "next/server";

/** Milestones are settled from the client wallet after Razorpay top-up. */
export async function POST() {
  return NextResponse.json(
    { error: "Milestones are paid from the client wallet. Fund the wallet first." },
    { status: 410 },
  );
}
