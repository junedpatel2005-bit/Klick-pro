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
  let stringValue = String(value);

  // CSV formula injection protection: if cell starts with =, +, -, or @, prefix with a single quote
  if (/^[=+\-@\t\r]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }

  // Escape double quotes by doubling them
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsvContent(options: CsvExportOptions & { includeMetadataBanner?: boolean }): string {
  const lines: string[] = [];

  // When metadata banner is explicitly enabled, pad each row to match total column count
  if (options.includeMetadataBanner) {
    if (options.title) {
      const titleLine = [sanitizeCell(`KLICK-PRO · ${options.title.toUpperCase()}`)];
      while (titleLine.length < options.headers.length) titleLine.push('""');
      lines.push(titleLine.join(","));

      const generatedLine = [
        sanitizeCell("Generated At"),
        sanitizeCell(`${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`),
      ];
      while (generatedLine.length < options.headers.length) generatedLine.push('""');
      lines.push(generatedLine.join(","));
    }

    if (options.metadata && options.metadata.length > 0) {
      for (const entry of options.metadata) {
        const metaLine = [sanitizeCell(entry.label), sanitizeCell(entry.value)];
        while (metaLine.length < options.headers.length) metaLine.push('""');
        lines.push(metaLine.join(","));
      }
      lines.push(new Array(options.headers.length).fill('""').join(","));
    }
  }

  // Column headers always line up cleanly
  lines.push(options.headers.map(sanitizeCell).join(","));

  // Data rows
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
