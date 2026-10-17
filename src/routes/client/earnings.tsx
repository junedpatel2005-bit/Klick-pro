"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Copy,
  Check,
  CreditCard,
  FolderKanban,
  History,
  Info,
  Landmark,
  Loader2,
  Lock,
  LockKeyhole,
  Percent,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  WalletCards,
  Building2,
  ExternalLink,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { CardListSkeleton } from "@/components/LoadingSkeleton";
import { PageActionLoading } from "@/components/PageActionLoading";
import { formatReadableLabel, capitalizeWords, capitalizeFirst } from "@/lib/utils";
import { LinkedAccountsCard } from "@/components/LinkedAccountsCard";
import { RecheckWithdrawalModal } from "@/components/RecheckWithdrawalModal";
import { WithdrawalDetailModal } from "@/components/WithdrawalDetailModal";
import {
  lookupIfscCode,
  normalizeIfsc,
  getBankNameFromIfsc,
  validateBankSpecificAccountNumber,
} from "@/lib/indian-banks";
type Payment = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  invoicePaymentId?: number | null;
};
type WalletTransaction = {
  id: number;
  amount: number;
  type: string;
  status: string;
  description: string;
  providerReference: string | null;
  createdAt: string;
};
type Withdrawal = {
  id: number;
  amount: number;
  status: string;
  destinationType: string;
  destinationLabel: string | null;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string | null;
  payoutMode?: string | null;
  utr?: string | null;
  failureReason?: string | null;
};
type LockedMilestone = {
  id: number;
  title: string;
  amount: number;
  validityDays: number;
  releaseAt: string | null;
  autoReleaseStatus: string;
  createdAt: string;
  jobTitle: string;
  jobId: number;
  projectId: number;
  professionalName: string;
  hasDispute?: boolean;
  disputeId?: number | null;
  disputeStatus?: string | null;
  disputeIssueType?: string | null;
};
type Wallet = {
  balance: number;
  available: number;
  reserved: number;
  frozenAmount?: number;
  disputedFrozenAmount?: number;
  totalFunds?: number;
  lockedMilestones?: LockedMilestone[];
  transactions: WalletTransaction[];
  withdrawals: Withdrawal[];
  minWithdrawalAmount?: number;
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
  isDefault: boolean;
};

