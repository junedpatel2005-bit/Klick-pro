"use client";

import Link from "next/link";
import { Briefcase, MapPin, DollarSign, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export type JobCardProps = {
  title: string;
  description?: string | null;
  category?: string | null;
  locationAddress?: string | null;
  clientName?: string | null;
  status?: string;
  timingType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  hourlyRate?: number | null;
  proposalCount?: number | null;
  actionLabel: string;
  actionHref?: string;
  actionOnClick?: () => void;
  actionDisabled?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
  secondaryOnClick?: () => void;
  secondaryDisabled?: boolean;
  badgeLabel?: string;
  footerText?: string;
};

function formatBudget(value: number | null | undefined, timingType?: string | null) {
  if (timingType === "HOURLY" && value != null) return `₹${value.toLocaleString()}/hr`;
  if (value == null) return "Budget on request";
  return `₹${value.toLocaleString()}`;
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
  timingType?: string | null,
) {
  if (timingType === "HOURLY") {
    return min == null ? "Hourly rate not set" : `₹${min.toLocaleString()}/hr`;
  }
  if (min == null && max == null) return "Budget on request";
  return `₹${min?.toLocaleString() ?? "—"} – ₹${max?.toLocaleString() ?? "—"}`;
}

export function JobCard({
  title,
  description,
  category,
  locationAddress,
  clientName,
  status,
  timingType,
  budgetMin,
  budgetMax,
  hourlyRate,
  proposalCount,
  actionLabel,
  actionHref,
  actionOnClick,
  actionDisabled,
  secondaryLabel,
  secondaryHref,
  secondaryOnClick,
  secondaryDisabled,
  badgeLabel,
  footerText,
}: JobCardProps) {
  const budget =
    timingType === "HOURLY"
      ? formatBudget(hourlyRate, timingType)
      : formatBudgetRange(budgetMin, budgetMax, timingType);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {category ?? "General"}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground truncate">{title}</h2>
          {description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {locationAddress ?? "Remote"}
            </span>
            {clientName ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-4 w-4" />
                {clientName}
              </span>
            ) : null}
            {proposalCount != null ? (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {proposalCount} saved
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {badgeLabel ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-primary">
              {badgeLabel}
            </span>
          ) : null}
          {status ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            {budget}
          </span>
          {footerText ? <span>{footerText}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryLabel ? (
            actionOnClick || secondaryHref || secondaryOnClick ? null : (
              <></>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {secondaryLabel ? (
          secondaryHref ? (
            <Button asChild variant="outline" size="sm" disabled={secondaryDisabled}>
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={secondaryOnClick}
              disabled={secondaryDisabled}
            >
              {secondaryLabel}
            </Button>
          )
        ) : null}

        {actionHref ? (
          <Button asChild size="sm" disabled={actionDisabled}>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={actionOnClick} disabled={actionDisabled}>
            {actionLabel}
          </Button>
        )}
      </div>
    </article>
  );
}
