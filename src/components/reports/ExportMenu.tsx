"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";

export interface ExportMenuProps {
  endpoint?: string;
  selectedIds?: (number | string)[];
  selectedCount?: number;
  totalCount?: number;
  fileBaseName?: string;
  className?: string;
  triggerClassName?: string;
  emptyMessage?: string;
  buttonLabel?: string;
  pageSize?: ReportPageSize;
  orientation?: ReportOrientation;
  onExportCsv?: (scope?: "all" | "selected") => void;
  onExportPdf?: (scope?: "all" | "selected") => Promise<void> | void;
}

export function ExportMenu({
  endpoint,
  selectedIds = [],
  selectedCount,
  totalCount,
  fileBaseName = "klick-pro-report",
  className,
  triggerClassName,
  emptyMessage = "Select items to export",
  buttonLabel = "Download report",
  pageSize = "A4",
  orientation = "portrait",
  onExportCsv,
  onExportPdf,
}: ExportMenuProps) {
  const [downloading, setDownloading] = useState(false);

  const effectiveSelectedCount = selectedCount ?? selectedIds.length;

  async function handleDownload() {
    if (onExportPdf) {
      setDownloading(true);
      try {
        await onExportPdf(effectiveSelectedCount > 0 ? "selected" : "all");
      } catch (err) {
        toast.error("Failed to generate PDF export.");
      } finally {
        setDownloading(false);
      }
      return;
    }

    if (!endpoint) {
      if (onExportCsv) {
        onExportCsv(effectiveSelectedCount > 0 ? "selected" : "all");
        return;
      }
      toast.error(emptyMessage);
      return;
    }

    if (effectiveSelectedCount === 0 && selectedIds.length === 0) {
      toast.error(emptyMessage);
      return;
    }

    setDownloading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "selected",
          ids: selectedIds,
          pageSize,
          orientation,
        }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `klick-pro-${fileBaseName.replace(/^klick-pro-/, "")}.pdf`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "").trim();
        }
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF report downloaded successfully.");
    } catch (error) {
      console.error("Export download error:", error);
      toast.error("Unable to generate PDF at this time.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {onExportCsv && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onExportCsv(effectiveSelectedCount > 0 ? "selected" : "all")}
          className="gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-semibold"
          title="Export as CSV spreadsheet"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Export CSV</span>
          {effectiveSelectedCount > 0 ? (
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              {effectiveSelectedCount}
            </span>
          ) : null}
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={downloading}
        className={cn(
          "gap-1.5 rounded-xl border-border hover:bg-muted text-xs font-semibold transition-all",
          triggerClassName,
        )}
      >
        {downloading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Generating…</span>
          </>
        ) : (
          <>
            <FileDown className="h-3.5 w-3.5 text-primary" />
            <span>{buttonLabel}</span>
            {effectiveSelectedCount > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                {effectiveSelectedCount}
              </span>
            )}
          </>
        )}
      </Button>
    </div>
  );
}
