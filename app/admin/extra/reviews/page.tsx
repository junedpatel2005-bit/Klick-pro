"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Star,
  Search,
  Filter,
  Trash2,
  Edit3,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  User,
  ShieldAlert,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReviewItem = {
  id: number;
  trackingId: number;
  jobId: number | null;
  jobTitle: string;
  jobCategory?: string | null;
  jobBudget: number;
  clientId: number;
  clientName: string;
  clientEmail: string;
  professionalId: number;
  professionalName: string;
  professionalEmail: string;
  rating: number | null;
  comment: string | null;
  clientReviewedAt: string | null;
  professionalRating: number | null;
  professionalComment: string | null;
  professionalReviewedAt: string | null;
  createdAt: string;
};

type ReviewStats = {
  total: number;
  fiveStar: number;
  oneStar: number;
  averageRating: number;
};

export default function ReviewModerationPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    total: 0,
    fiveStar: 0,
    oneStar: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [editComment, setEditComment] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function fetchReviews() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ratingFilter !== "ALL") params.set("rating", ratingFilter);
      if (search.trim()) params.set("query", search.trim());

      const res = await fetch(`/api/admin/extra/reviews?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reviews");

      setReviews(data.reviews || []);
      setStats(
        data.stats || {
          total: 0,
          fiveStar: 0,
          oneStar: 0,
          averageRating: 0,
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchReviews();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingFilter, search]);

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to permanently delete this review?")) return;
    try {
      const res = await fetch(`/api/admin/extra/reviews?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete review");

      toast.success("Review deleted and user rating updated.");
      setReviews((prev) => prev.filter((r) => r.id !== id));
      void fetchReviews();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete review");
    }
  }

  async function handleSaveEdit() {
    if (!editingReview) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/extra/reviews`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingReview.id,
          comment: editComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update review");

      toast.success("Review content moderated successfully.");
      setReviews((prev) =>
        prev.map((r) => (r.id === editingReview.id ? { ...r, comment: editComment } : r)),
      );
      setEditingReview(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Review & Rating Moderation
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Audit platform reviews, inspect client/professional feedback, and remove or moderate
            abusive comments.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchReviews()}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Total Reviews</p>
          {loading ? (
            <div className="mt-2 h-8 w-20 animate-pulse rounded-lg bg-slate-200" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Published feedback</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Average Platform Score</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-amber-100" />
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-2xl font-bold text-amber-600">
                {stats.averageRating || "0.0"}
              </span>
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Out of 5.0 stars</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-emerald-700">5-Star Feedback</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-emerald-100" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-emerald-600">{stats.fiveStar}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Top quality ratings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-rose-700">1-Star / Flagged</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-rose-100" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-rose-600">{stats.oneStar}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Disputed or low score</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by user, project, comment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {["ALL", "5", "4", "3", "2", "1"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRatingFilter(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                ratingFilter === r
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r === "ALL" ? "All Ratings" : `${r} ★`}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading && reviews.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 animate-pulse">
            Loading reviews and moderation data...
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No reviews found</p>
            <p className="text-xs text-slate-400 mt-1">
              No review records matched your search or rating filters.
            </p>
          </div>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 hover:border-slate-300 transition"
            >
              {/* Review Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                    Job Name:
                  </span>
                  <span className="font-bold text-sm text-slate-900">{r.jobTitle}</span>
                  {r.jobCategory && (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                      {r.jobCategory}
                    </span>
                  )}
                  {r.jobId && (
                    <Link
                      href={`/job/${r.jobId}`}
                      target="_blank"
                      className="text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 text-xs font-semibold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs hover:border-indigo-300"
                    >
                      <ExternalLink className="h-3 w-3" /> Job #{r.jobId}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Budget: ₹{r.jobBudget.toLocaleString()}</span>
                </div>
              </div>

              {/* Review Columns: Client Feedback & Pro Feedback */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Client's Review of Pro */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-indigo-600" />
                      Client Feedback
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      by {r.clientName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          (r.rating ?? 0) >= star
                            ? "fill-amber-500 text-amber-500"
                            : "text-slate-300"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-1">
                      {r.rating ? `${r.rating}.0` : "No rating"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 italic">
                    &ldquo;{r.comment || "No comment provided by client."}&rdquo;
                  </p>
                </div>

                {/* Professional's Review of Client */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-sky-600" />
                      Professional Feedback
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      by {r.professionalName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          (r.professionalRating ?? 0) >= star
                            ? "fill-amber-500 text-amber-500"
                            : "text-slate-300"
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-slate-700 ml-1">
                      {r.professionalRating ? `${r.professionalRating}.0` : "No rating"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 italic">
                    &ldquo;
                    {r.professionalComment || "No comment provided by professional."}
                    &rdquo;
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingReview(r);
                    setEditComment(r.comment || "");
                  }}
                  className="gap-1.5 text-xs text-slate-600"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Moderate Comment
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(r.id)}
                  className="gap-1.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Review
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Moderate Comment Modal */}
      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Moderate Review Content</h3>
              <button
                type="button"
                onClick={() => setEditingReview(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Editing review on <b>{editingReview.jobTitle}</b> left by {editingReview.clientName}.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client Review Comment
              </label>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Edit or redact inappropriate text..."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingReview(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {savingEdit ? "Saving..." : "Save Moderation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
