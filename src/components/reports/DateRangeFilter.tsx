"use client";

import { Calendar, X } from "lucide-react";

export type DatePreset =
  | "all"
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "last_60_days"
  | "last_90_days"
  | "this_year"
  | "custom";

export function isWithinCustomDateRange(
  dateString: string | Date | null | undefined,
  preset: DatePreset,
  startDate?: string,
  endDate?: string,
): boolean {
  if (!dateString) return preset === "all";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;

  if (preset === "custom") {
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  }

  const now = new Date();
  if (preset === "this_month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (preset === "last_month") {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear()
    );
  }
  if (preset === "last_30_days") {
    const d = new Date();
    d.setDate(now.getDate() - 30);
    return date >= d;
  }
  if (preset === "last_60_days") {
    const d = new Date();
    d.setDate(now.getDate() - 60);
    return date >= d;
  }
  if (preset === "last_90_days") {
    const d = new Date();
    d.setDate(now.getDate() - 90);
    return date >= d;
  }
  if (preset === "this_year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}

interface DateRangeFilterProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  className?: string;
}

export function DateRangeFilter({
  preset,
  onPresetChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  className = "",
}: DateRangeFilterProps) {
  const isCustom = preset === "custom";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Preset Selector */}
      <div className="relative inline-flex items-center">
        <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <select
          value={preset}
          onChange={(e) => {
            const next = e.target.value as DatePreset;
            onPresetChange(next);
          }}
          className="h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-xs sm:text-sm font-medium text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">All Time</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_30_days">Last 30 Days</option>
          <option value="last_60_days">Last 60 Days</option>
          <option value="last_90_days">Last 90 Days</option>
          <option value="this_year">This Year</option>
          <option value="custom">📅 Custom Date Range</option>
        </select>
      </div>

      {/* Calendar Date-to-Date Inputs (shown when custom is selected or if user sets dates) */}
      {isCustom && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-1 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs font-semibold text-muted-foreground">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs font-semibold text-muted-foreground">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                onStartDateChange("");
                onEndDateChange("");
                onPresetChange("all");
              }}
              title="Reset date filter"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
