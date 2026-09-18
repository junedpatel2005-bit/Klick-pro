import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { respondToProjectRequest } from "@/lib/project-request-actions";
import { logServerError } from "@/lib/server-logger";

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "counter"]),
  bidAmount: z.coerce.number().int().positive().optional(),
  duration: z.string().trim().min(1).max(100).optional(),
  message: z.string().trim().max(5000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
    const session = await verifySession(token);
    if (session.role !== "CLIENT")
      return NextResponse.json({ error: "Client access required." }, { status: 403 });

    const requestId = Number((await params).id);
    const input = bodySchema.safeParse(await request.json().catch(() => null));
    if (!Number.isSafeInteger(requestId) || requestId <= 0 || !input.success)
      return NextResponse.json(
        { error: "Please provide a valid request action." },
        { status: 400 },
      );
    if (
      input.data.action === "counter" &&
      (!input.data.bidAmount || !input.data.duration || !input.data.message)
    )
      return NextResponse.json(
        { error: "Provide a price, timeline, and message for your counter-offer." },
        { status: 400 },
      );

    const result = await respondToProjectRequest(
      requestId,
      { userId: session.userId, role: "CLIENT" },
      input.data.action,
      input.data.action === "counter"
        ? {
            bidAmount: input.data.bidAmount!,
            duration: input.data.duration!,
            message: input.data.message!,
          }
        : undefined,
    );
    if ("error" in result)
      return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    logServerError("client.project-request.action.failed", error, {
      requestId: request.headers.get("x-request-id"),
    });
    return NextResponse.json({ error: "Unable to update this request." }, { status: 500 });
  }
}
