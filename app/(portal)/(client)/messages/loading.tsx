import { MessagesSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <MessagesSkeleton />
    </main>
  );
}
