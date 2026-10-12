"use client";

import * as React from "react";
import Link from "next/link";
import { Info, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MiniInfoProps {
  /** Title shown at the top of the mini box */
  title?: string;
  /** Main explanation text or custom content */
  description: React.ReactNode;
  /** URL for the "Go there" button */
  href?: string;
  /** Custom click handler for the action button */
  onAction?: () => void;
  /** Label for the action button (default: "Go there") */
  actionLabel?: string;
  /** Alignment of the popover relative to the icon: "left" or "right" (default: "left") */
  align?: "left" | "right";
  /** Size of the round (i) icon: "sm" (16px) or "md" (20px) (default: "sm") */
  size?: "sm" | "md";
  /** Additional styling for the trigger wrapper */
  className?: string;
}

export function MiniInfo({
  title = "Information",
  description,
  href,
  onAction,
  actionLabel = "Go there",
  align = "left",
  size = "sm",
  className,
}: MiniInfoProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses =
    size === "sm"
      ? "h-4 w-4 text-[10px]"
      : "h-5 w-5 text-xs";

  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center", className)}
    >
      {/* Round (i) Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={title}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted/30 text-muted-foreground transition-all duration-150 hover:border-primary/60 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer",
          sizeClasses,
          isOpen && "border-primary bg-primary/15 text-primary ring-2 ring-primary/20",
        )}
      >
        <Info className={iconSize} />
      </button>

      {/* Floating Mini Box */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={title}
          className={cn(
            "absolute z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-xl shadow-black/10 dark:shadow-black/40 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0",
            "top-full",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Info className="h-2.5 w-2.5" />
              </span>
              <h4 className="text-xs font-bold text-foreground truncate">
                {title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Description */}
          <div className="mt-2 text-xs text-muted-foreground leading-relaxed break-words">
            {typeof description === "string" ? (
              <p>{description}</p>
            ) : (
              description
            )}
          </div>

          {/* Action "Go there" button / link */}
          {(href || onAction) && (
            <div className="mt-3 border-t border-border/60 pt-2.5 flex items-center justify-end">
              {href ? (
                <Link
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  <span>{actionLabel}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAction?.();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <span>{actionLabel}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
