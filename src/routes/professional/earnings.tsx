"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Clock3,
  CreditCard,
  Download,
  FolderKanban,
  Landmark,
  LockKeyhole,
  Percent,
  ReceiptText,
  Search,
  ShieldCheck,
  Smartphone,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageActionLoading } from "@/components/PageActionLoading";
import { formatReadableLabel, capitalizeWords, capitalizeFirst } from "@/lib/utils";
import { LinkedAccountsCard } from "@/components/LinkedAccountsCard";
import { BankCombobox } from "@/components/BankCombobox";
import { IfscFinderDialog } from "@/components/IfscFinderDialog";
import { RecheckWithdrawalModal } from "@/components/RecheckWithdrawalModal";
import { WithdrawalDetailModal } from "@/components/WithdrawalDetailModal";
import {
  validateBankSpecificAccountNumber,
  getExpectedAccountLengthHint,
  lookupIfscCode,
  normalizeIfsc,
} from "@/lib/indian-banks";
type Transaction = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  invoicePaymentId: number | null;
};
type PaymentDetail = {
  id: number;
  amount: number;
  baseAmount: number;
  clientFeeAmount: number;
  professionalPayoutAmount: number;
  adminNetAmount: number;
  commissionAmount: number;
  currency: string;
  provider: string;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  failureReason: string | null;
  createdAt: string;
  capturedAt: string | null;
  milestone: { id: number; title: string; amount: number } | null;
};
type Withdrawal = {
  id: number;
  amount: number;
  status: string;
  destinationType?: string;
  destinationLabel: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string | null;
  payoutMode?: string | null;
  utr?: string | null;
  providerTransferId?: string | null;
};

type PayoutMethod = "BANK" | "UPI";

function parseDestinationSummary(destinationLabel: string | null, destinationType?: string) {
  if (!destinationLabel) return { label: "Payout destination", icon: Building2 };
  try {
    const data = JSON.parse(destinationLabel);
    if (data.type === "BANK" || destinationType === "BANK") {
      const bank = data.bankName ? `${capitalizeWords(data.bankName)} · ` : "";
      const last4 = data.accountNumber
        ? `A/C •••• ${data.accountNumber.slice(-4)}`
        : "Bank Account";
      return {
        label: `${bank}${last4}`,
        sub: data.accountHolder
          ? `Holder: ${capitalizeWords(data.accountHolder)} | IFSC: ${data.ifsc ?? "—"}`
          : undefined,
        icon: Building2,
      };
    }
    if (data.type === "UPI" || destinationType === "UPI") {
      return {
        label: `UPI · ${data.upiId}`,
        sub: data.upiHolder ? `Name: ${capitalizeWords(data.upiHolder)}` : undefined,
        icon: Smartphone,
      };
    }
    if (data.type === "CARD" || destinationType === "CARD") {
      const bank = data.cardBank ? `${capitalizeWords(data.cardBank)} · ` : "";
      const last4 = data.cardNumber ? `Card •••• ${data.cardNumber.slice(-4)}` : "Debit Card";
      return {
        label: `${bank}${last4}`,
        sub: data.cardHolder ? `Name: ${capitalizeWords(data.cardHolder)}` : undefined,
        icon: CreditCard,
      };
    }
  } catch {
    // Plain text fallback
  }
  return {
    label: destinationLabel,
    icon:
      destinationType === "UPI" ? Smartphone : destinationType === "CARD" ? CreditCard : Building2,
  };
}
type Wallet = {
  total: number;
  grossTotal?: number;
  commission: number;
  available: number;
  reserved: number;
  withdrawals: Withdrawal[];
  minWithdrawalAmount?: number;
};
type CompletedJob = {
  id: number;
  jobId: number;
  jobTitle: string;
  clientName: string;
  completedAt: string;
  amount: number;
  currency: string;
};
type LinkedAccount = {
  id: string;
  accountType: "BANK" | "UPI" | "CARD" | "RAZORPAY";
  accountHolder: string | null;
  accountNumber: string | null;
  last4: string | null;
  ifscCode: string | null;
  bankName: string | null;
  upiId: string | null;
  cardBank: string | null;
  razorpayAccountId: string | null;
  razorpayFundAccountId?: string | null;
  isDefault: boolean;
};

