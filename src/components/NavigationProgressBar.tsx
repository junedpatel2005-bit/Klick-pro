"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, navigation has finished
  useEffect(() => {
    if (navigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams, navigating]);

  useEffect(() => {
    // Intercept clicks on internal links to start progress immediately
    const handleClick = (e: MouseEvent) => {
      // Ignore modified clicks (cmd, ctrl, shift, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;

      const isExternal =
        target.target === "_blank" ||
        target.rel?.includes("external") ||
        !target.href.startsWith(window.location.origin);
      if (isExternal) return;

      try {
        const url = new URL(target.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }

        setNavigating(true);
        setProgress(35);

        const interval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 85) {
              clearInterval(interval);
              return prev;
            }
            return prev + Math.random() * 12;
          });
        }, 180);

        setTimeout(() => clearInterval(interval), 6000);
      } catch {
        // Ignore invalid URLs
      }
    };

    window.addEventListener("click", handleClick, { capture: true });
    return () => window.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!navigating && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-1 overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-primary to-cyan-400 shadow-[0_0_12px_rgba(99,102,241,0.8)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarInner />
    </Suspense>
  );
}
