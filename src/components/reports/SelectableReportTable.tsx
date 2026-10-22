"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardListSkeleton } from "@/components/LoadingSkeleton";
import { cn } from "@/lib/utils";

export type ReportTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

export function SelectableReportTable<T extends { id: number | string }>({
  columns,
  rows,
  loading,
  emptyMessage,
  selectedIds,
  onToggle,
  allSelected,
  onToggleAll,
  rowLabel,
  getRowKey,
  selectable = false,
}: {
  columns: ReportTableColumn<T>[];
  rows: T[];
  loading: boolean;
  emptyMessage: string;
  selectedIds?: Set<T["id"]>;
  onToggle?: (id: T["id"]) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
  rowLabel?: (row: T) => string;
  getRowKey?: (row: T, index: number) => string | number;
  selectable?: boolean;
}) {
  if (loading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && <TableHead className="w-10" />}
            {columns.map((column, colIdx) => (
              <TableHead
                key={column.key}
                className={cn(
                  "whitespace-nowrap px-3 sm:px-4 text-xs font-semibold tracking-wide",
                  column.align === "right" && "text-right",
                  colIdx === columns.length - 1 && "pr-5 sm:pr-6",
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, rIdx) => (
            <TableRow key={rIdx} className="animate-pulse border-b border-border/40">
              {selectable && (
                <TableCell className="w-10 py-3.5">
                  <div className="h-4 w-4 rounded bg-muted/60" />
                </TableCell>
              )}
              {columns.map((column, colIdx) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "px-3 sm:px-4 py-3.5",
                    column.align === "right" && "text-right",
                    colIdx === columns.length - 1 && "pr-5 sm:pr-6",
                  )}
                >
                  <div
                    className={cn(
                      "h-4 rounded bg-muted/60",
                      column.align === "right"
                        ? "ml-auto w-16"
                        : colIdx === 0
                        ? "w-24"
                        : colIdx === 1
                        ? "w-44 max-w-[85%]"
                        : "w-28",
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ?? false}
                onCheckedChange={() => onToggleAll?.()}
                disabled={!rows.length}
                aria-label="Select all rows"
              />
            </TableHead>
          )}
          {columns.map((column, colIdx) => (
            <TableHead
              key={column.key}
              className={cn(
                "whitespace-nowrap px-3 sm:px-4 text-xs font-semibold tracking-wide",
                column.align === "right" && "text-right",
                colIdx === columns.length - 1 && "pr-5 sm:pr-6",
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const rowKey =
            (getRowKey ? getRowKey(row, index) : null) ??
            (row as { key?: string | number }).key ??
            (row.id != null ? `${row.id}-${index}` : index);
          const isSelected = selectable && selectedIds ? selectedIds.has(row.id) : false;
          return (
            <TableRow
              key={rowKey}
              data-state={isSelected ? "selected" : undefined}
              onClick={(e) => {
                if (!selectable || !onToggle) return;
                const target = e.target as HTMLElement | null;
                if (
                  target &&
                  target.closest(
                    'button, a, input[type="text"], [role="button"], select, textarea, [data-prevent-row-select]',
                  )
                ) {
                  return;
                }
                onToggle(row.id);
              }}
              className={cn(
                "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 select-none",
                selectable && "cursor-pointer data-[state=selected]:bg-indigo-50/40 dark:data-[state=selected]:bg-indigo-950/25",
              )}
            >
              {selectable && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle?.(row.id)}
                    aria-label={`Select ${rowLabel ? rowLabel(row) : String(row.id)}`}
                  />
                </TableCell>
              )}
              {columns.map((column, colIdx) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "px-3 sm:px-4",
                    column.align === "right" && "text-right",
                    colIdx === columns.length - 1 && "pr-5 sm:pr-6",
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
        {!rows.length && (
          <TableRow>
            <TableCell
              colSpan={selectable ? columns.length + 1 : columns.length}
              className="py-10 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
