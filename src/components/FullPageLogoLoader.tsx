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
    <div className="relative flex flex-col items-center justify-center text-center p-6 max-w-sm sm:max-w-md w-full animate-scale-in">
      {/* Ambient Pulsing Aura */}
      <div className="pointer-events-none absolute -top-10 h-44 w-44 rounded-full bg-gradient-to-tr from-indigo-500/25 via-purple-500/20 to-sky-400/25 blur-3xl animate-pulse" />

      {/* Logo Container with Animated Rings */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Outer Rotating Glowing Ring */}
        <div className="absolute -inset-2.5 rounded-3xl border-2 border-indigo-500/20 border-t-indigo-600 border-r-indigo-500/60 animate-spin [animation-duration:1.4s]" />

        {/* Middle Pulse Ring */}
        <div className="absolute -inset-1 rounded-2xl bg-indigo-50/60 animate-ping opacity-25" />

        {/* Main Logo Card */}
        <div className="relative z-10 grid h-20 w-20 place-items-center rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-xl shadow-indigo-500/10 transition-transform">
          <img
            src="/logo-icon.png"
            alt="Klick-Pro"
            className="h-full w-full object-contain animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
          />
        </div>
      </div>

      {/* Brand Title */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="font-display text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-900 bg-clip-text text-transparent">
          Klick-Pro
        </span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping" />
      </div>

      {/* Dynamic Action Title with Animated Wave Dots */}
      <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center justify-center gap-1">
        <span>{title}</span>
        <span className="inline-flex tracking-widest text-indigo-600 font-black">
          <span className="animate-[login-dot_1.2s_infinite_100ms]">.</span>
          <span className="animate-[login-dot_1.2s_infinite_250ms]">.</span>
          <span className="animate-[login-dot_1.2s_infinite_400ms]">.</span>
        </span>
      </h3>

      {/* Subtitle */}
      {subtitle ? (
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
          {subtitle}
        </p>
      ) : null}

      {/* Sleek Gradient Shimmer Progress Bar */}
      <div className="relative mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100 border border-slate-200/70 shadow-inner">
        <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 rounded-full animate-login-button-shimmer" />
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md transition-all duration-300 animate-fade-in ${className}`}
        role="status"
        aria-live="polite"
        aria-label={title}
      >
        <div className="rounded-3xl border border-white/80 bg-white/95 p-8 shadow-2xl shadow-indigo-950/20 backdrop-blur-xl max-w-sm sm:max-w-md w-full flex flex-col items-center">
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
