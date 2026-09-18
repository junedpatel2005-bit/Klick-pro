import MarketingVisualPage from "@/components/MarketingVisualPage";
import { readMarketingContent, type MarketingPageId } from "@/lib/marketing-cms";

export default async function MarketingPageShell({ page }: { page: MarketingPageId }) {
  return <MarketingVisualPage page={page} content={await readMarketingContent(page)} />;
}
