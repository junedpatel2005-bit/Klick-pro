/**
 * Universal CSV Export Utility for Klick-Pro
 *
 * Implements RFC-4180 compliant CSV serialization with:
 * - UTF-8 Byte Order Mark (\uFEFF) for native Excel on Windows Unicode rendering
 * - Proper escaping of quotes, commas, and line breaks (\r\n)
 * - CSV injection prevention (mitigates spreadsheet formula injection on =, +, -, @)
 * - Support for multi-section statements with headers, participant info, milestones, and financial summaries
 */

import { capitalizeWords, capitalizeFirst, formatCurrencyNoZero, formatDateSafely } from "@/lib/utils";

export type CsvMetadataEntry = {
  label: string;
  value: string | number;
};

export type CsvSection = {
  title?: string;
  headers?: string[];
  rows: (string | number | boolean | null | undefined)[][];
};

export type CsvExportOptions = {
  filename: string;
  title?: string;
  metadata?: CsvMetadataEntry[];
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
  sections?: CsvSection[];
  includeMetadataBanner?: boolean;
};

export function sanitizeCell(value: unknown): string {
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

  // Line 1: Header / Document Title
  lines.push(sanitizeCell(websiteTitle));
  // Line 2: Generation Timestamp
  lines.push(sanitizeCell(dateLine));
  // Line 3: Blank separator row
  lines.push('""');

  // Metadata entries (if any)
  if (options.metadata && options.metadata.length > 0) {
    for (const entry of options.metadata) {
      lines.push(`${sanitizeCell(entry.label)},${sanitizeCell(entry.value)}`);
    }
    lines.push('""');
  }

  // Multi-section structured tables (e.g. Project Specs, Parties, Milestones, Ledger)
  if (options.sections && options.sections.length > 0) {
    for (const section of options.sections) {
      if (section.title) {
        lines.push(sanitizeCell(`=== ${section.title.toUpperCase()} ===`));
      }
      if (section.headers && section.headers.length > 0) {
        lines.push(section.headers.map(sanitizeCell).join(","));
      }
      for (const row of section.rows) {
        lines.push(row.map(sanitizeCell).join(","));
      }
      lines.push('""');
    }
  }

  // Fallback / standard single-table rows
  if (options.headers && options.headers.length > 0) {
    lines.push(options.headers.map(sanitizeCell).join(","));
    if (options.rows) {
      for (const row of options.rows) {
        lines.push(row.map(sanitizeCell).join(","));
      }
    }
  }

  return lines.join("\r\n");
}

