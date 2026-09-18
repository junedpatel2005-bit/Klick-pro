"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Landmark,
  ReceiptText,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
type Transaction = {
  id: number;
  amount: number;
  currency: string;
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
  destinationLabel: string | null;
  createdAt: string;
};
type Wallet = {
  total: number;
  grossTotal?: number;
  commission: number;
  available: number;
  reserved: number;
  withdrawals: Withdrawal[];
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
type StatKey = "available" | "total" | "commission" | "month" | "reserved";
export default function Earnings() {
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("");
  const [razorpayAccountId, setRazorpayAccountId] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetail | null>(null);
  const [paymentDetailsError, setPaymentDetailsError] = useState("");
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
  const load = () => {
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems);
    void fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { completedProjects?: CompletedJob[] } | null) =>
        setCompletedJobs(d?.completedProjects ?? []),
      )
      .catch(() => setCompletedJobs([]));
    void fetch("/api/v1/wallet", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setWallet);
    void fetch("/api/professional/razorpay-account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { razorpayAccountId?: string | null } | null) =>
        setRazorpayAccountId(d?.razorpayAccountId ?? ""),
      );
  };
  useEffect(load, []);
  const thisMonth = useMemo(
    () =>
      items
        ?.filter(
          (i) =>
            new Date(i.createdAt).getMonth() === new Date().getMonth() &&
            new Date(i.createdAt).getFullYear() === new Date().getFullYear(),
        )
        .reduce((sum, i) => sum + i.amount, 0) ?? 0,
    [items],
  );
  async function withdraw() {
    const r = await fetch("/api/v1/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), destinationLabel: destination }),
    });
    const d = await r.json();
    setMessage(
      r.ok
        ? "Withdrawal request submitted for review."
        : (d.error ?? "Unable to request withdrawal."),
    );
    if (r.ok) {
      setAmount("");
      setDestination("");
      load();
    }
  }
  async function saveRazorpayAccount() {
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
        <p className="text-xs font-bold uppercase tracking-[.2em] text-white/65">
          Professional earnings
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold">Manage your work income.</h1>
        <p className="mt-2 text-sm text-white/75">
          Track approved milestone payments, requests, and available withdrawal balance.
        </p>
      </section>
      {!wallet || !items || !completedJobs ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
              icon={ReceiptText}
              label="Commission deducted"
              onClick={() => setSelectedStat("commission")}
              value={`₹${wallet.commission.toLocaleString()}`}
              tone="amber"
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
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold">Completed jobs</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Finished projects and the earnings recorded against each one.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div className="divide-y divide-border">
              {completedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <BriefcaseBusiness className="h-4 w-4 shrink-0 text-success" />
                    <div className="min-w-0">
                      <Link
                        href={`/project/${job.id}/tracking`}
                        className="truncate font-semibold hover:text-primary"
                      >
                        {job.jobTitle}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.clientName} · Completed{" "}
                        {new Date(job.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-bold text-success">
                    +₹{job.amount.toLocaleString("en-IN")}{" "}
                    <span className="text-xs">{job.currency}</span>
                  </p>
                </div>
              ))}
              {!completedJobs.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  Completed jobs will appear here after a project is marked complete.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Commission deduction breakdown</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Commission is deducted from each completed Razorpay payment before earnings become
              available.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Breakdown
                label="Gross completed payments"
                value={wallet.grossTotal ?? wallet.total + wallet.commission}
              />
              <Breakdown label="Platform commission" value={wallet.commission} tone="amber" />
              <Breakdown label="Net professional earnings" value={wallet.total} tone="success" />
            </div>
          </section>
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
              {items.map((i) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={i.id}
                  className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border p-5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                  onClick={() => void openTransaction(i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openTransaction(i);
                    }
                  }}
                >
                  <div>
                    <p className="font-semibold">{i.description}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(i.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {i.status}
                    </p>
                  </div>
                  <p className="font-bold text-success">
                    +₹{i.amount.toLocaleString()} <span className="text-xs">{i.currency}</span>
                  </p>
                </div>
              ))}
              {!items.length && (
                <p className="p-8 text-sm text-muted-foreground">
                  No approved payments yet. Payments appear here after a client approves a
                  milestone.
                </p>
              )}
            </section>
            <aside className="space-y-6">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-xl font-semibold">Razorpay payout account</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your Razorpay Route Linked Account ID to receive marketplace earnings.
                </p>
                <input
                  className="mt-4 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  placeholder="acc_..."
                  value={razorpayAccountId}
                  onChange={(e) => setRazorpayAccountId(e.target.value)}
                />
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  onClick={() => void saveRazorpayAccount()}
                >
                  Save payout account
                </Button>
              </section>
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-xl font-semibold">Request withdrawal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Available: ₹{wallet.available.toLocaleString("en-IN")}
                </p>
                <label className="mt-5 block text-sm font-medium">
                  Amount
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    type="number"
                    min="1"
                    max={wallet.available}
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  Payout destination
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    placeholder="Bank account or UPI ID"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </label>
                {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
                <Button
                  className="mt-5 w-full"
                  disabled={!amount || !destination || Number(amount) > wallet.available}
                  onClick={() => void withdraw()}
                >
                  Request withdrawal <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </section>
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-semibold">Withdrawal history</h2>
                <div className="mt-3 divide-y divide-border">
                  {wallet.withdrawals.map((w) => (
                    <div key={w.id} className="py-3">
                      <div className="flex justify-between gap-3">
                        <p className="font-medium">₹{w.amount.toLocaleString("en-IN")}</p>
                        <span
                          className={`text-xs font-semibold ${w.status === "COMPLETED" ? "text-success" : "text-amber-600"}`}
                        >
                          {w.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {w.destinationLabel ?? "Payout destination"} ·{" "}
                        {new Date(w.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
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
    </div>
  );
}

function TransactionSummary({ transaction }: { transaction: Transaction }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground">Amount credited</p>
        <p className="mt-1 font-display text-3xl font-bold">
          +INR {transaction.amount.toLocaleString("en-IN")} {transaction.currency}
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
        <DetailRow label="Milestone value" value={money(detail.baseAmount)} />
        <DetailRow label="Platform commission" value={money(detail.commissionAmount)} />
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
      description: "Completed professional earnings after commission deductions.",
      rows: [
        [
          "Gross earnings",
          `₹${(wallet.grossTotal ?? wallet.total + wallet.commission).toLocaleString("en-IN")}`,
        ],
        ["Commission deducted", `₹${wallet.commission.toLocaleString("en-IN")}`],
      ],
    },
    commission: {
      title: "Commission deducted",
      value: `₹${wallet.commission.toLocaleString("en-IN")}`,
      description: "The platform commission deducted from completed payments.",
      rows: [["Net professional earnings", `₹${wallet.total.toLocaleString("en-IN")}`]],
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
