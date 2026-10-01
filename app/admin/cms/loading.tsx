import { AdminPageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Loading Content Management…"
      subtitle="Fetching CMS pages, policies, and editorial sections…"
    />
  );
}

