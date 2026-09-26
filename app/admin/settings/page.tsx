"use client";

import { useEffect, useState } from "react";
import {
  Sliders,
  DollarSign,
  ShieldAlert,
  Save,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  ArrowRight,
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
      const original = settings.find((s) => s.key === key)?.value;
      if (original !== value) {
        setHasChanges(true);
      }
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

  const commissionRate = formValues["commission_rate"] || "20";
  const disputeLimit = formValues["dispute_limit"] || "5";
  const maxDisputeRounds = formValues["max_dispute_rounds"] || "5";
  const minWithdrawal = formValues["min_withdrawal_amount"] || "500";
  const autoResolveDays = formValues["auto_resolve_days"] || "7";

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                Platform Commission
              </p>
              <p className="mt-1 text-2xl font-black text-indigo-900">{commissionRate}%</p>
              <p className="text-[10px] text-indigo-600 mt-0.5">Applied on milestone releases</p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Dispute Limit
              </p>
              <p className="mt-1 text-2xl font-black text-rose-900">{disputeLimit}</p>
              <p className="text-[10px] text-rose-600 mt-0.5">Max disputes per project</p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Max Appeal Rounds
              </p>
              <p className="mt-1 text-2xl font-black text-amber-900">{maxDisputeRounds}</p>
              <p className="text-[10px] text-amber-600 mt-0.5">Rounds per dispute case</p>
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
          </div>

          {/* 1. FINANCIAL & COMMISSION SETTINGS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <DollarSign className="h-4 w-4" />
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
              {/* Commission Percentage */}
              <div className="space-y-3">
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

          {/* 2. DISPUTE & ARBITRATION POLICIES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  2. Dispute Arbitration & Escalation Limits
                </h2>
                <p className="text-xs text-slate-500">
                  Manage how many disputes can be initiated, maximum dispute appeal rounds, and
                  auto-resolution timeouts.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Max Disputes per Project */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dispute_limit" className="text-xs font-semibold text-slate-800">
                    Dispute Limit Per Project
                  </Label>
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                    {disputeLimit} disputes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="dispute_limit"
                    type="number"
                    min="1"
                    max="20"
                    value={disputeLimit}
                    onChange={(e) => handleValueChange("dispute_limit", e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    {[3, 5, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleValueChange("dispute_limit", String(preset))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                          disputeLimit === String(preset)
                            ? "border-rose-600 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Total disputes a client or professional can raise on a single contract before
                  requiring direct admin intervention.
                </p>
              </div>

              {/* Max Dispute Appeal Rounds */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="max_dispute_rounds"
                    className="text-xs font-semibold text-slate-800"
                  >
                    Max Appeal Rounds
                  </Label>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {maxDisputeRounds} rounds
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="max_dispute_rounds"
                    type="number"
                    min="1"
                    max="10"
                    value={maxDisputeRounds}
                    onChange={(e) => handleValueChange("max_dispute_rounds", e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    {[3, 5, 7].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleValueChange("max_dispute_rounds", String(preset))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                          maxDisputeRounds === String(preset)
                            ? "border-amber-600 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Maximum back-and-forth negotiation rounds permitted before a case is escalated
                  directly for binding admin adjudication.
                </p>
              </div>

              {/* Auto-Resolve Inactivity Days */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="auto_resolve_days"
                    className="text-xs font-semibold text-slate-800"
                  >
                    Auto-Resolve Timeout
                  </Label>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
                    {autoResolveDays} days
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="auto_resolve_days"
                    type="number"
                    min="1"
                    max="30"
                    value={autoResolveDays}
                    onChange={(e) => handleValueChange("auto_resolve_days", e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    {[3, 7, 14].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleValueChange("auto_resolve_days", String(preset))}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                          autoResolveDays === String(preset)
                            ? "border-slate-700 bg-slate-100 text-slate-900"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset}d
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Days without party response before an active dispute can be decided based on
                  verified system records.
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
