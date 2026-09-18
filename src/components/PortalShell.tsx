"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  AppMobileNavigation,
  AppSidebar,
  type NavigationItem,
  type NavigationUser,
} from "@/components/AppNavigation";
import {
  clientItems,
  clientMobileItems,
  professionalItems,
  professionalMobileItems,
} from "@/lib/portal-navigation";

type PortalUser = NavigationUser;

const PortalTitleContext = createContext<{
  title?: string;
  setTitle: (title?: string) => void;
  isInsidePortal?: boolean;
}>({ setTitle: () => {}, isInsidePortal: false });

export function PortalTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | undefined>(undefined);
  return (
    <PortalTitleContext.Provider value={{ title, setTitle, isInsidePortal: true }}>
      {children}
    </PortalTitleContext.Provider>
  );
}

export function usePortalTitle() {
  return useContext(PortalTitleContext);
}

export function PortalShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: PortalUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { title } = usePortalTitle();
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

  const navigationUser = activeUser ?? {
    firstName: "",
    lastName: "",
    role: isProfessional ? "PROFESSIONAL" : "CLIENT",
    avatarUrl: null,
  };

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <AppSidebar items={items} pathname={pathname} user={navigationUser} />
      <div className="lg:pl-64">
        <AppHeader role={activeUser?.role ?? (isProfessional ? "PROFESSIONAL" : "CLIENT")} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {pathname !== "/dashboard" && pathname !== "/professional/dashboard" && (
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {title && (
            <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
          )}
          {children}
        </main>
      </div>
      <AppMobileNavigation items={mobileItems} pathname={pathname} />
    </div>
  );
}
