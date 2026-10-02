"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Search,
  Filter,
  RefreshCw,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EscrowRecord = {
  id: number;
  trackingId: number;
  jobId: number | null;
  jobTitle: string;
  milestoneId: number;
  amount: number;
  status: string;
  clientName: string;
  clientEmail: string;
  professionalName: string;
  professionalEmail: string;
  ageDays: number;
  isStuck: boolean;
  isDisputed: boolean;
  disputeId: number | null;
  createdAt: string;
};

type EscrowStats = {
  totalEscrowHeld: number;
  totalDisputedEscrow: number;
  activeContractsCount: number;
  stuckContractsCount: number;
};

export default function AdminEscrowLedgerPage() {
  const [records, setRecords] = useState<EscrowRecord[]>([]);
  const [stats, setStats] = useState<EscrowStats>({
    totalEscrowHeld: 0,
    totalDisputedEscrow: 0,
    activeContractsCount: 0,
    stuckContractsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function fetchEscrow() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("query", search.trim());

      const res = await fetch(`/api/admin/extra/escrow?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load escrow ledger");

      setRecords(data.records || []);
      setStats(
        data.stats || {
          totalEscrowHeld: 0,
          totalDisputedEscrow: 0,
          activeContractsCount: 0,
          stuckContractsCount: 0,
        },
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error fetching escrow ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchEscrow();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
              <Landmark className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Central Escrow Ledger & Funds Reconciliation
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time balance sheet of platform-held escrow funds, milestone aging duration, and
            unreleased contract balances.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchEscrow()}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Ledger
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Total Escrow Secured</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 animate-pulse rounded-lg bg-slate-200" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-indigo-700">
              ₹{stats.totalEscrowHeld.toLocaleString()}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Held in platform escrow</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500">Active Escrow Contracts</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-slate-200" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.activeContractsCount}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Funded & awaiting delivery</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-amber-700">Aging Funds (&gt;14 Days)</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-amber-100" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-amber-600">{stats.stuckContractsCount}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Needs review or release</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-rose-700">Disputed Escrow At-Risk</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-rose-100" />
          ) : (
            <p className="mt-2 text-2xl font-bold text-rose-600">
              ₹{stats.totalDisputedEscrow.toLocaleString()}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">Frozen in arbitration</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search project, client, professional..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {[
            { id: "ALL", label: "All Records" },
            { id: "HELD", label: "Currently Held" },
            { id: "STUCK", label: "Aging (>14d)" },
            { id: "DISPUTED", label: "Disputed" },
            { id: "RELEASED", label: "Released" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === f.id
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading && records.length === 0 ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 py-3.5 px-2 border-b border-slate-100 animate-pulse"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-44 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-4 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
                <div className="h-6 w-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No escrow records found</p>
            <p className="text-xs text-slate-400 mt-1">
              No matching records found for this filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Project / Job</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Professional</th>
                  <th className="py-3 px-4">Secured Escrow</th>
                  <th className="py-3 px-4">Duration / Age</th>
                  <th className="py-3 px-4">Escrow Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-slate-900 line-clamp-1">{r.jobTitle}</p>
                        <p className="text-[10px] text-slate-400">Milestone #{r.milestoneId}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-slate-900">{r.clientName}</p>
                        <p className="text-[10px] text-slate-400">{r.clientEmail}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-slate-900">{r.professionalName}</p>
                        <p className="text-[10px] text-slate-400">{r.professionalEmail}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-sm text-slate-900">
                      ₹{r.amount.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          r.isStuck ? "text-amber-600" : "text-slate-600"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {r.ageDays === 0 ? "Today" : `${r.ageDays} days ago`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.isDisputed ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          IN DISPUTE
                        </span>
                      ) : r.status === "FUNDED" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                          <Wallet className="h-3 w-3" />
                          HELD IN ESCROW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          RELEASED / COMPLETED
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {r.jobId && (
                          <Link
                            href={`/project/${r.trackingId}/tracking`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition"
                          >
                            Project <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {r.disputeId && (
                          <Link
                            href={`/admin/operations?dispute=${r.disputeId}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-md transition"
                          >
                            Dispute Case <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
