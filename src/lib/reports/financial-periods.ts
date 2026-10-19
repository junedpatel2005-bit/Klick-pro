/**
 * Indian Financial Year & Period Calculations for Klick-Pro Reporting
 * Default: 1 April - 31 March (e.g., FY 2026-27 is 2026-04-01 to 2027-03-31)
 */

export type DateSystem = "INDIAN_FY" | "CALENDAR_YEAR" | "CUSTOM";

export type IndianQuarter = "ALL" | "Q1" | "Q2" | "Q3" | "Q4";

export type DateBasis =
  | "EVENT_DATE"
  | "POSTING_DATE"
  | "SETTLEMENT_DATE"
  | "INVOICE_DATE";

export interface PeriodSelection {
  system: DateSystem;
  financialYear: string; // e.g. "2026-27"
  quarter: IndianQuarter;
  dateBasis: DateBasis;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  label: string;
}

/**
 * Get current Indian Financial Year string (e.g. "2026-27")
 */
export function getCurrentIndianFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
}

/**
 * Available Indian Financial Years for selection (last 4 years + current)
 */
export function getAvailableFinancialYears(): string[] {
  const current = getCurrentIndianFinancialYear();
  const currentStartYear = parseInt(current.split("-")[0]!, 10);
  const years: string[] = [];
  for (let y = currentStartYear; y >= currentStartYear - 4; y--) {
    const endShort = String((y + 1) % 100).padStart(2, "0");
    years.push(`${y}-${endShort}`);
  }
  return years;
}

/**
 * Calculate half-open date boundaries for an Indian Financial Year and Quarter
 */
export function getFinancialYearBounds(
  fyString: string,
  quarter: IndianQuarter = "ALL",
): { startDate: string; endDate: string; label: string } {
  const startYear = parseInt(fyString.split("-")[0]!, 10);
  const nextYear = startYear + 1;

  switch (quarter) {
    case "Q1": // Apr 1 - Jun 30
      return {
        startDate: `${startYear}-04-01`,
        endDate: `${startYear}-06-30`,
        label: `FY ${fyString} Q1 (Apr–Jun ${startYear})`,
      };
    case "Q2": // Jul 1 - Sep 30
      return {
        startDate: `${startYear}-07-01`,
        endDate: `${startYear}-09-30`,
        label: `FY ${fyString} Q2 (Jul–Sep ${startYear})`,
      };
    case "Q3": // Oct 1 - Dec 31
      return {
        startDate: `${startYear}-10-01`,
        endDate: `${startYear}-12-31`,
        label: `FY ${fyString} Q3 (Oct–Dec ${startYear})`,
      };
    case "Q4": // Jan 1 - Mar 31 of nextYear
      return {
        startDate: `${nextYear}-01-01`,
        endDate: `${nextYear}-03-31`,
        label: `FY ${fyString} Q4 (Jan–Mar ${nextYear})`,
      };
    case "ALL":
    default:
      return {
        startDate: `${startYear}-04-01`,
        endDate: `${nextYear}-03-31`,
        label: `FY ${fyString} Full Year (1 Apr ${startYear} – 31 Mar ${nextYear})`,
      };
  }
}

/**
 * Checks whether a given timestamp falls within the selected period boundaries
 */
export function isDateWithinPeriod(
  dateInput: string | Date | null | undefined,
  periodOrStart: PeriodSelection | string,
  maybeEnd?: string,
): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;

  const startDateStr =
    typeof periodOrStart === "string" ? periodOrStart : periodOrStart.startDate;
  const endDateStr =
    typeof periodOrStart === "string" ? (maybeEnd ?? periodOrStart) : periodOrStart.endDate;

  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T23:59:59.999Z`);

  return d >= start && d <= end;
}

/**
 * Format Indian currency with rupees (₹) and lakh / crore system
 */
export function formatINR(
  amount: number | null | undefined,
  options: { showSymbol?: boolean; decimals?: number } = {},
): string {
  const val = amount ?? 0;
  const showSymbol = options.showSymbol ?? true;
  const decimals = options.decimals ?? 0;

  const formatted = val.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Human readable label for Date Basis
 */
export function getDateBasisLabel(basis: DateBasis): string {
  switch (basis) {
    case "EVENT_DATE":
      return "Financial Event Date (Delivery/Approval)";
    case "POSTING_DATE":
      return "Ledger Posting Date (Accounting)";
    case "SETTLEMENT_DATE":
      return "Bank / UPI Settlement Date";
    case "INVOICE_DATE":
      return "Invoice Issue Date";
  }
}
