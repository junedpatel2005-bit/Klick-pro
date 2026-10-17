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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FolderKanban,
  History,
  Landmark,
  Loader2,
  LockKeyhole,
  Pencil,
  Percent,
  ReceiptText,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { maskDestinationString } from "@/lib/account-formatting";
import {
  validateBankSpecificAccountNumber,
  getExpectedAccountLengthHint,
  lookupIfscCode,
  normalizeIfsc,
  getBankNameFromIfsc,
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
      const last4 = data.last4
        ? `A/C •••• ${data.last4}`
        : data.accountNumber && !data.accountNumber.startsWith("enc:")
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
    label: maskDestinationString(destinationLabel, destinationType),
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
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [selectedUpiAccountId, setSelectedUpiAccountId] = useState<string>("");
  const [showAllWithdrawals, setShowAllWithdrawals] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const savedBankAccounts = useMemo(
    () => linkedAccounts.filter((a) => a.accountType === "BANK"),
    [linkedAccounts],
  );
  const savedUpiAccounts = useMemo(
    () => linkedAccounts.filter((a) => a.accountType === "UPI"),
    [linkedAccounts],
  );

  const selectedBankAccount =
    savedBankAccounts.find((a) => String(a.id) === String(selectedBankAccountId)) ??
    savedBankAccounts.find((a) => a.isDefault) ??
    savedBankAccounts[0] ??
    null;

  const selectedUpiAccount =
    savedUpiAccounts.find((a) => String(a.id) === String(selectedUpiAccountId)) ??
    savedUpiAccounts.find((a) => a.isDefault) ??
    savedUpiAccounts[0] ??
    null;

  function handleCopyUtr(utr: string) {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    toast.success("UTR copied to clipboard");
    setTimeout(() => {
      setCopiedUtr((curr) => (curr === utr ? null : curr));
    }, 2500);
  }

  function openLinkAccountModal(type: "BANK" | "UPI") {
    document.getElementById("saved-accounts")?.scrollIntoView({ behavior: "smooth" });
    window.dispatchEvent(new CustomEvent("klickpro:open-link-account", { detail: { type } }));
  }

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
      setSelectedBankAccountId(String(acc.id));
      setBankName(acc.bankName ?? "");
      setAccountHolder(acc.accountHolder ?? "");
      setAccountNumber(acc.accountNumber ?? "");
      setConfirmAccountNumber(acc.accountNumber ?? "");
      setIfscCode(acc.ifscCode ?? "");
    } else if (acc.accountType === "UPI") {
      setPayoutMethod("UPI");
      setSelectedUpiAccountId(String(acc.id));
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
    Boolean(selectedBankAccount) ||
    (accountHolder.trim().length >= 2 &&
      bankAccValidation.valid &&
      accountNumber.trim() === confirmAccountNumber.trim() &&
      ifscCode.trim().length === 11);

  const isUpiValid =
    Boolean(selectedUpiAccount) ||
    (upiId.trim().includes("@") &&
      upiId.trim().length >= 4 &&
      upiHolder.trim().length >= 2);

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
    if (payoutMethod === "BANK" && selectedBankAccount) {
      applyLinkedAccount(selectedBankAccount);
    } else if (payoutMethod === "UPI" && selectedUpiAccount) {
      applyLinkedAccount(selectedUpiAccount);
    }
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
    const activeBank = selectedBankAccount;
    const activeUpi = selectedUpiAccount;

    const finalAccountNumber = (
      updatedDetails?.accountNumber ??
      (accountNumber || activeBank?.accountNumber || "")
    ).trim();
    const finalIfscCode = (
      updatedDetails?.ifscCode ??
      (ifscCode || activeBank?.ifscCode || "")
    ).trim().toUpperCase();
    const finalAccountHolder = capitalizeWords(
      (updatedDetails?.accountHolder ?? (accountHolder || activeBank?.accountHolder || "Professional")).trim()
    );
    const finalBankName = capitalizeWords((bankName || activeBank?.bankName || "Bank").trim());

    const finalUpiId = (
      updatedDetails?.upiId ??
      (upiId || activeUpi?.upiId || "")
    ).trim().toLowerCase();
    const finalUpiHolder = capitalizeWords(
      (updatedDetails?.upiHolder ?? (upiHolder || activeUpi?.accountHolder || "Professional")).trim()
    );

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
          bankName: finalBankName,
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
              bankName: finalBankName,
              accountHolder: finalAccountHolder,
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
          bankName: payoutMethod === "BANK" ? finalBankName : undefined,
          upiId: payoutMethod === "UPI" ? finalUpiId : undefined,
          upiHolder: payoutMethod === "UPI" ? finalUpiHolder : undefined,
        }),
      });
      const d = await r.json().catch(() => null);
      const respMsg = r.ok
        ? (d?.message ??
            `Withdrawal request of ₹${Number(amount).toLocaleString(
              "en-IN",
            )} submitted successfully! Your request has been forwarded to Admin for approval.`)
        : (d?.error ?? "Unable to submit withdrawal request.");
      setMessage(respMsg);
      if (r.ok) {
        toast.success(respMsg);
        setAmount("");
        setWithdrawDialogOpen(false);
        setRecheckModalOpen(false);
        load();
      } else {
        toast.error(respMsg);
      }
    } catch {
      const errMsg = "Network connection lost. Please check your internet connection and try again.";
      setMessage(errMsg);
      toast.error(errMsg);
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
          {/* Saved Bank & UPI Accounts */}
          <div id="saved-accounts" className="scroll-mt-6">
            <LinkedAccountsCard
              title="Saved Bank & UPI Accounts"
              description="Manage your linked bank accounts and UPI IDs for quick withdrawals and earnings settlements."
            />
          </div>

          {/* Withdraw Funds and Withdrawal History Section (50/50 Split & Equal Height) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
            {/* Left Box: Withdrawal History (Equal 50% Width & Full Height) */}
            <section className="flex flex-col h-full rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft justify-between">
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <History className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        Withdrawal History
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Recent payouts &amp; settlement status
                      </p>
                    </div>
                  </div>
                  {wallet?.withdrawals?.length ? (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground border border-border/80">
                      {wallet.withdrawals.length} {wallet.withdrawals.length === 1 ? "request" : "requests"}
                    </span>
                  ) : null}
                </div>

                {wallet?.withdrawals?.length ? (
                  <div className="mt-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      {wallet.withdrawals.slice(0, showAllWithdrawals ? undefined : 4).map((withdrawal) => {
                        const dest = parseDestinationSummary(
                          withdrawal.destinationLabel,
                          withdrawal.destinationType,
                        );
                        const DestIcon = dest.icon;
                        return (
                          <div
                            key={withdrawal.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedWithdrawalDetail(withdrawal)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedWithdrawalDetail(withdrawal);
                              }
                            }}
                            className="rounded-xl border border-border/80 bg-background/60 hover:bg-muted/40 p-3.5 text-sm space-y-2 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-bold text-foreground text-base tracking-tight">
                                ₹{withdrawal.amount.toLocaleString("en-IN")}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {withdrawal.payoutMode && (
                                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                                    {withdrawal.payoutMode}
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                    withdrawal.status === "COMPLETED"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : withdrawal.status === "FAILED"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                        : withdrawal.status === "PROCESSING"
                                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  }`}
                                >
                                  {withdrawal.status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
                                  {withdrawal.status === "PROCESSING" && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                  )}
                                  {withdrawal.status === "PENDING" && <Clock className="h-3 w-3" />}
                                  {withdrawal.status === "FAILED" && <X className="h-3 w-3" />}
                                  {withdrawal.status === "PROCESSING" ? "In Progress" : formatReadableLabel(withdrawal.status)}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                              </div>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <DestIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                              <div className="min-w-0">
                                <p className="font-medium text-foreground/90 truncate">{dest.label}</p>
                                {dest.sub && (
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {dest.sub}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                              <span>
                                {new Date(withdrawal.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {withdrawal.utr ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyUtr(withdrawal.utr!);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-0.5 rounded transition cursor-pointer"
                                  title="Click to copy UTR reference"
                                >
                                  {copiedUtr === withdrawal.utr ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-emerald-600" />
                                  )}
                                  <span>UTR: {withdrawal.utr}</span>
                                </button>
                              ) : null}
                            </div>

                            {withdrawal.failureReason && (
                              <div className="flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                                <span>
                                  <strong>Reason:</strong> {withdrawal.failureReason}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Informational settlement SLA card when history has 1-3 items so the card remains balanced */}
                      {wallet.withdrawals.length < 4 && (
                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 p-3.5 text-xs text-muted-foreground space-y-1">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Settlement Guarantee
                          </p>
                          <p className="text-[11px] leading-relaxed">
                            IMPS transfers settle instantly within seconds. UPI transfers are verified on the NPCI rail. Official bank UTR numbers are generated automatically for every payout.
                          </p>
                        </div>
                      )}
                    </div>

                    {wallet.withdrawals.length > 4 && (
                      <div className="pt-2 text-center mt-auto">
                        <button
                          type="button"
                          onClick={() => setShowAllWithdrawals((prev) => !prev)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted px-4 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary/40 cursor-pointer"
                        >
                          {showAllWithdrawals ? (
                            <>
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              <span>View less</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              <span>View more transactions</span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                +{wallet.withdrawals.length - 4} more
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-border/80 bg-muted/10 my-4">
                    <div className="h-12 w-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mb-3">
                      <History className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="font-semibold text-sm text-foreground">No withdrawal history yet</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                      When you withdraw your earnings to your bank account or UPI, your payout records and UTR reference will appear here.
                    </p>
                  </div>
                )}
              </div>

              {/* History Footer matching right box footer */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 mt-4 text-[11px] text-muted-foreground border-t border-border/70">
                <span className="inline-flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Gateway Synchronized
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <Clock className="h-3.5 w-3.5 text-primary" /> 24x7 Settlement Records
                </span>
              </div>
            </section>

            {/* Right Box: Withdraw Funds Redesign (Equal 50% Width & Full Height) */}
            <section className="flex flex-col h-full relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft justify-between">
              <div className="flex-1 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary">
                    <Landmark className="h-3.5 w-3.5" /> Withdraw funds
                  </div>
                </div>

                <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                  Get your earnings paid out
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Withdraw approved balance to your verified bank account or UPI. Fast settlements directly to your account.
                </p>

                {/* Available Balance Stat Banner */}
                <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 p-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Available to withdraw
                    </p>
                    <p className="text-xl font-bold text-foreground tracking-tight">
                      ₹{(wallet?.available ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Withdrawal Method Tabs */}
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Withdrawal Destination
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutMethod("BANK");
                        setMessage("");
                        if (selectedBankAccount) {
                          applyLinkedAccount(selectedBankAccount);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                        payoutMethod === "BANK"
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <Landmark className="h-4 w-4" />
                      <span>Bank Account (IMPS)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutMethod("UPI");
                        setMessage("");
                        if (selectedUpiAccount) {
                          applyLinkedAccount(selectedUpiAccount);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                        payoutMethod === "UPI"
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>UPI (Instant VPA)</span>
                    </button>
                  </div>
                </div>

                {/* Selected Saved Account Card */}
                <div
                  key={payoutMethod}
                  className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both"
                >
                  {payoutMethod === "BANK" ? (
                    <div className="mt-4 space-y-2.5">
                      {selectedBankAccount ? (
                        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-background p-4 sm:p-5 shadow-xs relative overflow-hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <Landmark className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground text-sm sm:text-base truncate capitalize">
                                    {capitalizeWords(
                                      selectedBankAccount.bankName ||
                                        getBankNameFromIfsc(selectedBankAccount.ifscCode) ||
                                        "Bank Account",
                                    )}
                                  </h3>
                                  {selectedBankAccount.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Default
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-xs sm:text-sm text-foreground/80 tracking-wider mt-1">
                                  A/C •••• {selectedBankAccount.last4 || selectedBankAccount.accountNumber?.slice(-4) || "••••"}
                                </p>
                              </div>
                            </div>
                            <a
                              href="#saved-accounts"
                              onClick={(e) => {
                                e.preventDefault();
                                document.getElementById("saved-accounts")?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0 cursor-pointer pt-0.5"
                              title="Edit or manage saved bank accounts"
                            >
                              <Pencil className="h-3 w-3" /> Edit / Manage
                            </a>
                          </div>

                          <div className="mt-3.5 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                                IFSC Code
                              </span>
                              <span className="font-mono font-semibold text-foreground tracking-wide">
                                {selectedBankAccount.ifscCode || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                                Account Holder
                              </span>
                              <span className="font-semibold text-foreground truncate block capitalize">
                                {capitalizeWords(selectedBankAccount.accountHolder) || "Account Holder"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5 text-center space-y-2">
                          <div className="h-10 w-10 mx-auto rounded-xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
                            <Landmark className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-semibold text-foreground">No bank account saved yet</p>
                          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                            Add your bank account in Saved Accounts to withdraw earnings directly via 24x7 IMPS.
                          </p>
                          <button
                            type="button"
                            onClick={() => openLinkAccountModal("BANK")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1 cursor-pointer"
                          >
                            + Link Bank Account
                          </button>
                        </div>
                      )}

                      {/* Multi-Account Quick Switcher */}
                      {savedBankAccounts.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                          <span className="text-[11px] text-muted-foreground shrink-0">Switch account:</span>
                          {savedBankAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSelectedBankAccountId(String(acc.id));
                                applyLinkedAccount(acc);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                String(selectedBankAccount?.id) === String(acc.id)
                                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                                  : "border-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span>
                                {acc.bankName || "Bank"} (••{acc.last4 || acc.accountNumber?.slice(-2)})
                              </span>
                              {acc.isDefault && (
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {selectedUpiAccount ? (
                        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-background p-4 sm:p-5 shadow-xs relative overflow-hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <Smartphone className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                                    UPI Virtual Payment Address
                                  </h3>
                                  {selectedUpiAccount.isDefault && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Default
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> NPCI Verified
                                  </span>
                                </div>
                                <p className="font-mono text-xs sm:text-sm font-semibold text-primary tracking-wide mt-1 truncate">
                                  {selectedUpiAccount.upiId}
                                </p>
                              </div>
                            </div>
                            <a
                              href="#saved-accounts"
                              onClick={(e) => {
                                e.preventDefault();
                                document.getElementById("saved-accounts")?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0 cursor-pointer pt-0.5"
                              title="Edit or manage saved UPI accounts"
                            >
                              <Pencil className="h-3 w-3" /> Edit / Manage
                            </a>
                          </div>

                          {selectedUpiAccount.accountHolder && (
                            <div className="mt-3.5 pt-3 border-t border-border/60 text-xs flex items-center justify-between">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Registered Beneficiary
                              </span>
                              <span className="font-semibold text-foreground truncate capitalize">
                                {capitalizeWords(selectedUpiAccount.accountHolder)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5 text-center space-y-2">
                          <div className="h-10 w-10 mx-auto rounded-xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
                            <Smartphone className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-semibold text-foreground">No UPI ID saved yet</p>
                          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                            Add your UPI ID in Saved Accounts to withdraw earnings directly to your UPI app.
                          </p>
                          <button
                            type="button"
                            onClick={() => openLinkAccountModal("UPI")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1 cursor-pointer"
                          >
                            + Link UPI ID
                          </button>
                        </div>
                      )}

                      {/* Multi-UPI Quick Switcher */}
                      {savedUpiAccounts.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                          <span className="text-[11px] text-muted-foreground shrink-0">Switch UPI:</span>
                          {savedUpiAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setSelectedUpiAccountId(String(acc.id));
                                applyLinkedAccount(acc);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                String(selectedUpiAccount?.id) === String(acc.id)
                                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                                  : "border-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span>{acc.upiId}</span>
                              {acc.isDefault && (
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Amounts & Amount Input */}
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Withdrawal Amount
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {[500, 1000, 2500, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(String(amt))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          amount === String(amt)
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        ₹{amt.toLocaleString("en-IN")}
                      </button>
                    ))}
                    {(wallet?.available ?? 0) >= (wallet?.minWithdrawalAmount ?? 500) && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(wallet?.available ?? 0))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          amount === String(wallet?.available ?? 0)
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-background text-primary hover:border-primary/40"
                        }`}
                      >
                        Max (₹{(wallet?.available ?? 0).toLocaleString("en-IN")})
                      </button>
                    )}
                  </div>

                  <div className="relative flex h-11 items-center rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="mr-2 text-sm font-bold text-muted-foreground">₹</span>
                    <input
                      className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
                      type="number"
                      min={wallet?.minWithdrawalAmount ?? 500}
                      max={wallet?.available ?? 0}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>

                  {amount &&
                    Number(amount) < (wallet?.minWithdrawalAmount ?? 500) && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Minimum withdrawal amount is ₹
                        {(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}.
                      </p>
                    )}
                  {amount &&
                    Number(amount) > (wallet?.available ?? 0) && (
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        Amount exceeds your available balance of ₹
                        {(wallet?.available ?? 0).toLocaleString("en-IN")}.
                      </p>
                    )}
                </div>

                {/* Withdraw Submit Action */}
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    className="w-full inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    onClick={() => handleInitiateWithdraw()}
                    disabled={!canSubmit}
                  >
                    {actionBusy === "withdraw" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Submitting Request…
                      </>
                    ) : (
                      <>
                        Withdraw {amount ? `₹${Number(amount).toLocaleString("en-IN")}` : "Funds"}
                        <ArrowUpRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {message ? (
                    <div
                      className={`rounded-xl p-3 text-xs font-medium border flex items-start gap-2 ${
                        message.includes("success") || message.includes("submitted")
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {message.includes("success") || message.includes("submitted") ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      )}
                      <span>{message}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right Box Footer matching left box footer */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 mt-4 text-[11px] text-muted-foreground border-t border-border/70">
                <span className="inline-flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 256-bit Bank Encryption
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Fast Settlement
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <LockKeyhole className="h-3.5 w-3.5 text-indigo-600" /> RazorpayX Secure Rails
                </span>
              </div>
            </section>
          </div>

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

          {/* Full-Width Payment Activity Section */}
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
        </>
      )}




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
