"use client";

import { useState } from "react";
import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";

export function ExportMenu({
  endpoint,
  selectedIds,
  fileBaseName,
  className,
  triggerClassName,
}: {
  endpoint: string;
  selectedIds: number[];
  fileBaseName: string;
  className?: string;
  triggerClassName?: string;
}) {
  const [pageSize, setPageSize] = useState<ReportPageSize>("A4");
  const [orientation, setOrientation] = useState<ReportOrientation>("portrait");
  const [downloading, setDownloading] = useState<"all" | "selected" | null>(null);
  const [error, setError] = useState("");

  async function download(scope: "all" | "selected") {
    setError("");
    setDownloading(scope);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          ids: scope === "selected" ? selectedIds : undefined,
          pageSize,
          orientation,
        }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileBaseName}-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("The report could not be generated. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("gap-2", triggerClassName)}>
            <FileDown className="h-4 w-4" />
            Download report
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Page options</DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-xs text-muted-foreground">Page size</span>
            <div className="flex overflow-hidden rounded-md border border-input">
              {(["A4", "LETTER"] satisfies ReportPageSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={cn(
                    "px-2 py-1 text-xs",
                    pageSize === size
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-xs text-muted-foreground">Orientation</span>
            <div className="flex overflow-hidden rounded-md border border-input">
              {(["portrait", "landscape"] satisfies ReportOrientation[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrientation(value)}
                  className={cn(
                    "px-2 py-1 text-xs capitalize",
                    orientation === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={downloading !== null}
            onSelect={(event) => {
              event.preventDefault();
              void download("all");
            }}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading === "all" ? "Preparing…" : "Download all"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={downloading !== null || selectedIds.length === 0}
            onSelect={(event) => {
              event.preventDefault();
              void download("selected");
            }}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading === "selected"
              ? "Preparing…"
              : `Download selected${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
          </DropdownMenuItem>
          {error ? <p className="px-2 py-1.5 text-xs text-destructive">{error}</p> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
