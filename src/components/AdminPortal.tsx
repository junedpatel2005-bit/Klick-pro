"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminRealtime } from "@/components/AdminRealtime";
import { AdminSidebarProvider, useAdminSidebar } from "@/components/AdminSidebarContext";

// Lazy: keeps socket.io-client out of the shared client entry.
const RealtimeNotifications = dynamic(
  () => import("@/components/RealtimeNotifications").then((m) => m.RealtimeNotifications),
  { ssr: false },
);

function AdminPortalContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useAdminSidebar();

  if (pathname === "/admin/login") return <>{children}</>;

  const isFullWidth =
    pathname?.startsWith("/admin/finance") || pathname?.startsWith("/admin/templates");

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AdminRealtime />
      <RealtimeNotifications />
      <AdminSidebar />
      <main
        className={`flex flex-col min-h-screen transition-[padding] duration-200 ease-in-out ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <AdminHeader />
        <div
          className={`flex-1 mx-auto w-full p-4 sm:p-6 lg:p-8 transition-all ${
            isFullWidth ? "max-w-[1780px]" : "max-w-7xl"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export function AdminPortal({ children }: { children: React.ReactNode }) {
  return (
    <AdminSidebarProvider>
      <AdminPortalContent>{children}</AdminPortalContent>
    </AdminSidebarProvider>
  );
}
