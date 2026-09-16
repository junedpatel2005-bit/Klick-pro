import "dotenv/config";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
const auth = (userId: number, role: "CLIENT" | "PROFESSIONAL") =>
  new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
async function call(
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
  action?: string,
  values: Record<string, unknown> = {},
) {
  const response = await fetch(
    action
      ? "http://localhost:3000/api/v1/portal/project-actions"
      : "http://localhost:3000/api/v1/portal/project?id=81",
    {
      method: action ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: `servio_session=${await auth(userId, role)}`,
      },
      ...(action ? { body: JSON.stringify({ action, projectId: 81, ...values }) } : {}),
    },
  );
  return { status: response.status, body: await response.json() };
}

const result: unknown[] = [];
const view = await call(43, "CLIENT");
if (view.status !== 200) throw new Error(JSON.stringify(view));
const active = view.body.milestones.find(
  (item: { status: string }) => item.status === "IN_PROGRESS",
);
result.push(
  await call(76, "PROFESSIONAL", "submit-milestone", {
    milestoneId: active.id,
    note: "Final milestone delivery.",
    fileNames: ["final-milestone.pdf"],
  }),
);
result.push(await call(43, "CLIENT", "approve-milestone", { milestoneId: active.id }));
result.push(
  await call(76, "PROFESSIONAL", "submit-final-work", {
    note: "All agreed work is complete.",
    fileNames: ["final-delivery.zip"],
  }),
);
result.push(await call(43, "CLIENT", "complete-project"));
result.push(await call(43, "CLIENT", "complete-project"));
result.push(await call(43, "CLIENT"));
result.push(await call(76, "PROFESSIONAL"));
console.log(JSON.stringify(result, null, 2));
