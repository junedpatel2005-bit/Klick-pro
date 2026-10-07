import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
