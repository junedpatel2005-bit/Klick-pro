import { PageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Loading Job Details…"
      subtitle="Fetching job requirements, proposals, and project scope…"
    />
  );
}
