import { CardListSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-4 w-72 rounded-lg bg-muted/40 animate-pulse" />
      </div>
      <div className="h-11 w-full max-w-md rounded-xl bg-muted/50 animate-pulse" />
      <CardListSkeleton count={4} />
    </main>
  );
}
