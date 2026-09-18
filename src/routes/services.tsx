import { getCompleteCategoryHierarchy } from "@/lib/queries/categories-hierarchy";
import { ServicesCatalog } from "@/components/ServicesCatalog";

export const dynamic = "force-dynamic";

export default async function Services() {
  const data = await getCompleteCategoryHierarchy();
  return <ServicesCatalog data={data} />;
}
