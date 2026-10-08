import { NextResponse } from "next/server";

/**
 * Direct wallet deposits without payment gateway verification are disabled.
 * All wallet funding must be completed through authenticated Razorpay checkout orders.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct wallet deposits are disabled. Fund your wallet using verified online checkout.",
    },
    { status: 410 },
  );
}
