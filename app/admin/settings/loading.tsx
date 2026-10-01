import { AdminPageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <AdminPageSkeleton
      title="Loading System Settings…"
      subtitle="Fetching global configurations and integrations…"
    />
  );
}

