import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { capitalizeWords, capitalizeFirst } from "@/lib/utils";

const TYPO_MAP: Record<string, string> = {
  paymnet: "payment",
  paymnt: "payment",
  payement: "payment",
  paymants: "payment",
  walet: "wallet",
  profesional: "professional",
  proffesional: "professional",
  mesage: "message",
  repot: "report",
  abut: "about",
  abowt: "about",
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q")?.trim() ?? "";
  if (!rawQuery) {
    return NextResponse.json({
      query: "",
      normalizedQuery: "",
      jobs: [],
      professionals: [],
      payments: [],
    });
  }

  const normalizedQuery = TYPO_MAP[rawQuery.toLowerCase()] ?? rawQuery;

  // Optional user session to fetch user-specific payments/transactions
  let userId: number | null = null;
  let userRole: string | null = null;
  const token = request.cookies.get(sessionCookie)?.value;
  if (token) {
    try {
      const session = await verifySession(token);
      userId = session.userId;
      userRole = session.role;
    } catch {
      // Unauthenticated, continue public search
    }
  }

  const isPaymentSearch = [
    "payment",
    "payments",
    "pay",
    "wallet",
    "money",
    "earnings",
    "invoice",
    "invoices",
    "escrow",
    "deposit",
    "payout",
  ].includes(normalizedQuery.toLowerCase());

  // 1. Search Jobs
  const jobsPromise = db.clientJob.findMany({
    where: {
      status: "OPEN",
      OR: [
        { title: { contains: normalizedQuery, mode: "insensitive" } },
        { description: { contains: normalizedQuery, mode: "insensitive" } },
        { category: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      category: true,
      locationLabel: true,
      budgetMin: true,
      budgetMax: true,
      hourlyRate: true,
      timingType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // 2. Search Professionals
  const professionalsPromise = db.user.findMany({
    where: {
      role: "PROFESSIONAL",
      OR: [
        { firstName: { contains: normalizedQuery, mode: "insensitive" } },
        { lastName: { contains: normalizedQuery, mode: "insensitive" } },
        { professionalCategory: { contains: normalizedQuery, mode: "insensitive" } },
        { professionalCity: { contains: normalizedQuery, mode: "insensitive" } },
        { professionalSkillsJson: { contains: normalizedQuery, mode: "insensitive" } },
        { companyName: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      professionalCategory: true,
      professionalCity: true,
      averageRating: true,
      reviewCount: true,
      hourlyRate: true,
    },
    orderBy: [{ averageRating: "desc" }, { reviewCount: "desc" }],
    take: 6,
  });

  // 3. Search Payments / Transactions (if user logged in)
  const paymentsPromise = (async () => {
    if (!userId) return [];
    try {
      if (isPaymentSearch) {
        const transactions = await db.walletTransaction.findMany({
          where: { wallet: { userId } },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true,
            amount: true,
            status: true,
            description: true,
            type: true,
            createdAt: true,
          },
        });
        return transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          status: capitalizeWords(t.status),
          description: capitalizeFirst(t.description || "Wallet transaction"),
          type: t.type,
          createdAt: t.createdAt.toISOString(),
        }));
      }

      const transactions = await db.walletTransaction.findMany({
        where: {
          wallet: { userId },
          OR: [
            { description: { contains: normalizedQuery, mode: "insensitive" } },
            { status: { contains: normalizedQuery, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          amount: true,
          status: true,
          description: true,
          type: true,
          createdAt: true,
        },
      });
      return transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        status: capitalizeWords(t.status),
        description: capitalizeFirst(t.description || "Wallet transaction"),
        type: t.type,
        createdAt: t.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  })();

  const [jobs, professionals, payments] = await Promise.all([
    jobsPromise.catch(() => []),
    professionalsPromise.catch(() => []),
    paymentsPromise.catch(() => []),
  ]);

  return NextResponse.json({
    query: rawQuery,
    normalizedQuery,
    jobs: jobs.map((j) => ({
      ...j,
      title: capitalizeFirst(j.title || "Job Posting"),
      category: capitalizeWords(j.category || "General"),
      locationLabel: j.locationLabel ? capitalizeWords(j.locationLabel) : "Remote",
    })),
    professionals: professionals.map((p) => ({
      id: p.id,
      name: capitalizeWords(`${p.firstName} ${p.lastName}`.trim() || "Professional"),
      title: capitalizeWords(p.professionalCategory || "Verified Professional"),
      category: capitalizeWords(p.professionalCategory || "Services"),
      city: p.professionalCity ? capitalizeWords(p.professionalCity) : "Remote",
      avatar: p.avatarUrl,
      rating: p.averageRating,
      reviews: p.reviewCount,
      hourlyRate: p.hourlyRate,
    })),
    payments,
  });
}
