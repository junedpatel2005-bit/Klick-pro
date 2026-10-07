"use client";

import { useMemo, useState } from "react";

export function useRowSelection<T extends { id: number }>(visibleRows: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = useMemo(
    () => visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id)),
    [visibleRows, selectedIds],
  );

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleRows.forEach((row) => next.delete(row.id));
      else visibleRows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  function clear() {
    setSelectedIds(new Set());
  }

  return { selectedIds, toggle, allVisibleSelected, toggleAllVisible, clear };
}