export function downloadCsvFile(options: CsvExportOptions): void {
  if (typeof window === "undefined") return;

  const csvContent = generateCsvContent(options);
  // Prepend UTF-8 BOM so Excel opens with proper character encoding
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

// ---------------------------------------------------------------------------
// RICH STATEMENT EXPORTERS (Matching full PDF Dossier & Invoice Details)
// ---------------------------------------------------------------------------

export type ProjectDossierCsvParams = {
  projectId: number | string;
  projectTitle: string;
  category?: string | null;
  status: string;
  agreedAmount?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  workMode?: string | null;
  locationAddress?: string | null;
  deadline?: string | null;
  createdAt?: string | null;
  client?: {
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  professional?: {
    name?: string | null;
    category?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
  milestones?: Array<{
    id?: number;
    title: string;
    percentage?: number | null;
    amount?: number | null;
    validityDays?: number | null;
    status?: string | null;
    paymentStatus?: string | null;
  }> | null;
};

export function exportProjectDossierCsv(params: ProjectDossierCsvParams): void {
  const sections: CsvSection[] = [];

  // 1. Project Specifications
  const specsRows: (string | number)[][] = [
    ["Platform", "Klick-Pro Enterprise Service Platform (Verified Digital Record)"],
    ["Project Scope / Title", capitalizeWords(params.projectTitle || `Project #${params.projectId}`)],
    ["Project Reference #", `#PRJ-${params.projectId}`],
    ["Service Category", capitalizeWords(params.category || "General Services")],
    ["Engagement Status", capitalizeWords(params.status || "In Progress")],
    [
      "Contract / Agreed Value (INR)",
      params.agreedAmount != null
        ? formatCurrencyNoZero(params.agreedAmount)
        : params.budgetMax != null
          ? `${formatCurrencyNoZero(params.budgetMin || 0)} - ${formatCurrencyNoZero(params.budgetMax)}`
          : "—",
    ],
    ["Work Delivery Mode", capitalizeWords(params.workMode || "Both (On-Site / Remote)")],
    ["Service Location", capitalizeWords(params.locationAddress || "Specified on Engagement")],
    ["Target Completion Deadline", params.deadline ? formatDateSafely(params.deadline) : "Flexible / Milestone-Driven"],
    ["Date Established", formatDateSafely(params.createdAt)],
  ];

  sections.push({
    title: "Project Specification & Overview",
    headers: ["Attribute / Specification", "Details"],
    rows: specsRows,
  });

  // 2. Engagement Parties (Client & Professional)
  const clientName = capitalizeWords(params.client?.name || "Direct Client");
  const clientCompany = capitalizeWords(params.client?.companyName || "Private Client");
  const clientContact = [params.client?.email, params.client?.phone, capitalizeWords(params.client?.address || "")]
    .filter(Boolean)
    .join(" · ") || "Verified Client Profile";

  const proName = capitalizeWords(params.professional?.name || "Assigned Professional");
  const proTrade = capitalizeWords(params.professional?.category || params.category || "Certified Professional");
  const proContact = [params.professional?.email, params.professional?.phone, capitalizeWords(params.professional?.city || "")]
    .filter(Boolean)
    .join(" · ") || "Verified Professional Contractor";

  sections.push({
    title: "Engagement Parties & Counterparts",
    headers: ["Party Role", "Full Name", "Company / Trade Specialization", "Contact Information & Location"],
    rows: [
      ["Client / Employer", clientName, clientCompany, clientContact],
      ["Professional Contractor", proName, proTrade, proContact],
    ],
  });

  // 3. Milestone Schedule & Deliverables
  if (params.milestones && params.milestones.length > 0) {
    const milestoneRows = params.milestones.map((m, idx) => [
      idx + 1,
      capitalizeWords(m.title),
      m.percentage != null ? `${m.percentage}%` : "—",
      m.amount != null ? formatCurrencyNoZero(m.amount) : "—",
      m.validityDays != null ? `${m.validityDays} Days` : "Standard",
      capitalizeWords(m.status || "Pending"),
      capitalizeWords(m.paymentStatus || (m.status === "APPROVED" || m.status === "COMPLETED" ? "Paid & Settled" : "Secured in Escrow")),
    ]);

    sections.push({
      title: "Milestone Schedule & Deliverable Status",
      headers: [
        "Milestone #",
        "Deliverable Scope",
        "Allocation %",
        "Amount (INR)",
        "Review Validity",
        "Milestone Status",
        "Escrow Settlement",
      ],
      rows: milestoneRows,
    });
  }

  // 4. Financial Ledger Summary
  const contractTotal = params.agreedAmount != null ? formatCurrencyNoZero(params.agreedAmount) : "—";
  sections.push({
    title: "Financial Ledger & Escrow Settlement",
    headers: ["Ledger Account", "Amount (INR)", "Settlement Classification"],
    rows: [
      ["Total Contract Commitment", contractTotal, "Agreed & Contracted via Escrow"],
      ["Platform Assurance Guarantee", "Active", "100% Escrow Protection via Razorpay"],
    ],
  });

  downloadCsvFile({
    filename: `klick-pro-project-${params.projectId}-statement`,
    title: `Project Engagement Statement #${params.projectId}`,
    sections,
    headers: [],
    rows: [],
  });
}

export type PaymentReceiptCsvParams = {
  paymentId: number | string;
  invoiceNumber?: string | null;
  createdAt: string | Date;
  status: string;
  description?: string | null;
  projectTitle?: string | null;
  milestoneTitle?: string | null;
  amount: number;
  baseAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  paymentMethod?: string | null;
  razorpayPaymentId?: string | null;
  clientName?: string | null;
  clientCompany?: string | null;
  clientEmail?: string | null;
  professionalName?: string | null;
  professionalTrade?: string | null;
  professionalEmail?: string | null;
};

export function exportPaymentReceiptCsv(params: PaymentReceiptCsvParams): void {
  const sections: CsvSection[] = [];

  // 1. Transaction Overview
  const refNum = params.invoiceNumber ? `#${params.invoiceNumber}` : `#PAY-${params.paymentId}`;
  sections.push({
    title: "Tax Invoice & Transaction Overview",
    headers: ["Receipt Property", "Particulars"],
    rows: [
      ["Platform Issuer", "Klick-Pro Enterprise Platform (Certified Digital Receipt)"],
      ["Invoice / Receipt Ref #", refNum],
      ["Date Recorded / Issued", formatDateSafely(params.createdAt)],
      ["Transaction Status", capitalizeWords(params.status)],
      ["Payment Settlement Method", capitalizeWords(params.paymentMethod || "Platform Escrow Transfer")],
      ["Gateway Reference ID", params.razorpayPaymentId || "KLK-ESCROW-SETTLEMENT"],
    ],
  });

  // 2. Transaction Parties
  sections.push({
    title: "Parties to Transaction",
    headers: ["Transaction Role", "Full Name", "Company / Trade", "Contact Information"],
    rows: [
      [
        "Billed To (Client)",
        capitalizeWords(params.clientName || "Direct Client"),
        capitalizeWords(params.clientCompany || "Client Employer"),
        params.clientEmail || "—",
      ],
      [
        "Paid To (Professional)",
        capitalizeWords(params.professionalName || "Assigned Professional"),
        capitalizeWords(params.professionalTrade || "Registered Contractor"),
        params.professionalEmail || "—",
      ],
    ],
  });

  // 3. Particulars & Settlement Breakdown
  const particularDesc = capitalizeFirst(
    params.description || params.milestoneTitle || "Project Deliverable Settlement",
  );
  const projTitle = capitalizeWords(params.projectTitle || "Service Project");
  const grossVal = formatCurrencyNoZero(params.baseAmount ?? params.amount);
  const feeVal = params.feeAmount != null && params.feeAmount > 0 ? formatCurrencyNoZero(params.feeAmount) : "₹0";
  const netVal = formatCurrencyNoZero(params.netAmount ?? params.amount);

  sections.push({
    title: "Deliverable & Financial Settlement Breakdown",
    headers: [
      "Item / Deliverable Description",
      "Associated Project",
      "Gross Amount (INR)",
      "Platform Fee / Commission",
      "Net Settlement (INR)",
    ],
    rows: [[particularDesc, projTitle, grossVal, feeVal, netVal]],
  });

  downloadCsvFile({
    filename: `klick-pro-receipt-${params.invoiceNumber || params.paymentId}`,
    title: `Official Tax Invoice & Receipt ${refNum}`,
    sections,
    headers: [],
    rows: [],
  });
}
