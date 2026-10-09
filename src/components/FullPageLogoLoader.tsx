"use client";

import React from "react";

export interface FullPageLogoLoaderProps {
  active?: boolean;
  title?: string;
  subtitle?: string;
  overlay?: boolean;
  className?: string;
}

export function FullPageLogoLoader({
  active = true,
  title = "Loading Klick-Pro…",
  subtitle = "Please wait a moment while we prepare your experience.",
  overlay = false,
  className = "",
}: FullPageLogoLoaderProps) {
  if (!active) return null;

  const content = (
    <div className="relative flex flex-col items-center justify-center text-center p-6 sm:p-8 max-w-sm sm:max-w-md w-full animate-scale-in">
      {/* Dynamic Multi-Color Ambient Glow */}
      <div className="pointer-events-none absolute -top-12 h-52 w-52 rounded-full bg-gradient-to-tr from-primary/30 via-violet-500/25 to-sky-400/30 blur-3xl animate-pulse [animation-duration:3s]" />
      <div className="pointer-events-none absolute -bottom-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-emerald-400/20 blur-2xl animate-pulse [animation-duration:4s]" />

      {/* Centerpiece: Dual-Ring Glassmorphic Logo Capsule */}
      <div className="relative mb-7 flex items-center justify-center">
        {/* Outer Orbital Ring with Gradient Glow (Clockwise) */}
        <div className="absolute -inset-3.5 rounded-full border-2 border-transparent border-t-primary border-r-violet-500/80 animate-spin [animation-duration:1.8s] drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />

        {/* Counter-Rotating Accent Ring (Counter-Clockwise) */}
        <div className="absolute -inset-2 rounded-full border border-dashed border-sky-400/40 border-b-primary/60 animate-[spin_3s_linear_infinite_reverse]" />

        {/* Soft Radial Pulse Ring */}
        <div className="absolute -inset-1 rounded-3xl bg-primary/10 animate-ping [animation-duration:2.5s] opacity-30" />

        {/* Logo Card with High-End Glassmorphism */}
        <div className="relative z-10 grid h-20 w-20 sm:h-22 sm:w-22 place-items-center rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-950/95 p-3.5 shadow-2xl shadow-primary/20 backdrop-blur-xl transition-transform hover:scale-105">
          <img
            src="/logo-icon.png"
            alt="Klick-Pro"
            className="h-full w-full object-contain filter drop-shadow-md animate-[pulse_2.2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          />
        </div>
      </div>

      {/* Brand Identity with Live Shimmer Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 dark:bg-primary/20 px-3.5 py-1 mb-2.5 backdrop-blur-md">
        <span className="font-display text-sm font-extrabold tracking-tight bg-gradient-to-r from-primary via-violet-600 to-indigo-600 dark:from-primary dark:via-violet-400 dark:to-indigo-300 bg-clip-text text-transparent">
          Klick-Pro
        </span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      </div>

      {/* Main Title with Animated Fluid Wave Dots */}
      <h3 className="font-display text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center justify-center gap-1.5">
        <span>{title}</span>
        <span className="inline-flex tracking-widest text-primary font-black">
          <span className="animate-[login-dot_1.2s_infinite_100ms]">.</span>
          <span className="animate-[login-dot_1.2s_infinite_250ms]">.</span>
          <span className="animate-[login-dot_1.2s_infinite_400ms]">.</span>
        </span>
      </h3>

      {/* Subtitle */}
      {subtitle ? (
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xs leading-relaxed">
          {subtitle}
        </p>
      ) : null}

      {/* Sleek Gradient Infinite Shimmer Progress Bar */}
      <div className="relative mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted/60 border border-border/60 shadow-inner">
        <div className="h-full w-full bg-gradient-to-r from-primary via-violet-500 to-sky-400 rounded-full animate-login-button-shimmer" />
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/70 dark:bg-slate-950/75 p-4 backdrop-blur-xl transition-all duration-300 animate-fade-in ${className}`}
        role="status"
        aria-live="polite"
        aria-label={title}
      >
        <div className="rounded-3xl border border-border/80 bg-card/90 dark:bg-card/95 p-6 sm:p-8 shadow-2xl shadow-primary/10 backdrop-blur-2xl max-w-sm sm:max-w-md w-full flex flex-col items-center">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-[75vh] w-full flex flex-col items-center justify-center p-6 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      {content}
    </div>
  );
}
