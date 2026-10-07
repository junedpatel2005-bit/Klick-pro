import { AdminPageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Loading SMS Template Editor…"
      subtitle="Fetching SMS tokens and configuration…"
    />
  );
}
