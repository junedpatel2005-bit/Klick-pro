/**
 * Universal CSV Export Utility for Klick-Pro
 *
 * Implements RFC-4180 compliant CSV serialization with:
 * - UTF-8 Byte Order Mark (\uFEFF) for native Excel on Windows Unicode rendering (prevents corrupted characters like â‚¹)
 * - Proper escaping of quotes, commas, and line breaks
 * - CSV injection prevention (mitigates spreadsheet formula injection on =, +, -, @)
 * - Optional executive summary metadata banner at the top of the statement
 */

export type CsvMetadataEntry = {
  label: string;
  value: string | number;
};

export type CsvExportOptions = {
  filename: string;
  title?: string;
  metadata?: CsvMetadataEntry[];
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  includeMetadataBanner?: boolean;
};

function sanitizeCell(value: unknown): string {
  if (value == null) return '""';
  if (typeof value === "number" && !isNaN(value)) {
    return String(value);
  }
  let stringValue = String(value);

  // CSV formula injection protection: if cell starts with =, +, -, or @ (and not a clean negative number)
  if (/^[=+@\t\r]/.test(stringValue) || (/^-/.test(stringValue) && !/^-\d+(\.\d+)?$/.test(stringValue.trim()))) {
    stringValue = `'${stringValue}`;
  }

  // Escape double quotes by doubling them
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsvContent(options: CsvExportOptions): string {
  const lines: string[] = [];

  const websiteTitle = options.title
    ? `Klick-Pro · ${options.title}`
    : "Klick-Pro Enterprise Platform · Official Statement";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const dateLine = `Generated Date: ${dateStr}, ${timeStr} IST`;

  // Line 1: Website Name
  lines.push(sanitizeCell(websiteTitle));
  // Line 2: Date
  lines.push(sanitizeCell(dateLine));
  // Line 3: Blank separator row
  lines.push('""');

  // Line 4: Column headers always line up cleanly
  lines.push(options.headers.map(sanitizeCell).join(","));

  // Line 5+: Exact data rows (1 row if 1 selected, 10 rows if 10 selected)
  for (const row of options.rows) {
    lines.push(row.map(sanitizeCell).join(","));
  }

  return lines.join("\r\n");
}

export function downloadCsvFile(options: CsvExportOptions): void {
  if (typeof window === "undefined") return;

  const csvContent = generateCsvContent(options);
  // Prepend UTF-8 BOM so Excel opens with proper UTF-8 font and character encoding
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeBaseName = options.filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  link.setAttribute("href", url);
  link.setAttribute("download", `${safeBaseName}-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
