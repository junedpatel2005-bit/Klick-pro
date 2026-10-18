"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatReadableLabel, capitalizeWords } from "@/lib/utils";
import { maskAccountNumber, maskDestinationString } from "@/lib/account-formatting";

export type WithdrawalRecord = {
  id: number;
  amount: number;
  status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  destinationType?: string;
  destinationLabel: string | null;
  createdAt: string;
  updatedAt?: string;
  processedAt?: string | null;
  payoutMode?: string | null;
  utr?: string | null;
  failureReason?: string | null;
};

export type WithdrawalDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawal: WithdrawalRecord | null;
};

export function WithdrawalDetailModal({
  open,
  onOpenChange,
  withdrawal,
}: WithdrawalDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!withdrawal) return null;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedField((curr) => (curr === label ? null : curr));
    }, 2000);
  };

  // Parse destination details
  let parsedDest: {
    type?: string;
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    last4?: string;
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
    // plain string fallback
  }

  const methodType = (parsedDest?.type || withdrawal.destinationType || "BANK").toUpperCase();
  const isBank = methodType === "BANK";
  const isUpi = methodType === "UPI";

  const isPending = withdrawal.status === "PENDING";
  const isProcessing = withdrawal.status === "PROCESSING";
  const isCompleted = withdrawal.status === "COMPLETED";
  const isFailed = withdrawal.status === "FAILED";

  const formattedDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-foreground bg-muted/80 px-2.5 py-1 rounded-lg border border-border">
              Withdrawal #{withdrawal.id}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${
                isCompleted
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : isFailed
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    : isProcessing
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              {isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isPending && <Clock className="h-3.5 w-3.5" />}
              {isProcessing && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              )}
              {isFailed && <X className="h-3.5 w-3.5" />}
              {isProcessing
                ? "Admin Approved · In Progress"
                : isPending
                  ? "Pending Admin Review"
                  : isCompleted
                    ? "Completed · Money in Bank"
                    : "Rejected by Admin"}
            </span>
          </div>

          <DialogTitle className="text-2xl font-black font-display tracking-tight pt-2">
            ₹{withdrawal.amount.toLocaleString("en-IN")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Requested on {formattedDate(withdrawal.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Status Alert Banner when Admin has approved and user is waiting for money in bank */}
          {isProcessing && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 p-4 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
                </span>
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Admin approved your request! Payout is in progress.
                </p>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 pl-5 leading-relaxed">
                Your payout has been authorized and dispatched to banking rails. Please <strong>wait for money in your bank</strong> account.
              </p>
            </div>
          )}

          {isCompleted && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-3.5 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong>Money is in your bank account!</strong> Payout was approved by admin and completed successfully.
              </span>
            </div>
          )}

          {isFailed && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3.5 space-y-1 text-xs text-rose-800 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Withdrawal Request Rejected</span>
              </div>
              <p className="pl-5.5 text-rose-700 dark:text-rose-300">
                Reason: {withdrawal.failureReason || "Rejected by admin."} All reserved funds have been restored to your available wallet balance.
              </p>
            </div>
          )}

          {/* 3-Step Timeline */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Payout Timeline</span>
              <span className="text-[11px] font-normal normal-case text-muted-foreground">
                3-Step Verification
              </span>
            </h3>

            <div className="space-y-4 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80">
              {/* Step 1: Withdrawal Requested */}
              <div className="relative flex items-start gap-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xs z-10">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">1. Withdrawal Requested by You</p>
                    <span className="text-[10px] text-muted-foreground">
                      {formattedDate(withdrawal.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Request of ₹{withdrawal.amount.toLocaleString("en-IN")} submitted and funds reserved from your wallet balance.
                  </p>
                </div>
              </div>

              {/* Step 2: Approved by Admin */}
              <div className="relative flex items-start gap-3.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-2xs z-10 ${
                    isFailed
                      ? "bg-rose-500"
                      : isCompleted || isProcessing
                        ? "bg-emerald-500"
                        : "bg-amber-500 animate-pulse"
                  }`}
                >
                  {isFailed ? (
                    <X className="h-4 w-4" />
                  ) : isCompleted || isProcessing ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">
                      {isFailed
                        ? "2. Request Rejected by Admin"
                        : isCompleted || isProcessing
                          ? "2. Approved by Admin"
                          : "2. Under Admin Verification"}
                    </p>
                    {(isCompleted || isProcessing) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                        <Check className="h-3 w-3" /> Approved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {isFailed
                      ? "Request was rejected by finance administrator. Reserved funds restored to wallet."
                      : isCompleted || isProcessing
                        ? "Admin verified and approved your payout destination."
                        : "Finance admin is verifying your account details and compliance."}
                  </p>
                  {(withdrawal.processedAt || (isCompleted && withdrawal.updatedAt)) && (
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                      Processed: {formattedDate(withdrawal.processedAt || withdrawal.updatedAt!)}
                    </p>
                  )}
                </div>
              </div>

              {/* Step 3: Money in Your Bank */}
              <div className="relative flex items-start gap-3.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-2xs z-10 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : isProcessing
                        ? "bg-indigo-600 animate-pulse"
                        : "bg-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Landmark className="h-4 w-4" />
                  ) : isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">
                      {isCompleted
                        ? "3. Money in Your Bank"
                        : isProcessing
                          ? "3. Wait for Money in Your Bank"
                          : "3. Money in Your Bank"}
                    </p>
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-200 dark:border-indigo-800">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {isCompleted
                      ? "Funds successfully credited to your bank account / UPI ID. Transfer complete!"
                      : isProcessing
                        ? "Admin approved! Payment dispatched via banking network. Wait for money in your bank."
                        : isFailed
                          ? "Transfer cancelled. Available in your wallet."
                          : "Funds will be dispatched to your account immediately once admin approves."}
                  </p>

                  {/* UTR badge if present */}
                  {withdrawal.utr && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <span>UTR: {withdrawal.utr}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(withdrawal.utr!, "UTR")}
                          className="text-emerald-600 hover:text-emerald-800 p-0.5 transition cursor-pointer"
                          title="Copy UTR Reference"
                        >
                          {copiedField === "UTR" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payout Destination Details */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payout Destination Details
            </h3>

            {isBank ? (
              <div className="space-y-2 text-xs divide-y divide-border/60">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Bank Name</span>
                  <span className="font-semibold text-foreground">
                    {capitalizeWords(parsedDest?.bankName) || "Bank Transfer"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">Account Holder</span>
                  <span className="font-semibold text-foreground">
                    {capitalizeWords(parsedDest?.accountHolder) || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">Account Number</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                    <span>
                      {parsedDest?.last4
                        ? `•••• •••• •••• ${parsedDest.last4}`
                        : maskAccountNumber(parsedDest?.accountNumber)}
                    </span>
                    {(parsedDest?.last4 || parsedDest?.accountNumber) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            parsedDest?.last4
                              ? `•••• •••• •••• ${parsedDest.last4}`
                              : maskAccountNumber(parsedDest?.accountNumber),
                            "Account Number",
                          )
                        }
                        className="text-muted-foreground hover:text-foreground p-0.5 transition cursor-pointer"
                        title="Copy account number"
                      >
                        {copiedField === "Account Number" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">IFSC Code</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                    <span>{parsedDest?.ifsc || "—"}</span>
                    {parsedDest?.ifsc && (
                      <button
                        type="button"
                        onClick={() => handleCopy(parsedDest!.ifsc!, "IFSC Code")}
                        className="text-muted-foreground hover:text-foreground p-0.5 transition cursor-pointer"
                        title="Copy IFSC code"
                      >
                        {copiedField === "IFSC Code" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {withdrawal.payoutMode && (
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-muted-foreground">Payout Rail</span>
                    <span className="font-bold text-primary font-mono text-[11px]">
                      {withdrawal.payoutMode}
                    </span>
                  </div>
                )}
              </div>
            ) : isUpi ? (
              <div className="space-y-2 text-xs divide-y divide-border/60">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Registered Name</span>
                  <span className="font-semibold text-foreground">
                    {capitalizeWords(parsedDest?.upiHolder) || "—"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">UPI ID / VPA</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-primary bg-primary/5 px-2.5 py-0.5 rounded border border-primary/20">
                    <span>{parsedDest?.upiId || withdrawal.destinationLabel || "—"}</span>
                    {(parsedDest?.upiId || withdrawal.destinationLabel) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            parsedDest?.upiId || withdrawal.destinationLabel || "",
                            "UPI ID",
                          )
                        }
                        className="text-primary/70 hover:text-primary p-0.5 transition cursor-pointer"
                        title="Copy UPI ID"
                      >
                        {copiedField === "UPI ID" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center py-1.5">
                  <span className="text-muted-foreground">Network Rail</span>
                  <span className="font-semibold text-foreground">NPCI UPI 24x7</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Destination: {maskDestinationString(withdrawal.destinationLabel) || "Standard Payout"}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full text-xs font-semibold"
            >
              Close Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
