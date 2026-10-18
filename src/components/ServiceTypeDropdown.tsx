"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import {
  Home,
  Building2,
  Factory,
  HeartPulse,
  Sparkles,
  GraduationCap,
  ChevronDown,
  Check,
  Layers,
} from "lucide-react";
import type { MarketplaceCategory } from "@/lib/types/marketplace";
import { capitalizeWords, cn } from "@/lib/utils";

export interface ServiceTypeOption {
  id: string;
  title: string;
  tag: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  badgeClass: string;
}

export const SERVICE_TYPES: ServiceTypeOption[] = [
  {
    id: "RESIDENTIAL",
    title: "Residential",
    tag: "Home",
    icon: Home,
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconBorder: "border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  {
    id: "COMMERCIAL",
    title: "Commercial",
    tag: "Office",
    icon: Building2,
    iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
    iconBorder: "border-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  },
  {
    id: "INDUSTRIAL",
    title: "Industrial",
    tag: "Industry",
    icon: Factory,
    iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    iconBorder: "border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  },
  {
    id: "HEALTH_CARE",
    title: "Health Care",
    tag: "Medical",
    icon: HeartPulse,
    iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
    iconBorder: "border-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  },
  {
    id: "PERSONAL_CARE",
    title: "Personal Care",
    tag: "Care",
    icon: Sparkles,
    iconBg: "bg-purple-500/10 dark:bg-purple-500/20",
    iconBorder: "border-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
  },
  {
    id: "EDUCATION",
    title: "Education",
    tag: "School",
    icon: GraduationCap,
    iconBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    iconBorder: "border-cyan-500/20",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60",
  },
];

export interface ServiceTypeDropdownProps {
  value: string;
  onChange: (value: string) => void;
  categories?: MarketplaceCategory[];
  error?: string;
  className?: string;
  disabled?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
}

export function ServiceTypeDropdown({
  value,
  onChange,
  error,
  className,
  disabled = false,
  allowAll = false,
  allLabel = "All Service Types",
  placeholder = "Select Service Type...",
}: ServiceTypeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Find currently selected option
  const selectedOption = useMemo(
    () => SERVICE_TYPES.find((opt) => opt.id === value) || null,
    [value],
  );

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    if (allowAll && optionId === value) {
      onChange("");
    } else {
      onChange(optionId);
    }
    setIsOpen(false);
  };

  const SelectedIcon = selectedOption ? selectedOption.icon : null;
  const isAllSelected = allowAll && (!value || value === "");

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Sleek Single-Line Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        className={cn(
          "group relative flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left transition-all duration-150 outline-none",
          isOpen
            ? "border-primary ring-2 ring-primary/20 shadow-xs"
            : error
              ? "border-destructive ring-1 ring-destructive/30"
              : "border-input hover:border-foreground/30 hover:bg-accent/[0.02] shadow-xs",
          disabled && "cursor-not-allowed opacity-60 bg-muted/30",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption && SelectedIcon ? (
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                selectedOption.iconBg,
                selectedOption.iconBorder,
                selectedOption.iconColor,
              )}
            >
              <SelectedIcon className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
              <Layers className="h-3.5 w-3.5 opacity-70" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {selectedOption ? (
              <>
                <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                  {capitalizeWords(selectedOption.title)}
                </span>
                <span
                  className={cn(
                    "hidden rounded border px-1.5 py-0.5 text-[9px] font-medium leading-none sm:inline-block",
                    selectedOption.badgeClass,
                  )}
                >
                  {capitalizeWords(selectedOption.tag)}
                </span>
              </>
            ) : isAllSelected ? (
              <>
                <span className="truncate text-xs sm:text-sm font-medium text-foreground">
                  {capitalizeWords(allLabel)}
                </span>
                <span className="hidden rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline-block">
                  All
                </span>
              </>
            ) : (
              <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                {placeholder}
              </span>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex shrink-0 items-center gap-1">
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
              isOpen && "rotate-180 text-primary",
            )}
          />
        </div>
      </button>

      {/* Sleek Single-Line Dropdown Menu */}
      {isOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="Service Types"
          className="absolute left-0 top-full z-50 mt-1.5 w-full rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-xl shadow-black/10 outline-none animate-in fade-in-0 zoom-in-95 duration-100 backdrop-blur-md"
        >
          <div className="space-y-0.5">
            {/* "All Service Types" option for filter usage */}
            {allowAll && (
              <button
                type="button"
                role="option"
                aria-selected={isAllSelected}
                onClick={() => handleSelect("")}
                className={cn(
                  "group flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left transition-colors duration-100 outline-none",
                  isAllSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <span className="truncate text-xs sm:text-sm font-medium">
                    {capitalizeWords(allLabel)}
                  </span>
                  <span className="hidden rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:inline-block">
                    All
                  </span>
                </div>
                {isAllSelected && (
                  <div className="flex shrink-0 items-center">
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary stroke-[2.5]" />
                  </div>
                )}
              </button>
            )}

            {SERVICE_TYPES.map((opt) => {
              const isSelected = opt.id === value;
              const Icon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.id)}
                  className={cn(
                    "group flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left transition-colors duration-100 outline-none",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {/* Left: Icon + Title + Inline Tag */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-transform duration-100 group-hover:scale-105",
                        opt.iconBg,
                        opt.iconBorder,
                        opt.iconColor,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <span className="truncate text-xs sm:text-sm font-medium">
                      {capitalizeWords(opt.title)}
                    </span>

                    <span
                      className={cn(
                        "hidden rounded border px-1.5 py-0.5 text-[9px] font-medium leading-none sm:inline-block",
                        opt.badgeClass,
                      )}
                    >
                      {capitalizeWords(opt.tag)}
                    </span>
                  </div>

                  {/* Right: Check icon when selected */}
                  {isSelected && (
                    <div className="flex shrink-0 items-center">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary stroke-[2.5]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
