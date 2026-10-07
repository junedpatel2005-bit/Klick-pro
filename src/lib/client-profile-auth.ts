import "server-only";
import type { NextRequest } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function getClientSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "CLIENT" ? session : null;
  } catch {
    return null;
  }
}