function parseDestinationSummary(destinationLabel: string | null, destinationType?: string) {
  if (!destinationLabel) return { label: "Payout destination", icon: Building2 };
  try {
    const data = JSON.parse(destinationLabel);
    if (data.type === "BANK" || destinationType === "BANK") {
      const rawBank = data.bankName || getBankNameFromIfsc(data.ifsc);
      const bank = rawBank ? `${capitalizeWords(rawBank)} · ` : "";
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
    label: destinationLabel,
    icon:
      destinationType === "UPI" ? Smartphone : destinationType === "CARD" ? CreditCard : Building2,
  };
}

export default function ClientEarnings() {
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const { data: walletQueryData, refetch: refetchWallet } = useQuery({
    queryKey: ["client-wallet"],
    queryFn: async () => {
      const r = await fetch("/api/v1/wallet", { cache: "no-store" });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (walletQueryData) {
      const bal = walletQueryData?.wallet?.balance ?? walletQueryData?.available ?? 0;
      if (bal < 0) {
        try {
          const alreadyAlerted = window.sessionStorage.getItem("klickpro_negative_wallet_alerted");
          if (!alreadyAlerted) {
            window.sessionStorage.setItem("klickpro_negative_wallet_alerted", "true");
            toast.error(
              `Your wallet balance is -₹${Math.abs(bal).toLocaleString("en-IN")}. Please add funds to clear your dues.`,
              { duration: 7000 },
            );
          }
        } catch {
          // ignore
        }
      }
      setWallet({
        balance: walletQueryData.wallet?.balance ?? 0,
        available: walletQueryData.available ?? walletQueryData.wallet?.balance ?? 0,
        reserved: walletQueryData.reserved ?? 0,
        frozenAmount: walletQueryData.frozenAmount ?? 0,
        disputedFrozenAmount: walletQueryData.disputedFrozenAmount ?? 0,
        totalFunds: walletQueryData.totalFunds ?? walletQueryData.wallet?.balance ?? 0,
        lockedMilestones: walletQueryData.lockedMilestones ?? [],
        transactions: walletQueryData.transactions ?? [],
        withdrawals: walletQueryData.withdrawals ?? [],
        minWithdrawalAmount: walletQueryData.minWithdrawalAmount,
      });
      setWalletLoading(false);
    }
  }, [walletQueryData]);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<
    | { kind: "payment"; detail: PaymentDetail | null }
    | { kind: "topup"; detail: WalletTransaction }
    | null
  >(null);
  const [paymentDetailsError, setPaymentDetailsError] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "milestones" | "deposits" | "failed" | "validity"
  >("all");
  const [withdrawMethod, setWithdrawMethod] = useState<"BANK" | "UPI">("BANK");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [upiHolder, setUpiHolder] = useState("");
  const [vpaVerifying, setVpaVerifying] = useState(false);
  const [vpaVerified, setVpaVerified] = useState<boolean | null>(null);
  const [vpaCustomerName, setVpaCustomerName] = useState<string | null>(null);
  const [vpaError, setVpaError] = useState<string | null>(null);

  // Bank Verification & IFSC State for Withdrawal Box
  const [bankName, setBankName] = useState("");
  const [bankSearchTerm, setBankSearchTerm] = useState("");
  const [customBankInput, setCustomBankInput] = useState(false);
  const [ifscBranch, setIfscBranch] = useState<string | null>(null);
  const [ifscVerifying, setIfscVerifying] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [bankAccountVerifying, setBankAccountVerifying] = useState(false);
  const [bankAccountVerified, setBankAccountVerified] = useState<boolean | null>(null);
  const [bankAccountError, setBankAccountError] = useState<string | null>(null);
  const [officialBankName, setOfficialBankName] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");
  const [recheckModalOpen, setRecheckModalOpen] = useState(false);
  const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] = useState<Withdrawal | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Profile Linked Accounts
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [defaultAccount, setDefaultAccount] = useState<LinkedAccount | null>(null);
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
    savedBankAccounts.find((a) => a.id === selectedBankAccountId) ??
    savedBankAccounts.find((a) => a.isDefault) ??
    savedBankAccounts[0] ??
    null;

  const selectedUpiAccount =
    savedUpiAccounts.find((a) => a.id === selectedUpiAccountId) ??
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

  async function handleVerifyVpa(targetVpa?: string) {
    const toCheck = (targetVpa || withdrawDestination).trim().toLowerCase();
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

  async function handleLookupIfsc(code: string, silent = false) {
    const clean = normalizeIfsc(code);
    setBankIfsc(clean);
    setIfscError(null);
    setIfscBranch(null);
    if (clean.length === 11) {
      setIfscVerifying(true);
      try {
        const res = await lookupIfscCode(clean);
        if (res.valid && res.bank) {
          setIfscBranch(`${res.bank} · ${res.branch} (${res.city})`);
          setBankName(res.bank);
          if (!silent) {
            toast.success(`IFSC Verified: ${res.bank} (${res.branch})`);
          }
        } else {
          setIfscError(res.error || "Invalid IFSC code.");
          if (!silent) {
            toast.error(res.error || "Invalid IFSC code.");
          }
        }
      } catch {
        setIfscError("Unable to verify IFSC code.");
      } finally {
        setIfscVerifying(false);
      }
    }
  }

  const handleNameChange = (newName: string) => {
    setAccountHolder(newName);
  };

  function applyLinkedAccount(acc: LinkedAccount) {
    if (acc.accountType === "BANK") {
      setWithdrawMethod("BANK");
      setSelectedBankAccountId(acc.id);
      setBankAccount(acc.accountNumber ?? "");
      setBankIfsc(acc.ifscCode ?? "");
      setAccountHolder(acc.accountHolder ?? "");
      const bName = acc.bankName || getBankNameFromIfsc(acc.ifscCode) || "";
      setBankName(bName);
      if (acc.ifscCode) {
        void handleLookupIfsc(acc.ifscCode, true);
      }
    } else if (acc.accountType === "UPI") {
      setWithdrawMethod("UPI");
      setSelectedUpiAccountId(acc.id);
      setWithdrawDestination(acc.upiId ?? "");
      setUpiHolder(acc.accountHolder ?? "");
      setVpaVerified(true);
      setVpaCustomerName(acc.accountHolder ?? null);
      setVpaError(null);
    }
  }

  function loadWallet() {
    setWalletLoading(true);
    void refetchWallet();
    void queryClient.invalidateQueries({ queryKey: ["client-wallet"] });
    void fetch("/api/v1/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then(
        (
          data: {
            wallet?: { balance: number };
            available?: number;
            reserved?: number;
            frozenAmount?: number;
            disputedFrozenAmount?: number;
            totalFunds?: number;
            lockedMilestones?: LockedMilestone[];
            transactions?: WalletTransaction[];
            withdrawals?: Withdrawal[];
            minWithdrawalAmount?: number;
          } | null,
        ) => {
          const bal = data?.wallet?.balance ?? data?.available ?? 0;
          if (bal < 0) {
            try {
              const alreadyAlerted = window.sessionStorage.getItem("klickpro_negative_wallet_alerted");
              if (!alreadyAlerted) {
                window.sessionStorage.setItem("klickpro_negative_wallet_alerted", "true");
                toast.error(
                  `Your wallet balance is -₹${Math.abs(bal).toLocaleString("en-IN")}. Please add funds to clear your dues.`,
                  { duration: 7000 },
                );
              }
            } catch {
              // ignore session storage access errors
            }
          }
          setWallet(
            data && {
              balance: data.wallet?.balance ?? 0,
              available: data.available ?? data.wallet?.balance ?? 0,
              reserved: data.reserved ?? 0,
              frozenAmount: data.frozenAmount ?? 0,
              disputedFrozenAmount: data.disputedFrozenAmount ?? 0,
              totalFunds: data.totalFunds ?? data.wallet?.balance ?? 0,
              lockedMilestones: data.lockedMilestones ?? [],
              transactions: data.transactions ?? [],
              withdrawals: data.withdrawals ?? [],
              minWithdrawalAmount: data.minWithdrawalAmount,
            },
          );
        },
      )
      .catch(() => setWallet(null))
      .finally(() => setWalletLoading(false));
  }

  function loadLinkedAccounts() {
    void fetch("/api/v1/linked-accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((data: { accounts?: LinkedAccount[] } | null) => {
        const accs = data?.accounts ?? [];
        setLinkedAccounts(accs);
        const def = accs.find((a) => a.isDefault) ?? accs[0] ?? null;
        setDefaultAccount(def);
        if (def) {
          applyLinkedAccount(def);
          setSelectedLinkedAccountId(def.id);
        } else if (accs.length > 0) {
          applyLinkedAccount(accs[0]!);
        }
      })
      .catch(() => {
        setLinkedAccounts([]);
        setDefaultAccount(null);
      });
  }

  useEffect(() => {
    setPaymentsLoading(true);
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => []) : []))
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
    loadWallet();
    loadLinkedAccounts();
    const handleLinkedUpdated = () => {
      loadLinkedAccounts();
    };
    const handleOnline = () => {
      toast.success("Internet connection restored. Refreshing wallet balance…");
      loadWallet();
      loadLinkedAccounts();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("servio:linked-accounts-updated", handleLinkedUpdated);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("servio:linked-accounts-updated", handleLinkedUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeRefresh(["servio:project-update", "servio:notification", "servio:proposal"], () => {
    setPaymentsLoading(true);
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json().catch(() => []) : []))
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
    void loadWallet();
    loadLinkedAccounts();
  });
  function requestWithdrawal() {
    const minAmt = wallet?.minWithdrawalAmount ?? 500;
    const numAmt = Number(withdrawAmount);
    if (!numAmt || numAmt < minAmt) {
      return setWithdrawMessage(`Minimum withdrawal amount is ₹${minAmt.toLocaleString("en-IN")}.`);
    }
    if (wallet && numAmt > (wallet.available ?? 0)) {
      return setWithdrawMessage(
        `Amount exceeds your available balance of ₹${(wallet.available ?? 0).toLocaleString("en-IN")}.`,
      );
    }
    const upiTarget = withdrawDestination.trim().toLowerCase();
    if (withdrawMethod === "BANK") {
      if (!selectedBankAccount) {
        return setWithdrawMessage("Please link or select a bank account to withdraw.");
      }
      const accValidation = validateBankSpecificAccountNumber(bankAccount, bankName, bankIfsc);
      if (!accValidation.valid) {
        return setWithdrawMessage(accValidation.message || "Please enter a valid bank account number.");
      }
      if (!bankIfsc.trim() || bankIfsc.trim().length !== 11) {
        return setWithdrawMessage("Please enter a valid 11-character IFSC code.");
      }
      if (!accountHolder.trim() || accountHolder.trim().length < 2) {
        return setWithdrawMessage("Please enter the account holder name as per bank records.");
      }
    }
    if (withdrawMethod === "UPI") {
      if (!selectedUpiAccount) {
        return setWithdrawMessage("Please link or select a UPI ID to withdraw.");
      }
      if (!upiTarget) {
        return setWithdrawMessage("Please enter a valid UPI ID (e.g. name@okhdfcbank).");
      }
    }

    setWithdrawMessage("");
    setRecheckModalOpen(true);
  }

  async function executeClientWithdrawal(updatedDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    accountHolder?: string;
    upiId?: string;
    upiHolder?: string;
  }) {
    const finalBankAccount = (updatedDetails?.accountNumber ?? bankAccount).trim();
    const finalBankIfsc = (updatedDetails?.ifscCode ?? bankIfsc).trim().toUpperCase();
    const finalAccountHolder = (updatedDetails?.accountHolder ?? accountHolder).trim();
    const finalUpiId = (updatedDetails?.upiId ?? withdrawDestination).trim().toLowerCase();
    const finalUpiHolder = (updatedDetails?.upiHolder ?? upiHolder).trim();

    if (updatedDetails?.accountNumber) setBankAccount(updatedDetails.accountNumber);
    if (updatedDetails?.ifscCode) setBankIfsc(updatedDetails.ifscCode);
    if (updatedDetails?.accountHolder) setAccountHolder(updatedDetails.accountHolder);
    if (updatedDetails?.upiId) setWithdrawDestination(updatedDetails.upiId);
    if (updatedDetails?.upiHolder) setUpiHolder(updatedDetails.upiHolder);

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      setActionBusy(null);
      return setWithdrawMessage(
        "You appear to be offline. Please reconnect to the internet to submit your withdrawal.",
      );
    }

    setActionBusy("withdraw");
    try {
      const destinationLabel =
        withdrawMethod === "BANK"
          ? JSON.stringify({
              type: "BANK",
              bankName: bankName.trim() || undefined,
              accountHolder: finalAccountHolder || undefined,
              accountNumber: finalBankAccount,
              ifsc: finalBankIfsc,
            })
          : JSON.stringify({
              type: "UPI",
              upiId: finalUpiId,
              upiHolder: finalUpiHolder || undefined,
            });

      const response = await fetch("/api/v1/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          destinationType: withdrawMethod,
          destinationLabel,
          accountHolder:
            withdrawMethod === "BANK" ? finalAccountHolder : finalUpiHolder || undefined,
          accountNumber: withdrawMethod === "BANK" ? finalBankAccount : undefined,
          ifscCode: withdrawMethod === "BANK" ? finalBankIfsc : undefined,
          upiId: withdrawMethod === "UPI" ? finalUpiId : undefined,
          upiHolder: withdrawMethod === "UPI" ? finalUpiHolder || undefined : undefined,
        }),
      });
      const result = await response.json().catch(() => null);
      setWithdrawMessage(
        response.ok
          ? (result?.message ??
              `Withdrawal request of ₹${Number(withdrawAmount).toLocaleString(
                "en-IN",
              )} submitted successfully! Your request has been forwarded to Admin for approval.`)
          : (result?.error ?? "Unable to request withdrawal."),
      );
      if (response.ok) {
        setWithdrawAmount("");
        setWithdrawDestination("");
        setBankAccount("");
        setBankIfsc("");
        setBankName("");
        setAccountHolder("");
        setUpiHolder("");
        setVpaVerified(null);
        setVpaCustomerName(null);
        setVpaError(null);
        setIfscBranch(null);
        setIfscError(null);
        setBankAccountVerified(null);
        setRecheckModalOpen(false);
        loadWallet();
      }
    } catch {
      setWithdrawMessage(
        "Network connection lost. Please check your internet connection and try again.",
      );
    } finally {
      setActionBusy(null);
    }
  }
  async function startTopUp(amountOverride?: number) {
    const topUp = Number(amountOverride ?? topUpAmount);
    if (!topUp || topUp <= 0) return;

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      return setWalletMessage(
        "You appear to be offline. Please reconnect to the internet to fund your wallet.",
      );
    }

    setActionBusy("topup");
    try {
      const response = await fetch("/api/v1/wallet/deposit/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: topUp }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setActionBusy(null);
        return setWalletMessage(result?.error ?? "Unable to start wallet top-up.");
      }
      const openCheckout = () => {
        setActionBusy(null);
        const Razorpay = (
          window as Window & {
            Razorpay?: new (options: Record<string, unknown>) => {
              open: () => void;
              on: (event: string, callback: (response: unknown) => void) => void;
            };
          }
        ).Razorpay;
        if (!Razorpay) return setWalletMessage("Payment checkout could not be loaded.");
        const rzp = new Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency || "INR",
          name: "Klick-Pro",
          description: "Wallet balance top-up",
          image: "/icon.png",
          order_id: result.orderId,
          prefill: {
            name: result.clientName || "Client User",
            email: result.clientEmail || "client@klick-pro.com",
            contact: result.clientPhone || "9876543210",
          },
          theme: { color: "#4f46e5" },
          handler: async (payment: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            setActionBusy("topup");
            setWalletMessage("Verifying payment with bank…");
            try {
              const verified = await fetch("/api/v1/wallet/deposit/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: payment.razorpay_order_id,
                  razorpayPaymentId: payment.razorpay_payment_id,
                  razorpaySignature: payment.razorpay_signature,
                }),
              });
              const data = await verified.json().catch(() => null);
              if (verified.ok) {
                setWalletMessage(
                  `✓ ₹${(data?.amount ?? topUp).toLocaleString("en-IN")} added to your wallet successfully!`,
                );
                setTopUpAmount("");
                loadWallet();
              } else {
                setWalletMessage(data?.error ?? "Wallet funding verification failed.");
              }
            } catch {
              setWalletMessage("Verifying payment with server…");
              let resolved = false;
              for (let i = 0; i < 3; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                try {
                  const check = await fetch(
                    `/api/v1/wallet/deposit/status?orderId=${encodeURIComponent(payment.razorpay_order_id)}`,
                    { cache: "no-store" },
                  );
                  const checkData = await check.json().catch(() => null);
                  if (checkData?.status === "COMPLETED") {
                    resolved = true;
                    setWalletMessage(
                      `✓ ₹${(checkData?.amount ?? topUp).toLocaleString("en-IN")} added to your wallet successfully!`,
                    );
                    setTopUpAmount("");
                    loadWallet();
                    break;
                  }
                } catch {
                  // retry
                }
              }
              if (!resolved) {
                setWalletMessage(
                  "Payment verification timed out. If your account was debited, your balance will update automatically within 1 minute.",
                );
              }
            } finally {
              setActionBusy(null);
            }
          },
          modal: {
            ondismiss: async () => {
              // Before marking cancelled, check if the payment was actually captured (e.g. user paid via UPI app switch)
              try {
                const statusRes = await fetch(
                  `/api/v1/wallet/deposit/status?orderId=${encodeURIComponent(result.orderId)}`,
                  { cache: "no-store" },
                );
                const statusData = await statusRes.json().catch(() => null);
                if (statusData?.status === "COMPLETED") {
                  setActionBusy(null);
                  setWalletMessage(
                    `✓ ₹${(statusData?.amount ?? topUp).toLocaleString("en-IN")} added to your wallet successfully!`,
                  );
                  setTopUpAmount("");
                  loadWallet();
                  return;
                }
              } catch {
                // fallback to fail
              }
              setActionBusy(null);
              void fetch("/api/v1/wallet/deposit/fail", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ orderId: result.orderId, reason: "Checkout cancelled." }),
              });
              setWalletMessage("Checkout closed. No funds were debited.");
            },
          },
        });
        rzp.on("payment.failed", (response: unknown) => {
          const res = response as { error?: { description?: string; reason?: string } };
          setWalletMessage(res.error?.description || "Payment could not be completed.");
        });
        rzp.open();
      };
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if ((window as Window & { Razorpay?: unknown }).Razorpay) return openCheckout();
      const script = existingScript ?? document.createElement("script");
      void new Promise<void>((resolve, reject) => {
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
          "error",
          () => reject(new Error("Unable to load payment checkout.")),
          {
            once: true,
          },
        );
        if (!existingScript) {
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          document.body.appendChild(script);
        }
      })
        .then(openCheckout)
        .catch((error: unknown) => {
          setActionBusy(null);
          setWalletMessage(
            error instanceof Error ? error.message : "Unable to load payment checkout.",
          );
        });
    } catch {
      setActionBusy(null);
    }
  }
  async function openPaymentDetails(payment: Payment) {
    if (!payment.invoicePaymentId) {
      setSelectedTransaction({
        kind: "payment",
        detail: {
          id: 0,
          amount: payment.amount,
          baseAmount: payment.amount,
          clientFeeAmount: 0,
          professionalPayoutAmount: payment.amount,
          adminNetAmount: 0,
          commissionAmount: 0,
          currency: payment.currency,
          provider: "wallet",
          status: payment.status,
          razorpayOrderId: null,
          razorpayPaymentId: null,
          failureReason: null,
          createdAt: payment.createdAt,
          capturedAt: payment.createdAt,
          milestone: { id: 0, title: payment.description, amount: payment.amount },
        },
      });
      return;
    }
    setPaymentDetailsError("");
    setSelectedTransaction({ kind: "payment", detail: null });
    const response = await fetch(`/api/v1/portal/payment-details/${payment.invoicePaymentId}`, {
      cache: "no-store",
    });
    const detail = (await response.json().catch(() => null)) as PaymentDetail | null;
    if (response.ok && detail) setSelectedTransaction({ kind: "payment", detail });
    else
      setPaymentDetailsError(
        detail && "error" in detail ? String(detail.error) : "Payment details could not be loaded.",
      );
  }
  const paidPayments = useMemo(
    () =>
      payments?.filter(
        (payment) => payment.status === "FUNDED" || payment.status === "COMPLETED",
      ) ?? [],
    [payments],
  );
  const total = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const thisMonth = useMemo(
    () =>
      paidPayments
        .filter((p) => {
          const d = new Date(p.createdAt),
            now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, p) => sum + p.amount, 0),
    [paidPayments],
  );
  const historyItems = useMemo(
    () =>
      [
        ...(payments ?? []).map((payment) => ({
          key: `payment-${payment.id}`,
          kind: "payment" as const,
          createdAt: payment.createdAt,
          status: payment.status,
          payment,
        })),
        ...(wallet?.transactions ?? [])
          .filter((transaction) => transaction.type === "WALLET_TOP_UP")
          .map((transaction) => ({
            key: `topup-${transaction.id}`,
            kind: "topup" as const,
            createdAt: transaction.createdAt,
            status: transaction.status,
            transaction,
          })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [payments, wallet],
  );
  const tabCounts = useMemo(
    () => ({
      all: historyItems.length,
      milestones: historyItems.filter(
        (item) => item.kind === "payment" && item.payment.type !== "PLATFORM_COMMISSION",
      ).length,
      commissions: historyItems.filter(
        (item) =>
          (item.kind === "payment" && item.payment.type === "PLATFORM_COMMISSION") ||
          (item.kind === "topup" && item.transaction.type === "PLATFORM_COMMISSION"),
      ).length,
      deposits: historyItems.filter(
        (item) => item.kind === "topup" && item.transaction.type === "WALLET_TOP_UP",
      ).length,
      failed: historyItems.filter((item) => item.status === "FAILED").length,
      validity: wallet?.lockedMilestones?.length ?? 0,
    }),
    [historyItems, wallet?.lockedMilestones],
  );
  const filteredHistoryItems = useMemo(
    () =>
      historyItems.filter((item) => {
        if (historyFilter === "milestones") {
          return item.kind === "payment" && item.payment.type !== "PLATFORM_COMMISSION";
        }
        if (historyFilter === "deposits") {
          return item.kind === "topup" && item.transaction.type === "WALLET_TOP_UP";
        }
        if (historyFilter === "failed") {
          return item.status === "FAILED";
        }
        return true;
      }),
    [historyItems, historyFilter],
  );
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] p-7 text-white shadow-card">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-white/65">
                <WalletCards className="h-4 w-4" /> Client wallet
              </p>
              <h1 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Your project money, ready when you are.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">
                Add funds securely with Razorpay and approve milestones without leaving your wallet.
              </p>
            </div>
            <div className="min-w-[260px] rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs font-semibold text-white/65">
                <span>Available balance</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Secure wallet
                </span>
              </div>
              {wallet && !walletLoading ? (
                <div>
                  <p
                    className={`mt-3 font-display text-4xl font-bold tracking-tight ${
                      wallet.available < 0 ? "text-rose-300" : ""
                    }`}
                  >
                    {wallet.available < 0
                      ? `-₹${Math.abs(wallet.available).toLocaleString("en-IN")}`
                      : `₹${wallet.available.toLocaleString("en-IN")}`}
                  </p>
                  {wallet.available < 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200 border border-rose-400/30">
                      <span>⚠️ Negative Balance (Outstanding Dues)</span>
                    </div>
                  )}
                </div>
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

      {/* Outstanding Dues Banner */}
      {wallet && wallet.available < 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-rose-100 p-2 text-rose-600 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">
                Outstanding Balance: -₹{Math.abs(wallet.available).toLocaleString("en-IN")}
              </h3>
              <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">
                Your wallet has a negative balance from an approved milestone auto-payment. Please add funds to clear your dues and keep your projects running smoothly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTopUpAmount(String(Math.abs(wallet.available)));
              const el = document.getElementById("client-top-up-input");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                (el as HTMLInputElement).focus();
              }
            }}
            className="shrink-0 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            Clear Dues (Add ₹{Math.abs(wallet.available).toLocaleString("en-IN")})
          </button>
        </div>
      )}

      {paymentsLoading && !payments ? (
        <CardListSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  {(wallet?.frozenAmount ?? 0) > 0 && (
                    <div className="relative group">
                      <button
                        type="button"
                        aria-label="View frozen funds breakdown"
                        onClick={() => {
                          setHistoryFilter("validity");
                          document.getElementById("payment-history-section")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          (wallet?.disputedFrozenAmount ?? 0) > 0
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                        }`}
                      >
                        {(wallet?.disputedFrozenAmount ?? 0) > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>
                          ₹{(wallet?.frozenAmount ?? 0).toLocaleString("en-IN")}{" "}
                          {(wallet?.disputedFrozenAmount ?? 0) > 0 ? "Frozen (Disputed)" : "Frozen"}
                        </span>
                        <Info className="h-3 w-3 opacity-70" />
                      </button>

                      {/* Hover Mini Popup */}
                      <div className="pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-popover/95 p-3.5 shadow-xl backdrop-blur-md text-popover-foreground">
                        <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-2.5">
                          <div className={`flex items-center gap-1.5 font-semibold text-xs ${
                            (wallet?.disputedFrozenAmount ?? 0) > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}>
                            {(wallet?.disputedFrozenAmount ?? 0) > 0 ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                            <span>Frozen Milestone Funds</span>
                          </div>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                            (wallet?.disputedFrozenAmount ?? 0) > 0
                              ? "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }`}>
                            {(wallet?.disputedFrozenAmount ?? 0) > 0 ? "Dispute Alert" : "In Review"}
                          </span>
                        </div>

                        {(wallet?.disputedFrozenAmount ?? 0) > 0 && (
                          <div className="mb-2.5 rounded-xl border border-rose-500/30 bg-rose-500/15 p-2 text-rose-800 dark:text-rose-300">
                            <div className="flex items-center gap-1 font-bold text-[11px]">
                              <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                              <span>Dispute Active (₹{(wallet?.disputedFrozenAmount ?? 0).toLocaleString("en-IN")})</span>
                            </div>
                            <p className="mt-0.5 text-[10px] leading-tight text-rose-700 dark:text-rose-400">
                              Payment auto-release is suspended. Funds remain securely locked in escrow.
                            </p>
                          </div>
                        )}

                        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                          Reserved exclusively for active reviews. Cannot be used for other jobs or withdrawn.
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {wallet?.lockedMilestones?.map((m) => (
                            <div
                              key={m.id}
                              className={`rounded-xl border p-2.5 text-xs ${
                                m.hasDispute
                                  ? "border-rose-500/50 bg-rose-500/10 dark:bg-rose-950/20"
                                  : "border-border/60 bg-muted/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    {m.hasDispute && (
                                      <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                                    )}
                                    <p className="font-semibold text-foreground truncate">{capitalizeWords(m.jobTitle)}</p>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">{capitalizeWords(m.title)}</p>
                                </div>
                                <span className={`font-bold shrink-0 ${
                                  m.hasDispute
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}>
                                  ₹{m.amount.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">{m.validityDays}-Day Validity</span>
                                <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider ${
                                  m.hasDispute
                                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                                    : "text-primary font-medium"
                                }`}>
                                  {m.hasDispute ? `Dispute #${m.disputeId ?? "Active"}` : "Active Review"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-border/70 flex items-center justify-between text-xs font-semibold">
                          <span className="text-muted-foreground">Total Frozen:</span>
                          <span className={`font-bold ${
                            (wallet?.disputedFrozenAmount ?? 0) > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}>
                            ₹{(wallet?.frozenAmount ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryFilter("validity");
                            document.getElementById("payment-history-section")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary py-1.5 text-xs font-semibold transition cursor-pointer"
                        >
                          <span>View in Transactions</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {walletLoading ? (
                  <div className="mt-4 h-9 w-28 animate-pulse rounded-lg bg-muted" />
                ) : (
                  <p className="mt-4 text-3xl font-bold">
                    {(wallet?.available ?? 0) < 0
                      ? `-₹${Math.abs(wallet?.available ?? 0).toLocaleString("en-IN")}`
                      : `₹${(wallet?.available ?? 0).toLocaleString("en-IN")}`}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">Available balance</p>
              </div>
              {(wallet?.frozenAmount ?? 0) > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                  Total in wallet: <span className="font-semibold text-foreground">₹{((wallet?.available ?? 0) + (wallet?.frozenAmount ?? 0)).toLocaleString("en-IN")}</span>
                </p>
              )}
            </div>
            <Stat
              icon={CircleDollarSign}
              value={`₹${total.toLocaleString()}`}
              label="Total paid"
              loading={paymentsLoading}
            />
            <Stat
              icon={CalendarDays}
              value={`₹${thisMonth.toLocaleString()}`}
              label="Paid this month"
              loading={paymentsLoading}
            />
            <Stat
              icon={ReceiptText}
              value={String(paidPayments.filter((p) => p.type !== "PLATFORM_COMMISSION").length)}
              label="Funded milestones"
              loading={paymentsLoading}
            />
          </div>
          <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card p-6 shadow-soft">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Add funds instantly
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold">Top up your wallet</h2>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Your balance is used for milestone approvals. Payments are processed securely by
                  Razorpay.
                </p>
              </div>
              <div className="w-full max-w-md">
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 2500, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTopUpAmount(String(amount))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        topUpAmount === String(amount)
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      ₹{amount.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <span className="mr-2 text-sm font-semibold text-muted-foreground">₹</span>
                    <input
                      id="client-top-up-input"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                      type="number"
                      min="1"
                      value={topUpAmount}
                      onChange={(event) => setTopUpAmount(event.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void startTopUp()}
                    disabled={
                      !Number(topUpAmount) || Number(topUpAmount) <= 0 || actionBusy === "topup"
                    }
                  >
                    {actionBusy === "topup" ? (
                      "Connecting…"
                    ) : (
                      <>
                        Add money <ArrowUpRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
                {walletMessage ? (
                  <p
                    className={`mt-3 text-sm font-medium ${
                      walletMessage.startsWith("✓") ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {walletMessage}
                  </p>
                ) : null}

                {/* Professional Trust & Compliance Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 256-bit bank encryption
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Instant wallet balance
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <LockKeyhole className="h-3.5 w-3.5 text-indigo-600" /> UPI, Netbanking &amp;
                    Cards
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Saved Bank & UPI Accounts */}
          <div id="saved-accounts" className="scroll-mt-6">
            <LinkedAccountsCard
              title="Saved Bank & UPI Accounts"
              description="Manage your linked bank accounts and UPI IDs for quick withdrawals and refunds."
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
                                  onClick={() => handleCopyUtr(withdrawal.utr!)}
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
                      When you withdraw unused balance to your bank account or UPI, your payout records and UTR reference will appear here.
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
                  Get your money back
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Withdraw unused wallet balance to your bank account or UPI. Requests are processed instantly via automated payment rails.
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
                        setWithdrawMethod("BANK");
                        setWithdrawMessage("");
                        if (selectedBankAccount) {
                          applyLinkedAccount(selectedBankAccount);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                        withdrawMethod === "BANK"
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
                        setWithdrawMethod("UPI");
                        setWithdrawMessage("");
                        if (selectedUpiAccount) {
                          applyLinkedAccount(selectedUpiAccount);
                        }
                      }}
                      className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                        withdrawMethod === "UPI"
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>UPI (Instant VPA)</span>
                    </button>
                  </div>
                </div>

                {/* Selected Saved Account Card (Replacing Raw Input Form) */}
                <div
                  key={withdrawMethod}
                  className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both"
                >
                  {withdrawMethod === "BANK" ? (
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
                            Add your bank account below in Saved Accounts to withdraw funds directly via 24x7 IMPS.
                          </p>
                          <a
                            href="#saved-accounts"
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById("saved-accounts")?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1 cursor-pointer"
                          >
                            + Link Bank Account
                          </a>
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
                                setSelectedBankAccountId(acc.id);
                                applyLinkedAccount(acc);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                selectedBankAccount?.id === acc.id
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
                            Add your UPI ID below in Saved Accounts to withdraw funds instantly to your UPI app.
                          </p>
                          <a
                            href="#saved-accounts"
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById("saved-accounts")?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1 cursor-pointer"
                          >
                            + Link UPI ID
                          </a>
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
                                setSelectedUpiAccountId(acc.id);
                                applyLinkedAccount(acc);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                selectedUpiAccount?.id === acc.id
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
                        onClick={() => setWithdrawAmount(String(amt))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          withdrawAmount === String(amt)
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
                        onClick={() => setWithdrawAmount(String(wallet?.available ?? 0))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                          withdrawAmount === String(wallet?.available ?? 0)
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
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>

                  {withdrawAmount &&
                    Number(withdrawAmount) < (wallet?.minWithdrawalAmount ?? 500) && (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Minimum withdrawal amount is ₹
                        {(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}.
                      </p>
                    )}
                  {withdrawAmount &&
                    Number(withdrawAmount) > (wallet?.available ?? 0) && (
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
                    onClick={() => void requestWithdrawal()}
                    disabled={
                      !Number(withdrawAmount) ||
                      Number(withdrawAmount) < (wallet?.minWithdrawalAmount ?? 500) ||
                      Number(withdrawAmount) > (wallet?.available ?? 0) ||
                      (withdrawMethod === "BANK"
                        ? !selectedBankAccount || !bankAccount.trim()
                        : !selectedUpiAccount || !withdrawDestination.trim()) ||
                      actionBusy === "withdraw"
                    }
                  >
                    {actionBusy === "withdraw" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing Withdrawal…
                      </>
                    ) : (
                      <>
                        Withdraw {withdrawAmount ? `₹${Number(withdrawAmount).toLocaleString("en-IN")}` : "Funds"}
                        <ArrowUpRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {withdrawMessage ? (
                    <div
                      className={`rounded-xl p-3 text-xs font-medium border flex items-start gap-2 ${
                        withdrawMessage.includes("transferred instantly") ||
                        withdrawMessage.includes("successfully")
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {withdrawMessage.includes("transferred instantly") ||
                      withdrawMessage.includes("successfully") ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      )}
                      <span>{withdrawMessage}</span>
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Instant Settlement
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <LockKeyhole className="h-3.5 w-3.5 text-indigo-600" /> RazorpayX Secure Rails
                </span>
              </div>
            </section>
          </div>
          {/* How Payment Works 4-Step Process Banner */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">
                    How Payment &amp; Escrow Works
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    End-to-end milestone protection, inspection review &amp; automated settlement
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Escrow Protected
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-primary">
                  <LockKeyhole className="h-3 w-3" /> 256-bit Security
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 relative group hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    1
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Deliverable
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-foreground">Milestone Submission</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Professional uploads completed deliverables and work files for your inspection review.
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 relative group hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    2
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Inspection
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-foreground">Review &amp; Approve</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  You inspect the submitted work. If revisions are needed, request them directly in project tracking.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 relative group hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    3
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Escrow Hold
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-foreground">Inspection Period</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Funds remain safely secured in platform escrow during the milestone inspection validity period.
                </p>
              </div>

              {/* Step 4 */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-2 relative group hover:border-primary/40 transition">
                <div className="flex items-center justify-between">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    4
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">
                    Settled
                  </span>
                </div>
                <h3 className="font-semibold text-xs sm:text-sm text-foreground">Payout Release</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Funds automatically release to the professional’s wallet or bank account seamlessly.
                </p>
              </div>
            </div>
          </div>

          <section
            id="payment-history-section"
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft scroll-mt-6"
          >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Payment history</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Client-funded milestones are released after admin payout approval.
                  </p>
                </div>
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/20 p-3 sm:px-5">
                {(
                  [
                    { key: "all", label: "All", count: tabCounts.all },
                    { key: "milestones", label: "Milestones", count: tabCounts.milestones },
                    { key: "deposits", label: "Deposits", count: tabCounts.deposits },
                    { key: "failed", label: "Failed", count: tabCounts.failed },
                    { key: "validity", label: "Validity", count: tabCounts.validity },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setHistoryFilter(tab.key);
                      setVisibleCount(10);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
              {historyFilter === "validity" ? (
                wallet?.lockedMilestones?.length ? (
                  wallet.lockedMilestones.slice(0, visibleCount).map((m) => {
                    const releaseDate = m.releaseAt ? new Date(m.releaseAt) : null;
                    const now = new Date();
                    const diffMs = releaseDate ? releaseDate.getTime() - now.getTime() : 0;
                    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
                    const diffDays = Math.floor(diffHours / 24);
                    const remHours = diffHours % 24;

                    return (
                      <div
                        key={`validity-${m.id}`}
                        className="group flex items-center justify-between gap-4 border-b border-border/60 p-4 sm:p-5 transition-all hover:bg-muted/40 last:border-0"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 transition-transform group-hover:scale-105">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                                {capitalizeWords(m.title)}
                              </p>
                              <span className="shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                Validity Active · {m.validityDays}d review
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>
                                Job:{" "}
                                <strong className="text-foreground font-medium">
                                  {capitalizeWords(m.jobTitle)}
                                </strong>
                              </span>
                              <span className="text-muted-foreground/40">·</span>
                              <span>
                                Pro:{" "}
                                <strong className="text-foreground font-medium">
                                  {capitalizeWords(m.professionalName)}
                                </strong>
                              </span>
                              <span className="text-muted-foreground/40">·</span>
                              {diffMs > 0 ? (
                                <span className="font-medium text-amber-700 dark:text-amber-400">
                                  ⏳ {diffDays > 0 ? `${diffDays}d ` : ""}
                                  {remHours}h remaining of {m.validityDays}d validity
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-medium">
                                  Validity ending · Ready for release
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm sm:text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                              ₹{m.amount.toLocaleString("en-IN")}{" "}
                              <span className="text-xs font-normal text-muted-foreground">INR</span>
                            </p>
                            <div className="mt-1 flex justify-end">
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                Payment Frozen
                              </span>
                            </div>
                          </div>
                          <Link
                            href={`/project/${m.projectId}/tracking`}
                            className="inline-flex items-center justify-center p-2 rounded-xl text-primary hover:bg-primary/10 transition"
                            title="View milestone in project tracking"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600/80 mb-2" />
                    <p className="text-sm font-semibold text-foreground">
                      Zero Milestones in Validity Period
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                      All completed milestone payments have finished their validity inspection period and been released. When a professional completes a milestone, it will show here while its payment is held.
                    </p>
                  </div>
                )
              ) :
                filteredHistoryItems.slice(0, visibleCount).map((item) =>
                item.kind === "payment" ? (
                  <div
                    key={item.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openPaymentDetails(item.payment)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        void openPaymentDetails(item.payment);
                    }}
                    className="group flex cursor-pointer items-center justify-between gap-4 border-b border-border/60 p-4 sm:p-5 transition-all hover:bg-muted/40 last:border-0"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                          item.payment.type === "PLATFORM_COMMISSION"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-primary/10 text-primary border-primary/20"
                        }`}
                      >
                        {item.payment.type === "PLATFORM_COMMISSION" ? (
                          <Percent className="h-5 w-5" />
                        ) : (
                          <FolderKanban className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                            {item.payment.description}
                          </p>
                          {item.payment.type === "PLATFORM_COMMISSION" ? (
                            <span className="shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              Commission fee (10%)
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Milestone payment
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>
                            {new Date(item.payment.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            ·{" "}
                            {new Date(item.payment.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          {item.payment.invoicePaymentId && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="font-mono text-[10px] text-muted-foreground/90 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                                INV #{item.payment.invoicePaymentId}
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
                            item.payment.type === "PLATFORM_COMMISSION"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-foreground"
                          }`}
                        >
                          -₹{item.payment.amount.toLocaleString("en-IN")}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {item.payment.currency}
                          </span>
                        </p>
                        <div className="mt-1 flex justify-end">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              item.payment.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : item.payment.status === "FUNDED"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {item.payment.status === "COMPLETED"
                              ? "Payout completed"
                              : item.payment.status === "FUNDED"
                                ? "Awaiting admin payout"
                                : formatReadableLabel(item.payment.status)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground hidden sm:block shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.key}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedTransaction({ kind: "topup", detail: item.transaction })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setSelectedTransaction({ kind: "topup", detail: item.transaction });
                    }}
                    className="group flex cursor-pointer items-center justify-between gap-4 border-b border-border/60 p-4 sm:p-5 transition-all hover:bg-muted/40 last:border-0"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                          item.transaction.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : item.transaction.status === "FAILED"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {item.transaction.status === "COMPLETED" ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : item.transaction.status === "FAILED" ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground text-sm sm:text-base truncate">
                            Wallet top-up
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              item.transaction.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : item.transaction.status === "FAILED"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            Deposit
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>
                            {new Date(item.transaction.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            ·{" "}
                            {new Date(item.transaction.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          {item.transaction.providerReference && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="font-mono text-[10px] text-muted-foreground/90 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                                {item.transaction.providerReference}
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
                            item.transaction.status === "COMPLETED"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : item.transaction.status === "FAILED"
                                ? "text-muted-foreground line-through"
                                : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {item.transaction.status === "COMPLETED"
                            ? "+"
                            : item.transaction.status === "FAILED"
                              ? ""
                              : ""}
                          ₹{item.transaction.amount.toLocaleString("en-IN")}{" "}
                          <span className="text-xs font-normal text-muted-foreground">INR</span>
                        </p>
                        <div className="mt-1 flex justify-end">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              item.transaction.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : item.transaction.status === "FAILED"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {item.transaction.status === "COMPLETED" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : item.transaction.status === "FAILED" ? (
                              <AlertCircle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {item.transaction.status === "COMPLETED"
                              ? "Wallet funded"
                              : item.transaction.status === "FAILED"
                                ? "Failed"
                                : item.transaction.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground hidden sm:block shrink-0" />
                    </div>
                  </div>
                ),
              )}
              {historyFilter === "validity"
                ? (wallet?.lockedMilestones?.length ?? 0) > visibleCount && (
                    <div className="border-t border-border/60 bg-muted/10 p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 10)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        <span>Show more milestones</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {(wallet?.lockedMilestones?.length ?? 0) - visibleCount} remaining
                        </span>
                      </button>
                    </div>
                  )
                : filteredHistoryItems.length > visibleCount && (
                    <div className="border-t border-border/60 bg-muted/10 p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 10)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-accent hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        <span>Show more transactions</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {filteredHistoryItems.length - visibleCount} remaining
                        </span>
                      </button>
                    </div>
                  )}
              {historyFilter !== "validity" && !filteredHistoryItems.length && (
                <p className="p-8 text-sm text-muted-foreground">
                  {historyFilter === "all"
                    ? "No payment activity yet."
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
                <h2 className="mt-2 font-display text-2xl font-bold">
                  {selectedTransaction.kind === "payment"
                    ? (selectedTransaction.detail?.milestone?.title ?? "Milestone payment")
                    : "Wallet top-up"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close payment details"
                className="grid h-9 w-9 place-items-center rounded-full bg-muted text-lg text-muted-foreground hover:bg-muted/70"
                onClick={() => setSelectedTransaction(null)}
              >
                ×
              </button>
            </div>
            {selectedTransaction.kind === "payment" && !selectedTransaction.detail ? (
              paymentDetailsError ? (
                <p className="mt-8 rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">
                  {paymentDetailsError}
                </p>
              ) : (
                <div className="mt-8 h-32 animate-pulse rounded-2xl bg-muted" />
              )
            ) : selectedTransaction.kind === "payment" ? (
              <PaymentDetails detail={selectedTransaction.detail!} />
            ) : (
              <TopUpDetails detail={selectedTransaction.detail} />
            )}
          </section>
        </div>
      ) : null}

      {/* Confirmation Modal to Recheck Details Before Withdrawal */}
      <RecheckWithdrawalModal
        open={recheckModalOpen}
        onOpenChange={setRecheckModalOpen}
        amount={Number(withdrawAmount)}
        payoutMethod={withdrawMethod}
        bankName={bankName}
        accountHolder={accountHolder}
        accountNumber={bankAccount}
        ifscCode={bankIfsc}
        upiId={withdrawDestination}
        upiHolder={upiHolder}
        onConfirm={executeClientWithdrawal}
        onEdit={() => setRecheckModalOpen(false)}
        onUpdateDetails={(updated) => {
          if (updated.accountNumber !== undefined) setBankAccount(updated.accountNumber);
          if (updated.ifscCode !== undefined) setBankIfsc(updated.ifscCode);
          if (updated.accountHolder !== undefined) setAccountHolder(updated.accountHolder);
          if (updated.upiId !== undefined) setWithdrawDestination(updated.upiId);
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

      <PageActionLoading
        active={actionBusy !== null}
        title={
          actionBusy === "topup"
            ? "Connecting to payment gateway…"
            : "Submitting withdrawal request…"
        }
        description={
          actionBusy === "topup"
            ? "Preparing secure checkout with Razorpay."
            : "Sending your withdrawal request to admin review."
        }
      />
    </div>
  );
}
function PaymentDetails({ detail }: { detail: PaymentDetail }) {
  const money = (amount: number) => `₹${amount.toLocaleString("en-IN")} ${detail.currency}`;
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground">Amount charged</p>
        <p className="mt-1 font-display text-3xl font-bold">{money(detail.amount)}</p>
        <p
          className={`mt-2 text-sm font-semibold ${detail.status === "COMPLETED" ? "text-success" : "text-warning"}`}
        >
          {detail.status === "FUNDED" ? "AWAITING ADMIN PAYOUT" : detail.status}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <DetailRow label="Milestone value" value={money(detail.baseAmount)} />
        <DetailRow label="Client service fee" value={money(detail.clientFeeAmount)} />
        <DetailRow
          label="Professional milestone amount"
          value={money(detail.professionalPayoutAmount)}
        />
        <DetailRow
          label="Payment method"
          value={detail.provider === "wallet" ? "Wallet balance" : detail.provider}
        />
        <DetailRow label="Payment date" value={new Date(detail.createdAt).toLocaleString()} />
        {detail.razorpayPaymentId ? (
          <DetailRow label="Razorpay payment ID" value={detail.razorpayPaymentId} />
        ) : null}
        {detail.failureReason ? (
          <DetailRow label="Failure reason" value={detail.failureReason} />
        ) : null}
      </div>
      {detail.status === "COMPLETED" && detail.id > 0 ? (
        <a
          href={`/api/v1/portal/invoices/${detail.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Download invoice / receipt
        </a>
      ) : null}
    </div>
  );
}
function TopUpDetails({ detail }: { detail: WalletTransaction }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground">Top-up amount</p>
        <p className="mt-1 font-display text-3xl font-bold">
          ₹{detail.amount.toLocaleString("en-IN")} INR
        </p>
        <p
          className={`mt-2 text-sm font-semibold ${detail.status === "FAILED" ? "text-destructive" : detail.status === "COMPLETED" ? "text-success" : "text-warning"}`}
        >
          {detail.status}
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <DetailRow label="Payment type" value="Razorpay wallet top-up" />
        <DetailRow label="Date" value={new Date(detail.createdAt).toLocaleString()} />
        <DetailRow label="Razorpay order ID" value={detail.providerReference ?? "Not available"} />
        <DetailRow
          label="Wallet effect"
          value={detail.status === "COMPLETED" ? "Balance credited" : "No money added"}
        />
      </div>
    </div>
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
function Stat({
  icon: Icon,
  value,
  label,
  loading = false,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-5 w-5 text-primary" />
      {loading ? (
        <div className="mt-4 h-9 w-28 animate-pulse rounded-lg bg-muted" />
      ) : (
        <p className="mt-4 text-3xl font-bold">{value}</p>
      )}
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
