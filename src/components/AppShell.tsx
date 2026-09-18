"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AppMobileNavigation, AppSidebar, type NavigationItem } from "@/components/AppNavigation";
import {
  clientItems,
  clientMobileItems,
  professionalItems,
  professionalMobileItems,
} from "@/lib/portal-navigation";

type PortalUser = {
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
};

export function AppShell({
  children,
  title,
  initialUser,
}: {
  children: React.ReactNode;
  title?: string;
  initialUser?: PortalUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PortalUser | null>(initialUser ?? null);

  useEffect(() => {
    if (!initialUser) {
      fetch("/api/v1/auth/me")
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { user?: PortalUser } | null) => {
          if (data?.user) setUser(data.user);
        })
        .catch(() => {});
    }
  }, [initialUser]);

  const activeUser = user ?? initialUser;
  const isProfessional = activeUser
    ? activeUser.role === "PROFESSIONAL"
    : Boolean(
        pathname?.startsWith("/professional") || pathname?.startsWith("/professional-profile"),
      );

  const items = isProfessional ? professionalItems : clientItems;
  const mobileItems = isProfessional ? professionalMobileItems : clientMobileItems;

  const navigationUser =
    activeUser ??
    (isProfessional
      ? { firstName: "", lastName: "", role: "PROFESSIONAL", avatarUrl: null }
      : null);

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {navigationUser && <AppSidebar items={items} pathname={pathname} user={navigationUser} />}
      <div className={navigationUser ? "lg:pl-64" : ""}>
        <AppHeader role={activeUser?.role ?? (isProfessional ? "PROFESSIONAL" : "CLIENT")} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {title && (
            <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
          )}
          {children}
        </main>
      </div>
      {user && <AppMobileNavigation items={mobileItems} pathname={pathname} />}
    </div>
  );
}
