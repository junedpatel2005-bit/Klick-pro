import { FullPageLogoLoader } from "@/components/FullPageLogoLoader";

export function PageActionLoading({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description?: string;
}) {
  return <FullPageLogoLoader active={active} title={title} subtitle={description} overlay={true} />;
}
