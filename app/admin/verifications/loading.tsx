import { TableSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="space-y-6 p-5 sm:p-8" aria-label="Loading verifications" role="status">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-4 w-80 rounded-lg bg-muted/40 animate-pulse" />
      </div>
      <TableSkeleton rows={7} />
    </main>
  );
}
