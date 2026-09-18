"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Database, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status =
  | { state: "checking" }
  | { state: "connected"; checkedAt: string; latencyMs: number }
  | { state: "disconnected"; checkedAt?: string };

export function DatabaseStatus() {
  const [status, setStatus] = useState<Status>({ state: "checking" });

  const checkConnection = useCallback(async () => {
    setStatus({ state: "checking" });
    try {
      const response = await fetch("/api/v1/admin/database-status", { cache: "no-store" });
      const data = (await response.json()) as {
        connected?: boolean;
        checkedAt?: string;
        latencyMs?: number;
      };
      if (
        response.ok &&
        data.connected &&
        data.checkedAt !== undefined &&
        data.latencyMs !== undefined
      ) {
        setStatus({ state: "connected", checkedAt: data.checkedAt, latencyMs: data.latencyMs });
      } else {
        setStatus({ state: "disconnected", checkedAt: data.checkedAt });
      }
    } catch {
      setStatus({ state: "disconnected" });
    }
  }, []);

  useEffect(() => {
    void checkConnection();
  }, [checkConnection]);

  const isChecking = status.state === "checking";
  const isConnected = status.state === "connected";
  const detail = isChecking
    ? "Checking database connection…"
    : isConnected
      ? `Connected · ${status.latencyMs} ms · checked ${new Date(status.checkedAt).toLocaleTimeString()}`
      : "Could not connect. Check the database configuration and try again.";

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            isChecking
              ? "bg-muted text-muted-foreground"
              : isConnected
                ? "bg-success/15 text-success"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {isChecking ? (
            <Database className="h-5 w-5" />
          ) : isConnected ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
        </span>
        <div>
          <h2 className="font-semibold">Database status</h2>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button variant="outline" onClick={() => void checkConnection()} disabled={isChecking}>
        <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
        Check connection
      </Button>
    </section>
  );
}
