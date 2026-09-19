"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

type Review = {
  id: number;
  trackingId: number;
  rating: number;
  comment: string | null;
  professionalResponse: string | null;
  clientName: string | null;
  projectId: number | null;
  projectTitle: string | null;
  createdAt: string;
};

export default function ClientReviews() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/portal/reviews")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Review[]>;
      })
      .then(setReviews)
      .catch(() => setError("Unable to load reviews."));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reviews & Ratings</h1>
          <p className="mt-1 text-muted-foreground">Feedback from professionals who completed projects with you.</p>
        </div>
        <Button asChild>
          <a href="/reports">Completed projects</a>
        </Button>
      </div>

      {error ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          {error}
        </div>
      ) : !reviews ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-3xl bg-muted" />
          <div className="h-72 animate-pulse rounded-3xl bg-muted" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No reviews yet. Professionals will leave feedback here once projects are completed.
        </div>
      ) : (
        <ul className="grid gap-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{review.clientName ?? "Professional"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <Star className="h-4 w-4" />
                  {review.rating.toFixed(1)}
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-muted/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Project
                </p>
                <a
                  href={`/project/${review.trackingId}/tracking`}
                  className="mt-1 block text-sm font-semibold text-primary hover:underline"
                >
                  {review.projectTitle?.trim() ||
                    (review.projectId ? `Project #${review.projectId}` : "Completed project")}
                </a>
              </div>
              {review.comment ? (
                <p className="mt-4 text-sm text-muted-foreground">{review.comment}</p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Rating provided without written comment.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

