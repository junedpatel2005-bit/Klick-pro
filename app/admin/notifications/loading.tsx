import { CardListSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="space-y-6 p-5 sm:p-8" aria-label="Loading admin notifications" role="status">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-4 w-80 rounded-lg bg-muted/40 animate-pulse" />
      </div>
      <div className="h-11 w-full max-w-md rounded-xl bg-muted/50 animate-pulse" />
      <CardListSkeleton
        count={5}
        title="Loading Admin Notifications…"
        subtitle="Syncing administrative alerts and project updates…"
      />
    </main>
  );
}
