"use client";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { CardListSkeleton } from "@/components/LoadingSkeleton";
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
export default function ClientEarnings() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<
    | { kind: "payment"; detail: PaymentDetail | null }
    | { kind: "topup"; detail: WalletTransaction }
    | null
  >(null);
  const [paymentDetailsError, setPaymentDetailsError] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "successful" | "failed">("all");
  const [withdrawMethod, setWithdrawMethod] = useState<"BANK" | "CARD" | "UPI">("BANK");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");
  function loadWallet() {
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
          } | null,
        ) =>
          setWallet(
            data && {
              balance: data.wallet?.balance ?? 0,
              available: data.available ?? data.wallet?.balance ?? 0,
              reserved: data.reserved ?? 0,
              transactions: data.transactions ?? [],
              withdrawals: data.withdrawals ?? [],
            },
          ),
      );
  }
  useEffect(() => {
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setPayments);
    loadWallet();
  }, []);
  async function requestWithdrawal() {
    const response = await fetch("/api/v1/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: Number(withdrawAmount),
        destinationType: withdrawMethod,
        destinationLabel: withdrawDestination.trim(),
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
      loadWallet();
    }
  }
  async function startTopUp() {
    const response = await fetch("/api/v1/wallet/deposit/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(topUpAmount) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return setWalletMessage(result?.error ?? "Unable to start wallet top-up.");
    const openCheckout = () => {
      const Razorpay = (
        window as Window & {
          Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
        }
      ).Razorpay;
      if (!Razorpay) return setWalletMessage("Payment checkout could not be loaded.");
      new Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: "Klick-Pro",
        description: "Wallet top-up",
        order_id: result.orderId,
        handler: async (payment: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const verified = await fetch("/api/v1/wallet/deposit/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            }),
          });
          setWalletMessage(
            verified.ok ? "Wallet funded successfully." : "Wallet funding verification failed.",
          );
          if (verified.ok) window.location.reload();
        },
        modal: {
          ondismiss: () => {
            void fetch("/api/v1/wallet/deposit/fail", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ orderId: result.orderId, reason: "Checkout cancelled." }),
            });
            setWalletMessage("Payment was cancelled. No money was added to your wallet.");
          },
        },
      }).open();
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
      .catch((error: unknown) =>
        setWalletMessage(
          error instanceof Error ? error.message : "Unable to load payment checkout.",
        ),
      );
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
  const completed = useMemo(
    () => payments?.filter((payment) => payment.status === "COMPLETED") ?? [],
    [payments],
  );
  const total = completed.reduce((sum, p) => sum + p.amount, 0);
  const thisMonth = useMemo(
    () =>
      completed
        .filter((p) => {
          const d = new Date(p.createdAt),
            now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, p) => sum + p.amount, 0),
    [completed],
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
  const filteredHistoryItems = useMemo(
    () =>
      historyItems.filter((item) => {
        if (historyFilter === "successful") return item.status === "COMPLETED";
        if (historyFilter === "failed") return item.status === "FAILED";
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
              <p className="mt-3 font-display text-4xl font-bold tracking-tight">
                ₹{(wallet?.available ?? 0).toLocaleString()}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
                <LockKeyhole className="h-3.5 w-3.5" /> Protected by Razorpay payments
              </div>
            </div>
          </div>
        </div>
      </section>
      {!payments ? (
        <CardListSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={CircleDollarSign}
              value={`₹${(wallet?.available ?? 0).toLocaleString()}`}
              label="Wallet balance"
            />
            <Stat icon={CircleDollarSign} value={`₹${total.toLocaleString()}`} label="Total paid" />
            <Stat
              icon={CalendarDays}
              value={`₹${thisMonth.toLocaleString()}`}
              label="Paid this month"
            />
            <Stat icon={ReceiptText} value={String(completed.length)} label="Approved milestones" />
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
                  {[500, 1000, 2500].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setTopUpAmount(String(amount))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${topUpAmount === String(amount) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                    >
                      ₹{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <span className="mr-2 text-sm font-semibold text-muted-foreground">₹</span>
                    <input
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
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
                    disabled={!Number(topUpAmount) || Number(topUpAmount) <= 0}
                  >
                    Add money <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
                {walletMessage ? (
                  <p className="mt-3 text-sm text-muted-foreground">{walletMessage}</p>
                ) : null}
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
              <div className="w-full max-w-md">
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
                <input
                  className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  value={withdrawDestination}
                  onChange={(event) => setWithdrawDestination(event.target.value)}
                  placeholder={
                    withdrawMethod === "BANK"
                      ? "Account number and IFSC"
                      : withdrawMethod === "CARD"
                        ? "Card number"
                        : "UPI ID (name@bank)"
                  }
                />
                <div className="mt-3 flex gap-2">
                  <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-input bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                    <span className="mr-2 text-sm font-semibold text-muted-foreground">₹</span>
                    <input
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      type="number"
                      min="1"
                      max={wallet?.available ?? 0}
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void requestWithdrawal()}
                    disabled={
                      !Number(withdrawAmount) ||
                      Number(withdrawAmount) <= 0 ||
                      Number(withdrawAmount) > (wallet?.available ?? 0) ||
                      !withdrawDestination.trim()
                    }
                  >
                    Withdraw
                  </button>
                </div>
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
                    Payments are released after milestone approval.
                  </p>
                </div>
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex gap-2 border-b border-border p-3">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "successful", label: "Successful" },
                    { key: "failed", label: "Failed" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setHistoryFilter(tab.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyFilter === tab.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {filteredHistoryItems.map((item) =>
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
                    className="flex cursor-pointer items-center justify-between gap-4 border-b border-border p-5 transition hover:bg-muted/40 last:border-0"
                  >
                    <div>
                      <p className="font-semibold">{item.payment.description}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(item.payment.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        ₹{item.payment.amount.toLocaleString()} {item.payment.currency}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.payment.status === "COMPLETED" ? "Paid" : item.payment.status}
                      </p>
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
                    className="flex cursor-pointer items-center justify-between gap-4 border-b border-border bg-muted/20 p-5 transition hover:bg-muted/40 last:border-0"
                  >
                    <div>
                      <p className="font-semibold">Wallet top-up</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(item.transaction.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {item.transaction.providerReference
                          ? ` · ${item.transaction.providerReference}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{item.transaction.amount.toLocaleString()} INR</p>
                      <p
                        className={`mt-1 text-xs font-semibold ${item.transaction.status === "COMPLETED" ? "text-success" : item.transaction.status === "FAILED" ? "text-destructive" : "text-warning"}`}
                      >
                        {item.transaction.status === "COMPLETED"
                          ? "Wallet funded"
                          : item.transaction.status}
                      </p>
                    </div>
                  </div>
                ),
              )}
              {!filteredHistoryItems.length && (
                <p className="p-8 text-sm text-muted-foreground">
                  {historyFilter === "all"
                    ? "No payment activity yet."
                    : `No ${historyFilter} transactions.`}
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
                  <span className="mr-2 font-semibold text-primary">3.</span>The approved amount is
                  recorded and released to the professional.
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
        <p className="mt-2 text-sm font-semibold text-success">{detail.status}</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <DetailRow label="Milestone value" value={money(detail.baseAmount)} />
        <DetailRow label="Client service fee" value={money(detail.clientFeeAmount)} />
        <DetailRow label="Professional receives" value={money(detail.professionalPayoutAmount)} />
        <DetailRow label="Platform amount" value={money(detail.adminNetAmount)} />
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
function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
