"use client";

import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

export function AppSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="var(--color-muted)" highlightColor="var(--color-card)">
      {children}
    </SkeletonTheme>
  );
}

export function BrandedLogoBadge({
  title = "Loading Klick-Pro…",
  subtitle = "Preparing your experience, please wait a moment…",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="relative flex flex-col items-center justify-center text-center p-6 sm:p-7 max-w-xs sm:max-w-sm w-full rounded-3xl border border-border/80 bg-background/90 dark:bg-card/90 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 animate-[scale-in_0.25s_ease-out]">
        {/* Ambient Pulsing Aura */}
        <div className="pointer-events-none absolute -top-8 h-32 w-32 rounded-full bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-sky-400/20 blur-2xl animate-pulse" />

        {/* Logo Container with Animated Rings */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute -inset-2.5 rounded-3xl border-2 border-indigo-500/20 border-t-indigo-600 border-r-indigo-500/60 animate-spin [animation-duration:1.4s]" />
          <div className="absolute -inset-1 rounded-2xl bg-indigo-500/10 animate-ping opacity-25" />
          <div className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl border border-border/80 bg-background p-2 shadow-md shadow-indigo-500/10">
            <img
              src="/logo-icon.png"
              alt="Klick-Pro"
              className="h-full w-full object-contain animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
            />
          </div>
        </div>

        {/* Brand Title */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-display text-base font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
            Klick-Pro
          </span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping" />
        </div>

        {/* Dynamic Action Title with Animated Wave Dots */}
        <h3 className="font-display text-sm font-bold text-foreground tracking-tight flex items-center justify-center gap-1">
          <span>{title}</span>
          <span className="inline-flex tracking-widest text-indigo-600 font-black">
            <span className="animate-[login-dot_1.2s_infinite_100ms]">.</span>
            <span className="animate-[login-dot_1.2s_infinite_250ms]">.</span>
            <span className="animate-[login-dot_1.2s_infinite_400ms]">.</span>
          </span>
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground max-w-[240px] leading-relaxed line-clamp-2">
            {subtitle}
          </p>
        )}

        {/* Sleek Gradient Shimmer Progress Bar */}
        <div className="relative mt-3.5 h-1.5 w-32 overflow-hidden rounded-full bg-muted border border-border/60 shadow-inner">
          <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 rounded-full animate-login-button-shimmer" />
        </div>
      </div>
    </div>
  );
}

export function CardListSkeleton({
  count = 3,
  title = "Loading content…",
  subtitle = "Fetching updates and details…",
  showLogo = true,
}: {
  count?: number;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <div className="relative min-h-[360px]" aria-label="Loading content" role="status">
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`space-y-3 ${showLogo ? "opacity-35" : ""}`}>
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex gap-4">
                <Skeleton circle width={44} height={44} />
                <div className="min-w-0 flex-1">
                  <Skeleton width="42%" height={20} />
                  <div className="mt-3 flex gap-3">
                    <Skeleton width={115} />
                    <Skeleton width={145} />
                  </div>
                </div>
                <Skeleton className="hidden sm:block" width={105} height={36} borderRadius={9} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppSkeleton>
  );
}

export function DashboardSkeleton({
  title = "Loading Dashboard…",
  subtitle = "Fetching real-time platform metrics…",
  showLogo = true,
}: {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <div className="relative min-h-[480px]" aria-label="Loading dashboard" role="status">
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`space-y-6 ${showLogo ? "opacity-35" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={142} borderRadius={16} />
            ))}
          </div>
          <Skeleton height={360} borderRadius={16} />
        </div>
      </div>
    </AppSkeleton>
  );
}

export function PageSkeleton({
  title = "Loading Klick-Pro…",
  subtitle = "Preparing your workspace…",
  showLogo = true,
}: {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <main
        className="relative mx-auto w-full max-w-7xl min-h-[480px] px-4 py-10 sm:px-6 lg:px-8"
        aria-label="Loading page"
        role="status"
      >
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`space-y-8 ${showLogo ? "opacity-35" : ""}`}>
          <div className="space-y-3">
            <Skeleton width={112} height={16} />
            <Skeleton width="min(540px, 90%)" height={42} />
            <Skeleton width="min(680px, 100%)" height={20} />
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} height={210} borderRadius={16} />
            ))}
          </div>
        </div>
      </main>
    </AppSkeleton>
  );
}

export function AdminPageSkeleton({
  title = "Loading Admin Console…",
  subtitle = "Fetching enterprise metrics and records…",
  showLogo = true,
}: {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <main className="relative space-y-6 p-5 sm:p-8 min-h-[500px]" aria-label="Loading administration page" role="status">
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`space-y-6 ${showLogo ? "opacity-35" : ""}`}>
          <div className="space-y-3">
            <Skeleton width={140} height={16} />
            <Skeleton width={320} height={38} />
            <Skeleton width={460} height={18} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={126} borderRadius={16} />
            ))}
          </div>
          <Skeleton height={360} borderRadius={16} />
        </div>
      </main>
    </AppSkeleton>
  );
}

export function TableSkeleton({
  rows = 6,
  title = "Loading records…",
  subtitle = "Syncing table data…",
  showLogo = true,
}: {
  rows?: number;
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <div className="relative min-h-[420px] rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="Loading table" role="status">
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`space-y-4 ${showLogo ? "opacity-35" : ""}`}>
          <div className="flex justify-between items-center pb-3 border-b border-border">
            <Skeleton width={180} height={24} />
            <Skeleton width={120} height={32} borderRadius={8} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: rows }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-2 border-b border-border/50">
                <Skeleton width="25%" height={18} />
                <Skeleton width="20%" height={18} />
                <Skeleton width="15%" height={18} />
                <Skeleton width="15%" height={18} />
                <Skeleton width="10%" height={28} borderRadius={6} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppSkeleton>
  );
}

export function MessagesSkeleton({
  title = "Loading conversations…",
  subtitle = "Connecting to real-time messaging…",
  showLogo = true,
}: {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
} = {}) {
  return (
    <AppSkeleton>
      <div className="relative flex h-[calc(100vh-8rem)] min-h-[450px] rounded-2xl border border-border bg-card overflow-hidden" aria-label="Loading messages" role="status">
        {showLogo && <BrandedLogoBadge title={title} subtitle={subtitle} />}
        <div className={`flex w-full ${showLogo ? "opacity-35" : ""}`}>
          <div className="w-80 border-r border-border p-4 space-y-3 hidden md:block">
            <Skeleton height={36} borderRadius={10} />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex gap-3 items-center p-2">
                <Skeleton circle width={40} height={40} />
                <div className="flex-1 space-y-1.5">
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="85%" height={12} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <Skeleton circle width={42} height={42} />
              <div className="space-y-1">
                <Skeleton width={160} height={18} />
                <Skeleton width={100} height={12} />
              </div>
            </div>
            <div className="space-y-4 py-8">
              <Skeleton width="40%" height={40} borderRadius={14} />
              <Skeleton width="55%" height={56} borderRadius={14} className="ml-auto" />
              <Skeleton width="35%" height={36} borderRadius={14} />
            </div>
            <Skeleton height={48} borderRadius={14} />
          </div>
        </div>
      </div>
    </AppSkeleton>
  );
}
