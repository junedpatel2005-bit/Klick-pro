"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageActionLoading } from "@/components/PageActionLoading";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  FileCheck2,
  Landmark,
  Layers,
  Mail,
  Percent,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
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
  isVerified?: boolean;
  phoneVerifiedAt?: string | null;
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
  clientName?: string | null;
  professionalName?: string | null;
  projectTitle?: string | null;
  milestoneTitle?: string | null;
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
  topupRaw?: WalletTopUp;
  ledgerRaw?: PlatformLedgerItem;
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
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [selectedTopUp, setSelectedTopUp] = useState<UnifiedItem | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<UnifiedItem | null>(null);
  const [selectedGenericItem, setSelectedGenericItem] = useState<UnifiedItem | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  function handleInspectItem(item: UnifiedItem) {
    if (item.paymentRaw) {
      setSelectedPayment(item.paymentRaw);
    } else if (item.withdrawalRaw) {
      setSelectedWithdrawal(item.withdrawalRaw);
    } else if (item.topupRaw) {
      setSelectedTopUp(item);
    } else if (item.ledgerRaw) {
      setSelectedLedger(item);
    } else {
      setSelectedGenericItem(item);
    }
  }
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    action: () => Promise<void>;
  } | null>(null);
  const [razorpayChoice, setRazorpayChoice] = useState<{
    withdrawal: Withdrawal;
    candidates: EnrichedPayment[];
  } | null>(null);

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

  useRealtimeRefresh(
    [
      "servio:admin-operations-update",
      "servio:admin-overview-update",
      "servio:project-update",
      "servio:notification",
    ],
    () => void fetchFinance(),
  );

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
      .filter((p) => p.status === "FUNDED" || p.status === "AWAITING_ADMIN_APPROVAL")
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

    // 1. Milestone Payments: 2 entries (1. Milestone Money, 2. Platform Commission)
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

      // Entry 1: Milestone Money
      items.push({
        id: `payment-${p.id}-milestone`,
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
        clientPaid: p.baseAmount || p.amount,
        baseAmount: p.baseAmount,
        adminNet: null,
        proPayout,
        status: p.status,
        provider: p.provider,
        paymentRaw: p,
      });

      // Entry 2: Platform Commission (10%)
      if (adminNet > 0 || clientFee > 0) {
        items.push({
          id: `payment-${p.id}-commission`,
          kind: "PAYMENT",
          refId: p.id,
          date: p.createdAt,
          title: `Platform Commission · ${p.jobTitle || "Direct Milestone Project"}`,
          categoryOrRef: "Platform Commission (10%)",
          milestoneInfo: p.milestoneTitle
            ? `Commission: ${p.milestoneTitle}`
            : "Platform Commission (10%)",
          remainingAmount: null,
          clientName,
          clientEmail: p.client?.email,
          proName,
          proEmail: p.professional?.email,
          clientPaid: clientFee,
          baseAmount: null,
          adminNet,
          proPayout: null,
          status: p.status,
          provider: p.provider,
          paymentRaw: p,
        });
      }
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
        topupRaw: topup,
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
        title: tx.projectTitle || tx.type.replaceAll("_", " "),
        categoryOrRef: tx.description,
        milestoneInfo: tx.milestoneTitle || null,
        remainingAmount: null,
        clientName: tx.clientName || null,
        clientEmail: null,
        proName: tx.professionalName || null,
        proEmail: null,
        clientPaid: tx.amount > 0 ? tx.amount : null,
        baseAmount: null,
        adminNet: tx.amount >= 0 ? tx.amount : null,
        proPayout: tx.amount < 0 ? Math.abs(tx.amount) : null,
        status: tx.status,
        provider: "TREASURY",
        ledgerRaw: tx,
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
      list = list.filter(
        (i) =>
          i.kind === "PAYMENT" && (i.status === "FUNDED" || i.status === "AWAITING_ADMIN_APPROVAL"),
      );
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

  function handleApprovePayout(paymentId: number) {
    setConfirmAction({
      title: "Release Milestone Payout?",
      description: `Are you sure you want to release the milestone payout for transaction #${paymentId}? This will credit the professional's wallet.`,
      confirmLabel: "Release Payout",
      action: async () => {
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
          toast.success(`Milestone payout #${paymentId} released successfully.`);
          await fetchFinance();
          if (selectedPayment?.id === paymentId) {
            setSelectedPayment((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Payout failed.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  // Razorpay Route moves the money out from one specific captured payment, so
  // the admin has to choose which settlement funds this withdrawal.
  function eligiblePaymentsFor(withdrawal: Withdrawal) {
    return (data?.payments ?? []).filter(
      (payment) =>
        payment.professionalId === withdrawal.professionalId &&
        payment.status === "COMPLETED" &&
        Boolean(payment.razorpayPaymentId),
    );
  }

  function handlePayViaRazorpay(withdrawal: Withdrawal) {
    const candidates = eligiblePaymentsFor(withdrawal);
    if (candidates.length === 0) {
      toast.error(
        "No captured Razorpay payment is available for this professional. Approve manually or capture a payment first.",
      );
      return;
    }
    const first = candidates[0];
    if (candidates.length === 1 && first) {
      executeRazorpayPayout(withdrawal, first);
      return;
    }
    setRazorpayChoice({ withdrawal, candidates });
  }

  function executeRazorpayPayout(withdrawal: Withdrawal, payment: EnrichedPayment) {
    setConfirmAction({
      title: "Send Payout via Razorpay?",
      description: `This transfers ₹${withdrawal.amount.toLocaleString("en-IN")} to the professional's linked Razorpay account from payment #${payment.id}. This cannot be undone.`,
      confirmLabel: "Send Payout",
      action: async () => {
        setBusyId(withdrawal.id);
        try {
          const response = await fetch("/api/admin/finance/payouts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ withdrawalId: withdrawal.id, paymentId: payment.id }),
          });
          const res = await response.json().catch(() => null);
          if (!response.ok) throw new Error(res?.error ?? "Razorpay payout failed.");
          toast.success(`Withdrawal #${withdrawal.id} paid out via Razorpay.`);
          await fetchFinance();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Razorpay payout failed.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleWithdrawalStatus(
    withdrawalId: number,
    status: "COMPLETED" | "FAILED",
    failureReason?: string,
  ) {
    const isCompleted = status === "COMPLETED";
    setConfirmAction({
      title: isCompleted ? "Approve Payout as Paid?" : "Reject Withdrawal Request?",
      description: isCompleted
        ? `Are you sure you want to mark withdrawal #${withdrawalId} as paid? This records that the funds have been sent to the professional's destination.`
        : `Are you sure you want to reject withdrawal #${withdrawalId}? Reserved funds will be returned to the professional's wallet.`,
      confirmLabel: isCompleted ? "Approve Payout" : "Reject Withdrawal",
      variant: status === "FAILED" ? "destructive" : "default",
      action: async () => {
        setBusyId(withdrawalId);
        try {
          const res = await fetch(`/api/admin/finance/withdrawals/${withdrawalId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status,
              ...(failureReason ? { failureReason } : {}),
            }),
          });
          const d = await res.json().catch(() => null);
          if (!res.ok) throw new Error(d?.error ?? "Failed to update withdrawal.");
          toast.success(
            `Withdrawal #${withdrawalId} ${isCompleted ? "approved as paid" : "rejected"}.`,
          );
          if (selectedWithdrawal?.id === withdrawalId) {
            setSelectedWithdrawal(null);
          }
          await fetchFinance();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error updating withdrawal.");
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function promptRejectWithdrawal(w: Withdrawal) {
    const reason = window.prompt(
      `Enter reason for rejecting withdrawal #${w.id} (funds will be restored to professional's balance):`,
      "Invalid bank account or IFSC code provided.",
    );
    if (reason !== null) {
      handleWithdrawalStatus(w.id, "FAILED", reason.trim() || "Rejected by admin.");
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
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-slate-200" />
          ) : (
            <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
              {formatMoney(metrics.grossVolume)}
            </p>
          )}
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
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-emerald-200/70" />
          ) : (
            <p className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
              +{formatMoney(metrics.platformCommission)}
            </p>
          )}
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
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-slate-200" />
          ) : (
            <p className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
              {formatMoney(metrics.proDisbursements)}
            </p>
          )}
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
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-amber-200/70" />
          ) : (
            <p className="mt-2 text-xl sm:text-2xl font-black text-amber-900">
              {formatMoney(metrics.inEscrow)}
            </p>
          )}
          {loading ? (
            <div className="mt-1 h-3.5 w-24 animate-pulse rounded bg-amber-200/50" />
          ) : (
            <p className="mt-0.5 text-[11px] text-amber-700 font-medium">
              {data?.payments.filter((p) => p.status === "FUNDED").length ?? 0} waiting payout
            </p>
          )}
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
          {loading ? (
            <div className="mt-2 h-7 w-28 animate-pulse rounded-md bg-indigo-200/70" />
          ) : (
            <p className="mt-2 text-xl sm:text-2xl font-black text-indigo-950">
              {formatMoney(metrics.adminBalance)}
            </p>
          )}
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
            badge={
              data?.payments.filter(
                (p) => p.status === "FUNDED" || p.status === "AWAITING_ADMIN_APPROVAL",
              ).length
            }
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
              <option value="AWAITING_ADMIN_APPROVAL">Awaiting Approval</option>
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
                const isFundedPayment =
                  isPayment &&
                  (item.status === "FUNDED" || item.status === "AWAITING_ADMIN_APPROVAL");
                const isPendingWithdrawal = item.kind === "WITHDRAWAL" && item.status === "PENDING";

                return (
                  <tr
                    key={item.id}
                    onClick={() => handleInspectItem(item)}
                    className="group transition-colors cursor-pointer hover:bg-indigo-50/30"
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
                        {item.id.endsWith("-commission") ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            <Percent className="h-2.5 w-2.5 text-amber-500" />
                            Platform Commission
                          </span>
                        ) : item.id.endsWith("-milestone") ? (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                            <Briefcase className="h-2.5 w-2.5 text-indigo-500" />
                            Milestone Money
                          </span>
                        ) : null}
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

                        {isPendingWithdrawal && item.withdrawalRaw && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === item.refId}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWithdrawalStatus(item.refId, "COMPLETED");
                              }}
                              title="Mark completed without sending money through Razorpay"
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === item.refId}
                              onClick={(e) => {
                                e.stopPropagation();
                                promptRejectWithdrawal(item.withdrawalRaw!);
                              }}
                              className="rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Always available Eye button for ANY transaction */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectItem(item);
                          }}
                          className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 shadow-2xs transition active:scale-95"
                          title="Inspect all transaction details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {loading &&
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-4 px-5">
                      <div className="h-4 bg-slate-100 rounded-md w-full" />
                    </td>
                  </tr>
                ))}

              {!loading && !filteredItems.length && (
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

      {/* Withdrawal Deep-Dive Slide-Over Drawer */}
      {selectedWithdrawal && (
        <WithdrawalDrawer
          withdrawal={selectedWithdrawal}
          user={data?.usersById?.[selectedWithdrawal.professionalId] ?? null}
          onClose={() => setSelectedWithdrawal(null)}
          onApprove={(id) => handleWithdrawalStatus(id, "COMPLETED")}
          onReject={promptRejectWithdrawal}
          onPayRazorpay={handlePayViaRazorpay}
          isBusy={busyId === selectedWithdrawal.id}
          onCopy={copyToClipboard}
          copySuccess={copySuccess}
        />
      )}

      {/* Client Top-Up Deep-Dive Slide-Over Drawer */}
      {selectedTopUp && (
        <TopUpDrawer
          item={selectedTopUp}
          user={data?.usersById?.[selectedTopUp.topupRaw?.wallet.userId ?? 0] ?? null}
          onClose={() => setSelectedTopUp(null)}
          onCopy={copyToClipboard}
          copySuccess={copySuccess}
        />
      )}

      {/* Treasury Ledger Deep-Dive Slide-Over Drawer */}
      {selectedLedger && (
        <LedgerDrawer
          item={selectedLedger}
          onClose={() => setSelectedLedger(null)}
          onCopy={copyToClipboard}
          copySuccess={copySuccess}
        />
      )}

      {/* Generic Activity Deep-Dive Slide-Over Drawer */}
      {selectedGenericItem && (
        <GenericActivityDrawer
          item={selectedGenericItem}
          onClose={() => setSelectedGenericItem(null)}
          onCopy={copyToClipboard}
          copySuccess={copySuccess}
        />
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
        loading={busyId !== null}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
          }
        }}
      />

      {/* Razorpay Route moves money from one captured payment, so when a
          professional has several the admin picks the settlement to draw from. */}
      {razorpayChoice && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose payout source"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-800">
              Fund this payout from which payment?
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              ₹{razorpayChoice.withdrawal.amount.toLocaleString("en-IN")} for withdrawal #
              {razorpayChoice.withdrawal.id}. Razorpay moves the money out of the selected captured
              payment.
            </p>
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {razorpayChoice.candidates.map((payment) => (
                <li key={payment.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const { withdrawal } = razorpayChoice;
                      setRazorpayChoice(null);
                      executeRazorpayPayout(withdrawal, payment);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        Payment #{payment.id} ·{" "}
                        {getUserDisplayName(payment.professional, "Professional")}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-slate-500">
                        {payment.razorpayPaymentId}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-slate-700">
                      ₹{payment.amount.toLocaleString("en-IN")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setRazorpayChoice(null)}
              className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <PageActionLoading
        active={busyId !== null}
        title="Processing transaction…"
        description="Updating transaction records and ledger balances."
      />
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
  if (status === "AWAITING_ADMIN_APPROVAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
        <Clock className="h-3 w-3" />
        Awaiting Approval
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
// WITHDRAWAL DEEP-DIVE SLIDE-OVER DRAWER
// -------------------------------------------------------------------------

function WithdrawalDrawer({
  withdrawal,
  user,
  onClose,
  onApprove,
  onReject,
  onPayRazorpay,
  isBusy,
  onCopy,
  copySuccess,
}: {
  withdrawal: Withdrawal;
  user?: UserProfile | null;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (withdrawal: Withdrawal) => void;
  onPayRazorpay: (withdrawal: Withdrawal) => void;
  isBusy: boolean;
  onCopy: (text: string, label: string) => void;
  copySuccess: string | null;
}) {
  let parsedDest: {
    type?: string;
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
    upiHolder?: string;
    cardHolder?: string;
    cardNumber?: string;
    cardBank?: string;
  } | null = null;

  try {
    if (withdrawal.destinationLabel) {
      parsedDest = JSON.parse(withdrawal.destinationLabel);
    }
  } catch {
    // legacy string fallback
  }

  const methodType = (parsedDest?.type || withdrawal.destinationType || "BANK").toUpperCase();
  const isBank = methodType === "BANK";
  const isUpi = methodType === "UPI";
  const isCard = methodType === "CARD";

  const isPending = withdrawal.status === "PENDING";
  const isCompleted = withdrawal.status === "COMPLETED";

  const proName = user?.name || `Professional #${withdrawal.professionalId}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                Withdrawal #{withdrawal.id}
              </span>
              <StatusBadge status={withdrawal.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Requested: {formatDate(withdrawal.createdAt)}
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

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount & Method Card */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Payout Amount
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold backdrop-blur-xs border border-white/10 text-white">
                {isBank && <Building2 className="h-3.5 w-3.5 text-emerald-300" />}
                {isUpi && <Smartphone className="h-3.5 w-3.5 text-cyan-300" />}
                {isCard && <CreditCard className="h-3.5 w-3.5 text-amber-300" />}
                {isBank
                  ? "Bank Transfer"
                  : isUpi
                    ? "UPI Transfer"
                    : isCard
                      ? "Debit Card"
                      : "Payout"}
              </span>
            </div>
            <p className="mt-3 font-display text-4xl font-black tracking-tight">
              ₹{withdrawal.amount.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Currency: {withdrawal.currency || "INR"} · Status: {withdrawal.status}
            </p>
          </div>

          {/* Professional User Details Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Professional Details
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                <User className="h-3 w-3" /> Professional #{withdrawal.professionalId}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 border border-indigo-100 font-bold text-indigo-700 text-lg">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "PRO"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-base">{proName}</p>
                  {user?.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  )}
                </div>
                {user?.companyName && (
                  <p className="text-xs text-slate-500 mt-0.5">{user.companyName}</p>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 pt-2 text-xs">
              {/* Email */}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> Email
                </span>
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span>{user?.email || "—"}</span>
                  {user?.email && (
                    <button
                      type="button"
                      onClick={() => onCopy(user.email, "Email")}
                      className="text-slate-400 hover:text-indigo-600 transition p-1"
                      title="Copy email"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone
                </span>
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span>{user?.phone || "No phone registered"}</span>
                  {user?.phone && (
                    <button
                      type="button"
                      onClick={() => onCopy(user.phone!, "Phone")}
                      className="text-slate-400 hover:text-indigo-600 transition p-1"
                      title="Copy phone"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {user?.phoneVerifiedAt ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      OTP Verified
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Structured Payout Destination Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Payout Destination & Beneficiary
              </h3>
              <span className="text-xs font-semibold text-slate-600">
                {isBank ? "Bank Account" : isUpi ? "UPI ID" : isCard ? "Debit Card" : "Direct"}
              </span>
            </div>

            {/* If BANK */}
            {isBank && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Bank Name</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {parsedDest?.bankName || "Bank Transfer"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Account Holder</span>
                    <span className="font-semibold text-slate-800">
                      {parsedDest?.accountHolder || proName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Account Number</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 text-sm bg-white px-2 py-1 rounded border border-slate-200">
                      <span>{parsedDest?.accountNumber || withdrawal.destinationLabel || "—"}</span>
                      {(parsedDest?.accountNumber || withdrawal.destinationLabel) && (
                        <button
                          type="button"
                          onClick={() =>
                            onCopy(
                              parsedDest?.accountNumber || withdrawal.destinationLabel || "",
                              "Account Number",
                            )
                          }
                          className="text-slate-400 hover:text-indigo-600 p-0.5 transition"
                          title="Copy Account Number"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">IFSC Code</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200">
                      <span>{parsedDest?.ifsc || "—"}</span>
                      {parsedDest?.ifsc && (
                        <button
                          type="button"
                          onClick={() => onCopy(parsedDest?.ifsc || "", "IFSC Code")}
                          className="text-slate-400 hover:text-indigo-600 p-0.5 transition"
                          title="Copy IFSC"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If UPI */}
            {isUpi && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Registered Name</span>
                    <span className="font-semibold text-slate-800">
                      {parsedDest?.upiHolder || proName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">UPI ID / VPA</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-700 bg-indigo-50/50 px-2.5 py-1 rounded border border-indigo-200 text-sm">
                      <span>{parsedDest?.upiId || withdrawal.destinationLabel || "—"}</span>
                      {(parsedDest?.upiId || withdrawal.destinationLabel) && (
                        <button
                          type="button"
                          onClick={() =>
                            onCopy(parsedDest?.upiId || withdrawal.destinationLabel || "", "UPI ID")
                          }
                          className="text-indigo-400 hover:text-indigo-700 p-0.5 transition"
                          title="Copy UPI ID"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If CARD */}
            {isCard && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Cardholder Name</span>
                    <span className="font-semibold text-slate-800">
                      {parsedDest?.cardHolder || proName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Issuing Bank</span>
                    <span className="font-bold text-slate-900">
                      {parsedDest?.cardBank || "Debit Card"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Card Number</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-sm">
                      <span>{parsedDest?.cardNumber || withdrawal.destinationLabel || "—"}</span>
                      {(parsedDest?.cardNumber || withdrawal.destinationLabel) && (
                        <button
                          type="button"
                          onClick={() =>
                            onCopy(
                              parsedDest?.cardNumber || withdrawal.destinationLabel || "",
                              "Card Number",
                            )
                          }
                          className="text-slate-400 hover:text-indigo-600 p-0.5 transition"
                          title="Copy Card Number"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback plain string */}
            {!isBank && !isUpi && !isCard && (
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-2">
                <span className="text-xs text-slate-500">Destination Details</span>
                <div className="flex items-center justify-between font-mono text-xs font-semibold text-slate-800 bg-white p-2.5 rounded border border-slate-200">
                  <span>{withdrawal.destinationLabel || "—"}</span>
                  {withdrawal.destinationLabel && (
                    <button
                      type="button"
                      onClick={() => onCopy(withdrawal.destinationLabel!, "Destination")}
                      className="text-slate-400 hover:text-indigo-600 p-0.5 transition"
                      title="Copy destination"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Failure reason if rejected */}
          {withdrawal.failureReason && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs space-y-1">
              <p className="font-bold text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600" /> Rejection Reason
              </p>
              <p className="text-rose-700 leading-relaxed pl-5.5">{withdrawal.failureReason}</p>
            </div>
          )}

          {/* Copy feedback */}
          {copySuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 text-center animate-in fade-in duration-200">
              ✓ {copySuccess} copied to clipboard!
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          {isPending ? (
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onApprove(withdrawal.id)}
                className="w-full sm:flex-1 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & Mark as Paid
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onReject(withdrawal)}
                className="w-full sm:w-auto rounded-xl border border-rose-200 bg-rose-50 py-2.5 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reject Payout
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onPayRazorpay(withdrawal)}
                title="Send money automatically via linked Razorpay Route"
                className="w-full sm:w-auto rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
              >
                Razorpay
              </button>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              This withdrawal was paid and completed.
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
              <XCircle className="h-4 w-4" />
              This withdrawal was rejected. Funds returned to professional wallet.
            </div>
          )}
        </div>
      </div>
    </div>
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

          {(payment.status === "FUNDED" || payment.status === "AWAITING_ADMIN_APPROVAL") && (
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

// -------------------------------------------------------------------------
// TOP-UP DEEP-DIVE SLIDE-OVER DRAWER
// -------------------------------------------------------------------------

function TopUpDrawer({
  item,
  user,
  onClose,
  onCopy,
  copySuccess,
}: {
  item: UnifiedItem;
  user?: UserProfile | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  copySuccess: string | null;
}) {
  const topup = item.topupRaw;
  if (!topup) return null;

  const clientName = getUserDisplayName(user, item.clientName || `Client #${topup.wallet.userId}`);

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
                Top-up #{topup.id}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Wallet Top-up
              </span>
              <StatusBadge status={topup.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Created: {formatDate(topup.createdAt)}
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
          {/* Top-up Amount Card */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Wallet Credit Amount
            </span>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-black text-emerald-950">+{formatMoney(topup.amount)}</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                INR Deposit
              </span>
            </div>
            <p className="text-xs text-emerald-700">
              Funds credited directly to client balance for job funding and escrow milestone
              locking.
            </p>
          </div>

          {/* Client Account Dossier */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              Client Account Details
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Client Name:</span>
                <span className="font-bold text-slate-900">{clientName}</span>
              </div>
              {(user?.email || item.clientEmail) && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800">
                    {user?.email || item.clientEmail}
                  </span>
                </div>
              )}
              {user?.phone && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-medium text-slate-800">{user.phone}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Client User ID:</span>
                <span className="font-mono font-semibold text-slate-700">
                  #{topup.wallet.userId}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Account Type:</span>
                <span className="font-semibold text-slate-800">Marketplace Client</span>
              </div>
            </div>
          </div>

          {/* Gateway & Payment Reference */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-slate-400" />
              Payment Gateway Reference
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-semibold text-slate-800">
                  {topup.providerReference ? "Razorpay Gateway" : "Direct Wallet Deposit"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Reference / Order ID:</span>
                <div className="flex items-center gap-1.5 font-mono text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  <span>{topup.providerReference || "WALLET_INTERNAL"}</span>
                  {topup.providerReference && (
                    <button
                      type="button"
                      onClick={() => onCopy(topup.providerReference!, "Reference ID")}
                      className="text-slate-400 hover:text-indigo-600 transition"
                      title="Copy reference"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Transaction Status:</span>
                <span className="font-semibold text-emerald-700">{topup.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Timestamp:</span>
                <span className="font-medium text-slate-600">{formatDate(topup.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Copy feedback */}
          {copySuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 text-center animate-in fade-in duration-200">
              ✓ {copySuccess} copied to clipboard!
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// TREASURY LEDGER DEEP-DIVE SLIDE-OVER DRAWER
// -------------------------------------------------------------------------

function LedgerDrawer({
  item,
  onClose,
  onCopy,
  copySuccess,
}: {
  item: UnifiedItem;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  copySuccess: string | null;
}) {
  const ledger = item.ledgerRaw;
  if (!ledger) return null;

  const isCredit = ledger.amount >= 0;

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
                Ledger #{ledger.id}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {ledger.type.replaceAll("_", " ")}
              </span>
              <StatusBadge status={ledger.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Created: {formatDate(ledger.createdAt)}
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
          {/* Treasury Impact Card */}
          <div
            className={`rounded-2xl border p-5 space-y-2 ${
              isCredit ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/80"
            }`}
          >
            <span
              className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isCredit ? "text-emerald-800" : "text-slate-700"
              }`}
            >
              <Landmark className="h-4 w-4" />
              Treasury Cashflow Movement
            </span>
            <div className="flex items-baseline justify-between">
              <p
                className={`text-3xl font-black ${
                  isCredit ? "text-emerald-950" : "text-slate-900"
                }`}
              >
                {isCredit
                  ? `+${formatMoney(ledger.amount)}`
                  : `-${formatMoney(Math.abs(ledger.amount))}`}
              </p>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isCredit ? "text-emerald-800 bg-emerald-100" : "text-slate-700 bg-slate-200"
                }`}
              >
                {isCredit ? "Treasury Credit" : "Treasury Disbursement"}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {isCredit
                ? "Cash received or retained in the platform escrow & operational treasury."
                : "Cash paid out from platform balances to partner accounts."}
            </p>
          </div>

          {/* Description & Narrative */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Transaction Narrative
            </span>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              {ledger.description || item.title || "Platform Treasury Operation"}
            </p>
          </div>

          {/* Associated Project Context */}
          {(ledger.projectTitle || ledger.milestoneTitle) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                Related Project / Milestone
              </span>
              <div className="space-y-1.5 text-xs">
                {ledger.projectTitle && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Project Title:</span>
                    <span className="font-bold text-slate-900">{ledger.projectTitle}</span>
                  </div>
                )}
                {ledger.milestoneTitle && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Milestone:</span>
                    <span className="font-semibold text-indigo-700">{ledger.milestoneTitle}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Associated Parties */}
          {(ledger.clientName || ledger.professionalName) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ledger.clientName && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Client
                  </span>
                  <p className="font-bold text-slate-900 text-xs">{ledger.clientName}</p>
                </div>
              )}
              {ledger.professionalName && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Professional
                  </span>
                  <p className="font-bold text-slate-900 text-xs">{ledger.professionalName}</p>
                </div>
              )}
            </div>
          )}

          {/* Audit Data */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Audit Record
            </span>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Ledger ID:</span>
              <span className="font-mono font-bold text-slate-800">#{ledger.id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Event Type:</span>
              <span className="font-mono text-slate-800">{ledger.type}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Recorded At:</span>
              <span className="text-slate-700">{formatDate(ledger.createdAt)}</span>
            </div>
          </div>

          {/* Copy feedback */}
          {copySuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 text-center animate-in fade-in duration-200">
              ✓ {copySuccess} copied to clipboard!
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// GENERIC ACTIVITY DEEP-DIVE SLIDE-OVER DRAWER
// -------------------------------------------------------------------------

function GenericActivityDrawer({
  item,
  onClose,
  onCopy,
  copySuccess,
}: {
  item: UnifiedItem;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  copySuccess: string | null;
}) {
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
                Ref #{item.refId}
              </span>
              <KindBadge kind={item.kind} provider={item.provider} />
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Recorded: {formatDate(item.date)}</p>
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
          {/* Main Info */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Transaction Details
            </span>
            <p className="text-base font-bold text-slate-900">{item.title}</p>
            {item.categoryOrRef && <p className="text-xs text-slate-500">{item.categoryOrRef}</p>}
            {item.milestoneInfo && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-700 mt-1">
                <Layers className="h-3 w-3 text-slate-500" />
                {item.milestoneInfo}
              </span>
            )}
          </div>

          {/* Financials Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-slate-400" />
              Financials
            </span>
            <div className="space-y-2 text-xs">
              {item.clientPaid !== null && item.clientPaid !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Gross Amount / Client Paid:</span>
                  <span className="font-bold text-slate-900">{formatMoney(item.clientPaid)}</span>
                </div>
              )}
              {item.adminNet !== null && item.adminNet !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Platform Net:</span>
                  <span className="font-bold text-emerald-700">+{formatMoney(item.adminNet)}</span>
                </div>
              )}
              {item.proPayout !== null && item.proPayout !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Professional Payout:</span>
                  <span className="font-bold text-slate-800">{formatMoney(item.proPayout)}</span>
                </div>
              )}
              {item.remainingAmount !== null && item.remainingAmount !== undefined && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Remaining Balance:</span>
                  <span className="font-bold text-amber-700">
                    {formatMoney(item.remainingAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Parties */}
          {(item.clientName || item.proName) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {item.clientName && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Client
                  </span>
                  <p className="font-bold text-slate-900 text-xs">{item.clientName}</p>
                  {item.clientEmail && (
                    <p className="text-[11px] text-slate-500 truncate">{item.clientEmail}</p>
                  )}
                </div>
              )}
              {item.proName && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Professional
                  </span>
                  <p className="font-bold text-slate-900 text-xs">{item.proName}</p>
                  {item.proEmail && (
                    <p className="text-[11px] text-slate-500 truncate">{item.proEmail}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Copy feedback */}
          {copySuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 text-center animate-in fade-in duration-200">
              ✓ {copySuccess} copied to clipboard!
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
