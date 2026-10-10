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
  if (resource === "users") {
    try {
      const allTrackings = await db.projectTracking
        .findMany({
          select: { clientId: true, professionalId: true, status: true },
        })
        .catch(() => [] as Array<{ clientId: number | null; professionalId: number | null; status: string }>);

      const rawUsers = await db.user.findMany({
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          emailVerifiedAt: true,
          createdAt: true,
          averageRating: true,
          reviewCount: true,
          professionalCity: true,
          address: true,
          serviceArea: true,
          companyName: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const [
        jobCounts,
        proposalCounts,
        wallets,
        topupSums,
        withdrawalSums,
      ] = await Promise.all([
        db.clientJob
          .groupBy({
            by: ["userId"],
            _count: { id: true },
          })
          .catch(() => [] as Array<{ userId: number; _count: { id: number } }>),
        db.projectRequest
          .groupBy({
            by: ["professionalId"],
            _count: { id: true },
          })
          .catch(() => [] as Array<{ professionalId: number; _count: { id: number } }>),
        db.wallet
          .findMany({
            select: { id: true, userId: true, balance: true, pendingBalance: true },
          })
          .catch(() => [] as Array<{ id: number; userId: number; balance: number; pendingBalance: number }>),
        db.walletTransaction
          .groupBy({
            by: ["walletId"],
            where: {
              type: "WALLET_TOP_UP",
              status: "COMPLETED",
            },
            _sum: { amount: true },
          })
          .catch(() => [] as Array<{ walletId: number; _sum: { amount: number | null } }>),
        db.projectWithdrawal
          .groupBy({
            by: ["professionalId"],
            where: {
              status: { in: ["COMPLETED", "PAID", "PROCESSED"] },
            },
            _sum: { amount: true },
          })
          .catch(() => [] as Array<{ professionalId: number; _sum: { amount: number | null } }>),
      ]);

      const trackingsByClient = new Map<
        number,
        { completed: number; closed: number; total: number }
      >();
      const trackingsByPro = new Map<
        number,
        { completed: number; closed: number; total: number }
      >();

      for (const t of allTrackings) {
        const isCompleted =
          t.status === "COMPLETED" || t.status.toUpperCase().includes("COMPLETED");
        const isClosed =
          t.status === "CLOSED" ||
          t.status.toUpperCase().includes("CLOSED") ||
          t.status.toUpperCase().includes("CANCELLED");

        if (t.clientId) {
          const c = trackingsByClient.get(t.clientId) ?? { completed: 0, closed: 0, total: 0 };
          c.total += 1;
          if (isCompleted) c.completed += 1;
          if (isClosed) c.closed += 1;
          trackingsByClient.set(t.clientId, c);
        }

        if (t.professionalId) {
          const p = trackingsByPro.get(t.professionalId) ?? { completed: 0, closed: 0, total: 0 };
          p.total += 1;
          if (isCompleted) p.completed += 1;
          if (isClosed) p.closed += 1;
          trackingsByPro.set(t.professionalId, p);
        }
      }

      const jobCountMap = new Map(jobCounts.map((j) => [j.userId, j._count.id]));
      const proposalCountMap = new Map(proposalCounts.map((p) => [p.professionalId, p._count.id]));
      const walletByUserId = new Map(wallets.map((w) => [w.userId, w]));
      const topupByWalletId = new Map(topupSums.map((t) => [t.walletId, t._sum.amount ?? 0]));
      const withdrawalByProId = new Map(withdrawalSums.map((w) => [w.professionalId, w._sum.amount ?? 0]));

      const users = rawUsers.map((u) => {
        const isClient = u.role === "CLIENT";
        const stats = (isClient ? trackingsByClient.get(u.id) : trackingsByPro.get(u.id)) ?? {
          completed: 0,
          closed: 0,
          total: 0,
        };

        const location =
          u.professionalCity?.trim() || u.address?.trim() || u.serviceArea?.trim() || "";

        const wallet = walletByUserId.get(u.id);
        const walletBalance = wallet ? wallet.balance : 0;
        const totalTopUp = wallet ? (topupByWalletId.get(wallet.id) ?? 0) : 0;
        const totalWithdrawals = withdrawalByProId.get(u.id) ?? 0;
        const jobsCount = isClient ? (jobCountMap.get(u.id) ?? 0) : 0;
        const proposalsCount = !isClient ? (proposalCountMap.get(u.id) ?? 0) : 0;
        const createdAtDate = u.createdAt ? new Date(u.createdAt) : new Date();
        const daysActive = Math.max(
          1,
          Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)),
        );

        return {
          id: u.id,
          username: u.username ?? null,
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          email: u.email ?? "",
          phone: u.phone ?? null,
          role: u.role,
          isActive: u.isActive,
          isVerified: Boolean(u.isVerified),
          emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
          createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
          daysActive,
          jobsCount,
          proposalsCount,
          walletBalance,
          totalTopUp,
          totalWithdrawals,
          averageRating: Number(u.averageRating) || 0,
          reviewCount: Number(u.reviewCount) || 0,
          completedProjects: stats.completed,
          closedProjects: stats.closed,
          totalProjects: stats.total,
          location,
          companyName: u.companyName || null,
        };
      });

      return NextResponse.json({ users });
    } catch (err) {
      console.error("Failed to load admin users:", err);
      return NextResponse.json({ error: "Failed to load users", users: [] }, { status: 500 });
    }
  }
  if (resource === "jobs") {
    const now = new Date();
    const [jobs, disputes, totalJobs, scheduledJobs, openJobs] = await Promise.all([
      db.clientJob.findMany({
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
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
    try {
      const [transactions, withdrawals, payments, walletTransactions, adminUsers] =
        await Promise.all([
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
        ]);
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
      const paymentIdsFromLedger = [
        ...new Set(
          platformWalletTransactionsRaw
            .map((tx) => tx.paymentId)
            .filter((id): id is number => typeof id === "number" && id > 0),
        ),
      ];
      const ledgerPayments =
        paymentIdsFromLedger.length > 0
          ? await db.payment.findMany({
              where: { id: { in: paymentIdsFromLedger } },
              include: {
                client: { select: { id: true, firstName: true, lastName: true } },
                professional: { select: { id: true, firstName: true, lastName: true } },
                job: { select: { id: true, title: true } },
                milestone: { select: { id: true, title: true } },
              },
            })
          : [];
      const ledgerPaymentMap = new Map(ledgerPayments.map((p) => [p.id, p]));

      const commissionPaymentIds = new Set(
        platformWalletTransactionsRaw
          .filter((tx) => tx.type === "PLATFORM_COMMISSION" && tx.paymentId)
          .map((tx) => tx.paymentId as number),
      );

      const platformWalletTransactions: Array<{
        id: number;
        type: string;
        amount: number;
        status: string;
        description: string;
        createdAt: Date;
        clientName: string | null;
        professionalName: string | null;
        projectTitle: string | null;
        milestoneTitle: string | null;
      }> = [];

      for (const item of platformWalletTransactionsRaw) {
        const relPayment = item.paymentId ? ledgerPaymentMap.get(item.paymentId) : null;
        const clientName = relPayment?.client
          ? `${relPayment.client.firstName} ${relPayment.client.lastName}`.trim()
          : null;
        const professionalName = relPayment?.professional
          ? `${relPayment.professional.firstName} ${relPayment.professional.lastName}`.trim()
          : null;
        const projectTitle = relPayment?.job?.title ?? null;
        const milestoneTitle = relPayment?.milestone?.title ?? null;

        // If legacy ADMIN_MILESTONE_RECEIPT has total client charge and no separate commission entry:
        if (
          item.type === "ADMIN_MILESTONE_RECEIPT" &&
          item.paymentId &&
          relPayment &&
          !commissionPaymentIds.has(item.paymentId) &&
          (relPayment.clientFeeAmount > 0 || relPayment.commissionAmount > 0)
        ) {
          const base = relPayment.baseAmount || Math.round(item.amount / 1.1);
          const fee =
            relPayment.clientFeeAmount || relPayment.commissionAmount || item.amount - base;

          // Entry 1: Milestone receipt
          platformWalletTransactions.push({
            id: item.id,
            type: "ADMIN_MILESTONE_RECEIPT",
            amount: base,
            status: item.status,
            description: `Milestone receipt: ₹${base.toLocaleString("en-IN")}`,
            createdAt: item.createdAt,
            clientName,
            professionalName,
            projectTitle,
            milestoneTitle,
          });

          // Entry 2: Platform commission
          platformWalletTransactions.push({
            id: -(item.id * 1000 + 1),
            type: "PLATFORM_COMMISSION",
            amount: fee,
            status: item.status,
            description: `Platform commission: ₹${fee.toLocaleString("en-IN")}`,
            createdAt: item.createdAt,
            clientName,
            professionalName,
            projectTitle,
            milestoneTitle,
          });
        } else {
          platformWalletTransactions.push({
            id: item.id,
            type: item.type,
            amount: item.amount,
            status: item.status,
            description:
              adminWallets.length > 1
                ? `${item.description} (${adminNameByUserId[item.wallet.userId] ?? `#${item.wallet.userId}`})`
                : item.description,
            createdAt: item.createdAt,
            clientName,
            professionalName,
            projectTitle,
            milestoneTitle,
          });
        }
      }
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
            isVerified: true,
            phoneVerifiedAt: true,
          },
        }),
        db.legacyUserProfile
          .findMany({
            where: { userId: { in: ids.map(String) } },
            select: { userId: true, fullName: true },
          })
          .catch(() => []),
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
            isVerified: u.isVerified,
            phoneVerifiedAt: u.phoneVerifiedAt,
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
        const remainingMilestonesCount = allMilestones.filter(
          (m) => m.status !== "APPROVED",
        ).length;

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
    } catch (err) {
      console.error("Failed to load admin finance data:", err);
      return NextResponse.json({ error: "Failed to load finance data" }, { status: 500 });
    }
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
