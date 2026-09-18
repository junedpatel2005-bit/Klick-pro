"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Skeleton from "react-loading-skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, MapPin, User, Briefcase, LayoutDashboard } from "lucide-react";

type AccountUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  avatarUrl: string | null;
};

export function ClientAccountMenu() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/me")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { user: AccountUser | null };
        return data.user ?? null;
      })
      .then((account) => {
        if (!active) return;
        setUser(account);
      })
      .catch(() => setUser(null))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => window.location.reload();
    window.addEventListener("servio:profile-updated", refresh);
    return () => window.removeEventListener("servio:profile-updated", refresh);
  }, []);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading) {
    return <Skeleton width={128} height={36} borderRadius={999} />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const isClient = user.role === "CLIENT";
  const isProfessional = user.role === "PROFESSIONAL";
  const isAdmin = user.role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-full border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Avatar className="h-9 w-9">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
            ) : (
              <AvatarFallback>{initials || "U"}</AvatarFallback>
            )}
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-foreground">{`${user.firstName} ${user.lastName}`}</p>
            <p className="text-xs text-muted-foreground">{user.role.toLowerCase()}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-64">
        <div className="space-y-1 px-3 py-2">
          <p className="text-sm font-semibold">{`${user.firstName} ${user.lastName}`}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {isClient ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/my-info">My Info</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/client-profile?from=dashboard">My Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/my-jobs">Projects</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/client-profile?from=dashboard">Saved Locations</Link>
            </DropdownMenuItem>
          </>
        ) : isProfessional ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/professional-profile?from=dashboard">Professional Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/professional/dashboard">Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/professional/my-jobs">Projects</Link>
            </DropdownMenuItem>
          </>
        ) : isAdmin ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">Admin dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/users">Users</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/operations">Jobs &amp; disputes</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-destructive">
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
