import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalizeFirst(value: string | null | undefined): string {
  if (!value) return "";
  const firstIndex = value.search(/\S/);
  if (firstIndex === -1) return value;
  return (
    value.slice(0, firstIndex) +
    value.charAt(firstIndex).toUpperCase() +
    value.slice(firstIndex + 1)
  );
}

export function formatReadableLabel(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = value.trim().replace(/_/g, " ");
  if (/[a-z]/.test(cleaned) && /[A-Z]/.test(cleaned) && !value.includes("_")) {
    return cleaned;
  }
  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const COMMON_PRESERVED_ACRONYMS = new Set([
  "SBI",
  "HDFC",
  "ICICI",
  "PNB",
  "BOB",
  "AXIS",
  "KOTAK",
  "IDFC",
  "NPCI",
  "UPI",
  "IMPS",
  "NEFT",
  "RTGS",
  "IFSC",
  "PAN",
  "GST",
  "IT",
  "ID",
  "OTP",
]);

/**
 * Capitalizes the first letter of each word in a string (Title Case).
 * Formats user names, bank names, account holders, cities, job titles, etc.
 * e.g., "juned ansari" -> "Juned Ansari"
 * e.g., "state bank of india" -> "State Bank Of India"
 */
export function capitalizeWords(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  return trimmed
    .split(/(\s+|-|\/)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === "-" || part === "/") return part;
      const upper = part.toUpperCase();
      if (COMMON_PRESERVED_ACRONYMS.has(upper)) return upper;
      // Preserve existing mixed-case tokens like McDonald, iPhone, etc. if intentional
      if (/[A-Z]/.test(part) && /[a-z]/.test(part) && !part.includes(" ")) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

/**
 * Unified formatter for user details across the website.
 * @param value String to format
 * @param mode "words" for proper nouns/names/titles/cities (default); "sentence" for descriptions/messages
 */
export function formatUserDetail(
  value: string | null | undefined,
  mode: "words" | "sentence" = "words",
): string {
  if (!value) return "";
  return mode === "sentence" ? capitalizeFirst(value) : capitalizeWords(value);
}

/**
 * Formats a project title into a clean, safe filename for PDF downloads.
 * Returns only the project name formatted safely (e.g. "Website-Redesign.pdf").
 */
export function formatProjectPdfFilename(
  title: string | null | undefined,
  fallback = "project",
): string {
  const raw = (title || fallback).trim();
  const sanitized = raw
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const base = sanitized || fallback;
  return `${base}.pdf`;
}

/**
 * Formats a currency amount in Indian Rupees (₹), returning an em dash ("—") if zero or empty.
 */
export function formatCurrencyNoZero(
  amount: number | string | null | undefined,
  options: { decimals?: number } = {},
): string {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return "—";
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: options.decimals ?? 0,
    maximumFractionDigits: options.decimals ?? 0,
  })}`;
}

/**
 * Formats a numeric count, returning an em dash ("—") if zero or empty.
 */
export function formatCountNoZero(
  count: number | string | null | undefined,
): string {
  if (count == null) return "—";
  const num = typeof count === "string" ? parseInt(String(count), 10) : count;
  if (isNaN(num) || num <= 0) return "—";
  return num.toLocaleString("en-IN");
}

/**
 * Formats a percentage value, returning an em dash ("—") if zero or empty.
 */
export function formatPercentageNoZero(
  percent: number | string | null | undefined,
): string {
  if (percent == null) return "—";
  const num = typeof percent === "string" ? parseFloat(String(percent)) : percent;
  if (isNaN(num) || num <= 0) return "—";
  return `${Math.round(num)}%`;
}


