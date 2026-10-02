"use client";

import { useEffect, useState } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  Layers,
  Code,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuditEntry = {
  id: number;
  actorId: number | null;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditStats = {
  total: number;
  uniqueActors: number;
  actionsBreakdown: Record<string, number>;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    uniqueActors: 0,
    actionsBreakdown: {},
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (search.trim()) params.set("query", search.trim());

      const res = await fetch(`/api/admin/extra/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load audit logs");

      setLogs(data.logs || []);
      setStats(
        data.stats || {
          total: 0,
          uniqueActors: 0,
          actionsBreakdown: {},
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, search]);

  function getActionBadgeStyle(action: string) {
    const upper = action.toUpperCase();
    if (upper.includes("DELETE") || upper.includes("BAN") || upper.includes("SUSPEND")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (upper.includes("APPROVE") || upper.includes("VERIF") || upper.includes("CREATE")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (upper.includes("DISPUTE") || upper.includes("REJECT") || upper.includes("WARN")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (upper.includes("PAYOUT") || upper.includes("FINANCE") || upper.includes("ESCROW")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
              <History className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Activity Trail & Security Audit Logs
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Immutable log of administrative operations, policy changes, verification decisions, and
            support actions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchLogs()}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Total Action Records</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="mt-1 text-[11px] text-slate-400">Captured events</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Active Admin Actors</p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{stats.uniqueActors}</p>
          <p className="mt-1 text-[11px] text-slate-400">Staff accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Matching Events</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{logs.length}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current filter</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Log Integrity</p>
          <div className="mt-2 flex items-center gap-1.5 text-emerald-600 font-bold text-lg">
            <ShieldCheck className="h-5 w-5" />
            Verified
          </div>
          <p className="mt-1 text-[11px] text-slate-400">PostgreSQL journal</p>
        </div>
      </div>

      {/* Search & Action Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search action, actor, entity ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Action:
          </span>
          {["ALL", "VERIF", "REVIEW", "SETTINGS", "DISPUTE", "DELETE"].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActionFilter(a)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                actionFilter === a
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {a === "ALL" ? "All Actions" : a}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
            Loading system audit trail...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No audit events found</p>
            <p className="text-xs text-slate-400 mt-1">
              Events will be automatically logged here as administrative actions occur.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-slate-700 font-bold text-xs">
                            {log.actorName.charAt(0) || "A"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{log.actorName}</p>
                            <p className="text-[10px] text-slate-400">{log.actorEmail}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-[11px] border ${getActionBadgeStyle(
                            log.action,
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {log.entityType} #{log.entityId}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {log.metadata ? (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition"
                          >
                            <Code className="h-3 w-3" />
                            {isExpanded ? "Hide JSON" : "Inspect"}
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No extra data</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded JSON Inspector Modal / View */}
      {expandedLogId !== null && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
              <Code className="h-4 w-4 text-indigo-600" />
              Event Payload & State Changes (Log #{expandedLogId}):
            </span>
            <button
              type="button"
              onClick={() => setExpandedLogId(null)}
              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
            >
              Close Inspector ✕
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
            {JSON.stringify(logs.find((l) => l.id === expandedLogId)?.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
