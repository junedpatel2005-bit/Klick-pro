"use client";

import { useEffect, useState } from "react";
import {
  Sliders,
  IndianRupee,
  ShieldAlert,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingItem = {
  key: string;
  value: string;
  description: string;
  category: "FINANCE" | "DISPUTES" | "GENERAL" | "SECURITY";
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load settings");

      const items: SettingItem[] = data.settings || [];
      setSettings(items);

      const initialMap: Record<string, string> = {};
      for (const item of items) {
        initialMap[item.key] = item.value;
      }
      setFormValues(initialMap);
      setHasChanges(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error loading platform settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function handleValueChange(key: string, value: string) {
    setFormValues((prev) => {
      const next = { ...prev, [key]: value };
      const hasAnyDiff = Object.entries(next).some(([k, v]) => {
        const orig = settings.find((s) => s.key === k)?.value;
        return orig !== undefined ? orig !== v : true;
      });
      setHasChanges(hasAnyDiff);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: formValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setSettings(data.settings);
      setHasChanges(false);
      window.dispatchEvent(new CustomEvent("servio:settings-update"));
      toast.success("Platform configuration updated successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const initialMap: Record<string, string> = {};
    for (const item of settings) {
      initialMap[item.key] = item.value;
    }
    setFormValues(initialMap);
    setHasChanges(false);
    toast.info("Changes reset to saved values.");
  }

  const isCommissionEnabled =
    formValues["commission_enabled"] === "true" ||
    formValues["commission_enabled"] === "1" ||
    formValues["commission_enabled"] === "on";
  const isAutoWithdrawalEnabled =
    formValues["auto_withdrawal_enabled"] === "true" ||
    formValues["auto_withdrawal_enabled"] === "1" ||
    formValues["auto_withdrawal_enabled"] === "on";
  const commissionRate = formValues["commission_rate"] || "10";
  const minWithdrawal = formValues["min_withdrawal_amount"] || "500";

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
              <Sliders className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Platform Configuration & Settings
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Control marketplace commission rates, dispute policies, arbitration limits, and
            financial rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {hasChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving}
              className="gap-1.5 text-xs text-slate-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
          >
            {saving ? (
              <span>Saving…</span>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          <div className="h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Quick Stat Pill Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              className={`rounded-xl border p-3.5 ${
                isCommissionEnabled
                  ? "border-indigo-200/80 bg-indigo-50/50"
                  : "border-slate-200/80 bg-slate-50/50"
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isCommissionEnabled ? "text-indigo-700" : "text-slate-600"
                }`}
              >
                Platform Commission
              </p>
              <p
                className={`mt-1 text-2xl font-black ${
                  isCommissionEnabled ? "text-indigo-900" : "text-slate-700"
                }`}
              >
                {isCommissionEnabled ? `${commissionRate}%` : "OFF"}
              </p>
              <p
                className={`text-[10px] mt-0.5 ${
                  isCommissionEnabled ? "text-indigo-600" : "text-slate-500"
                }`}
              >
                {isCommissionEnabled ? "Deduction enabled" : "Zero commission cut"}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Min Withdrawal
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-900">
                ₹{Number(minWithdrawal).toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-600 mt-0.5">Professional payout minimum</p>
            </div>
            <div
              className={`rounded-xl border p-3.5 ${
                isAutoWithdrawalEnabled
                  ? "border-emerald-200/80 bg-emerald-50/50"
                  : "border-slate-200/80 bg-slate-50/50"
              }`}
            >
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isAutoWithdrawalEnabled ? "text-emerald-700" : "text-slate-600"
                }`}
              >
                Auto-Withdrawal
              </p>
              <p
                className={`mt-1 text-2xl font-black ${
                  isAutoWithdrawalEnabled ? "text-emerald-900" : "text-slate-700"
                }`}
              >
                {isAutoWithdrawalEnabled ? "AUTO ON" : "OFF"}
              </p>
              <p
                className={`text-[10px] mt-0.5 ${
                  isAutoWithdrawalEnabled ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                {isAutoWithdrawalEnabled ? "Instant user cashout" : "Admin approval needed"}
              </p>
            </div>
          </div>

          {/* 1. FINANCIAL & COMMISSION SETTINGS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <IndianRupee className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  1. Financial Economics & Commission
                </h2>
                <p className="text-xs text-slate-500">
                  Configure marketplace revenue cuts and payout thresholds.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Auto Withdrawal ON/OFF Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:col-span-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto_withdrawal_enabled" className="text-xs font-bold text-slate-900 block">
                      Automatic User Withdrawal Payouts (Auto-Pay)
                    </Label>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isAutoWithdrawalEnabled
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {isAutoWithdrawalEnabled ? "INSTANT PAYOUT" : "MANUAL REVIEW"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    When turned <strong>ON</strong>, user withdrawal requests (Bank IMPS / UPI) are settled and transferred automatically without requiring manual Admin approval. When turned <strong>OFF</strong>, withdrawals remain in PENDING status until an Admin reviews and approves them in the Finance portal.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold ${isAutoWithdrawalEnabled ? "text-emerald-600" : "text-slate-500"}`}>
                    {isAutoWithdrawalEnabled ? "AUTO PAY ON" : "AUTO PAY OFF"}
                  </span>
                  <button
                    id="auto_withdrawal_enabled"
                    type="button"
                    onClick={() =>
                      handleValueChange("auto_withdrawal_enabled", isAutoWithdrawalEnabled ? "false" : "true")
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                      isAutoWithdrawalEnabled ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isAutoWithdrawalEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Commission ON/OFF Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:col-span-2">
                <div>
                  <Label htmlFor="commission_enabled" className="text-xs font-bold text-slate-900 block">
                    Turn Platform Commission On / Off
                  </Label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    When turned ON, platform commission is deducted from milestone payouts. When turned OFF, zero commission is cut (100% payout to professional, 0% platform fee to client).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isCommissionEnabled ? "text-indigo-600" : "text-slate-500"}`}>
                    {isCommissionEnabled ? "COMMISSION ON" : "COMMISSION OFF"}
                  </span>
                  <button
                    id="commission_enabled"
                    type="button"
                    onClick={() =>
                      handleValueChange("commission_enabled", isCommissionEnabled ? "false" : "true")
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                      isCommissionEnabled ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isCommissionEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
              {/* Commission Percentage - hidden when commission is OFF, auto-shown when ON */}
              {isCommissionEnabled && (
                <div className="space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="commission_rate" className="text-xs font-semibold text-slate-800">
                      Platform Commission Rate (%)
                    </Label>
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                      {commissionRate}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      id="commission_rate"
                      type="number"
                      min="0"
                      max="100"
                      value={commissionRate}
                      onChange={(e) => handleValueChange("commission_rate", e.target.value)}
                      className="h-10 text-sm font-semibold"
                    />
                    <div className="flex items-center gap-1">
                      {[10, 15, 20, 25].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleValueChange("commission_rate", String(preset))}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                            commissionRate === String(preset)
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Percentage automatically deducted as platform earnings when a milestone payout is
                    released to the professional.
                  </p>
                </div>
              )}

              {/* Min Withdrawal Amount */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="min_withdrawal_amount"
                    className="text-xs font-semibold text-slate-800"
                  >
                    Minimum Payout Withdrawal (₹)
                  </Label>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    ₹{minWithdrawal}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="min_withdrawal_amount"
                    type="number"
                    min="100"
                    step="50"
                    value={minWithdrawal}
                    onChange={(e) => handleValueChange("min_withdrawal_amount", e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    {[200, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleValueChange("min_withdrawal_amount", String(preset))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                          minWithdrawal === String(preset)
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        ₹{preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The minimum wallet balance required for a professional to submit a bank withdrawal
                  request.
                </p>
              </div>

            </div>
          </div>

          {/* Save Action Footer */}
          <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
              <p className="text-xs text-indigo-950 font-medium">
                Changes take effect across the entire marketplace platform immediately upon saving.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shrink-0"
            >
              {saving ? "Saving…" : "Apply Configurations"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
