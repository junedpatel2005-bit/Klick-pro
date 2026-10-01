import { TableSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="space-y-6 p-5 sm:p-8" aria-label="Loading services" role="status">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-4 w-72 rounded-lg bg-muted/40 animate-pulse" />
      </div>
      <TableSkeleton rows={7} />
    </main>
  );
}

