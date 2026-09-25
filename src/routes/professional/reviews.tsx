"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Star,
  Search,
  Briefcase,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Loader2,
  X,
  Reply,
  Award,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type ReviewItem = {
  id: number;
  trackingId: number;
  rating: number;
  comment: string | null;
  professionalResponse: string | null;
  professionalResponseAt: string | null;
  reviewerId?: number;
  reviewerName?: string;
  reviewerAvatar?: string | null;
  reviewerRole?: string;
  reviewerCategory?: string | null;
  reviewerVerified?: boolean;
  clientName?: string | null;
  recipientId?: number;
  recipientName?: string;
  recipientAvatar?: string | null;
  recipientRole?: string;
  recipientCategory?: string | null;
  recipientVerified?: boolean;
  projectId: number | null;
  projectTitle: string | null;
  createdAt: string;
};

export type PendingReview = {
  trackingId: number;
  projectId: number | null;
  projectTitle: string;
  projectCategory: string | null;
  otherPartyName: string;
  otherPartyAvatar: string | null;
  otherPartyCategory: string | null;
  completedAt: string;
};

export type ReviewStats = {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
  isVerified: boolean;
  userRole: string;
  userName: string;
};

export type ReviewsResponse = {
  stats?: ReviewStats;
  reviews?: ReviewItem[];
  receivedReviews?: ReviewItem[];
  givenReviews?: ReviewItem[];
  pendingReviews?: PendingReview[];
};

