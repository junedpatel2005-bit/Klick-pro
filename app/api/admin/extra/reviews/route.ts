import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";

async function verifyAdmin(request: NextRequest) {
  if (!ENABLE_ADMIN_EXTRA_SECTION) return null;
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const ratingFilter = searchParams.get("rating");
  const query = searchParams.get("query")?.toLowerCase() || "";

  try {
    const reviews = await db.projectReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (reviews.length === 0) {
      return NextResponse.json({
        reviews: [],
        stats: { total: 0, fiveStar: 0, oneStar: 0, averageRating: 0 },
      });
    }

    const userIds = Array.from(new Set(reviews.flatMap((r) => [r.clientId, r.professionalId])));
    const trackingIds = reviews.map((r) => r.trackingId);

    const [users, trackings] = await Promise.all([
      db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      }),
      db.projectTracking.findMany({
        where: { id: { in: trackingIds } },
        include: {
          job: {
            select: { id: true, title: true, category: true, budgetMin: true, budgetMax: true },
          },
        },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const trackingMap = new Map(trackings.map((t) => [t.id, t]));

    const enriched = reviews.map((r) => {
      const client = userMap.get(r.clientId);
      const pro = userMap.get(r.professionalId);
      const tracking = trackingMap.get(r.trackingId);

      return {
        id: r.id,
        trackingId: r.trackingId,
        jobId: tracking?.job.id ?? null,
        jobTitle: tracking?.job.title ?? `Project #${r.trackingId}`,
        jobCategory: tracking?.job.category ?? null,
        jobBudget: tracking?.job.budgetMax ?? tracking?.job.budgetMin ?? 0,
        clientId: r.clientId,
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : "Unknown Client",
        clientEmail: client?.email ?? "",
        clientAvatar: client?.avatarUrl ?? null,
        professionalId: r.professionalId,
        professionalName: pro ? `${pro.firstName} ${pro.lastName}`.trim() : "Unknown Pro",
        professionalEmail: pro?.email ?? "",
        professionalAvatar: pro?.avatarUrl ?? null,
        rating: r.rating,
        comment: r.comment,
        clientReviewedAt: r.clientReviewedAt,
        professionalRating: r.professionalRating,
        professionalComment: r.professionalComment,
        professionalReviewedAt: r.professionalReviewedAt,
        professionalResponse: r.professionalResponse,
        professionalResponseAt: r.professionalResponseAt,
        createdAt: r.createdAt,
      };
    });

    let filtered = enriched;
    if (ratingFilter && ratingFilter !== "ALL") {
      const targetRating = parseInt(ratingFilter, 10);
      filtered = filtered.filter(
        (r) => r.rating === targetRating || r.professionalRating === targetRating,
      );
    }

    if (query) {
      filtered = filtered.filter(
        (r) =>
          r.clientName.toLowerCase().includes(query) ||
          r.professionalName.toLowerCase().includes(query) ||
          r.jobTitle.toLowerCase().includes(query) ||
          (r.comment && r.comment.toLowerCase().includes(query)) ||
          (r.professionalComment && r.professionalComment.toLowerCase().includes(query)),
      );
    }

    const ratingsList = reviews
      .flatMap((r) => [r.rating, r.professionalRating])
      .filter((n): n is number => typeof n === "number" && n > 0);

    const totalRatingsCount = ratingsList.length;
    const avg =
      totalRatingsCount > 0
        ? Number((ratingsList.reduce((a, b) => a + b, 0) / totalRatingsCount).toFixed(1))
        : 0;
    const fiveStarCount = ratingsList.filter((r) => r === 5).length;
    const oneStarCount = ratingsList.filter((r) => r === 1).length;

    return NextResponse.json({
      reviews: filtered,
      stats: {
        total: reviews.length,
        fiveStar: fiveStarCount,
        oneStar: oneStarCount,
        averageRating: avg,
      },
    });
  } catch (error) {
    console.error("Failed to load reviews:", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}

const updateSchema = z.object({
  id: z.number(),
  comment: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
  professionalComment: z.string().optional(),
  professionalRating: z.number().min(1).max(5).optional(),
});

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review update payload" }, { status: 400 });
  }

  try {
    const updated = await db.projectReview.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
        ...(parsed.data.rating !== undefined ? { rating: parsed.data.rating } : {}),
        ...(parsed.data.professionalComment !== undefined
          ? { professionalComment: parsed.data.professionalComment }
          : {}),
        ...(parsed.data.professionalRating !== undefined
          ? { professionalRating: parsed.data.professionalRating }
          : {}),
      },
    });

    // Record audit log
    await db.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "MODERATE_REVIEW",
        entityType: "ProjectReview",
        entityId: String(parsed.data.id),
        metadata: { changes: parsed.data },
      },
    });

    return NextResponse.json({ success: true, review: updated });
  } catch (error) {
    console.error("Failed to update review:", error);
    return NextResponse.json({ error: "Failed to moderate review" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "", 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Review ID required" }, { status: 400 });
  }

  try {
    const review = await db.projectReview.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await db.projectReview.delete({ where: { id } });

    // Record in audit log
    await db.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "DELETE_REVIEW",
        entityType: "ProjectReview",
        entityId: String(id),
        metadata: {
          deletedReview: {
            clientId: review.clientId,
            professionalId: review.professionalId,
            rating: review.rating,
          },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete review:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
