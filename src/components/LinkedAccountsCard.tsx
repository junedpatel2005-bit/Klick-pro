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
  Building2,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
  RefreshCw,
  Smartphone,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";

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
  isDefault: boolean;
  createdAt: string;
};

export function LinkedAccountsCard({
  title = "Linked Accounts",
  description = "Save your Bank, UPI, Razorpay, or Debit Card once for 1-click earnings & payout requests.",
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

  // Form State
  const [accountType, setAccountType] = useState<"BANK" | "UPI" | "CARD" | "RAZORPAY">("BANK");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [cardBank, setCardBank] = useState("");
  const [razorpayAccountId, setRazorpayAccountId] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/v1/linked-accounts");
      if (res.ok) {
        const data = await res.json();
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
    setAccountHolder("");
    setAccountNumber("");
    setConfirmAccountNumber("");
    setIfscCode("");
    setBankName("");
    setUpiId("");
    setCardBank("");
    setRazorpayAccountId("");
    setIsDefault(false);
  };

  const handleOpenDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (accountType === "BANK") {
      if (!accountNumber || accountNumber.length < 6) {
        toast.error("Please enter a valid bank account number.");
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
    } else if (accountType === "UPI") {
      if (!upiId || !upiId.includes("@")) {
        toast.error("Please enter a valid UPI ID (e.g. yourname@oksbi).");
        return;
      }
    } else if (accountType === "CARD") {
      const cleanCard = accountNumber.replace(/\s/g, "");
      if (cleanCard.length < 15) {
        toast.error("Debit card number must be 16 digits.");
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
      const res = await fetch("/api/v1/linked-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountType,
          accountHolder: accountHolder.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          ifscCode: ifscCode.trim().toUpperCase() || undefined,
          bankName: bankName.trim() || undefined,
          upiId: upiId.trim().toLowerCase() || undefined,
          cardBank: cardBank.trim() || undefined,
          razorpayAccountId: razorpayAccountId.trim() || undefined,
          isDefault,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link account.");
      }

      toast.success("Account linked successfully!");
      setDialogOpen(false);
      resetForm();
      await fetchAccounts();
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
      const res = await fetch(`/api/v1/linked-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account.");
      toast.success("Linked account removed.");
      await fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error removing account.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    setActionBusyId(id);
    try {
      const res = await fetch(`/api/v1/linked-accounts/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to set default.");
      toast.success("Default payout account updated.");
      await fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating default.");
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
                titleText = `${acc.bankName || "Bank Account"} · •••• ${acc.last4 || "••••"}`;
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
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
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
                      onClick={() => handleDelete(acc.id)}
                      disabled={actionBusyId === acc.id}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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

      {/* Add / Link Account Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Link Payout &amp; Settlement Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save your account details once. You can use it across the platform with 1-click on the
              Earnings page.
            </DialogDescription>
          </DialogHeader>

          {/* Account Type Selector */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
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
              onClick={() => setAccountType("CARD")}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition ${
                accountType === "CARD"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <CreditCard className="h-4 w-4 mb-1" />
              Debit Card
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
                <div className="space-y-1">
                  <Label htmlFor="bankName" className="text-xs font-semibold">
                    Bank Name
                  </Label>
                  <Input
                    id="bankName"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI, ICICI Bank"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="accountHolder" className="text-xs font-semibold">
                    Account Holder Name
                  </Label>
                  <Input
                    id="accountHolder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Name as registered with your bank"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="accountNumber" className="text-xs font-semibold">
                      Account Number
                    </Label>
                    <Input
                      id="accountNumber"
                      type="password"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 102938475612"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="confirmAccountNumber" className="text-xs font-semibold">
                      Confirm Account Number
                    </Label>
                    <Input
                      id="confirmAccountNumber"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value)}
                      placeholder="Re-enter number"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ifscCode" className="text-xs font-semibold">
                    IFSC Code
                  </Label>
                  <Input
                    id="ifscCode"
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234 (11 characters)"
                    required
                  />
                </div>
              </>
            )}

            {/* UPI FORM */}
            {accountType === "UPI" && (
              <>
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
                </div>
                <div className="space-y-1">
                  <Label htmlFor="upiId" className="text-xs font-semibold">
                    UPI ID / VPA
                  </Label>
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                    placeholder="e.g. yourname@oksbi, 9876543210@paytm"
                    required
                  />
                </div>
              </>
            )}

            {/* CARD FORM */}
            {accountType === "CARD" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="cardHolder" className="text-xs font-semibold">
                    Cardholder Name
                  </Label>
                  <Input
                    id="cardHolder"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Full name printed on debit card"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cardBank" className="text-xs font-semibold">
                    Issuing Bank
                  </Label>
                  <Input
                    id="cardBank"
                    value={cardBank}
                    onChange={(e) => setCardBank(e.target.value)}
                    placeholder="e.g. HDFC Bank, ICICI Bank"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cardNumber" className="text-xs font-semibold">
                    16-Digit Debit Card Number
                  </Label>
                  <Input
                    id="cardNumber"
                    maxLength={19}
                    value={accountNumber}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw;
                      setAccountNumber(formatted);
                    }}
                    placeholder="e.g. 4532 1123 8890 1234"
                    required
                  />
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
                {saving ? "Saving…" : "Save & Link Account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
