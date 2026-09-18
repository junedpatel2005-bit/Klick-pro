"use client";

import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

export function AppSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="var(--color-muted)" highlightColor="var(--color-card)">
      {children}
    </SkeletonTheme>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <AppSkeleton>
      <div className="space-y-3" aria-label="Loading content" role="status">
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
    </AppSkeleton>
  );
}

export function DashboardSkeleton() {
  return (
    <AppSkeleton>
      <div className="space-y-6" aria-label="Loading dashboard" role="status">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height={142} borderRadius={16} />
          ))}
        </div>
        <Skeleton height={360} borderRadius={16} />
      </div>
    </AppSkeleton>
  );
}

export function PageSkeleton() {
  return (
    <AppSkeleton>
      <main
        className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8"
        aria-label="Loading page"
        role="status"
      >
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
      </main>
    </AppSkeleton>
  );
}

export function AdminPageSkeleton() {
  return (
    <AppSkeleton>
      <main className="space-y-6 p-5 sm:p-8" aria-label="Loading administration page" role="status">
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
      </main>
    </AppSkeleton>
  );
}
