import { db } from "../src/lib/db";

async function main() {
  const disputes = await db.projectDispute.findMany({
    select: {
      id: true,
      trackingId: true,
      status: true,
      decision: true,
      payoutAmount: true,
      milestoneId: true,
      clientId: true,
      professionalId: true,
    },
    orderBy: { id: "desc" },
    take: 5,
  });
  console.log("DISPUTES:", JSON.stringify(disputes, null, 2));

  for (const d of disputes) {
    const milestones = await db.projectMilestone.findMany({
      where: { trackingId: d.trackingId },
      include: { payment: true },
    });
    console.log(`Tracking ${d.trackingId} milestones:`, JSON.stringify(milestones, null, 2));

    const transactions = await db.projectTransaction.findMany({
      where: { trackingId: d.trackingId },
    });
    console.log(
      `Tracking ${d.trackingId} projectTransactions:`,
      JSON.stringify(transactions, null, 2),
    );
  }
}

main().finally(() => db.$disconnect());
