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

export type ReportTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

export function SelectableReportTable<T extends { id: number }>({
  columns,
  rows,
  loading,
  emptyMessage,
  selectedIds,
  onToggle,
  allSelected,
  onToggleAll,
  rowLabel,
}: {
  columns: ReportTableColumn<T>[];
  rows: T[];
  loading: boolean;
  emptyMessage: string;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  rowLabel: (row: T) => string;
}) {
  if (loading) {
    return (
      <div className="p-5">
        <CardListSkeleton />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              disabled={!rows.length}
              aria-label="Select all rows"
            />
          </TableHead>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={column.align === "right" ? "text-right" : undefined}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-state={selectedIds.has(row.id) ? "selected" : undefined}>
            <TableCell>
              <Checkbox
                checked={selectedIds.has(row.id)}
                onCheckedChange={() => onToggle(row.id)}
                aria-label={`Select ${rowLabel(row)}`}
              />
            </TableCell>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                className={column.align === "right" ? "text-right" : undefined}
              >
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {!rows.length && (
          <TableRow>
            <TableCell
              colSpan={columns.length + 1}
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
