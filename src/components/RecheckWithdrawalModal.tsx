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
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  Pencil,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { getBankValidationRule } from "@/lib/indian-banks";

export type RecheckWithdrawalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  payoutMethod: "BANK" | "UPI";
  // Bank fields
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifscCode?: string;
  // UPI fields
  upiId?: string;
  upiHolder?: string;
  // Actions
  onConfirm: () => void | Promise<void>;
  onEdit: () => void;
  isSubmitting?: boolean;
};

export function RecheckWithdrawalModal({
  open,
  onOpenChange,
  amount,
  payoutMethod,
  bankName = "",
  accountHolder = "",
  accountNumber = "",
  ifscCode = "",
  upiId = "",
  upiHolder = "",
  onConfirm,
  onEdit,
  isSubmitting = false,
}: RecheckWithdrawalModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isBank = payoutMethod === "BANK";
  const rule = isBank ? getBankValidationRule(bankName, ifscCode) : null;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedField((curr) => (curr === label ? null : curr));
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-1">
            <ShieldCheck className="h-4 w-4" /> Final Verification
          </div>
          <DialogTitle className="text-xl font-bold font-display">
            Recheck your details
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Please verify your payout destination and withdrawal amount carefully before final submission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Amount Summary Card */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Withdrawal Amount</span>
              <span className="font-semibold text-foreground">₹{amount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Platform Transfer Fee</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹0 (Free)</span>
            </div>
            <div className="pt-2 border-t border-primary/10 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Net Payout to You
              </span>
              <span className="font-display text-2xl font-black text-primary">
                ₹{amount.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Destination Details Card */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isBank ? <Building2 className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {isBank ? "Bank Account Transfer" : "UPI Instant Transfer"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isBank ? (rule?.bankName || bankName || "Verified Bank") : "UPI Network 24x7"}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onEdit}
                disabled={isSubmitting}
                className="h-8 gap-1 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>

            {isBank ? (
              <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Bank Name</span>
                  <span className="font-semibold text-foreground">{bankName || rule?.bankName || "Bank Transfer"}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Account Holder Name</span>
                  <span className="font-semibold text-foreground">{accountHolder || "—"}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Account Number</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                    <span>{accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(accountNumber, "Account Number")}
                      className="text-muted-foreground hover:text-foreground p-0.5 transition cursor-pointer"
                      title="Copy account number"
                    >
                      {copiedField === "Account Number" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">IFSC Code</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                    <span>{ifscCode.toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ifscCode.toUpperCase(), "IFSC Code")}
                      className="text-muted-foreground hover:text-foreground p-0.5 transition cursor-pointer"
                      title="Copy IFSC code"
                    >
                      {copiedField === "IFSC Code" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {rule && (
                  <div className="pt-1 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Validated {rule.bankName} Account ({rule.expectedLengths.join(" or ")} digits)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Registered Name</span>
                  <span className="font-semibold text-foreground">{upiHolder || "—"}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">UPI ID / VPA</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-primary bg-primary/5 px-2.5 py-0.5 rounded border border-primary/20">
                    <span>{upiId.toLowerCase()}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiId.toLowerCase(), "UPI ID")}
                      className="text-primary/70 hover:text-primary p-0.5 transition cursor-pointer"
                      title="Copy UPI ID"
                    >
                      {copiedField === "UPI ID" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-1 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>NPCI Validated UPI ID</span>
                </div>
              </div>
            )}
          </div>

          {/* Admin Verification Notice */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-semibold">Admin Verification Workflow</p>
              <p>
                Your withdrawal request will be submitted to the Admin Finance desk for verification. Please make sure your account number and IFSC / UPI ID are accurate to avoid delays.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              disabled={isSubmitting}
              className="sm:w-1/3 text-xs font-semibold"
            >
              Edit Details
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isSubmitting}
              className="sm:flex-1 text-xs font-bold gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting Request…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Confirm & Submit Withdrawal
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
