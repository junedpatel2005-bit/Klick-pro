import { FullPageLogoLoader } from "@/components/FullPageLogoLoader";

export default function Loading() {
  return (
    <FullPageLogoLoader
      title="Loading Admin Console…"
      subtitle="Fetching enterprise metrics and records…"
    />
  );
}
