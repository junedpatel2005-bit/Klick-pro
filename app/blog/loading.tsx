import { PageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Loading Klick-Pro Blog…"
      subtitle="Fetching articles, tips, and industry insights…"
    />
  );
}

