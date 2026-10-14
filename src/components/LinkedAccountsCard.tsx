"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  POPULAR_INDIAN_BANKS,
  lookupIfscCode,
  normalizeIfsc,
  getBankNameFromIfsc,
  validateBankSpecificAccountNumber,
  getExpectedAccountLengthHint,
} from "@/lib/indian-banks";
import { BankCombobox } from "@/components/BankCombobox";
import { IfscFinderDialog } from "@/components/IfscFinderDialog";

export type LinkedAccount = {
  id: number;
  userId: number;
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
  createdAt: string;
};

export function LinkedAccountsCard({
  title = "Linked Accounts",
  description = "Save your Bank, UPI, or Razorpay account once for 1-click earnings & payout requests.",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [accountType, setAccountType] = useState<"BANK" | "UPI" | "RAZORPAY">("BANK");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [cardBank, setCardBank] = useState("");
  const [razorpayAccountId, setRazorpayAccountId] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // NPCI VPA Verification State
  const [vpaVerifying, setVpaVerifying] = useState(false);
  const [vpaVerified, setVpaVerified] = useState<boolean | null>(null);
  const [vpaCustomerName, setVpaCustomerName] = useState<string | null>(null);
  const [vpaError, setVpaError] = useState<string | null>(null);

  // Bank Verification & IFSC State
  const [ifscBranch, setIfscBranch] = useState<string | null>(null);
  const [ifscVerifying, setIfscVerifying] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [bankAccountVerifying, setBankAccountVerifying] = useState(false);
  const [bankAccountVerified, setBankAccountVerified] = useState<boolean | null>(null);
  const [bankAccountError, setBankAccountError] = useState<string | null>(null);
  const [officialBankName, setOfficialBankName] = useState<string | null>(null);
  const [customBankInput, setCustomBankInput] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState("");
  const [ifscFinderOpen, setIfscFinderOpen] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/v1/linked-accounts");
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setAccounts(data.accounts || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAccounts();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setAccountHolder("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setIfscCode("");
    setBankName("");
    setUpiId("");
    setCardBank("");
    setRazorpayAccountId("");
    setIsDefault(false);
    setVpaVerified(null);
    setVpaCustomerName(null);
    setVpaError(null);
    setIfscBranch(null);
    setIfscError(null);
    setBankAccountVerified(null);
    setBankAccountError(null);
    setOfficialBankName(null);
    setCustomBankInput(false);
    setBankSearchTerm("");
  };

  const handleEdit = (acc: LinkedAccount) => {
    setEditingId(acc.id);
    const targetType = acc.accountType === "CARD" ? "BANK" : acc.accountType;
    setAccountType(targetType);
    setAccountHolder(acc.accountHolder || "");
    setAccountNumber(acc.accountNumber || "");
    setConfirmAccountNumber(acc.accountNumber || "");
    setIfscCode(acc.ifscCode || "");
    setBankName(acc.bankName || "");
    setUpiId(acc.upiId || "");
    setCardBank(acc.cardBank || "");
    setRazorpayAccountId(acc.razorpayAccountId || "");
    setIsDefault(acc.isDefault);
    setVpaVerified(acc.accountType === "UPI" ? true : null);
    setVpaCustomerName(acc.accountHolder || null);
    setVpaError(null);
    setIfscBranch(null);
    setIfscError(null);
    setBankAccountVerified(acc.accountType === "BANK" ? true : null);
    setCustomBankInput(
      acc.bankName
        ? !POPULAR_INDIAN_BANKS.some((b) => b.name.toLowerCase() === acc.bankName?.toLowerCase())
        : false,
    );
    setBankSearchTerm("");
    if (acc.ifscCode && acc.ifscCode.length === 11) {
      void handleLookupIfsc(acc.ifscCode);
    }
    setDialogOpen(true);
  };

  const handleLookupIfsc = async (code: string) => {
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
          setBankName(res.bank);
          toast.success(`IFSC Verified: ${res.bank} (${res.branch})`);
        } else {
          setIfscError(res.error || "Invalid IFSC code.");
          toast.error(res.error || "Invalid IFSC code.");
        }
      } catch {
        setIfscError("Unable to verify IFSC code.");
      } finally {
        setIfscVerifying(false);
      }
    }
  };

  const handleNameChange = (newName: string) => {
    setAccountHolder(newName);
  };

  const handleVerifyVpa = async () => {
    const toCheck = upiId.trim().toLowerCase();
    if (!toCheck || !toCheck.includes("@")) {
      toast.error("Please enter a valid UPI ID (e.g. rahul@upi)");
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
        toast.success("UPI ID format verified successfully!");
      } else {
        setVpaVerified(false);
        setVpaCustomerName(null);
        setVpaError(data?.error || "UPI ID could not be verified on NPCI.");
        toast.error(data?.error || "UPI ID could not be verified on NPCI.");
      }
    } catch {
      setVpaVerified(false);
      setVpaError("Failed to reach NPCI verification service.");
      toast.error("Failed to reach NPCI verification service.");
    } finally {
      setVpaVerifying(false);
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (accountType === "BANK") {
      const accValidation = validateBankSpecificAccountNumber(accountNumber, bankName, ifscCode);
      if (!accValidation.valid) {
        toast.error(accValidation.message || "Please enter a valid bank account number.");
        return;
      }
      if (accountNumber !== confirmAccountNumber) {
        toast.error("Account numbers do not match.");
        return;
      }
      if (!ifscCode || ifscCode.length !== 11) {
        toast.error("IFSC Code must be exactly 11 characters.");
        return;
      }
      if (!accountHolder.trim() || accountHolder.trim().length < 2) {
        toast.error("Please enter the account holder name as per bank records.");
        return;
      }
    } else if (accountType === "UPI") {
      if (!upiId || !upiId.includes("@")) {
        toast.error("Please enter a valid UPI ID (e.g. yourname@oksbi).");
        return;
      }
      if (!accountHolder.trim() || accountHolder.trim().length < 2) {
        toast.error("Please enter the name registered with your UPI account.");
        return;
      }
    } else if (accountType === "RAZORPAY") {
      if (!razorpayAccountId || razorpayAccountId.length < 5) {
        toast.error("Please enter a valid Razorpay Account ID.");
        return;
      }
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/v1/linked-accounts/${editingId}`
        : "/api/v1/linked-accounts";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountType,
          accountHolder: accountHolder.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          ifscCode: ifscCode.trim().toUpperCase() || undefined,
          bankName: bankName.trim() || undefined,
          upiId: upiId.trim().toLowerCase() || undefined,
          razorpayAccountId: razorpayAccountId.trim() || undefined,
          isDefault,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${editingId ? "update" : "link"} account.`);
      }

      toast.success(editingId ? "Account updated successfully!" : "Account linked successfully!");
      setDialogOpen(false);
      resetForm();
      await fetchAccounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("servio:linked-accounts-updated"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this linked account?")) return;

    setActionBusyId(id);
    try {
      const res = await fetch(`/api/v1/linked-accounts/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to delete account.");
      toast.success("Linked account removed.");
      await fetchAccounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("servio:linked-accounts-updated"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error removing account.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    setActionBusyId(id);
    try {
      const res = await fetch(`/api/v1/linked-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to set default.");
      toast.success("Default payout account updated.");
      await fetchAccounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("servio:linked-accounts-updated"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default.");
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <Card className={`border border-border/80 shadow-xs ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenDialog}
          className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Link Account
        </Button>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="space-y-2 py-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-center">
            <p className="text-xs text-muted-foreground">
              No linked accounts saved yet. Add your Bank Account, UPI ID, Razorpay, or Debit Card
              to withdraw earnings in 1 click.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDialog}
              className="mt-3 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Link Your First Account
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {accounts.map((acc) => {
              const isBank = acc.accountType === "BANK";
              const isUpi = acc.accountType === "UPI";
              const isCard = acc.accountType === "CARD";

              let IconComponent = Building2;
              let iconColor = "bg-blue-50 text-blue-600 border-blue-200";
              let titleText = "";
              let subText = "";

              if (isBank) {
                IconComponent = Building2;
                iconColor =
                  "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400";
                const resolvedBank = acc.bankName || getBankNameFromIfsc(acc.ifscCode) || "Bank Account";
                titleText = `${resolvedBank} · •••• ${acc.last4 || "••••"}`;
                subText = [
                  acc.accountHolder ? `Holder: ${acc.accountHolder}` : null,
                  acc.ifscCode ? `IFSC: ${acc.ifscCode}` : null,
                ]
                  .filter(Boolean)
                  .join(" | ");
              } else if (isUpi) {
                IconComponent = Smartphone;
                iconColor =
                  "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400";
                titleText = `UPI · ${acc.upiId}`;
                subText = acc.accountHolder
                  ? `Name: ${acc.accountHolder}`
                  : "Virtual Payment Address";
              } else if (isCard) {
                IconComponent = CreditCard;
                iconColor =
                  "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400";
                titleText = `${acc.cardBank || "Debit Card"} · •••• ${acc.last4 || "••••"}`;
                subText = acc.accountHolder ? `Holder: ${acc.accountHolder}` : "Debit Card";
              } else {
                IconComponent = Landmark;
                iconColor =
                  "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400";
                titleText = `Razorpay Route · ${acc.razorpayAccountId}`;
                subText = "Linked Gateway Account";
              }

              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconColor}`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                          {titleText}
                        </p>
                        {acc.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Default
                          </span>
                        )}
                      </div>
                      {subText && (
                        <p className="text-[11px] text-muted-foreground truncate">{subText}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!acc.isDefault && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(acc.id)}
                        disabled={actionBusyId === acc.id}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Make default payout method"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(acc)}
                      disabled={actionBusyId === acc.id}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      title="Edit account details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(acc.id)}
                      disabled={actionBusyId === acc.id}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Remove linked account"
                    >
                      {actionBusyId === acc.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add / Edit Linked Account Modal */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? (
                <Pencil className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5 text-primary" />
              )}
              {editingId
                ? `Edit ${accountType === "BANK" ? "Bank Account" : accountType === "UPI" ? "UPI ID" : "Razorpay Account"}`
                : "Link Payout & Settlement Account"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingId
                ? "Modify your account details below. Payouts will immediately use the updated details."
                : "Save your account details once. You can use it across the platform with 1-click on the Earnings page."}
            </DialogDescription>
          </DialogHeader>

          {/* Account Type Selector */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setAccountType("BANK")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition ${
                accountType === "BANK"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Building2 className="h-4 w-4 mb-1" />
              Bank A/C
            </button>
            <button
              type="button"
              onClick={() => setAccountType("UPI")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition ${
                accountType === "UPI"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Smartphone className="h-4 w-4 mb-1" />
              UPI ID
            </button>
            <button
              type="button"
              onClick={() => setAccountType("RAZORPAY")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition ${
                accountType === "RAZORPAY"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Landmark className="h-4 w-4 mb-1" />
              Razorpay
            </button>
          </div>

          <form onSubmit={handleSaveAccount} className="space-y-3.5 pt-2">
            {/* BANK FORM */}
            {accountType === "BANK" && (
              <>
                {/* 2-in-1 Bank Name Combobox */}
                <div className="space-y-1">
                  <Label htmlFor="bankName" className="text-xs font-semibold">
                    Bank Name
                  </Label>
                  <BankCombobox
                    id="bankName"
                    value={bankName}
                    onChange={(val) => setBankName(val)}
                    onSelectBank={(bank) => {
                      if (!ifscCode) {
                        setIfscCode(`${bank.code}0`);
                      }
                    }}
                    placeholder="Search or type bank name (e.g. HDFC, SBI, ICICI)…"
                    required
                  />
                </div>

                {/* IFSC Code with Live Verification & Find IFSC Tool */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ifscCode" className="text-xs font-semibold">
                      IFSC Code
                    </Label>
                    <div className="flex items-center gap-2">
                      {ifscVerifying && (
                        <span className="flex items-center gap-1 text-[11px] text-primary">
                          <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIfscFinderOpen(true)}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title="Find IFSC Code by Bank & Location"
                      >
                        <Search className="h-3 w-3" />
                        Find IFSC Code
                      </button>
                    </div>
                  </div>
                  <Input
                    id="ifscCode"
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => void handleLookupIfsc(normalizeIfsc(e.target.value))}
                    placeholder="e.g. HDFC0001234 or BARB0IKHARX"
                    className="font-mono uppercase text-xs"
                    required
                  />
                  {ifscBranch && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate">
                        Branch: <strong>{ifscBranch}</strong>
                      </span>
                    </div>
                  )}
                  {ifscError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      {ifscError}
                    </p>
                  )}
                </div>

                <IfscFinderDialog
                  open={ifscFinderOpen}
                  onOpenChange={setIfscFinderOpen}
                  defaultBank={bankName}
                  onSelectIfsc={(code, bName, bBranch) => {
                    setIfscCode(code);
                    if (bName) setBankName(bName);
                    if (bBranch) setIfscBranch(bBranch);
                    void handleLookupIfsc(code);
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="accountNumber" className="text-xs font-semibold">
                      Account Number
                    </Label>
                    <Input
                      id="accountNumber"
                      type="password"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
                      placeholder="e.g. 102938475612"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {getExpectedAccountLengthHint(bankName, ifscCode)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirmAccountNumber" className="text-xs font-semibold">
                      Confirm Account Number
                    </Label>
                    <Input
                      id="confirmAccountNumber"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s+/g, ""))}
                      placeholder="Re-enter number"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="accountHolder" className="text-xs font-semibold">
                    Account Holder Name
                  </Label>
                  <Input
                    id="accountHolder"
                    value={accountHolder}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Enter full name as per bank records"
                    className="text-xs"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Please ensure this matches the beneficiary name on your bank passbook or statement.
                  </p>
                </div>

                <div className="rounded-xl bg-cyan-500/10 p-2.5 border border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-300">
                  ⚡ <strong>Secure Payout Account:</strong> Verified bank details are saved securely for withdrawal requests. Admin reviews and approves payouts upon request.
                </div>
              </>
            )}

            {/* UPI FORM */}
            {accountType === "UPI" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="upiId" className="text-xs font-semibold">
                    UPI ID / VPA
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="upiId"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value.toLowerCase());
                        setVpaVerified(null);
                        setVpaCustomerName(null);
                        setVpaError(null);
                      }}
                      onBlur={() => {
                        if (upiId.includes("@") && upiId.length >= 4 && vpaVerified === null) {
                          void handleVerifyVpa();
                        }
                      }}
                      placeholder="e.g. rahul@upi, yourname@oksbi"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!upiId.includes("@") || vpaVerifying}
                      onClick={() => void handleVerifyVpa()}
                      className="h-9 text-xs px-3 font-semibold shrink-0"
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
                </div>

                {vpaVerified === true && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
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
                  <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 p-2 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">{vpaError}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="upiHolder" className="text-xs font-semibold">
                    Registered Name
                  </Label>
                  <Input
                    id="upiHolder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Name linked with UPI"
                    required
                  />
                  {vpaCustomerName && (
                    <p className="text-[10px] text-muted-foreground">
                      Auto-detected from bank record via NPCI.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                  ⚡ <strong>Automated UPI Payout:</strong> RazorpayX verifies VPA validity via NPCI and initiates a UPI payout directly to the bank account linked to that UPI ID. Money arrives in seconds.
                </div>
              </>
            )}



            {/* RAZORPAY FORM */}
            {accountType === "RAZORPAY" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="razorpayAccountId" className="text-xs font-semibold">
                    Razorpay Linked Account ID
                  </Label>
                  <Input
                    id="razorpayAccountId"
                    value={razorpayAccountId}
                    onChange={(e) => setRazorpayAccountId(e.target.value)}
                    placeholder="e.g. acc_xxxxxxxxxxxxxx"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your automated Razorpay Route partner account identifier for instant settlement.
                </p>
              </>
            )}

            {/* Default check */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">
                Set as my default payout account
              </span>
            </label>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5 font-semibold">
                {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {saving
                  ? editingId
                    ? "Updating…"
                    : "Saving…"
                  : editingId
                  ? "Update Account"
                  : "Save & Link Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
