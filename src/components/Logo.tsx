"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";

export function Logo({
  className = "",
  preview = false,
}: {
  className?: string;
  preview?: boolean;
}) {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { role: string } } | null) => setRole(data?.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);
  const href = role === "PROFESSIONAL" ? "/professional-home" : "/";
  return (
    <Link
      href={href}
      onClick={preview ? (event) => event.preventDefault() : undefined}
      className={`flex items-center gap-2 font-display font-bold text-foreground ${className}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
        <Briefcase className="h-4 w-4" />
      </span>
      <span className="text-xl tracking-tight">Klick-Pro</span>
    </Link>
  );
}
