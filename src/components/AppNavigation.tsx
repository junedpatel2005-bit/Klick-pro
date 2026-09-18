"use client";

import Link from "next/link";
import { useEffect, useState, type ElementType } from "react";
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
}: {
  items: NavigationItem[];
  pathname: string;
  user: NavigationUser;
}) {
  const unreadMessages = useUnreadMessages(pathname);
  const unreadNotifications = useUnreadNotifications(pathname);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <nav className="px-3 py-2">
        {items.map((item) => {
          const itemPath = item.to.split("?")[0];
          const active = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary font-medium text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && !active && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
              {item.label === "Notifications" && unreadNotifications > 0 && !active && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="absolute inset-x-3 bottom-4 flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
        <Avatar className="h-9 w-9">
          <AvatarImage
            src={user.avatarUrl ?? undefined}
            alt={`${user.firstName} ${user.lastName}`}
          />
          <AvatarFallback>
            {`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs capitalize text-muted-foreground">{user.role.toLowerCase()}</p>
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
