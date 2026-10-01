import { AdminPageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Loading Template Editor…"
      subtitle="Fetching template variables and preview data…"
    />
  );
}

