"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  Landmark,
  Layers,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wallet,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";

// --- Types ---

type UserProfile = {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  companyName?: string | null;
  role?: string;
};

function getUserDisplayName(user?: UserProfile | null, fallback = ""): string {
  if (!user) return fallback;
  if (user.name) return user.name;
  const combined = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return combined || fallback;
}

type MilestoneItem = {
  id: number;
  title: string;
  amount: number;
  status: string;
  dueDate?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
};

type PaymentFinancials = {
  grossClientAmount: number;
  baseAmount: number;
  clientFeeAmount: number;
  commissionAmount: number;
  professionalPayoutAmount: number;
  adminNetAmount: number;
};

type EnrichedPayment = {
  id: number;
  clientId: number;
  professionalId: number;
  amount: number;
  baseAmount: number;
  clientFeeAmount: number;
  commissionAmount: number;
  professionalPayoutAmount: number;
  adminNetAmount: number;
  currency: string;
  provider: string;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  projectTrackingId: number | null;
  milestoneId: number | null;
  failureReason: string | null;
  capturedAt: string | null;
  createdAt: string;
  client?: UserProfile | null;
  professional?: UserProfile | null;
  jobTitle?: string;
  jobCategory?: string | null;
  milestoneTitle?: string;
  milestoneStatus?: string;
  milestoneNumber?: number | null;
  totalMilestonesCount?: number;
  projectTotalBudget?: number;
  projectPaidAmount?: number;
  projectRemainingAmount?: number;
  remainingMilestonesCount?: number;
  milestonesList?: MilestoneItem[];
  financials?: PaymentFinancials;
};

type WalletTopUp = {
  id: number;
  amount: number;
  status: string;
  providerReference: string | null;
  createdAt: string;
  wallet: { userId: number };
};

type Withdrawal = {
  id: number;
  professionalId: number;
  amount: number;
  currency: string;
  status: string;
  destinationType?: string;
  destinationLabel?: string | null;
  failureReason?: string | null;
  createdAt: string;
};

type PlatformWallet = {
  balance: number;
  currency: string;
  ownerName: string | null;
  totalReceived: number;
  totalPaidToProfessionals: number;
  retainedEarnings: number;
};

type PlatformLedgerItem = {
  id: number;
  type: string;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
};

type FinanceData = {
  payments: EnrichedPayment[];
  withdrawals: Withdrawal[];
  walletTransactions: WalletTopUp[];
  platformWallet: PlatformWallet | null;
  platformWalletTransactions: PlatformLedgerItem[];
  names: Record<string, string>;
  usersById?: Record<string, UserProfile>;
};

type TabView = "all" | "payments" | "escrow" | "topups" | "withdrawals" | "ledger";

type UnifiedItem = {
  id: string;
  kind: "PAYMENT" | "TOP_UP" | "WITHDRAWAL" | "LEDGER";
  refId: number;
  date: string;
  title: string;
  categoryOrRef?: string | null;
  milestoneInfo?: string | null;
  remainingAmount?: number | null;
  clientName?: string | null;
  clientEmail?: string | null;
  proName?: string | null;
  proEmail?: string | null;
  clientPaid?: number | null;
  baseAmount?: number | null;
  adminNet?: number | null;
  proPayout?: number | null;
  status: string;
  provider: string;
  paymentRaw?: EnrichedPayment;
  withdrawalRaw?: Withdrawal;
};

// --- Formatting Helpers ---

const formatMoney = (amount: number, currency = "INR") => {
  const formatted = Math.round(amount).toLocaleString("en-IN");
  return currency === "INR" ? `₹${formatted}` : `${currency} ${formatted}`;
};

