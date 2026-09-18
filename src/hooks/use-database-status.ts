import { useEffect, useState } from "react";

type DatabaseStatus = { state: "checking" } | { state: "connected" } | { state: "disconnected" };

export function useDatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatus>({ state: "checking" });

  useEffect(() => {
    let active = true;
    fetch("/api/v1/admin/database-status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { connected: false }))
      .then((data: { connected?: boolean }) => {
        if (active) setStatus({ state: data.connected ? "connected" : "disconnected" });
      })
      .catch(() => {
        if (active) setStatus({ state: "disconnected" });
      });
    return () => {
      active = false;
    };
  }, []);

  return status.state;
}
