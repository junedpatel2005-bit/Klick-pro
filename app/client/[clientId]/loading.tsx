import { PageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Loading Client Profile…"
      subtitle="Fetching verified client history and job postings…"
    />
  );
}
