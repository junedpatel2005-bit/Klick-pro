"use client";

import { useEffect, useState } from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getBankValidationRule } from "@/lib/indian-banks";
import { capitalizeWords } from "@/lib/utils";

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
  onConfirm: (details?: {
    accountNumber?: string;
    ifscCode?: string;
    accountHolder?: string;
    upiId?: string;
    upiHolder?: string;
  }) => void | Promise<void>;
  onEdit: () => void;
  onUpdateDetails?: (details: {
    accountNumber?: string;
    ifscCode?: string;
    accountHolder?: string;
    upiId?: string;
    upiHolder?: string;
  }) => void;
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
  onUpdateDetails,
  isSubmitting = false,
}: RecheckWithdrawalModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Local editable values
  const [currentAccNo, setCurrentAccNo] = useState(accountNumber);
  const [currentIfsc, setCurrentIfsc] = useState(ifscCode);
  const [currentHolder, setCurrentHolder] = useState(accountHolder);
  const [currentUpiId, setCurrentUpiId] = useState(upiId);
  const [currentUpiHolder, setCurrentUpiHolder] = useState(upiHolder);

  // Inline editing state
  const [editingField, setEditingField] = useState<
    "accountNumber" | "ifsc" | "accountHolder" | "upiId" | "upiHolder" | null
  >(null);
  const [tempValue, setTempValue] = useState("");

  useEffect(() => {
    setCurrentAccNo(accountNumber);
    setCurrentIfsc(ifscCode);
    setCurrentHolder(accountHolder);
    setCurrentUpiId(upiId);
    setCurrentUpiHolder(upiHolder);
    setEditingField(null);
    setTempValue("");
  }, [accountNumber, ifscCode, accountHolder, upiId, upiHolder, open]);

  const isBank = payoutMethod === "BANK";
  const rule = isBank ? getBankValidationRule(bankName, currentIfsc) : null;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedField((curr) => (curr === label ? null : curr));
    }, 2000);
  };

  const startEdit = (
    field: "accountNumber" | "ifsc" | "accountHolder" | "upiId" | "upiHolder",
    initialVal: string,
  ) => {
    setEditingField(field);
    setTempValue(initialVal);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  const saveEdit = (
    field: "accountNumber" | "ifsc" | "accountHolder" | "upiId" | "upiHolder",
  ) => {
    const val = tempValue.trim();
    if (!val) {
      toast.error("Value cannot be empty");
      return;
    }

    if (field === "accountNumber") {
      const cleanVal = val.replace(/\s+/g, "");
      if (!/^\d+$/.test(cleanVal)) {
        toast.error("Account number must contain only numeric digits.");
        return;
      }
      setCurrentAccNo(cleanVal);
      onUpdateDetails?.({ accountNumber: cleanVal });
      toast.success("Account number updated!");
    } else if (field === "ifsc") {
      const cleanVal = val.toUpperCase().replace(/\s+/g, "");
      if (cleanVal.length !== 11) {
        toast.error("IFSC code must be exactly 11 characters.");
        return;
      }
      setCurrentIfsc(cleanVal);
      onUpdateDetails?.({ ifscCode: cleanVal });
      toast.success("IFSC code updated!");
    } else if (field === "accountHolder") {
      const formatted = capitalizeWords(val);
      setCurrentHolder(formatted);
      onUpdateDetails?.({ accountHolder: formatted });
      toast.success("Account holder name updated!");
    } else if (field === "upiId") {
      const cleanVal = val.toLowerCase().replace(/\s+/g, "");
      if (!cleanVal.includes("@")) {
        toast.error("Please enter a valid UPI ID (e.g. name@bank).");
        return;
      }
      setCurrentUpiId(cleanVal);
      onUpdateDetails?.({ upiId: cleanVal });
      toast.success("UPI ID updated!");
    } else if (field === "upiHolder") {
      const formatted = capitalizeWords(val);
      setCurrentUpiHolder(formatted);
      onUpdateDetails?.({ upiHolder: formatted });
      toast.success("Registered UPI name updated!");
    }

    setEditingField(null);
    setTempValue("");
  };

  const handleFinalConfirm = () => {
    void onConfirm({
      accountNumber: currentAccNo,
      ifscCode: currentIfsc,
      accountHolder: currentHolder,
      upiId: currentUpiId,
      upiHolder: currentUpiHolder,
    });
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
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {isBank ? capitalizeWords(rule?.bankName || bankName || "Verified Bank") : "UPI Network 24x7"}
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
                <Pencil className="h-3.5 w-3.5" /> Edit on Form
              </Button>
            </div>

            {isBank ? (
              <div className="space-y-2.5 pt-2 border-t border-border/60 text-xs">
                {/* Bank Name */}
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Bank Name</span>
                  <span className="font-semibold text-foreground capitalize">
                    {capitalizeWords(bankName || rule?.bankName || "Bank Transfer")}
                  </span>
                </div>

                {/* Account Holder Name with Edit */}
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-muted-foreground shrink-0">Account Holder Name</span>
                  {editingField === "accountHolder" ? (
                    <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xs">
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        placeholder="Account holder name"
                        className="h-7 w-full max-w-[170px] capitalize rounded-md border border-primary/40 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit("accountHolder");
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit("accountHolder")}
                        className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition cursor-pointer flex items-center gap-1"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 px-1.5 rounded-md hover:bg-muted text-muted-foreground text-[11px] transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground capitalize">
                        {capitalizeWords(currentHolder) || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit("accountHolder", currentHolder)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Edit account holder name"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Number with Copy AND Inline Edit */}
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-muted-foreground shrink-0">Account Number</span>
                  {editingField === "accountNumber" ? (
                    <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xs">
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        placeholder="Enter account number"
                        className="h-7 w-full max-w-[170px] rounded-md border border-primary/40 bg-background px-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit("accountNumber");
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit("accountNumber")}
                        className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition cursor-pointer flex items-center gap-1"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 px-1.5 rounded-md hover:bg-muted text-muted-foreground text-[11px] transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                        <span>{currentAccNo || "—"}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(currentAccNo, "Account Number")}
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
                      <button
                        type="button"
                        onClick={() => startEdit("accountNumber", currentAccNo)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Edit account number"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* IFSC Code with Copy AND Inline Edit */}
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-muted-foreground shrink-0">IFSC Code</span>
                  {editingField === "ifsc" ? (
                    <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xs">
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                        placeholder="11-char IFSC"
                        maxLength={11}
                        className="h-7 w-full max-w-[130px] uppercase rounded-md border border-primary/40 bg-background px-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit("ifsc");
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit("ifsc")}
                        className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition cursor-pointer flex items-center gap-1"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 px-1.5 rounded-md hover:bg-muted text-muted-foreground text-[11px] transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/60">
                        <span>{currentIfsc ? currentIfsc.toUpperCase() : "—"}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(currentIfsc.toUpperCase(), "IFSC Code")}
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
                      <button
                        type="button"
                        onClick={() => startEdit("ifsc", currentIfsc)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Edit IFSC code"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {rule && (
                  <div className="pt-1 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Validated {rule.bankName} Account ({rule.expectedLengths.join(" or ")} digits)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 pt-2 border-t border-border/60 text-xs">
                {/* UPI Registered Name */}
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-muted-foreground shrink-0">Registered Name</span>
                  {editingField === "upiHolder" ? (
                    <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xs">
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        placeholder="Registered name"
                        className="h-7 w-full max-w-[170px] rounded-md border border-primary/40 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit("upiHolder");
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit("upiHolder")}
                        className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition cursor-pointer flex items-center gap-1"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 px-1.5 rounded-md hover:bg-muted text-muted-foreground text-[11px] transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground capitalize">
                        {capitalizeWords(currentUpiHolder) || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit("upiHolder", currentUpiHolder)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Edit registered name"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* UPI ID with Copy AND Inline Edit */}
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-muted-foreground shrink-0">UPI ID / VPA</span>
                  {editingField === "upiId" ? (
                    <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xs">
                      <input
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value.toLowerCase())}
                        placeholder="yourname@bank"
                        className="h-7 w-full max-w-[170px] rounded-md border border-primary/40 bg-background px-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit("upiId");
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit("upiId")}
                        className="h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition cursor-pointer flex items-center gap-1"
                        title="Save"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="h-7 px-1.5 rounded-md hover:bg-muted text-muted-foreground text-[11px] transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-primary bg-primary/5 px-2.5 py-0.5 rounded border border-primary/20">
                        <span>{currentUpiId ? currentUpiId.toLowerCase() : "—"}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(currentUpiId.toLowerCase(), "UPI ID")}
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
                      <button
                        type="button"
                        onClick={() => startEdit("upiId", currentUpiId)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition cursor-pointer"
                        title="Edit UPI ID"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
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
              Edit on Form
            </Button>
            <Button
              type="button"
              onClick={handleFinalConfirm}
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
