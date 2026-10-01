import { MessagesSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="p-5 sm:p-8">
      <MessagesSkeleton
        title="Loading Admin Communications…"
        subtitle="Connecting to real-time support and moderation channels…"
      />
    </main>
  );
}
