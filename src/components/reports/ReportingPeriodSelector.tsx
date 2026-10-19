"use client";

import { useMemo } from "react";
import { Calendar, SlidersHorizontal, Info, Clock } from "lucide-react";
import {
  type DateSystem,
  type IndianQuarter,
  type DateBasis,
  type PeriodSelection,
  getCurrentIndianFinancialYear,
  getAvailableFinancialYears,
  getFinancialYearBounds,
  getDateBasisLabel,
} from "@/lib/reports/financial-periods";

interface ReportingPeriodSelectorProps {
  value: PeriodSelection;
  onChange: (value: PeriodSelection) => void;
  className?: string;
  hideDateBasis?: boolean;
  availableYears?: string[];
}

export function ReportingPeriodSelector({
  value,
  onChange,
  className = "",
  hideDateBasis = false,
  availableYears: availableYearsProp,
}: ReportingPeriodSelectorProps) {
  const availableYears = useMemo(
    () => availableYearsProp ?? getAvailableFinancialYears(),
    [availableYearsProp],
  );

  const handleSystemChange = (system: DateSystem) => {
    if (system === "INDIAN_FY") {
      const bounds = getFinancialYearBounds(value.financialYear, value.quarter);
      onChange({
        ...value,
        system,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        label: bounds.label,
      });
    } else if (system === "CALENDAR_YEAR") {
      const currentYear = new Date().getFullYear();
      onChange({
        ...value,
        system,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`,
        label: `Calendar Year ${currentYear}`,
      });
    } else {
      onChange({
        ...value,
        system,
        label: `Custom: ${value.startDate} to ${value.endDate}`,
      });
    }
  };

  const handleYearChange = (financialYear: string) => {
    const bounds = getFinancialYearBounds(financialYear, value.quarter);
    onChange({
      ...value,
      financialYear,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      label: bounds.label,
    });
  };

  const handleQuarterChange = (quarter: IndianQuarter) => {
    const bounds = getFinancialYearBounds(value.financialYear, quarter);
    onChange({
      ...value,
      quarter,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      label: bounds.label,
    });
  };

  const handleDateBasisChange = (dateBasis: DateBasis) => {
    onChange({
      ...value,
      dateBasis,
    });
  };

  const handleCustomStart = (startDate: string) => {
    onChange({
      ...value,
      startDate,
      label: `Custom: ${startDate} to ${value.endDate}`,
    });
  };

  const handleCustomEnd = (endDate: string) => {
    onChange({
      ...value,
      endDate,
      label: `Custom: ${value.startDate} to ${endDate}`,
    });
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all ${className}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Date System Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/60 p-1">
          <button
            type="button"
            onClick={() => handleSystemChange("INDIAN_FY")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              value.system === "INDIAN_FY"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Indian Financial Year
          </button>
          <button
            type="button"
            onClick={() => handleSystemChange("CALENDAR_YEAR")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              value.system === "CALENDAR_YEAR"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calendar Year
          </button>
          <button
            type="button"
            onClick={() => handleSystemChange("CUSTOM")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              value.system === "CUSTOM"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Primary Filtering Controls based on System */}
      <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
        {value.system === "INDIAN_FY" && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Year:</span>
              <select
                value={value.financialYear.replace(/^FY\s*/i, "")}
                onChange={(e) => handleYearChange(e.target.value.replace(/^FY\s*/i, ""))}
                className="h-8.5 rounded-lg border border-input bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {availableYears.map((fy) => {
                  const cleanYear = fy.replace(/^FY\s*/i, "");
                  return (
                    <option key={cleanYear} value={cleanYear}>
                      {cleanYear}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quarter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: "ALL", label: "Full Year" },
                { key: "Q1", label: "Q1 (Apr–Jun)" },
                { key: "Q2", label: "Q2 (Jul–Sep)" },
                { key: "Q3", label: "Q3 (Oct–Dec)" },
                { key: "Q4", label: "Q4 (Jan–Mar)" },
              ].map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => handleQuarterChange(q.key as IndianQuarter)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    value.quarter === q.key
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {value.system === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">From:</span>
              <input
                type="date"
                value={value.startDate}
                onChange={(e) => handleCustomStart(e.target.value)}
                className="h-8.5 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">To:</span>
              <input
                type="date"
                value={value.endDate}
                onChange={(e) => handleCustomEnd(e.target.value)}
                className="h-8.5 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Effective Range Display Badge */}
        <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground">{value.label}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-medium text-primary">
            {value.startDate} to {value.endDate}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Default initial period selection for Indian Financial Year
 */
export function getDefaultPeriodSelection(): PeriodSelection {
  const fy = getCurrentIndianFinancialYear();
  const bounds = getFinancialYearBounds(fy, "ALL");
  return {
    system: "INDIAN_FY",
    financialYear: fy,
    quarter: "ALL",
    dateBasis: "EVENT_DATE",
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    label: bounds.label,
  };
}
