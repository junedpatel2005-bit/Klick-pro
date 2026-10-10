"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";

export interface ExportMenuProps {
  endpoint: string;
  selectedIds: number[];
  fileBaseName: string;
  className?: string;
  triggerClassName?: string;
  emptyMessage?: string;
  buttonLabel?: string;
  pageSize?: ReportPageSize;
  orientation?: ReportOrientation;
  onExportCsv?: (scope: "all" | "selected") => void;
}

export function ExportMenu({
  endpoint,
  selectedIds,
  fileBaseName,
  className,
  triggerClassName,
  emptyMessage = "Select project first",
  buttonLabel = "Download report",
  pageSize = "A4",
  orientation = "portrait",
  onExportCsv,
}: ExportMenuProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!selectedIds || selectedIds.length === 0) {
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

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully");
    } catch {
      toast.error("The report could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className={cn("gap-2", triggerClassName)}
        title={selectedIds.length === 0 ? emptyMessage : "Download selected report"}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{downloading ? "Preparing report…" : buttonLabel}</span>
      </Button>
    </div>
  );
}
