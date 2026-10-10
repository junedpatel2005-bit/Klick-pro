"use client";

import React from "react";
import { Toaster as Sonner } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const defaultToastIcons = {
  success: (
    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.2]" />
  ),
  error: (
    <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400 shrink-0 stroke-[2.2]" />
  ),
  info: (
    <Info className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 shrink-0 stroke-[2.2]" />
  ),
  warning: (
    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.2]" />
  ),
  loading: (
    <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0 stroke-[2.2]" />
  ),
};

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={defaultToastIcons}
      toastOptions={{
        className: "group font-sans",
        classNames: {
          toast:
            "w-auto min-w-[280px] max-w-[380px] rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-3.5 shadow-lg shadow-black/5 dark:shadow-black/30 text-slate-800 dark:text-slate-100 font-sans text-xs sm:text-sm font-medium transition-all duration-200 flex items-center gap-2.5",
          title: "font-semibold text-xs sm:text-sm leading-snug text-slate-900 dark:text-white",
          description: "text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed",
          closeButton:
            "!border-transparent !bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 !rounded-md !transition-colors !p-1",
          actionButton:
            "!bg-indigo-600 !text-white text-xs font-semibold rounded-lg px-2.5 py-1 shadow-xs hover:!bg-indigo-700 transition active:scale-95",
          cancelButton:
            "!bg-slate-100 dark:!bg-slate-800 !text-slate-700 dark:!text-slate-300 text-xs font-medium rounded-lg px-2.5 py-1 hover:!bg-slate-200 transition",
          success:
            "!border-emerald-500/25 !bg-emerald-50/90 dark:!bg-emerald-950/40 !text-emerald-950 dark:!text-emerald-100",
          error:
            "!border-rose-500/25 !bg-rose-50/90 dark:!bg-rose-950/40 !text-rose-950 dark:!text-rose-100",
          info:
            "!border-indigo-500/25 !bg-indigo-50/90 dark:!bg-indigo-950/40 !text-indigo-950 dark:!text-indigo-100",
          warning:
            "!border-amber-500/25 !bg-amber-50/90 dark:!bg-amber-950/40 !text-amber-950 dark:!text-amber-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
