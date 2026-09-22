"use client";

import Link from "next/link";
import { useEffect, useState, type ElementType } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type NavigationItem = { to: string; icon: ElementType; label: string };
export type NavigationUser = {
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
};

function useUnreadMessages(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (pathname.startsWith("/messages") || pathname.startsWith("/professional/messages")) {
      setCount(0);
      return;
    }
    const load = () => {
      void fetch("/api/v1/messages", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { contacts?: { unreadCount?: number }[] } | null) =>
          setCount(
            data?.contacts?.reduce((total, contact) => total + (contact.unreadCount ?? 0), 0) ?? 0,
          ),
        )
        .catch(() => setCount(0));
    };
    load();
    window.addEventListener("servio:message", load);
    window.addEventListener("servio:message-read", load);
    window.addEventListener("servio:notifications-read", load);
    return () => {
      window.removeEventListener("servio:message", load);
      window.removeEventListener("servio:message-read", load);
      window.removeEventListener("servio:notifications-read", load);
    };
  }, [pathname]);
  return count;
}

function useUnreadNotifications(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (pathname.startsWith("/notifications")) {
      setCount(0);
      void fetch("/api/portal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).then(() => window.dispatchEvent(new CustomEvent("servio:notifications-read")));
      return;
    }
    const load = () => {
      void fetch("/api/portal/notifications", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { readAt?: string | null }[] | null) =>
          setCount(data?.filter((notification) => !notification.readAt).length ?? 0),
        )
        .catch(() => setCount(0));
    };
    load();
    window.addEventListener("servio:notification", load);
    window.addEventListener("servio:notifications-read", load);
    window.addEventListener("servio:message", load);
    window.addEventListener("servio:message-read", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("servio:notifications-read", load);
      window.removeEventListener("servio:message", load);
      window.removeEventListener("servio:message-read", load);
      window.removeEventListener("focus", load);
    };
  }, [pathname]);
  return count;
}

export function AppSidebar({
  items,
  pathname,
  user,
  collapsed = false,
  onToggleCollapse,
}: {
  items: NavigationItem[];
  pathname: string;
  user: NavigationUser;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const unreadMessages = useUnreadMessages(pathname);
  const unreadNotifications = useUnreadNotifications(pathname);
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface lg:block transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-[width] overflow-hidden select-none ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center px-4 border-b border-border/40 overflow-hidden">
        {collapsed ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            className="mx-auto cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl overflow-hidden bg-white shadow-soft border border-slate-200/80">
              <img
                src="/logo-icon.png"
                alt="Klick-Pro"
                className="h-full w-full object-contain p-0.5"
              />
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-center shrink-0">
              <Logo collapsed={false} />
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      <nav className="flex flex-col gap-1.5 px-4 py-3 overflow-hidden">
        {items.map((item) => {
          const itemPath = item.to.split("?")[0];
          const active = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          return (
            <Link
              key={item.to}
              href={item.to}
              title={collapsed ? item.label : undefined}
              className={`group relative flex h-10 w-full items-center rounded-xl transition-colors ${
                active
                  ? "bg-primary font-medium text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center">
                <item.icon className="h-5 w-5 transition-transform duration-150 group-hover:scale-105" />
              </div>
              <span
                className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-opacity duration-150 ${
                  collapsed ? "opacity-0 pointer-events-none hidden" : "opacity-100"
                }`}
              >
                {item.label}
              </span>
              {item.label === "Messages" && unreadMessages > 0 && !active && (
                <span
                  className={
                    collapsed
                      ? "absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-cta px-1 text-[9px] font-bold text-cta-foreground"
                      : "ml-auto mr-3 grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground"
                  }
                >
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
              {item.label === "Notifications" && unreadNotifications > 0 && !active && (
                <span
                  className={
                    collapsed
                      ? "absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-cta px-1 text-[9px] font-bold text-cta-foreground"
                      : "ml-auto mr-3 grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground"
                  }
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="absolute inset-x-0 bottom-4 px-4 overflow-hidden">
        <div
          title={
            collapsed
              ? `${user.firstName} ${user.lastName} (${user.role.toLowerCase()})`
              : undefined
          }
          className={`flex h-12 w-full items-center rounded-xl border border-border bg-muted/50 transition-colors overflow-hidden ${
            collapsed ? "justify-center" : "px-1.5"
          }`}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={`${user.firstName} ${user.lastName}`}
              />
              <AvatarFallback>
                {`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div
            className={`min-w-0 whitespace-nowrap pl-1 transition-opacity duration-150 ${
              collapsed ? "opacity-0 pointer-events-none hidden" : "opacity-100"
            }`}
          >
            <p className="truncate text-sm font-semibold text-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs capitalize text-muted-foreground">{user.role.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppMobileNavigation({
  items,
  pathname,
}: {
  items: NavigationItem[];
  pathname: string;
}) {
  const unreadMessages = useUnreadMessages(pathname);
  const unreadNotifications = useUnreadNotifications(pathname);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
      <div className="grid grid-cols-6">
        {items.map((item) => {
          const itemPath = item.to.split("?")[0];
          const active = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          return (
            <Link
              key={item.label}
              href={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <item.icon className="h-5 w-5" />
              {item.label === "Messages" && unreadMessages > 0 && !active && (
                <span className="absolute ml-5 mt-[-18px] grid h-4 min-w-4 place-items-center rounded-full bg-cta px-1 text-[9px] font-bold text-cta-foreground">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
              {item.label === "Notifications" && unreadNotifications > 0 && !active && (
                <span className="absolute ml-5 mt-[-18px] grid h-4 min-w-4 place-items-center rounded-full bg-cta px-1 text-[9px] font-bold text-cta-foreground">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
