"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "klickpro:sidebar-collapsed";

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Sync initial state from localStorage on mount (safe against SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === "true");
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  // Listen to cross-tab storage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setCollapsed(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore storage error */
      }
      return next;
    });
  }, []);

  const setCollapseState = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore storage error */
    }
  }, []);

  return { collapsed, toggle, setCollapseState };
}
