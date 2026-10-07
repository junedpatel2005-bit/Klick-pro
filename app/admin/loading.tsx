import { AdminPageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Loading Admin Console…"
      subtitle="Fetching enterprise metrics and records…"
    />
  );
}
