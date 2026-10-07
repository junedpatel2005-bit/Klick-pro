import { NextResponse } from "next/server";

/** Kept as a compatibility response so old clients cannot bypass wallet settlement. */
export async function POST() {
  return NextResponse.json(
    { error: "Milestone payments must be verified through the wallet flow." },
    { status: 410 },
  );
}
