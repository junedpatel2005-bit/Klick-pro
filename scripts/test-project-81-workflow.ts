import "dotenv/config";
import { SignJWT } from "jose";

const base = "http://localhost:3000";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
const token = (userId: number, role: "CLIENT" | "PROFESSIONAL") =>
  new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

async function request(
  userId: number,
  role: "CLIENT" | "PROFESSIONAL",
  action: string,
  input: Record<string, unknown> = {},
) {
  const response = await fetch(`${base}/api/v1/portal/project-actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `servio_session=${await token(userId, role)}`,
    },
    body: JSON.stringify({ action, projectId: 81, ...input }),
  });
  const body = await response.json().catch(() => null);
  return { action, status: response.status, body };
}
async function project(userId: number, role: "CLIENT" | "PROFESSIONAL") {
  const response = await fetch(`${base}/api/v1/portal/project?id=81`, {
    headers: { Cookie: `servio_session=${await token(userId, role)}` },
  });
  return { status: response.status, body: await response.json() };
}

const professional = 76;
const client = 43;
const outcomes: unknown[] = [];
outcomes.push(await request(professional, "PROFESSIONAL", "start-work"));
outcomes.push(await request(professional, "PROFESSIONAL", "start-work"));
outcomes.push(await project(professional, "PROFESSIONAL"));
outcomes.push(
  await request(professional, "PROFESSIONAL", "update-progress", {
    progress: 30,
    stage: "UI Design",
    note: "Homepage wireframes are complete.",
  }),
);
outcomes.push(
  await request(professional, "PROFESSIONAL", "upload-work", {
    title: "Homepage wireframes",
    note: "Desktop and mobile wireframes completed.",
    fileNames: ["homepage-wireframes.pdf"],
  }),
);
for (let index = 1; index <= 3; index += 1)
  outcomes.push(
    await request(client, "CLIENT", "create-milestone", {
      title: `Test milestone ${index}`,
      amount: index === 3 ? 34 : 33,
      description: `Test scope ${index}`,
      deadline: "2026-11-11T00:00:00.000Z",
    }),
  );
let current = await project(client, "CLIENT");
const first = current.body.milestones.find(
  (item: { status: string }) => item.status === "IN_PROGRESS",
);
outcomes.push(
  await request(professional, "PROFESSIONAL", "submit-milestone", {
    milestoneId: first.id,
    note: "Initial milestone delivery.",
    fileNames: ["milestone-one.pdf"],
  }),
);
outcomes.push(
  await request(professional, "PROFESSIONAL", "submit-milestone", {
    milestoneId: first.id,
    note: "Duplicate delivery.",
    fileNames: ["duplicate.pdf"],
  }),
);
outcomes.push(
  await request(client, "CLIENT", "request-revision", {
    milestoneId: first.id,
    note: "Please improve the mobile layout.",
  }),
);
outcomes.push(
  await request(client, "CLIENT", "request-revision", {
    milestoneId: first.id,
    note: "Duplicate revision.",
  }),
);
outcomes.push(
  await request(professional, "PROFESSIONAL", "submit-milestone", {
    milestoneId: first.id,
    note: "Mobile layout revised.",
    fileNames: ["milestone-one-revised.pdf"],
  }),
);
outcomes.push(await request(client, "CLIENT", "approve-milestone", { milestoneId: first.id }));
current = await project(client, "CLIENT");
for (const milestone of current.body.milestones.filter(
  (item: { status: string }) => item.status === "IN_PROGRESS",
)) {
  outcomes.push(
    await request(professional, "PROFESSIONAL", "submit-milestone", {
      milestoneId: milestone.id,
      note: `${milestone.title} delivery.`,
      fileNames: [`${milestone.id}.pdf`],
    }),
  );
  outcomes.push(
    await request(client, "CLIENT", "approve-milestone", { milestoneId: milestone.id }),
  );
  current = await project(client, "CLIENT");
}
outcomes.push(
  await request(professional, "PROFESSIONAL", "submit-final-work", {
    note: "All agreed work is complete.",
    fileNames: ["final-delivery.zip"],
  }),
);
outcomes.push(await request(client, "CLIENT", "complete-project"));
outcomes.push(await request(client, "CLIENT", "complete-project"));
outcomes.push(await project(client, "CLIENT"));
outcomes.push(await project(professional, "PROFESSIONAL"));
console.log(JSON.stringify(outcomes, null, 2));