const formatDate = (iso: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminFinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedPayment, setSelectedPayment] = useState<EnrichedPayment | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/data/finance", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFinance();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  // --- Aggregate Metrics ---

  const metrics = useMemo(() => {
    if (!data) {
      return {
        grossVolume: 0,
        platformCommission: 0,
        proDisbursements: 0,
        inEscrow: 0,
        adminBalance: 0,
      };
    }

    const completedOrFunded = data.payments.filter(
      (p) => p.status === "COMPLETED" || p.status === "FUNDED",
    );

    const grossVolume = completedOrFunded.reduce((sum, p) => sum + p.amount, 0);

    const platformCommission = completedOrFunded.reduce((sum, p) => {
      const net =
        p.adminNetAmount ||
        (p.clientFeeAmount || Math.ceil(p.baseAmount * 0.1)) +
          (p.commissionAmount || Math.ceil(p.baseAmount * 0.1));
      return sum + net;
    }, 0);

    const proDisbursements = data.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => {
        const payout =
          p.professionalPayoutAmount ||
          Math.max(0, p.baseAmount - (p.commissionAmount || Math.ceil(p.baseAmount * 0.1)));
        return sum + payout;
      }, 0);

    const inEscrow = data.payments
      .filter((p) => p.status === "FUNDED")
      .reduce((sum, p) => sum + p.amount, 0);

    const adminBalance = data.platformWallet?.balance ?? 0;

    return {
      grossVolume,
      platformCommission,
      proDisbursements,
      inEscrow,
      adminBalance,
    };
  }, [data]);

  // --- Unified Activity List (Combines all transactions so all are visible) ---

  const allActivities = useMemo<UnifiedItem[]>(() => {
    if (!data) return [];
    const items: UnifiedItem[] = [];

    // 1. Milestone Payments
    for (const p of data.payments) {
      const clientName = getUserDisplayName(
        p.client,
        data.names[p.clientId] || `Client #${p.clientId}`,
      );
      const proName = getUserDisplayName(
        p.professional,
        data.names[p.professionalId] || `Professional #${p.professionalId}`,
      );
      const clientFee = p.clientFeeAmount || Math.ceil(p.baseAmount * 0.1);
      const proComm = p.commissionAmount || Math.ceil(p.baseAmount * 0.1);
      const adminNet = p.adminNetAmount || clientFee + proComm;
      const proPayout = p.professionalPayoutAmount || Math.max(0, p.baseAmount - proComm);

      items.push({
        id: `payment-${p.id}`,
        kind: "PAYMENT",
        refId: p.id,
        date: p.createdAt,
        title: p.jobTitle || "Direct Milestone Project",
        categoryOrRef: p.jobCategory,
        milestoneInfo:
          p.milestoneNumber && p.totalMilestonesCount
            ? `Milestone ${p.milestoneNumber} of ${p.totalMilestonesCount}`
            : p.milestoneTitle || "Milestone",
        remainingAmount: p.projectRemainingAmount,
        clientName,
        clientEmail: p.client?.email,
        proName,
        proEmail: p.professional?.email,
        clientPaid: p.amount,
        baseAmount: p.baseAmount,
        adminNet,
        proPayout,
        status: p.status,
        provider: p.provider,
        paymentRaw: p,
      });
    }

    // 2. Client Top-ups
    for (const topup of data.walletTransactions) {
      const user = data.usersById?.[topup.wallet.userId];
      const userName =
        user?.name || data.names[topup.wallet.userId] || `Client #${topup.wallet.userId}`;

      items.push({
        id: `topup-${topup.id}`,
        kind: "TOP_UP",
        refId: topup.id,
        date: topup.createdAt,
        title: "Client Wallet Top-up",
        categoryOrRef: topup.providerReference
          ? `Ref: ${topup.providerReference}`
          : "Internal Deposit",
        milestoneInfo: null,
        remainingAmount: null,
        clientName: userName,
        clientEmail: user?.email,
        proName: null,
        proEmail: null,
        clientPaid: topup.amount,
        baseAmount: null,
        adminNet: null,
        proPayout: null,
        status: topup.status,
        provider: "WALLET",
      });
    }

    // 3. Pro Withdrawals
    for (const w of data.withdrawals) {
      const user = data.usersById?.[w.professionalId];
      const proName =
        user?.name || data.names[w.professionalId] || `Professional #${w.professionalId}`;

      items.push({
        id: `withdrawal-${w.id}`,
        kind: "WITHDRAWAL",
        refId: w.id,
        date: w.createdAt,
        title: "Professional Withdrawal",
        categoryOrRef: w.destinationLabel
          ? `${w.destinationType} (${w.destinationLabel})`
          : w.destinationType || "Bank Transfer",
        milestoneInfo: null,
        remainingAmount: null,
        clientName: null,
        clientEmail: null,
        proName,
        proEmail: user?.email,
        clientPaid: null,
        baseAmount: null,
        adminNet: null,
        proPayout: w.amount,
        status: w.status,
        provider: "BANK",
        withdrawalRaw: w,
      });
    }

    // 4. Platform Wallet Ledger Transactions
    for (const tx of data.platformWalletTransactions) {
      items.push({
        id: `ledger-${tx.id}`,
        kind: "LEDGER",
        refId: tx.id,
        date: tx.createdAt,
        title: tx.type.replaceAll("_", " "),
        categoryOrRef: tx.description,
        milestoneInfo: null,
        remainingAmount: null,
        clientName: null,
        clientEmail: null,
        proName: null,
        proEmail: null,
        clientPaid: tx.amount > 0 ? tx.amount : null,
        baseAmount: null,
        adminNet: tx.amount >= 0 ? tx.amount : null,
        proPayout: tx.amount < 0 ? Math.abs(tx.amount) : null,
        status: tx.status,
        provider: "TREASURY",
      });
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  // --- Filtered List ---

  const filteredItems = useMemo(() => {
    let list = allActivities;

    if (activeTab === "payments") {
      list = list.filter((i) => i.kind === "PAYMENT");
    } else if (activeTab === "escrow") {
      list = list.filter((i) => i.kind === "PAYMENT" && i.status === "FUNDED");
    } else if (activeTab === "topups") {
      list = list.filter((i) => i.kind === "TOP_UP");
    } else if (activeTab === "withdrawals") {
      list = list.filter((i) => i.kind === "WITHDRAWAL");
    } else if (activeTab === "ledger") {
      list = list.filter((i) => i.kind === "LEDGER");
    }

    if (statusFilter !== "ALL") {
      list = list.filter((i) => i.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => {
        const title = (i.title || "").toLowerCase();
        const client = (i.clientName || "").toLowerCase();
        const pro = (i.proName || "").toLowerCase();
        const ref = (i.categoryOrRef || "").toLowerCase();
        const idStr = String(i.refId);
        return (
          title.includes(q) ||
          client.includes(q) ||
          pro.includes(q) ||
          ref.includes(q) ||
          idStr.includes(q)
        );
      });
    }

    return list;
  }, [allActivities, activeTab, statusFilter, searchQuery]);

  // --- Actions ---

  async function handleApprovePayout(paymentId: number) {
    if (!window.confirm(`Release milestone payout for transaction #${paymentId}?`)) return;

    setBusyId(paymentId);
    try {
      const response = await fetch("/api/admin/finance/milestone-payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const res = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(res?.error ?? "Payout approval failed.");
      }
      await fetchFinance();
      if (selectedPayment?.id === paymentId) {
        setSelectedPayment((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Payout failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleWithdrawalStatus(withdrawalId: number, status: "COMPLETED" | "FAILED") {
    if (!window.confirm(`Mark withdrawal #${withdrawalId} as ${status}?`)) return;
    setBusyId(withdrawalId);
    try {
      const res = await fetch(`/api/admin/finance/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update withdrawal.");
      await fetchFinance();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error updating withdrawal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-display">
            Finance & Milestone Settlements
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time platform cashflow, escrow balances, milestone settlements, and net revenue.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void fetchFinance()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {/* Card 1: Gross Platform Volume */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Gross Volume
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <Coins className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            {formatMoney(metrics.grossVolume)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Total client volume</p>
        </div>

        {/* Card 2: Platform Net */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Platform Net
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <Percent className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
            +{formatMoney(metrics.platformCommission)}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-700 font-medium">Net platform revenue</p>
        </div>

        {/* Card 3: Professional Disbursements */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Disbursed to Pros
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            {formatMoney(metrics.proDisbursements)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Released milestone payouts</p>
        </div>

        {/* Card 4: Escrow In-Transit */}
        <div
          onClick={() => setActiveTab("escrow")}
          className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition ${
            activeTab === "escrow"
              ? "border-amber-400 bg-amber-50/80 ring-2 ring-amber-200"
              : "border-slate-200 bg-white hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Held in Escrow
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-amber-900">
            {formatMoney(metrics.inEscrow)}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
            {data?.payments.filter((p) => p.status === "FUNDED").length ?? 0} waiting payout
          </p>
        </div>

        {/* Card 5: Treasury Wallet */}
        <div
          onClick={() => setActiveTab("ledger")}
          className={`col-span-2 sm:col-span-1 cursor-pointer rounded-2xl border p-4 shadow-xs transition ${
            activeTab === "ledger"
              ? "border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-200"
              : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              Admin Treasury
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
              <WalletCards className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-indigo-950">
            {formatMoney(metrics.adminBalance)}
          </p>
          <p className="mt-0.5 text-[11px] text-indigo-700 font-medium">Platform wallet balance</p>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="space-y-3">
        {/* Row 1: Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="All Activity"
            badge={allActivities.length}
          />
          <TabButton
            active={activeTab === "payments"}
            onClick={() => setActiveTab("payments")}
            label="Milestone Payments"
            badge={data?.payments.length}
          />
          <TabButton
            active={activeTab === "escrow"}
            onClick={() => setActiveTab("escrow")}
            label="Escrow Approvals"
            badge={data?.payments.filter((p) => p.status === "FUNDED").length}
            badgeTone="amber"
          />
          <TabButton
            active={activeTab === "topups"}
            onClick={() => setActiveTab("topups")}
            label="Client Top-ups"
            badge={data?.walletTransactions.length}
          />
          <TabButton
            active={activeTab === "withdrawals"}
            onClick={() => setActiveTab("withdrawals")}
            label="Pro Withdrawals"
            badge={data?.withdrawals.length}
          />
          <TabButton
            active={activeTab === "ledger"}
            onClick={() => setActiveTab("ledger")}
            label="Treasury Ledger"
            badge={data?.platformWalletTransactions.length}
          />
        </div>

        {/* Row 2: Search & Status Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, pro, project, #ID..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8.5 pr-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              Showing <span className="font-bold text-slate-700">{filteredItems.length}</span>{" "}
              records
            </span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FUNDED">Funded (Escrow)</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Unified Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-2 w-28">Txn / Ref</th>
                <th className="py-3 px-2">Details / Project</th>
                <th className="py-3 px-2 w-40">Client</th>
                <th className="py-3 px-2 w-40">Professional</th>
                <th className="py-3 px-2 text-right w-24">Gross</th>
                <th className="py-3 px-2 text-right w-24">Platform Net</th>
                <th className="py-3 px-2 text-right w-24">Pro Payout</th>
                <th className="py-3 px-2 text-center w-28">Status</th>
                <th className="py-3 pr-5 pl-2 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isPayment = item.kind === "PAYMENT";
                const isFundedPayment = isPayment && item.status === "FUNDED";
                const isPendingWithdrawal = item.kind === "WITHDRAWAL" && item.status === "PENDING";

                return (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (item.paymentRaw) setSelectedPayment(item.paymentRaw);
                    }}
                    className={`group transition-colors ${
                      isPayment ? "cursor-pointer hover:bg-indigo-50/20" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Txn ID & Provider */}
                    <td className="py-3 pl-5 pr-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          #{item.refId}
                        </span>
                        <KindBadge kind={item.kind} provider={item.provider} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(item.date)}</p>
                    </td>

                    {/* Details / Project */}
                    <td className="py-3 px-2">
                      <p className="font-semibold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {item.milestoneInfo && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                            <Layers className="h-2.5 w-2.5 text-slate-400" />
                            {item.milestoneInfo}
                          </span>
                        )}
                        {item.categoryOrRef && (
                          <span className="text-[10px] text-slate-400 truncate max-w-44">
                            {item.categoryOrRef}
                          </span>
                        )}
                        {typeof item.remainingAmount === "number" && item.remainingAmount > 0 && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/50">
                            {formatMoney(item.remainingAmount)} remaining
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="py-3 px-2">
                      {item.clientName ? (
                        <div className="flex items-center gap-1.5">
                          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                            {item.clientName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {item.clientName}
                            </p>
                            {item.clientEmail && (
                              <p className="text-[10px] text-slate-400 truncate max-w-32">
                                {item.clientEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Professional */}
                    <td className="py-3 px-2">
                      {item.proName ? (
                        <div className="flex items-center gap-1.5">
                          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                            {item.proName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {item.proName}
                            </p>
                            {item.proEmail && (
                              <p className="text-[10px] text-slate-400 truncate max-w-32">
                                {item.proEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Client Paid (Gross) */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {item.clientPaid !== null && item.clientPaid !== undefined ? (
                        <div>
                          <p className="font-bold text-slate-900">{formatMoney(item.clientPaid)}</p>
                          {item.baseAmount && (
                            <p className="text-[10px] text-slate-400">
                              Base: {formatMoney(item.baseAmount)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Platform Net (CLEAN: No "fee + commission" label!) */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {item.adminNet !== null && item.adminNet !== undefined ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          +{formatMoney(item.adminNet)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Pro Payout */}
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      {item.proPayout !== null && item.proPayout !== undefined ? (
                        <span className="font-semibold text-slate-800">
                          {formatMoney(item.proPayout)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 pr-5 pl-2 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {isFundedPayment && (
                          <button
                            type="button"
                            disabled={busyId === item.refId}
                            onClick={() => handleApprovePayout(item.refId)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-500 shadow-2xs transition disabled:opacity-50"
                          >
                            {busyId === item.refId ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <FileCheck2 className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                        )}

                        {isPendingWithdrawal && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyId === item.refId}
                              onClick={() => handleWithdrawalStatus(item.refId, "COMPLETED")}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === item.refId}
                              onClick={() => handleWithdrawalStatus(item.refId, "FAILED")}
                              className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {isPayment && item.paymentRaw && (
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(item.paymentRaw!)}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-2xs transition"
                            title="Inspect Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredItems.length && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Deep-Dive Slide-Over Drawer */}
      {selectedPayment && (
        <TransactionDrawer
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onApprovePayout={handleApprovePayout}
          isBusy={busyId === selectedPayment.id}
          names={data?.names ?? {}}
          onCopy={copyToClipboard}
          copySuccess={copySuccess}
        />
      )}
    </div>
  );
}

// =========================================================================
// SUB-COMPONENTS
// =========================================================================

function TabButton({
  active,
  onClick,
  label,
  badge,
  badgeTone = "slate",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  badgeTone?: "slate" | "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
        active
          ? "bg-indigo-600 text-white shadow-2xs"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span>{label}</span>
      {typeof badge === "number" && (
        <span
          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            active
              ? "bg-white/20 text-white"
              : badgeTone === "amber" && badge > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function KindBadge({ kind, provider }: { kind: string; provider: string }) {
  if (kind === "PAYMENT") {
    return (
      <span
        className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${
          provider === "RAZORPAY"
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "bg-purple-50 text-purple-700 border border-purple-200"
        }`}
      >
        {provider}
      </span>
    );
  }
  if (kind === "TOP_UP") {
    return (
      <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        Top-up
      </span>
    );
  }
  if (kind === "WITHDRAWAL") {
    return (
      <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        Payout
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
      Ledger
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  }
  if (status === "FUNDED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
        <ShieldCheck className="h-3 w-3" />
        In Escrow
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3" />
      {status}
    </span>
  );
}

// -------------------------------------------------------------------------
// TRANSACTION DEEP-DIVE SLIDE-OVER DRAWER
// -------------------------------------------------------------------------

function TransactionDrawer({
  payment,
  onClose,
  onApprovePayout,
  isBusy,
  names,
  onCopy,
  copySuccess,
}: {
  payment: EnrichedPayment;
  onClose: () => void;
  onApprovePayout: (id: number) => void;
  isBusy: boolean;
  names: Record<string, string>;
  onCopy: (text: string, label: string) => void;
  copySuccess: string | null;
}) {
  const clientName = getUserDisplayName(
    payment.client,
    names[payment.clientId] || `Client #${payment.clientId}`,
  );

  const proName = getUserDisplayName(
    payment.professional,
    names[payment.professionalId] || `Professional #${payment.professionalId}`,
  );

  const baseAmount = payment.baseAmount;
  const clientFee = payment.clientFeeAmount || Math.ceil(baseAmount * 0.1);
  const proComm = payment.commissionAmount || Math.ceil(baseAmount * 0.1);
  const totalCharged = payment.amount;
  const proPayout = payment.professionalPayoutAmount || Math.max(0, baseAmount - proComm);
  const adminNet = payment.adminNetAmount || clientFee + proComm;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                Transaction #{payment.id}
              </span>
              <StatusBadge status={payment.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Created: {formatDate(payment.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Financial Waterfall Card */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                Financial Breakdown
              </span>
              <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-full">
                {payment.currency}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Milestone Base Agreed:</span>
                <span className="font-semibold text-slate-900">{formatMoney(baseAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>(+) Client Convenience Fee:</span>
                <span>+{formatMoney(clientFee)}</span>
              </div>
              <div className="border-t border-indigo-200/60 pt-2 flex justify-between font-bold text-slate-900">
                <span>Total Client Paid:</span>
                <span className="text-sm text-indigo-950">{formatMoney(totalCharged)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-medium">
                <span>(-) Pro Commission Deducted:</span>
                <span>-{formatMoney(proComm)}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-semibold">
                <span>Net Disbursed to Professional:</span>
                <span>{formatMoney(proPayout)}</span>
              </div>
            </div>

            {/* Admin Net Highlight */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  Platform Net Profit
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Retained platform cash earnings
                </p>
              </div>
              <p className="text-xl font-black text-emerald-800">+{formatMoney(adminNet)}</p>
            </div>
          </div>

          {/* 2. Project & Milestone Context */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              Project Context & Progress
            </h4>

            <div>
              <p className="font-bold text-slate-900 text-sm">
                {payment.jobTitle || "Direct Milestone Project"}
              </p>
              {payment.jobCategory && (
                <span className="mt-1 inline-block text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {payment.jobCategory}
                </span>
              )}
            </div>

            {/* Milestones Roadmap List */}
            {payment.milestonesList && payment.milestonesList.length > 0 ? (
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700">
                  Project Milestones Breakdown:
                </p>
                <div className="space-y-1.5">
                  {payment.milestonesList.map((m, idx) => {
                    const isCurrent = m.id === payment.milestoneId;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          isCurrent
                            ? "border-indigo-300 bg-indigo-50/50"
                            : "border-slate-100 bg-slate-50/60"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>#{idx + 1}</span> {m.title}
                            {isCurrent && (
                              <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Status: <span className="font-semibold text-slate-600">{m.status}</span>
                          </p>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
                          {formatMoney(m.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Remaining project amounts */}
                <div className="mt-2.5 flex items-center justify-between bg-slate-100/70 p-2.5 rounded-xl text-xs">
                  <span className="font-medium text-slate-600">Remaining Project Balance:</span>
                  <span className="font-bold text-amber-700">
                    {formatMoney(payment.projectRemainingAmount ?? 0)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* 3. Client & Pro Dossier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Client Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Client
              </span>
              <p className="font-bold text-slate-900 text-xs">{clientName}</p>
              <p className="text-[11px] text-slate-500 break-all">{payment.client?.email || "—"}</p>
              {payment.client?.phone && (
                <p className="text-[11px] text-slate-400">{payment.client.phone}</p>
              )}
            </div>

            {/* Professional Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Professional
              </span>
              <p className="font-bold text-slate-900 text-xs">{proName}</p>
              <p className="text-[11px] text-slate-500 break-all">
                {payment.professional?.email || "—"}
              </p>
              {payment.professional?.phone && (
                <p className="text-[11px] text-slate-400">{payment.professional.phone}</p>
              )}
            </div>
          </div>

          {/* 4. Payment Gateway & Audit Info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Gateway Audit Log
            </h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Provider:</span>
                <span className="font-semibold text-slate-800">{payment.provider}</span>
              </div>

              {payment.razorpayOrderId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Razorpay Order ID:</span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-800">
                    <span>{payment.razorpayOrderId}</span>
                    <button
                      type="button"
                      onClick={() => onCopy(payment.razorpayOrderId!, "order")}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copySuccess === "order" && (
                      <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                    )}
                  </div>
                </div>
              )}

              {payment.razorpayPaymentId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Razorpay Payment ID:</span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-800">
                    <span>{payment.razorpayPaymentId}</span>
                    <button
                      type="button"
                      onClick={() => onCopy(payment.razorpayPaymentId!, "payment")}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copySuccess === "payment" && (
                      <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>
                    )}
                  </div>
                </div>
              )}

              {payment.failureReason && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-rose-700">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Failure Reason:
                  </p>
                  <p className="mt-0.5 text-xs">{payment.failureReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>

          {payment.status === "FUNDED" && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onApprovePayout(payment.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-2xs transition disabled:opacity-50"
            >
              {isBusy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Approve Milestone Payout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
