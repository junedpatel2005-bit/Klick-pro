"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  FolderKanban,
  Landmark,
  Loader2,
  LockKeyhole,
  Percent,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { CardListSkeleton } from "@/components/LoadingSkeleton";
import { PageActionLoading } from "@/components/PageActionLoading";
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
};
type Wallet = {
  balance: number;
  available: number;
  reserved: number;
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

export default function ClientEarnings() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<
    | { kind: "payment"; detail: PaymentDetail | null }
    | { kind: "topup"; detail: WalletTransaction }
    | null
  >(null);
  const [paymentDetailsError, setPaymentDetailsError] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "milestones" | "commissions" | "deposits" | "failed"
  >("all");
  const [withdrawMethod, setWithdrawMethod] = useState<"BANK" | "CARD" | "UPI">("BANK");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  // Profile Linked Accounts
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [selectedLinkedAccountId, setSelectedLinkedAccountId] = useState<string>("");

  function applyLinkedAccount(acc: LinkedAccount) {
    if (acc.accountType === "BANK") {
      setWithdrawMethod("BANK");
      setBankAccount(acc.accountNumber ?? "");
      setBankIfsc(acc.ifscCode ?? "");
    } else if (acc.accountType === "UPI") {
      setWithdrawMethod("UPI");
      setWithdrawDestination(acc.upiId ?? "");
    } else if (acc.accountType === "CARD") {
      setWithdrawMethod("CARD");
      setWithdrawDestination(acc.accountNumber ?? "");
    }
  }

  function loadWallet() {
    setWalletLoading(true);
    void fetch("/api/v1/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            wallet?: { balance: number };
            available?: number;
            reserved?: number;
            transactions?: WalletTransaction[];
            withdrawals?: Withdrawal[];
            minWithdrawalAmount?: number;
          } | null,
        ) =>
          setWallet(
            data && {
              balance: data.wallet?.balance ?? 0,
              available: data.available ?? data.wallet?.balance ?? 0,
              reserved: data.reserved ?? 0,
              transactions: data.transactions ?? [],
              withdrawals: data.withdrawals ?? [],
              minWithdrawalAmount: data.minWithdrawalAmount,
            },
          ),
      )
      .catch(() => setWallet(null))
      .finally(() => setWalletLoading(false));
  }

  function loadLinkedAccounts() {
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
  }

  useEffect(() => {
    setPaymentsLoading(true);
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
    loadWallet();
    loadLinkedAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useRealtimeRefresh(["servio:project-update", "servio:notification", "servio:proposal"], () => {
    setPaymentsLoading(true);
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPayments)
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
    void loadWallet();
    loadLinkedAccounts();
  });
  async function requestWithdrawal() {
    const destination =
      withdrawMethod === "BANK"
        ? `${bankAccount.trim()} (IFSC: ${bankIfsc.trim().toUpperCase()})`
        : withdrawDestination.trim();

    if (withdrawMethod === "BANK" && (!bankAccount.trim() || !bankIfsc.trim())) {
      return setWithdrawMessage("Please enter both bank account number and IFSC code.");
    }
    if (withdrawMethod !== "BANK" && !destination) {
      return setWithdrawMessage("Please enter payout destination details.");
    }

    setActionBusy("withdraw");
    try {
      const response = await fetch("/api/v1/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          destinationType: withdrawMethod,
          destinationLabel: destination,
        }),
      });
      const result = await response.json().catch(() => null);
      setWithdrawMessage(
        response.ok
          ? "Withdrawal request submitted for review."
          : (result?.error ?? "Unable to request withdrawal."),
      );
      if (response.ok) {
        setWithdrawAmount("");
        setWithdrawDestination("");
        setBankAccount("");
        setBankIfsc("");
        loadWallet();
      }
    } finally {
      setActionBusy(null);
    }
  }
  async function startTopUp(amountOverride?: number) {
    const topUp = Number(amountOverride ?? topUpAmount);
    if (!topUp || topUp <= 0) return;
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
    }),
    [historyItems],
  );
  const filteredHistoryItems = useMemo(
    () =>
      historyItems.filter((item) => {
        if (historyFilter === "milestones") {
          return item.kind === "payment" && item.payment.type !== "PLATFORM_COMMISSION";
        }
        if (historyFilter === "commissions") {
          return (
            (item.kind === "payment" && item.payment.type === "PLATFORM_COMMISSION") ||
            (item.kind === "topup" && item.transaction.type === "PLATFORM_COMMISSION")
          );
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
      {paymentsLoading && !payments ? (
        <CardListSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={CircleDollarSign}
              value={`₹${(wallet?.available ?? 0).toLocaleString()}`}
              label="Wallet balance"
              loading={walletLoading}
            />
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
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground">
                  <Landmark className="h-3.5 w-3.5" /> Withdraw funds
                </div>
                <h2 className="mt-4 font-display text-2xl font-semibold">Get your money back</h2>
                <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                  Withdraw unused wallet balance to your bank account, card, or UPI. Requests are
                  reviewed before payout.
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  Available to withdraw:{" "}
                  <span className="font-semibold text-foreground">
                    ₹{(wallet?.available ?? 0).toLocaleString("en-IN")}
                  </span>
                </p>
              </div>
              <div className="w-full max-w-md space-y-3">
                {/* Profile Linked Account Selector */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-primary" />
                      Profile Linked Account
                    </label>
                    <Link
                      href="/my-info"
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Manage accounts →
                    </Link>
                  </div>

                  {linkedAccounts.length > 0 ? (
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
                          {linkedAccounts.map((acc) => {
                            const label =
                              acc.accountType === "BANK"
                                ? `Bank: ${acc.bankName || "Bank Account"} (•••• ${acc.last4 || "••••"})`
                                : acc.accountType === "UPI"
                                  ? `UPI: ${acc.upiId || "UPI"} (•••• ${acc.last4 || "••••"})`
                                  : acc.accountType === "CARD"
                                    ? `Card: ${acc.cardBank || "Debit Card"} (•••• ${acc.last4 || "••••"})`
                                    : `Razorpay: ${acc.razorpayAccountId || "Account"} (•••• ${acc.last4 || "••••"})`;
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
                        href="/my-info"
                        className="font-semibold text-primary hover:underline ml-2"
                      >
                        + Link Account
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "BANK", label: "Bank account", icon: Landmark },
                      { key: "CARD", label: "Card", icon: CreditCard },
                      { key: "UPI", label: "UPI", icon: Smartphone },
                    ] as const
                  ).map((method) => (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setWithdrawMethod(method.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${withdrawMethod === method.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                    >
                      <method.icon className="h-3.5 w-3.5" /> {method.label}
                    </button>
                  ))}
                </div>
                {withdrawMethod === "BANK" ? (
                  <div className="mt-3 space-y-2.5">
                    <input
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      value={bankAccount}
                      onChange={(event) => setBankAccount(event.target.value)}
                      placeholder="Bank account number (e.g. 1234567890)"
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm uppercase focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none placeholder:normal-case font-mono text-xs tracking-wider"
                      value={bankIfsc}
                      onChange={(event) => setBankIfsc(event.target.value.toUpperCase())}
                      placeholder="IFSC code (e.g. HDFC0001234)"
                      maxLength={11}
                    />
                  </div>
                ) : (
                  <input
                    className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                    value={withdrawDestination}
                    onChange={(event) => setWithdrawDestination(event.target.value)}
                    placeholder={
                      withdrawMethod === "CARD"
                        ? "Debit / Credit Card number (16 digits)"
                        : "UPI ID (e.g. username@okhdfcbank, 9876543210@paytm)"
                    }
                  />
                )}
                <div className="mt-3 flex gap-2">
                  <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <span className="mr-2 text-sm font-semibold text-muted-foreground">₹</span>
                    <input
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      type="number"
                      min={wallet?.minWithdrawalAmount ?? 500}
                      max={wallet?.available ?? 0}
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder={`Min ₹${(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}`}
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void requestWithdrawal()}
                    disabled={
                      !Number(withdrawAmount) ||
                      Number(withdrawAmount) < (wallet?.minWithdrawalAmount ?? 500) ||
                      Number(withdrawAmount) > (wallet?.available ?? 0) ||
                      (withdrawMethod === "BANK"
                        ? !bankAccount.trim() || !bankIfsc.trim()
                        : !withdrawDestination.trim()) ||
                      actionBusy === "withdraw"
                    }
                  >
                    Withdraw
                  </button>
                </div>
                {withdrawAmount &&
                  Number(withdrawAmount) < (wallet?.minWithdrawalAmount ?? 500) && (
                    <p className="mt-1.5 text-xs font-medium text-amber-600">
                      Minimum withdrawal amount is ₹
                      {(wallet?.minWithdrawalAmount ?? 500).toLocaleString("en-IN")}.
                    </p>
                  )}
                {withdrawMessage ? (
                  <p className="mt-3 text-sm text-muted-foreground">{withdrawMessage}</p>
                ) : null}
                {wallet?.withdrawals.length ? (
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent withdrawals
                    </p>
                    {wallet.withdrawals.slice(0, 5).map((withdrawal) => (
                      <div
                        key={withdrawal.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-semibold">
                            ₹{withdrawal.amount.toLocaleString("en-IN")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {withdrawal.destinationLabel ?? withdrawal.destinationType}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${withdrawal.status === "COMPLETED" ? "text-success" : withdrawal.status === "FAILED" ? "text-destructive" : "text-warning"}`}
                        >
                          {withdrawal.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
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
                    { key: "commissions", label: "Commissions", count: tabCounts.commissions },
                    { key: "deposits", label: "Deposits", count: tabCounts.deposits },
                    { key: "failed", label: "Failed", count: tabCounts.failed },
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
              {filteredHistoryItems.slice(0, visibleCount).map((item) =>
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
                                : item.payment.status}
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
              {filteredHistoryItems.length > visibleCount && (
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
              {!filteredHistoryItems.length && (
                <p className="p-8 text-sm text-muted-foreground">
                  {historyFilter === "all"
                    ? "No payment activity yet."
                    : `No ${historyFilter} transactions found.`}
                </p>
              )}
            </section>
            <aside className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h2 className="mt-5 font-display text-xl font-semibold">How payment works</h2>
              <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
                <li>
                  <span className="mr-2 font-semibold text-primary">1.</span>A professional submits
                  their milestone work.
                </li>
                <li>
                  <span className="mr-2 font-semibold text-primary">2.</span>You review and approve
                  the milestone.
                </li>
                <li>
                  <span className="mr-2 font-semibold text-primary">3.</span>The milestone payment
                  moves to the secure platform wallet for admin review.
                </li>
                <li>
                  <span className="mr-2 font-semibold text-primary">4.</span>After admin approval,
                  the professional payout is credited to their wallet.
                </li>
              </ol>
              <p className="mt-6 rounded-xl bg-primary/5 p-4 text-sm text-muted-foreground">
                Need to review a payment? Open the related project from your Projects page.
              </p>
            </aside>
          </div>
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
