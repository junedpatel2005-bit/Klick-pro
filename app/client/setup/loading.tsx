import { PageSkeleton } from "@/components/LoadingSkeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Setting Up Client Profile…"
      subtitle="Loading onboarding steps and profile wizard…"
    />
  );
}