type StatKey = "available" | "total" | "month" | "reserved";
export default function Earnings() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const { data: proWalletData, refetch: refetchProWallet } = useQuery({
    queryKey: ["pro-wallet"],
    queryFn: async () => {
      const r = await fetch("/api/v1/wallet", { cache: "no-store" });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (proWalletData) {
      setWallet(proWalletData);
    }
  }, [proWalletData]);
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("BANK");
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [recheckModalOpen, setRecheckModalOpen] = useState(false);
  const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] = useState<Withdrawal | null>(null);
  const [ifscFinderOpen, setIfscFinderOpen] = useState(false);
  const [ifscBranch, setIfscBranch] = useState<string | null>(null);
  const [ifscVerifying, setIfscVerifying] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);

  // Profile Linked Accounts
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [selectedLinkedAccountId, setSelectedLinkedAccountId] = useState<string>("");

  // Bank Form State
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // UPI Form State
  const [upiId, setUpiId] = useState("");
  const [upiHolder, setUpiHolder] = useState("");
  const [vpaVerifying, setVpaVerifying] = useState(false);
  const [vpaVerified, setVpaVerified] = useState<boolean | null>(null);
  const [vpaCustomerName, setVpaCustomerName] = useState<string | null>(null);
  const [vpaError, setVpaError] = useState<string | null>(null);

  const [saveDetailsForFuture, setSaveDetailsForFuture] = useState(true);
  const [showRazorpayAdvanced, setShowRazorpayAdvanced] = useState(false);
  const [message, setMessage] = useState("");
  const [razorpayAccountId, setRazorpayAccountId] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetail | null>(null);
  const [paymentDetailsError, setPaymentDetailsError] = useState("");
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [historyFilter, setHistoryFilter] = useState<"all" | "milestones" | "disputes">("all");

  async function handleLookupIfsc(code: string) {
    const clean = normalizeIfsc(code);
    setIfscCode(clean);
    setIfscError(null);
    setIfscBranch(null);
    if (clean.length === 11) {
      setIfscVerifying(true);
      try {
        const res = await lookupIfscCode(clean);
        if (res.valid && res.bank) {
          setIfscBranch(`${res.bank} · ${res.branch} (${res.city})`);
          if (!bankName) setBankName(res.bank);
        } else {
          setIfscError(res.error || "Invalid IFSC code.");
        }
      } catch {
        setIfscError("Unable to verify IFSC code.");
      } finally {
        setIfscVerifying(false);
      }
    }
  }

  async function handleVerifyVpa(targetVpa?: string) {
    const toCheck = (targetVpa || upiId).trim().toLowerCase();
    if (!toCheck || !toCheck.includes("@")) {
      setVpaError("Please enter a valid UPI ID (e.g. rahul@upi)");
      setVpaVerified(false);
      return;
    }
    setVpaVerifying(true);
    setVpaError(null);
    try {
      const res = await fetch("/api/v1/wallet/verify-vpa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vpa: toCheck }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.valid) {
        setVpaVerified(true);
        setVpaCustomerName(null);
      } else {
        setVpaVerified(false);
        setVpaCustomerName(null);
        setVpaError(data?.error || "UPI ID could not be verified on NPCI.");
      }
    } catch {
      setVpaVerified(false);
      setVpaError("Failed to reach NPCI verification service.");
    } finally {
      setVpaVerifying(false);
    }
  }

  function applyLinkedAccount(acc: LinkedAccount) {
    if (acc.accountType === "BANK") {
      setPayoutMethod("BANK");
      setBankName(acc.bankName ?? "");
      setAccountHolder(acc.accountHolder ?? "");
      setAccountNumber(acc.accountNumber ?? "");
      setConfirmAccountNumber(acc.accountNumber ?? "");
      setIfscCode(acc.ifscCode ?? "");
    } else if (acc.accountType === "UPI") {
      setPayoutMethod("UPI");
      setUpiId(acc.upiId ?? "");
      setUpiHolder(acc.accountHolder ?? "");
      setVpaVerified(true);
      setVpaCustomerName(null);
      setVpaError(null);
    } else if (acc.accountType === "RAZORPAY") {
      setRazorpayAccountId(acc.razorpayAccountId ?? "");
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("klickpro_saved_payout_details");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.payoutMethod) setPayoutMethod(parsed.payoutMethod);
        if (parsed.bankName) setBankName(parsed.bankName);
        if (parsed.accountHolder) setAccountHolder(parsed.accountHolder);
        if (parsed.accountNumber) {
          setAccountNumber(parsed.accountNumber);
          setConfirmAccountNumber(parsed.accountNumber);
        }
        if (parsed.ifscCode) setIfscCode(parsed.ifscCode);
        if (parsed.upiId) setUpiId(parsed.upiId);
        if (parsed.upiHolder) setUpiHolder(parsed.upiHolder);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = () => {
    void refetchProWallet();
    void queryClient.invalidateQueries({ queryKey: ["pro-wallet"] });
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
    void fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { completedProjects?: CompletedJob[] } | null) =>
        setCompletedJobs(d?.completedProjects ?? []),
      )
      .catch(() => setCompletedJobs([]));
    void fetch("/api/v1/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setWallet)
      .catch(() => setWallet(null));
    void fetch("/api/professional/razorpay-account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { razorpayAccountId?: string | null } | null) =>
        setRazorpayAccountId(d?.razorpayAccountId ?? ""),
      )
      .catch(() => setRazorpayAccountId(""));
    void fetch("/api/v1/linked-accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { accounts?: LinkedAccount[] } | null) => {
        const accs = data?.accounts ?? [];
        setLinkedAccounts(accs);
        const def = accs.find((a) => a.isDefault) ?? accs[0];
        if (def) {
          applyLinkedAccount(def);
          setSelectedLinkedAccountId(def.id);
        }
      })
      .catch(() => setLinkedAccounts([]));
  };
  useEffect(() => {
    load();
    const handleLinkedUpdated = () => {
      load();
    };
    window.addEventListener("servio:linked-accounts-updated", handleLinkedUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeRefresh(["servio:project-update", "servio:notification", "servio:proposal"], load);
  const thisMonth = useMemo(
    () =>
      items
        ?.filter(
          (i) =>
            new Date(i.createdAt).getMonth() === new Date().getMonth() &&
            new Date(i.createdAt).getFullYear() === new Date().getFullYear(),
        )
        .reduce(
          (sum, i) => sum + (i.type === "PLATFORM_COMMISSION" ? -Math.abs(i.amount) : i.amount),
          0,
        ) ?? 0,
    [items],
  );
  const tabCounts = useMemo(
    () => ({
      all: (items ?? []).length,
      milestones: (items ?? []).filter(
        (i) => i.type !== "PLATFORM_COMMISSION" && i.type !== "DISPUTE_PAYOUT",
      ).length,
      disputes: (items ?? []).filter((i) => i.type === "DISPUTE_PAYOUT").length,
    }),
    [items],
  );
  const filteredItems = useMemo(
    () =>
      (items ?? []).filter((i) => {
        if (historyFilter === "milestones") {
          return i.type !== "PLATFORM_COMMISSION" && i.type !== "DISPUTE_PAYOUT";
        }
        if (historyFilter === "disputes") {
          return i.type === "DISPUTE_PAYOUT";
        }
        return true;
      }),
    [items, historyFilter],
  );

  const bankAccValidation = validateBankSpecificAccountNumber(accountNumber, bankName, ifscCode);

  const isBankValid =
    accountHolder.trim().length >= 2 &&
    bankAccValidation.valid &&
    accountNumber.trim() === confirmAccountNumber.trim() &&
    ifscCode.trim().length === 11;

  const isUpiValid =
    upiId.trim().includes("@") &&
    upiId.trim().length >= 4 &&
    upiHolder.trim().length >= 2;

  const isFormValid = payoutMethod === "BANK" ? isBankValid : isUpiValid;

  const minAmt = wallet?.minWithdrawalAmount ?? 500;
  const isAmountValid =
    Boolean(amount) &&
    Number(amount) >= minAmt &&
    wallet != null &&
    Number(amount) <= wallet.available;

  const canSubmit = isAmountValid && isFormValid && !actionBusy;

  function handleInitiateWithdraw() {
    if (!canSubmit) return;
    setRecheckModalOpen(true);
  }

  async function executeWithdrawal(updatedDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    accountHolder?: string;
    upiId?: string;
    upiHolder?: string;
  }) {
    if (!canSubmit) return;
    const finalAccountNumber = (updatedDetails?.accountNumber ?? accountNumber).trim();
    const finalIfscCode = (updatedDetails?.ifscCode ?? ifscCode).trim().toUpperCase();
    const finalAccountHolder = capitalizeWords((updatedDetails?.accountHolder ?? accountHolder).trim());
    const finalUpiId = (updatedDetails?.upiId ?? upiId).trim().toLowerCase();
    const finalUpiHolder = capitalizeWords((updatedDetails?.upiHolder ?? upiHolder).trim());

    if (updatedDetails?.accountNumber) setAccountNumber(updatedDetails.accountNumber);
    if (updatedDetails?.ifscCode) setIfscCode(updatedDetails.ifscCode);
    if (updatedDetails?.accountHolder) setAccountHolder(finalAccountHolder);
    if (updatedDetails?.upiId) setUpiId(updatedDetails.upiId);
    if (updatedDetails?.upiHolder) setUpiHolder(finalUpiHolder);

    setActionBusy("withdraw");
    setMessage("");
    try {
      let destinationLabel = "";
      if (payoutMethod === "BANK") {
        destinationLabel = JSON.stringify({
          type: "BANK",
          bankName: capitalizeWords(bankName.trim()),
          accountHolder: finalAccountHolder,
          accountNumber: finalAccountNumber,
          ifsc: finalIfscCode,
        });
      } else {
        destinationLabel = JSON.stringify({
          type: "UPI",
          upiId: finalUpiId,
          upiHolder: finalUpiHolder,
        });
      }

      if (saveDetailsForFuture) {
        try {
          localStorage.setItem(
            "klickpro_saved_payout_details",
            JSON.stringify({
              payoutMethod,
              bankName,
              accountHolder: finalAccountHolder,
              accountNumber: finalAccountNumber,
              ifscCode: finalIfscCode,
              upiId: finalUpiId,
              upiHolder: finalUpiHolder,
            }),
          );
        } catch {
          // ignore
        }
      }

      const r = await fetch("/api/v1/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          destinationType: payoutMethod,
          destinationLabel,
          saveDetails: saveDetailsForFuture,
          accountHolder: payoutMethod === "BANK" ? finalAccountHolder : finalUpiHolder,
          accountNumber: payoutMethod === "BANK" ? finalAccountNumber : undefined,
          ifscCode: payoutMethod === "BANK" ? finalIfscCode : undefined,
          bankName: payoutMethod === "BANK" ? bankName.trim() : undefined,
          upiId: payoutMethod === "UPI" ? finalUpiId : undefined,
          upiHolder: payoutMethod === "UPI" ? finalUpiHolder : undefined,
        }),
      });
      const d = await r.json().catch(() => null);
      setMessage(
        r.ok
          ? (d?.message ??
              `Withdrawal request of ₹${Number(amount).toLocaleString(
                "en-IN",
              )} submitted successfully! Your request has been forwarded to Admin for approval.`)
          : (d?.error ?? "Unable to submit withdrawal request."),
      );
      if (r.ok) {
        setAmount("");
        setWithdrawDialogOpen(false);
        setRecheckModalOpen(false);
        load();
      }
    } catch {
      setMessage("Network connection lost. Please check your internet connection and try again.");
    } finally {
      setActionBusy(null);
    }
  }
  async function saveRazorpayAccount() {
    setActionBusy("save-account");
    try {
      const response = await fetch("/api/professional/razorpay-account", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ razorpayAccountId: razorpayAccountId.trim() || null }),
      });
      const result = await response.json();
      setMessage(
        response.ok
          ? "Razorpay payout account saved."
          : (result.error ?? "Unable to save payout account."),
      );
    } finally {
      setActionBusy(null);
    }
  }
  async function openTransaction(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setSelectedPayment(null);
    setPaymentDetailsError("");
    if (!transaction.invoicePaymentId) return;
    const response = await fetch(`/api/v1/portal/payment-details/${transaction.invoicePaymentId}`, {
      cache: "no-store",
    });
    const detail = (await response.json().catch(() => null)) as PaymentDetail | null;
    if (response.ok && detail) setSelectedPayment(detail);
    else setPaymentDetailsError("Payment details could not be loaded.");
  }
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] p-7 text-white shadow-card">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-white/65">
                <WalletCards className="h-4 w-4" /> Professional earnings
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Manage your work income.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">
                Track approved milestone payments, requests, and available withdrawal balance.
              </p>
            </div>
            <div className="min-w-[260px] rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4 text-xs font-semibold text-white/65">
                <span>Available balance</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Secure wallet
                </span>
              </div>
              {wallet ? (
                <p className="mt-3 font-display text-4xl font-bold tracking-tight">
                  ₹{wallet.available.toLocaleString("en-IN")}
                </p>
              ) : (
                <div
                  className="mt-3 h-10 w-44 animate-pulse rounded-lg bg-white/20"
                  aria-label="Loading available balance"
                  role="status"
                />
              )}
              <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
                <LockKeyhole className="h-3.5 w-3.5" /> Protected by Razorpay payments
              </div>
            </div>
          </div>
        </div>
      </section>
      {!wallet || !items || !completedJobs ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={WalletCards}
              label="Available balance"
              onClick={() => setSelectedStat("available")}
              value={`₹${wallet.available.toLocaleString()}`}
              tone="primary"
            />
            <Stat
              icon={CircleDollarSign}
              label="Total earned"
              onClick={() => setSelectedStat("total")}
              value={`₹${wallet.total.toLocaleString()}`}
            />
            <Stat
              icon={Clock3}
              label="This month"
              value={`₹${thisMonth.toLocaleString()}`}
              onClick={() => setSelectedStat("month")}
            />
            <Stat
              icon={Landmark}
              label="In payout review"
              onClick={() => setSelectedStat("reserved")}
              value={`₹${wallet.reserved.toLocaleString()}`}
            />
          </div>
          {/* Linked Payout & Settlement Accounts Card */}
          <LinkedAccountsCard
            title="Link Payout & Settlement Accounts"
            description="Manage saved bank accounts & UPI IDs for fast withdrawal settlements."
          />
          <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Payment activity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Approved client milestone payments
                  </p>
                </div>
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/20 p-3 sm:px-5">
                {(
                  [
                    { key: "all", label: "All", count: tabCounts.all },
                    { key: "milestones", label: "Milestones", count: tabCounts.milestones },
                    { key: "disputes", label: "Disputes", count: tabCounts.disputes },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setHistoryFilter(tab.key);
                      setVisibleCount(10);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      historyFilter === tab.key
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/80 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        historyFilter === tab.key
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              {filteredItems.slice(0, visibleCount).map((i) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={i.id}
                  onClick={() => void openTransaction(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openTransaction(i);
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-4 border-b border-border/60 p-4 sm:p-5 transition-all hover:bg-muted/40 last:border-0"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                        i.type === "PLATFORM_COMMISSION"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : i.type === "DISPUTE_PAYOUT"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {i.type === "PLATFORM_COMMISSION" ? (
                        <Percent className="h-5 w-5" />
                      ) : i.type === "DISPUTE_PAYOUT" ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : (
                        <Briefcase className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                          {i.description}
                        </p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            i.type === "PLATFORM_COMMISSION"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : i.type === "DISPUTE_PAYOUT"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {i.type === "PLATFORM_COMMISSION"
                            ? "Commission cut (10%)"
                            : i.type === "DISPUTE_PAYOUT"
                              ? "Dispute payout"
                              : i.type === "MILESTONE_EARNING"
                                ? "Milestone earning"
                                : formatReadableLabel(i.type)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {new Date(i.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          ·{" "}
                          {new Date(i.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                        {i.invoicePaymentId && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="font-mono text-[10px] text-muted-foreground/90 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                              INV #{i.invoicePaymentId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-sm sm:text-base font-bold tabular-nums ${
                          i.type === "PLATFORM_COMMISSION"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {i.type === "PLATFORM_COMMISSION" ? "-" : "+"}₹
                        {Math.abs(i.amount).toLocaleString("en-IN")}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {i.currency}
                        </span>
                      </p>
                      <div className="mt-1 flex justify-end">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            i.type === "PLATFORM_COMMISSION"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {i.type === "PLATFORM_COMMISSION"
                            ? "Deducted"
                            : i.status === "COMPLETED"
                              ? "Credited to wallet"
                              : i.status}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground hidden sm:block shrink-0" />
                  </div>
                </div>
              ))}
              {filteredItems.length > visibleCount && (
                <div className="border-t border-border/60 bg-muted/10 p-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 10)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    <span>Show more transactions</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {filteredItems.length - visibleCount} remaining
                    </span>
                  </button>
                </div>
              )}
              {!filteredItems.length && (
                <p className="p-8 text-sm text-muted-foreground">
                  {historyFilter === "all"
                    ? "No approved payments yet. Payments appear here after a client approves a milestone."
                    : `No ${historyFilter} transactions found.`}
                </p>
              )}
            </section>
            <aside className="space-y-6">
              {/* Payout Withdrawal Card */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold">Request withdrawal</h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    Min ₹{(wallet.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 p-4 border border-border/60">
                  <p className="text-xs text-muted-foreground">Available balance</p>
                  <p className="font-display text-2xl font-bold text-foreground mt-1">
                    ₹{wallet.available.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transfer directly to your verified bank account or UPI ID.
                  </p>
                </div>

                {message && (
                  <div
                    className={`rounded-xl p-3 text-xs font-medium border ${
                      message.includes("success") || message.includes("submitted")
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                    }`}
                  >
                    {message}
                  </div>
                )}

                <Button
                  className="w-full gap-2 font-semibold h-11"
                  disabled={wallet.available < (wallet.minWithdrawalAmount ?? 500)}
                  onClick={() => {
                    setMessage("");
                    setWithdrawDialogOpen(true);
                  }}
                >
                  Request withdrawal <ArrowUpRight className="h-4 w-4" />
                </Button>

                {wallet.available < (wallet.minWithdrawalAmount ?? 500) && (
                  <p className="text-xs text-center text-muted-foreground">
                    Minimum balance of ₹{(wallet.minWithdrawalAmount ?? 500).toLocaleString("en-IN")} required to request withdrawal.
                  </p>
                )}
              </section>


              {/* Optional Advanced Razorpay Account Accordion */}
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <button
                  type="button"
                  onClick={() => setShowRazorpayAdvanced((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                >
                  <span>Advanced: Razorpay Route Account</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showRazorpayAdvanced ? "rotate-180" : ""}`}
                  />
                </button>
                {showRazorpayAdvanced && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-border">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      If you have an automated Razorpay Route Linked Account ID (`acc_...`), enter
                      it below.
                    </p>
                    <input
                      className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
                      placeholder="acc_..."
                      value={razorpayAccountId}
                      onChange={(e) => setRazorpayAccountId(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={actionBusy === "save-account"}
                      onClick={() => void saveRazorpayAccount()}
                    >
                      {actionBusy === "save-account" ? "Saving..." : "Save Route account"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Withdrawal History Card */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Withdrawal history</h2>
                  <span className="text-[11px] text-muted-foreground">Click item to view 3-step timeline</span>
                </div>
                <div className="mt-3 divide-y divide-border">
                  {wallet.withdrawals.map((w) => {
                    const dest = parseDestinationSummary(w.destinationLabel, w.destinationType);
                    const DestIcon = dest.icon;
                    return (
                      <div
                        key={w.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedWithdrawalDetail(w)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedWithdrawalDetail(w);
                          }
                        }}
                        className="py-3 px-2.5 -mx-2.5 rounded-xl space-y-1.5 cursor-pointer hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground text-sm">
                            ₹{w.amount.toLocaleString("en-IN")}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {w.payoutMode && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                                {w.payoutMode}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                w.status === "COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : w.status === "FAILED"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : w.status === "PROCESSING"
                                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {w.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                              {w.status === "PROCESSING" && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                </span>
                              )}
                              {w.status === "PENDING" && <Clock className="h-3 w-3" />}
                              {w.status === "FAILED" && <X className="h-3 w-3" />}
                              {w.status === "PROCESSING" ? "In Progress" : formatReadableLabel(w.status)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <DestIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground/80 truncate">{dest.label}</p>
                            {dest.sub && (
                              <p className="text-[11px] text-muted-foreground/80 truncate">
                                {dest.sub}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>
                            {new Date(w.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {w.utr && (
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">
                              UTR: {w.utr}
                            </span>
                          )}
                        </div>
                        {w.failureReason && (
                          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                            Reason: {w.failureReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {!wallet.withdrawals.length && (
                    <p className="py-4 text-sm text-muted-foreground">
                      No withdrawal requests yet.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      {/* Withdrawal Request Modal Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Funds Withdrawal</DialogTitle>
            <DialogDescription>
              Submit your payout request to your bank account or UPI ID. Requests are reviewed and processed by the Finance administrator.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 border border-border/60">
              <div>
                <p className="text-xs text-muted-foreground">Available balance</p>
                <p className="font-semibold text-foreground text-sm">
                  ₹{wallet?.available.toLocaleString("en-IN")}
                </p>
              </div>
              {wallet && wallet.available >= (wallet.minWithdrawalAmount ?? 500) && (
                <button
                  type="button"
                  onClick={() => setAmount(String(wallet.available))}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Withdraw full balance
                </button>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                Withdrawal Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₹
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  type="number"
                  min={wallet?.minWithdrawalAmount ?? 500}
                  max={wallet?.available ?? 0}
                  placeholder={`Min ₹${(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {amount && Number(amount) < (wallet?.minWithdrawalAmount ?? 500) && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  Minimum withdrawal amount is ₹
                  {(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}.
                </p>
              )}
              {amount && wallet && Number(amount) > wallet.available && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Amount exceeds available balance of ₹
                  {wallet.available.toLocaleString("en-IN")}.
                </p>
              )}
            </div>

            {/* Profile Linked Account Selector */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-primary" />
                  Profile Linked Account
                </label>
                <Link
                  href="/professional-profile"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Manage accounts →
                </Link>
              </div>

              {linkedAccounts.filter((a) => a.accountType === "BANK" || a.accountType === "UPI").length > 0 ? (
                <div className="space-y-2">
                  <div className="relative">
                    <select
                      className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      value={selectedLinkedAccountId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedLinkedAccountId(val);
                        const found = linkedAccounts.find((a) => a.id === val);
                        if (found) {
                          applyLinkedAccount(found);
                        }
                      }}
                    >
                      <option value="">-- Select saved account or type details below --</option>
                      {linkedAccounts
                        .filter((a) => a.accountType === "BANK" || a.accountType === "UPI")
                        .map((acc) => {
                          const label =
                            acc.accountType === "BANK"
                              ? `Bank: ${acc.bankName || "Bank Account"} (•••• ${acc.last4 || "••••"})`
                              : `UPI: ${acc.upiId || "UPI"} (•••• ${acc.last4 || "••••"})`;
                          return (
                            <option key={acc.id} value={acc.id}>
                              {acc.isDefault ? `★ [Default] ${label}` : label}
                            </option>
                          );
                        })}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>

                  {selectedLinkedAccountId && (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-2.5 py-1.5 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <span className="font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Auto-filled from profile
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedLinkedAccountId("")}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline"
                      >
                        Reset selection
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-background/60 p-2.5 border border-border/60 text-[11px] text-muted-foreground">
                  <span>No saved accounts in profile yet.</span>
                  <Link
                    href="/professional-profile"
                    className="font-semibold text-primary hover:underline ml-2"
                  >
                    + Link Account
                  </Link>
                </div>
              )}
            </div>

            {/* Payout Method Tabs (BANK and UPI only) */}
            <div>
              <label className="block text-xs font-semibold text-foreground/80 mb-2">
                Select Payout Method
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPayoutMethod("BANK")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all ${
                    payoutMethod === "BANK"
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Bank Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("UPI")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all ${
                    payoutMethod === "UPI"
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  <span>UPI ID</span>
                </button>
              </div>
            </div>

            {/* Form Fields: BANK */}
            {payoutMethod === "BANK" && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Bank Name
                    </label>
                    <button
                      type="button"
                      onClick={() => setIfscFinderOpen(true)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="h-3 w-3" /> Find IFSC
                    </button>
                  </div>
                  <BankCombobox
                    id="pro-withdraw-bank-name"
                    value={bankName}
                    onChange={(val) => setBankName(val)}
                    onSelectBank={(bank) => {
                      setBankName(bank.name);
                      if (!ifscCode && bank.code) {
                        setIfscCode(`${bank.code.toUpperCase()}0`);
                      }
                    }}
                    placeholder="Search popular Indian banks (e.g. HDFC, SBI, BOB, Kotak)…"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Account Holder Name
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Full name as per bank passbook"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Account Number
                    </label>
                    <span className="text-[10px] font-medium text-primary">
                      {getExpectedAccountLengthHint(bankName, ifscCode)}
                    </span>
                  </div>
                  <input
                    className={`h-10 w-full rounded-xl border bg-background px-3 text-xs font-mono focus:outline-none focus:ring-2 ${
                      accountNumber && !bankAccValidation.valid
                        ? "border-rose-500 text-rose-600 focus:border-rose-500 focus:ring-rose-500/20"
                        : "border-input focus:ring-primary/20"
                    }`}
                    placeholder="e.g. 102938475612"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
                  />
                  {accountNumber && !bankAccValidation.valid && (
                    <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      {bankAccValidation.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Confirm Account Number
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Re-enter bank account number"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s+/g, ""))}
                  />
                  {confirmAccountNumber && (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        accountNumber === confirmAccountNumber
                          ? "text-emerald-600"
                          : "text-rose-500"
                      }`}
                    >
                      {accountNumber === confirmAccountNumber
                        ? "✓ Account numbers match"
                        : "✗ Account numbers do not match"}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      IFSC Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setIfscFinderOpen(true)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Search IFSC
                    </button>
                  </div>
                  <input
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g. SBIN0001234 (11 characters)"
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => void handleLookupIfsc(e.target.value.toUpperCase())}
                  />
                  {ifscBranch && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {ifscBranch}
                    </p>
                  )}
                  {ifscError && (
                    <p className="mt-1 text-[11px] text-rose-500">{ifscError}</p>
                  )}
                  {ifscCode && !ifscBranch && !ifscError && ifscCode.length < 11 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      IFSC must be exactly 11 characters ({ifscCode.length}/11).
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-cyan-500/10 p-2.5 border border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-300">
                  ⚡ <strong>Secure Bank Settlement:</strong> Your withdrawal request is sent directly to Admin for verification and payout approval in the Finance portal.
                </div>
              </div>
            )}

            {/* Form Fields: UPI */}
            {payoutMethod === "UPI" && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    UPI ID (Virtual Payment Address)
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="e.g. rahul@upi, yourname@oksbi"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value.toLowerCase());
                        setVpaVerified(null);
                        setVpaCustomerName(null);
                        setVpaError(null);
                      }}
                      onBlur={() => {
                        if (upiId.includes("@") && upiId.length >= 4 && vpaVerified === null) {
                          void handleVerifyVpa(upiId);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!upiId.includes("@") || vpaVerifying}
                      onClick={() => void handleVerifyVpa(upiId)}
                      className="h-10 text-xs px-3 font-semibold shrink-0"
                    >
                      {vpaVerifying ? (
                        <>
                          <Clock className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                          Verify VPA
                        </>
                      )}
                    </Button>
                  </div>
                  {upiId && !upiId.includes("@") && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      Please include a valid UPI handle (must contain &apos;@&apos;, e.g. rahul@upi).
                    </p>
                  )}
                </div>

                {/* Real-time NPCI Verification Status Indicator */}
                {vpaVerified === true && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                        NPCI Verified Active VPA
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        {vpaCustomerName
                          ? `Registered Beneficiary: ${vpaCustomerName}`
                          : "UPI VPA is verified and active on NPCI banking rails."}
                      </p>
                    </div>
                  </div>
                )}

                {vpaVerified === false && vpaError && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-2.5 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p className="font-semibold text-rose-900 dark:text-rose-200">
                        NPCI Verification Failed
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">{vpaError}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Account Holder / Registered Name
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Name linked with your UPI ID"
                    value={upiHolder}
                    onChange={(e) => setUpiHolder(e.target.value)}
                  />
                  {vpaCustomerName && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Auto-detected from bank record via NPCI.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                  ⚡ <strong>Automated UPI Payout:</strong> RazorpayX verifies VPA validity via NPCI and initiates a UPI payout directly to the bank account linked to that UPI ID. Money arrives in seconds.
                </div>
              </div>
            )}

            {/* Remember details checkbox */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={saveDetailsForFuture}
                onChange={(e) => setSaveDetailsForFuture(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">
                Save payout details for future withdrawals
              </span>
            </label>

            {/* Status Message inside dialog */}
            {message && (
              <div
                className={`rounded-xl p-3 text-xs font-medium border ${
                  message.includes("success") || message.includes("submitted")
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                }`}
              >
                {message}
              </div>
            )}

            {/* Submit & Cancel Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setWithdrawDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!canSubmit}
                onClick={handleInitiateWithdraw}
              >
                {actionBusy === "withdraw" ? (
                  "Submitting..."
                ) : (
                  <>
                    Continue to Verification <ArrowUpRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedTransaction ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-details-title"
          onClick={() => setSelectedTransaction(null)}
        >
          <section
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
                  Payment details
                </p>
                <h2 id="transaction-details-title" className="mt-2 font-display text-2xl font-bold">
                  {selectedPayment?.milestone?.title ?? selectedTransaction.description}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close payment details"
                className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
                onClick={() => setSelectedTransaction(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!selectedTransaction.invoicePaymentId ? (
              <TransactionSummary transaction={selectedTransaction} />
            ) : paymentDetailsError ? (
              <p className="mt-8 rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">
                {paymentDetailsError}
              </p>
            ) : !selectedPayment ? (
              <div className="mt-8 h-40 animate-pulse rounded-2xl bg-muted" />
            ) : (
              <PaymentDetails detail={selectedPayment} />
            )}
          </section>
        </div>
      ) : null}
      {selectedStat ? (
        <StatDetailsModal
          stat={selectedStat}
          wallet={wallet}
          items={items}
          thisMonth={thisMonth}
          onClose={() => setSelectedStat(null)}
        />
      ) : null}

      {/* Confirmation Modal to Recheck Details Before Withdrawal */}
      <RecheckWithdrawalModal
        open={recheckModalOpen}
        onOpenChange={setRecheckModalOpen}
        amount={Number(amount)}
        payoutMethod={payoutMethod}
        bankName={bankName}
        accountHolder={accountHolder}
        accountNumber={accountNumber}
        ifscCode={ifscCode}
        upiId={upiId}
        upiHolder={upiHolder}
        onConfirm={executeWithdrawal}
        onEdit={() => setRecheckModalOpen(false)}
        onUpdateDetails={(updated) => {
          if (updated.accountNumber !== undefined) setAccountNumber(updated.accountNumber);
          if (updated.ifscCode !== undefined) setIfscCode(updated.ifscCode);
          if (updated.accountHolder !== undefined) setAccountHolder(updated.accountHolder);
          if (updated.upiId !== undefined) setUpiId(updated.upiId);
          if (updated.upiHolder !== undefined) setUpiHolder(updated.upiHolder);
        }}
        isSubmitting={actionBusy === "withdraw"}
      />

      {/* Withdrawal Transaction 3-Step Timeline Detail Modal */}
      <WithdrawalDetailModal
        open={Boolean(selectedWithdrawalDetail)}
        onOpenChange={(open) => !open && setSelectedWithdrawalDetail(null)}
        withdrawal={selectedWithdrawalDetail}
      />

      {/* IFSC Code Search Tool Dialog */}
      <IfscFinderDialog
        open={ifscFinderOpen}
        onOpenChange={setIfscFinderOpen}
        defaultBank={bankName}
        onSelectIfsc={(code, bName) => {
          setIfscCode(code);
          if (bName) setBankName(bName);
          void handleLookupIfsc(code);
        }}
      />

      <PageActionLoading
        active={actionBusy !== null}
        title={
          actionBusy === "save-account"
            ? "Saving payout account…"
            : "Submitting withdrawal request…"
        }
        description={
          actionBusy === "save-account"
            ? "Updating your Razorpay account ID for payouts."
            : "Sending your withdrawal request to admin review."
        }
      />
    </div>
  );
}

function TransactionSummary({ transaction }: { transaction: Transaction }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground">Client milestone payment</p>
        <p className="mt-1 font-display text-3xl font-bold">
          INR {transaction.amount.toLocaleString("en-IN")} {transaction.currency}
        </p>
        <p className="mt-2 text-sm font-semibold text-success">{transaction.status}</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <DetailRow label="Description" value={transaction.description} />
        <DetailRow label="Payment date" value={new Date(transaction.createdAt).toLocaleString()} />
      </div>
      <InvoiceAction paymentId={transaction.invoicePaymentId} />
    </div>
  );
}

function PaymentDetails({ detail }: { detail: PaymentDetail }) {
  const money = (amount: number) => `INR ${amount.toLocaleString("en-IN")} ${detail.currency}`;
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground">Amount credited</p>
        <p className="mt-1 font-display text-3xl font-bold">
          {money(detail.professionalPayoutAmount)}
        </p>
        <p className="mt-2 text-sm font-semibold text-success">{detail.status}</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <DetailRow label="Client milestone payment" value={money(detail.baseAmount)} />
        {detail.commissionAmount > 0 && (
          <DetailRow label="Platform commission" value={money(detail.commissionAmount)} />
        )}
        <DetailRow label="Net earnings" value={money(detail.professionalPayoutAmount)} />
        <DetailRow
          label="Payment method"
          value={detail.provider === "wallet" ? "Wallet balance" : detail.provider}
        />
        <DetailRow label="Payment date" value={new Date(detail.createdAt).toLocaleString()} />
        {detail.razorpayPaymentId ? (
          <DetailRow label="Razorpay payment ID" value={detail.razorpayPaymentId} />
        ) : null}
      </div>
      <InvoiceAction paymentId={detail.id} />
    </div>
  );
}

function InvoiceAction({ paymentId }: { paymentId: number | null }) {
  if (!paymentId) {
    return (
      <button
        type="button"
        disabled
        className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground"
        title="An invoice will be available after this payment is completed."
      >
        <Download className="mr-2 h-4 w-4" /> Invoice not available yet
      </button>
    );
  }
  return (
    <a
      href={`/api/v1/portal/invoices/${paymentId}`}
      target="_blank"
      rel="noreferrer"
      className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <Download className="mr-2 h-4 w-4" /> Download invoice
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-semibold">{value}</span>
    </div>
  );
}

function StatDetailsModal({
  stat,
  wallet,
  items,
  thisMonth,
  onClose,
}: {
  stat: StatKey;
  wallet: Wallet | null;
  items: Transaction[] | null;
  thisMonth: number;
  onClose: () => void;
}) {
  if (!wallet) return null;
  const monthItems =
    items?.filter((item) => {
      const date = new Date(item.createdAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }) ?? [];
  const content: Record<
    StatKey,
    { title: string; value: string; description: string; rows: [string, string][] }
  > = {
    available: {
      title: "Available balance",
      value: `₹${wallet.available.toLocaleString("en-IN")}`,
      description: "Funds currently available to request as a payout.",
      rows: [
        ["Wallet balance", `₹${wallet.total.toLocaleString("en-IN")}`],
        ["In payout review", `₹${wallet.reserved.toLocaleString("en-IN")}`],
      ],
    },
    total: {
      title: "Total earned",
      value: `₹${wallet.total.toLocaleString("en-IN")}`,
      description: "Completed professional earnings recorded from projects.",
      rows: [["Total earned", `₹${wallet.total.toLocaleString("en-IN")}`]],
    },
    month: {
      title: "This month",
      value: `₹${thisMonth.toLocaleString("en-IN")}`,
      description: "Approved payment activity recorded during the current calendar month.",
      rows: [["Payments this month", String(monthItems.length)]],
    },
    reserved: {
      title: "In payout review",
      value: `₹${wallet.reserved.toLocaleString("en-IN")}`,
      description: "Funds reserved for payout requests waiting to be processed.",
      rows: [["Withdrawal requests", String(wallet.withdrawals.length)]],
    },
  };
  const detail = content[stat];
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="earnings-stat-title"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">
              Earnings summary
            </p>
            <h2 id="earnings-stat-title" className="mt-2 font-display text-2xl font-bold">
              {detail.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close earnings summary"
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 rounded-2xl bg-primary/5 p-5">
          <p className="text-sm text-muted-foreground">Current value</p>
          <p className="mt-1 font-display text-3xl font-bold">{detail.value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{detail.description}</p>
        </div>
        <div className="mt-4 space-y-3 rounded-2xl border border-border p-5 text-sm">
          {detail.rows.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tone ? "ring-1 ring-primary/20" : ""}`}
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </button>
  );
}

function Breakdown({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-xl font-bold ${tone === "amber" ? "text-amber-600" : tone === "success" ? "text-success" : ""}`}
      >
        ₹{value.toLocaleString()}
      </p>
    </div>
  );
}
