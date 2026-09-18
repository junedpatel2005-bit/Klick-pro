import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function notificationKey(notification: { type: string; href: string | null }) {
  return `${notification.type}|${notification.href ?? ""}`;
}

async function main() {
  const requests = await db.projectRequest.findMany({
    select: {
      id: true,
      jobId: true,
      clientId: true,
      professionalId: true,
      origin: true,
      status: true,
      bidAmount: true,
      job: { select: { title: true } },
    },
  });
  const projects = await db.projectTracking.findMany({
    where: { requestId: { in: requests.map((request) => request.id) } },
    select: { id: true, requestId: true },
  });
  const negotiations = await db.projectNegotiation.findMany({
    where: { requestId: { in: requests.map((request) => request.id) } },
    select: {
      id: true,
      requestId: true,
      jobId: true,
      clientId: true,
      professionalId: true,
      senderRole: true,
      bidAmount: true,
      createdAt: true,
    },
  });
  const projectByRequest = new Map(projects.map((project) => [project.requestId, project.id]));
  const userIds = [
    ...new Set(requests.flatMap((request) => [request.clientId, request.professionalId])),
  ];
  const existing = await db.userNotification.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, type: true, href: true },
  });
  const existingKeys = new Set(
    existing.map((notification) => `${notification.userId}|${notificationKey(notification)}`),
  );
  const data: Array<{
    userId: number;
    type: string;
    title: string;
    description: string;
    href: string;
  }> = [];

  for (const request of requests) {
    const jobTitle = request.job.title?.trim() || `job #${request.jobId}`;
    const projectId = projectByRequest.get(request.id);
    const projectHref = projectId ? `/project/${projectId}/tracking` : `/job/${request.jobId}`;
    const requestHref = `/job/${request.jobId}?requestId=${request.id}`;
    const add = (
      userId: number,
      notification: { type: string; title: string; description: string; href: string },
    ) => {
      const key = `${userId}|${notificationKey(notification)}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      data.push({ userId, ...notification });
    };

    if (request.origin === "PROFESSIONAL_PROPOSAL") {
      add(request.clientId, {
        type: "NEW_PROPOSAL",
        title: "Proposal received",
        description: `A professional sent a proposal for ${jobTitle}.`,
        href: requestHref,
      });
      add(request.professionalId, {
        type: "PROPOSAL_SENT",
        title: "Proposal sent",
        description: `Your proposal for ${jobTitle} was sent to the client.`,
        href: requestHref,
      });
    } else {
      add(request.clientId, {
        type: "HIRE_REQUEST_SENT",
        title: "Hire request sent",
        description: `Your hire request for ${jobTitle} was sent to the professional.`,
        href: requestHref,
      });
      add(request.professionalId, {
        type: "NEW_HIRE_REQUEST",
        title: "New hire request",
        description: `A client sent you a hire request for ${jobTitle}.`,
        href: requestHref,
      });
    }

    const clientStatus =
      request.status === "ACCEPTED"
        ? {
            type: "PROJECT_AWARDED",
            title: "Project awarded",
            description: `A professional proposal for ${jobTitle} was accepted.`,
            href: projectHref,
          }
        : request.status === "REJECTED"
          ? {
              type: "REQUEST_DECLINED",
              title: "Request declined",
              description: `A request for ${jobTitle} was declined.`,
              href: `/job/${request.jobId}`,
            }
          : request.origin === "PROFESSIONAL_PROPOSAL"
            ? {
                type: "NEW_PROPOSAL",
                title: "New proposal",
                description: `A professional sent a proposal for ${jobTitle}.`,
                href: `/job/${request.jobId}`,
              }
            : null;
    const professionalStatus =
      request.status === "ACCEPTED"
        ? {
            type: "REQUEST_ACCEPTED",
            title: "Request accepted",
            description: `Your request for ${jobTitle} was accepted.`,
            href: projectHref,
          }
        : request.status === "REJECTED"
          ? {
              type: "REQUEST_DECLINED",
              title: "Request declined",
              description: `Your request for ${jobTitle} was declined.`,
              href: `/job/${request.jobId}`,
            }
          : {
              type: request.origin === "CLIENT_HIRE" ? "NEW_HIRE_REQUEST" : "PROPOSAL_SENT",
              title: request.origin === "CLIENT_HIRE" ? "New hire request" : "Proposal sent",
              description: `Your request for ${jobTitle} is awaiting a response.`,
              href: `/job/${request.jobId}`,
            };

    if (clientStatus) add(request.clientId, clientStatus);
    add(request.professionalId, professionalStatus);
  }

  for (const negotiation of negotiations) {
    const request = requests.find((item) => item.id === negotiation.requestId);
    const jobTitle = request?.job.title?.trim() || `job #${negotiation.jobId}`;
    const amount = negotiation.bidAmount
      ? ` for ₹${negotiation.bidAmount.toLocaleString("en-IN")}`
      : "";
    const href = `/job/${negotiation.jobId}?requestId=${negotiation.requestId}&negotiationId=${negotiation.id}`;
    const description = `${negotiation.senderRole === "CLIENT" ? "The client" : "The professional"} sent a counter-offer for ${jobTitle}${amount}.`;
    const notification = {
      type: "REQUEST_COUNTERED",
      title: "Negotiation update",
      description,
      href,
    };
    const addKey = (userId: number) => {
      const key = `${userId}|${notificationKey(notification)}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      data.push({ userId, ...notification });
    };
    addKey(negotiation.clientId);
    addKey(negotiation.professionalId);
  }

  if (data.length) await db.userNotification.createMany({ data });
  console.log(`Backfilled ${data.length} notification(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
