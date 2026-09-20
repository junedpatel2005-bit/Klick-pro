"use client";

import Link from "next/link";
import { fetchCurrentUser } from "@/lib/current-user";
import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";

export function Logo({
  className = "",
  preview = false,
  collapsed = false,
}: {
  className?: string;
  preview?: boolean;
  collapsed?: boolean;
}) {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    void fetchCurrentUser()
      .then((data) => setRole(data.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);
  const href = role === "PROFESSIONAL" ? "/professional-home" : "/";
  return (
    <Link
      href={href}
      onClick={preview ? (event) => event.preventDefault() : undefined}
      className={`flex items-center gap-2 font-display font-bold text-foreground ${className}`}
      title="Klick-Pro"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
        <Briefcase className="h-4 w-4" />
      </span>
      <span
        className={`whitespace-nowrap text-xl tracking-tight transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
          collapsed
            ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none"
            : "max-w-[160px] opacity-100 translate-x-0"
        }`}
      >
        Klick-Pro
      </span>
    </Link>
  );
}