export default function ProfessionalReviews() {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"received" | "given" | "pending">("received");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRating, setFilterRating] = useState<number | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");

  // Response to client review modal state
  const [respondingReview, setRespondingReview] = useState<ReviewItem | null>(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Review submission modal state (rate client)
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingProject, setReviewingProject] = useState<PendingReview | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/portal/reviews", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load reviews.");
      const json = await res.json();

      if (Array.isArray(json)) {
        setData({
          reviews: json,
          receivedReviews: json,
          givenReviews: [],
          pendingReviews: [],
          stats: {
            averageRating:
              json.length > 0
                ? Number((json.reduce((acc, r) => acc + (r.rating || 0), 0) / json.length).toFixed(1))
                : 0,
            totalReviews: json.length,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            isVerified: true,
            userRole: "PROFESSIONAL",
            userName: "Professional",
          },
        });
      } else {
        setData(json);
      }
    } catch {
      setError("Unable to load reviews. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, []);

  const receivedReviews = data?.receivedReviews ?? data?.reviews ?? [];
  const givenReviews = data?.givenReviews ?? [];
  const pendingReviews = data?.pendingReviews ?? [];

  const stats = useMemo(() => {
    if (data?.stats) return data.stats;
    const count = receivedReviews.length;
    const avg =
      count > 0
        ? Number((receivedReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
        : 0;
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    receivedReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      dist[star] = (dist[star] || 0) + 1;
    });
    return {
      averageRating: avg,
      totalReviews: count,
      distribution: dist,
      isVerified: true,
      userRole: "PROFESSIONAL",
      userName: "Professional",
    };
  }, [data?.stats, receivedReviews]);

  // Current list to display based on active tab
  const currentList = useMemo(() => {
    let list: ReviewItem[] = [];
    if (activeTab === "received") list = receivedReviews;
    else if (activeTab === "given") list = givenReviews;
    else return [];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const title = (r.projectTitle || "").toLowerCase();
        const comment = (r.comment || "").toLowerCase();
        const reviewer = (r.reviewerName || r.clientName || r.recipientName || "").toLowerCase();
        return title.includes(q) || comment.includes(q) || reviewer.includes(q);
      });
    }

    // Filter by rating
    if (filterRating !== "ALL") {
      list = list.filter((r) => Math.round(r.rating) === filterRating);
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === "highest") return b.rating - a.rating;
      if (sortBy === "lowest") return a.rating - b.rating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeTab, receivedReviews, givenReviews, searchQuery, filterRating, sortBy]);

  // Respond to Review Handler
  const handleOpenResponseModal = (review: ReviewItem) => {
    setRespondingReview(review);
    setResponseText(review.professionalResponse || "");
    setResponseModalOpen(true);
  };

  const handleSubmitResponse = async () => {
    if (!respondingReview || !responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      const response = await fetch("/api/v1/portal/project-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond-to-review",
          projectId: respondingReview.trackingId,
          response: responseText.trim(),
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Failed to publish response.");
      }

      toast.success("Response published to client review!");
      setResponseModalOpen(false);
      setRespondingReview(null);
      await fetchReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to publish response.");
    } finally {
      setSubmittingResponse(false);
    }
  };

  // Submit Review for a Pending Project (Rate Client)
  const handleOpenReviewModal = (pending: PendingReview) => {
    setReviewingProject(pending);
    setSelectedRating(5);
    setHoverRating(null);
    setReviewComment("");
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingProject) return;
    setSubmittingReview(true);
    try {
      const response = await fetch("/api/v1/portal/project-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit-review",
          projectId: reviewingProject.trackingId,
          rating: selectedRating,
          comment: reviewComment.trim() || null,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Failed to submit review.");
      }

      toast.success("Client rating submitted successfully!");
      setReviewModalOpen(false);
      setReviewingProject(null);
      await fetchReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to submit rating.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const ratingLabel = (val: number) => {
    switch (val) {
      case 5:
        return "5 - Excellent Client to Work With";
      case 4:
        return "4 - Great Communication & Clear Scope";
      case 3:
        return "3 - Standard Experience";
      case 2:
        return "2 - Challenging / Difficult Scope";
      case 1:
        return "1 - Not Recommended";
      default:
        return `${val} Stars`;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Award className="h-3.5 w-3.5" />
              Verified Pro Reputation
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Reviews & Reputation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Client testimonials, ratings, and public feedback earned across your completed contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/professional/reports">Completed projects</Link>
          </Button>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/professional/dashboard">Find new jobs</Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchReviews}>
            Retry
          </Button>
        </div>
      )}

      {/* Reputation Summary Card */}
      <div className="grid gap-6 rounded-3xl border border-border/80 bg-card p-6 shadow-soft lg:grid-cols-3">
        {/* Overall Score */}
        <div className="flex flex-col items-center justify-center border-b border-border/60 pb-6 text-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Marketplace Trust Score
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold text-foreground">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
            </span>
            <span className="text-lg font-semibold text-muted-foreground">/ 5.0</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i < Math.round(stats.averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {stats.totalReviews > 0
              ? `Based on ${stats.totalReviews} verified client ${stats.totalReviews === 1 ? "review" : "reviews"}`
              : "No reviews recorded yet"}
          </p>
        </div>

        {/* Rating Distribution Bars */}
        <div className="flex flex-col justify-center border-b border-border/60 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:px-6">
          <span className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rating Distribution
          </span>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star] || 0;
              const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <span className="w-12 font-medium text-foreground">{star} Stars</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        star >= 4
                          ? "bg-amber-400"
                          : star === 3
                            ? "bg-amber-500/70"
                            : "bg-muted-foreground/50"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pro Benefits Highlights */}
        <div className="flex flex-col justify-center space-y-3.5 lg:pl-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reputation Perks
          </span>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Top-Rated Badge Placement</p>
              <p className="text-xs text-muted-foreground">
                Profiles with 4.8+ ratings and 3+ reviews get featured in client search results.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">100% Escrow-Verified Work</p>
              <p className="text-xs text-muted-foreground">
                All client feedback is verified against released milestone payments.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Reply className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Public Reply Rights</p>
              <p className="text-xs text-muted-foreground">
                Respond directly to any client feedback to showcase professionalism.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filter Section */}
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("received");
                setFilterRating("ALL");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === "received"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>Client Reviews</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "received"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {receivedReviews.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("given");
                setFilterRating("ALL");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === "given"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>Reviews You Left</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  activeTab === "given"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {givenReviews.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("pending");
                setFilterRating("ALL");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white shadow-sm"
                  : pendingReviews.length > 0
                    ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Pending Feedback</span>
              {pendingReviews.length > 0 && (
                <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingReviews.length}
                </span>
              )}
            </button>
          </div>

          {/* Search, Filter & Sort Controls */}
          {activeTab !== "pending" && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[200px] flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search project or client…"
                  className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Star Rating Filter */}
              <select
                value={filterRating}
                onChange={(e) =>
                  setFilterRating(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                }
                className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ALL">All Stars</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>

              {/* Sort Order */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "highest" | "lowest")}
                className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          )}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-3xl bg-muted" />
            <div className="h-32 animate-pulse rounded-3xl bg-muted" />
            <div className="h-32 animate-pulse rounded-3xl bg-muted" />
          </div>
        ) : activeTab === "pending" ? (
          /* PENDING REVIEWS TAB */
          pendingReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                All caught up! No pending feedback
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                You've rated all your completed clients. Whenever you finish a project, you can submit feedback here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingReviews.map((pending) => (
                <div
                  key={pending.trackingId}
                  className="flex flex-col gap-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 transition-all hover:border-amber-500/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                        Client Rating Pending
                      </span>
                      {pending.projectCategory && (
                        <span className="text-xs text-muted-foreground">
                          · {pending.projectCategory}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      {pending.projectTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Client: <span className="font-semibold text-foreground">{pending.otherPartyName}</span> · Completed{" "}
                      {new Date(pending.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/project/${pending.trackingId}/tracking`}>
                        View Project
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenReviewModal(pending)}
                      className="bg-amber-500 text-white hover:bg-amber-600"
                    >
                      <Star className="mr-1.5 h-4 w-4 fill-white" />
                      Rate Client
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* REVIEWS LIST (RECEIVED OR GIVEN) */
          currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                {activeTab === "received" ? "No client reviews found" : "No client ratings left yet"}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {searchQuery || filterRating !== "ALL"
                  ? "No reviews match your selected filter. Try clearing the search or rating filter."
                  : activeTab === "received"
                    ? "Complete client milestones and deliver great work to earn 5-star reviews on your profile."
                    : "When you complete a project, leave feedback to help other professionals in the community."}
              </p>
              {(searchQuery || filterRating !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterRating("ALL");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-5">
              {currentList.map((review) => {
                const displayName =
                  activeTab === "received"
                    ? review.reviewerName || review.clientName || "Client"
                    : review.recipientName || "Client";

                const category =
                  activeTab === "received"
                    ? review.reviewerCategory
                    : review.recipientCategory;

                const avatar =
                  activeTab === "received" ? review.reviewerAvatar : review.recipientAvatar;

                return (
                  <article
                    key={review.id}
                    className="overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-soft transition-all hover:border-border hover:shadow-elevated"
                  >
                    {/* Header Row: Reviewer / Recipient Info + Rating */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={displayName}
                            className="h-12 w-12 rounded-2xl object-cover ring-2 ring-primary/10"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{displayName}</h3>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {activeTab === "received" ? "Verified Client" : "Client"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {category && <span>{category}</span>}
                            {category && <span>·</span>}
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(review.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Star Rating Badge */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          {review.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Associated Project Banner */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-2.5 text-xs border border-border/40">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-foreground">
                          {review.projectTitle?.trim() ||
                            (review.projectId ? `Project #${review.projectId}` : "Completed Project")}
                        </span>
                      </div>
                      <Link
                        href={`/project/${review.trackingId}/tracking`}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <span>View project workspace</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Review Comment */}
                    <div className="mt-4">
                      {review.comment ? (
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          "{review.comment}"
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          Rating provided without written comment.
                        </p>
                      )}
                    </div>

                    {/* Professional Response Section */}
                    {activeTab === "received" && (
                      <div className="mt-4">
                        {review.professionalResponse ? (
                          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-primary">Your Response:</span>
                              {review.professionalResponseAt && (
                                <span className="text-muted-foreground">
                                  {new Date(review.professionalResponseAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-foreground/90 whitespace-pre-wrap">
                              "{review.professionalResponse}"
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenResponseModal(review)}
                              className="text-xs"
                            >
                              <Reply className="mr-1.5 h-3.5 w-3.5" />
                              Respond to this review
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Response to Client Review Dialog */}
      <Dialog open={responseModalOpen} onOpenChange={setResponseModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Respond to Client Review
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your response will appear publicly on your profile below the client's review.
            </DialogDescription>
          </DialogHeader>

          {respondingReview && (
            <div className="mt-3 rounded-2xl bg-muted/50 p-3 text-xs">
              <p className="font-semibold text-foreground">
                Client's Review ({respondingReview.rating}★):
              </p>
              <p className="mt-1 text-muted-foreground">
                "{respondingReview.comment || "Rating only"}"
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Professional Response
            </label>
            <textarea
              rows={4}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="e.g. Thank you for the positive review! It was great working with you on this project."
              className="w-full rounded-2xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setResponseModalOpen(false)}
              disabled={submittingResponse}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResponse}
              disabled={submittingResponse || !responseText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submittingResponse ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                "Publish Response"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Client Dialog */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Rate & Review Client
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {reviewingProject?.projectTitle} · Client: {reviewingProject?.otherPartyName}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-5">
            {/* Interactive Star Rating Selector */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Client Collaboration & Communication
              </label>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        star <= (hoverRating ?? selectedRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs font-bold text-foreground">
                  {ratingLabel(hoverRating ?? selectedRating)}
                </span>
              </div>
            </div>

            {/* Written Review Textarea */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Share your feedback on working with this client (optional)
              </label>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="How was the client's communication, clarity of requirements, and milestone responsiveness?"
                className="mt-2 w-full rounded-2xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {reviewComment.length} characters
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setReviewModalOpen(false)}
              disabled={submittingReview}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submittingReview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Rating"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
