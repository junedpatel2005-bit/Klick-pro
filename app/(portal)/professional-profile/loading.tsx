import { PageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Loading Professional Profile…"
      subtitle="Fetching portfolio, services, and credentials…"
    />
  );
}
