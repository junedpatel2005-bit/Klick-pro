import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureWallet } from "@/lib/wallet-ledger";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (session.role !== "ADMIN")
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { resource } = await params;
  if (resource === "overview") {
    const [
      clients,
      professionals,
      pendingVerifications,
      jobs,
      disputes,
      payments,
      newUsers,
      newJobs,
      newDisputes,
    ] = await Promise.all([
      db.user.count({ where: { role: "CLIENT" } }),
      db.user.count({ where: { role: "PROFESSIONAL" } }),
      db.professionalVerification.count({ where: { status: "PENDING" } }),
      db.clientJob.count(),
      db.projectDispute.count({
        where: { status: { in: ["OPEN", "WAITING_RESPONSE", "UNDER_ADMIN_REVIEW"] } },
      }),
      db.projectTransaction.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
      db.user.findMany({
        where: { role: { in: ["CLIENT", "PROFESSIONAL"] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.clientJob.findMany({
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.projectDispute.findMany({
        select: { id: true, issueType: true, priority: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
    return NextResponse.json({
      clients,
      professionals,
      pendingVerifications,
      jobs,
      disputes,
      payments: payments._sum.amount ?? 0,
      newUsers,
      newJobs,
      newDisputes,
    });
  }
  if (resource === "users")
    return NextResponse.json({
      users: await db.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          isVerified: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    });
  if (resource === "jobs") {
    const now = new Date();
    const [jobs, disputes, totalJobs, scheduledJobs, openJobs] = await Promise.all([
      db.clientJob.findMany({
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.projectDispute.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.clientJob.count(),
      db.clientJob.count({ where: { status: "OPEN", jobDate: { gt: now } } }),
      db.clientJob.count({
        where: { status: "OPEN", OR: [{ jobDate: null }, { jobDate: { lte: now } }] },
      }),
    ]);
    const projects = await db.projectTracking.findMany({
      where: { jobId: { in: jobs.map((job) => job.id) } },
      select: { jobId: true, status: true, completedAt: true },
    });
    const projectByJobId = new Map(projects.map((project) => [project.jobId, project]));
    const jobsWithProjectStatus = jobs.map((job) => {
      const project = projectByJobId.get(job.id);
      const isCompleted =
        project?.completedAt || project?.status.toUpperCase().includes("COMPLETED");
      return { ...job, status: isCompleted ? "COMPLETED" : project ? "RUNNING" : job.status };
    });
    return NextResponse.json({
      jobs: jobsWithProjectStatus,
      disputes,
      stats: { totalJobs, openJobs, scheduledJobs },
    });
  }
  if (resource === "finance") {
    const [transactions, withdrawals, payments, walletTransactions, adminUsers] = await Promise.all(
      [
        db.projectTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
        db.projectWithdrawal.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
        db.payment.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                companyName: true,
              },
            },
            professional: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
            job: {
              select: {
                id: true,
                title: true,
                category: true,
                budgetMin: true,
                budgetMax: true,
                status: true,
              },
            },
            milestone: {
              select: {
                id: true,
                title: true,
                amount: true,
                status: true,
                dueDate: true,
                submittedAt: true,
                approvedAt: true,
              },
            },
            projectTracking: {
              select: {
                id: true,
                status: true,
                progress: true,
                currentStage: true,
                job: {
                  select: {
                    id: true,
                    title: true,
                    category: true,
                    budgetMin: true,
                    budgetMax: true,
                    status: true,
                  },
                },
                milestones: {
                  select: {
                    id: true,
                    title: true,
                    amount: true,
                    status: true,
                    dueDate: true,
                    submittedAt: true,
                    approvedAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        }),
        db.walletTransaction.findMany({
          where: { type: "WALLET_TOP_UP" },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { wallet: { select: { userId: true } } },
        }),
        db.user.findMany({
          where: { role: "ADMIN" },
          orderBy: { id: "asc" },
          select: { id: true, firstName: true, lastName: true },
        }),
      ],
    );
    // Milestone settlements credit whichever ADMIN row `findFirst` happens to resolve first
    // (src/lib/wallet-ledger.ts has no deterministic tie-breaker), so with multiple admin
    // accounts the platform's fee wallet isn't necessarily any single one of them — aggregate
    // across every admin wallet rather than guessing which one is "the" platform account.
    const adminWallets = await Promise.all(adminUsers.map((admin) => ensureWallet(admin.id)));
    const adminNameByUserId = Object.fromEntries(
      adminUsers.map((admin) => [admin.id, `${admin.firstName} ${admin.lastName}`.trim()]),
    );
    const platformWallet =
      adminWallets.length > 0
        ? {
            balance: adminWallets.reduce((sum, wallet) => sum + wallet.balance, 0),
            currency: adminWallets[0]!.currency,
            ownerName:
              adminWallets.length === 1
                ? (adminNameByUserId[adminWallets[0]!.userId] ?? null)
                : `${adminWallets.length} admin wallets combined`,
          }
        : null;
    const platformWalletTransactionsRaw =
      adminWallets.length > 0
        ? await db.walletTransaction.findMany({
            where: { walletId: { in: adminWallets.map((wallet) => wallet.id) } },
            orderBy: { createdAt: "desc" },
            take: 200,
            include: { wallet: { select: { userId: true } } },
          })
        : [];
    const platformWalletTransactions = platformWalletTransactionsRaw.map((item) => ({
      id: item.id,
      type: item.type,
      amount: item.amount,
      status: item.status,
      description:
        adminWallets.length > 1
          ? `${item.description} (${adminNameByUserId[item.wallet.userId] ?? `#${item.wallet.userId}`})`
          : item.description,
      createdAt: item.createdAt,
    }));
    const platformTotalReceived = platformWalletTransactionsRaw
      .filter((item) => item.type === "ADMIN_MILESTONE_RECEIPT" && item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);
    const platformTotalPaid = platformWalletTransactionsRaw
      .filter((item) => item.type === "PROFESSIONAL_PAYOUT" && item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const ids = [
      ...new Set([
        ...transactions.flatMap((item) => [item.clientId, item.professionalId]),
        ...withdrawals.map((item) => item.professionalId),
        ...payments.flatMap((item) => [item.clientId, item.professionalId]),
        ...walletTransactions.map((item) => item.wallet.userId),
      ]),
    ];
    const [users, legacyProfiles] = await Promise.all([
      db.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          companyName: true,
        },
      }),
      db.legacyUserProfile.findMany({
        where: { userId: { in: ids.map(String) } },
        select: { userId: true, fullName: true },
      }),
    ]);
    const names = Object.fromEntries(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    for (const profile of legacyProfiles)
      if (profile.fullName && !names[profile.userId]) names[profile.userId] = profile.fullName;

    const usersById = Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
          role: u.role,
          companyName: u.companyName,
        },
      ]),
    );

    const enrichedPayments = payments.map((p) => {
      const job = p.job ?? p.projectTracking?.job ?? null;
      const tracking = p.projectTracking;
      const allMilestones = tracking?.milestones ?? (p.milestone ? [p.milestone] : []);

      const milestoneIndex = p.milestoneId
        ? allMilestones.findIndex((m) => m.id === p.milestoneId)
        : -1;
      const milestoneNumber = milestoneIndex >= 0 ? milestoneIndex + 1 : null;
      const totalMilestonesCount = allMilestones.length;

      const projectTotalMilestonesAmount = allMilestones.reduce((sum, m) => sum + m.amount, 0);
      const projectTotalBudget =
        projectTotalMilestonesAmount > 0
          ? projectTotalMilestonesAmount
          : (job?.budgetMax ?? job?.budgetMin ?? p.baseAmount);

      const approvedMilestones = allMilestones.filter((m) => m.status === "APPROVED");
      const projectPaidAmount = approvedMilestones.reduce((sum, m) => sum + m.amount, 0);
      const projectRemainingAmount = Math.max(0, projectTotalBudget - projectPaidAmount);
      const remainingMilestonesCount = allMilestones.filter((m) => m.status !== "APPROVED").length;

      const clientFee = p.clientFeeAmount || Math.ceil(p.baseAmount * 0.1);
      const proCommission = p.commissionAmount || Math.ceil(p.baseAmount * 0.1);
      const adminNet = p.adminNetAmount || clientFee + proCommission;
      const proPayout = p.professionalPayoutAmount || Math.max(0, p.baseAmount - proCommission);

      return {
        ...p,
        jobTitle: job?.title ?? (p.jobId ? `Job #${p.jobId}` : "Direct Milestone Project"),
        jobCategory: job?.category ?? null,
        milestoneTitle:
          p.milestone?.title ??
          (p.milestoneId ? `Milestone #${p.milestoneId}` : "Milestone Payment"),
        milestoneStatus: p.milestone?.status ?? p.status,
        milestoneNumber,
        totalMilestonesCount,
        projectTotalBudget,
        projectPaidAmount,
        projectRemainingAmount,
        remainingMilestonesCount,
        milestonesList: allMilestones,
        financials: {
          grossClientAmount: p.amount,
          baseAmount: p.baseAmount,
          clientFeeAmount: clientFee,
          commissionAmount: proCommission,
          professionalPayoutAmount: proPayout,
          adminNetAmount: adminNet,
        },
      };
    });

    return NextResponse.json({
      transactions,
      withdrawals,
      payments: enrichedPayments,
      walletTransactions,
      platformWallet: platformWallet
        ? {
            ...platformWallet,
            totalReceived: platformTotalReceived,
            totalPaidToProfessionals: platformTotalPaid,
            retainedEarnings: platformTotalReceived - platformTotalPaid,
          }
        : null,
      platformWalletTransactions,
      names,
      usersById,
    });
  }
  if (resource === "support") {
    const [faqs, contactRequests] = await Promise.all([
      db.faq.findMany({ orderBy: { displayOrder: "asc" }, take: 200 }),
      db.contactRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    return NextResponse.json({ faqs, contactRequests });
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
