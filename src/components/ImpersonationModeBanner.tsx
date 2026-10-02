"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";

export function ImpersonationModeBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!ENABLE_ADMIN_EXTRA_SECTION) return;
    fetch("/api/admin/extra/impersonate", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { isImpersonating?: boolean } | null) => {
        if (data?.isImpersonating) setIsImpersonating(true);
      })
      .catch(() => {});
  }, []);

  if (!ENABLE_ADMIN_EXTRA_SECTION || !isImpersonating) return null;

  async function handleExit() {
    setExiting(true);
    try {
      const res = await fetch("/api/admin/extra/impersonate", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to exit impersonation");

      toast.success("Returned to Admin workspace");
      window.location.href = data.redirectUrl || "/admin/users";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error restoring admin session");
      setExiting(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-slate-950" />
        <span>
          SUPPORT IMPERSONATION ACTIVE — You are viewing this portal through a user&apos;s account.
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-950 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
      >
        <LogOut className="h-3.5 w-3.5" />
        {exiting ? "Exiting..." : "Exit Support Session & Return to Admin"}
      </button>
    </div>
  );
}
