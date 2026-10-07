"use client";

import { useEffect, useState } from "react";
import {
  Megaphone,
  Save,
  Eye,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldCheck,
  User,
  Power,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BannerConfig = {
  enabled: boolean;
  message: string;
  type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  target: "ALL" | "CLIENT" | "PROFESSIONAL";
  link: string;
  dismissible: boolean;
};

export default function AdminAnnouncementsPage() {
  const [config, setConfig] = useState<BannerConfig>({
    enabled: false,
    message: "",
    type: "INFO",
    target: "ALL",
    link: "",
    dismissible: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/extra/announcements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BannerConfig | null) => {
        if (data) setConfig(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/extra/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update banner");

      toast.success(
        config.enabled ? "Sitewide banner published and active!" : "Announcement banner disabled.",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving announcement");
    } finally {
      setSaving(false);
    }
  }

  const previewStyles = {
    INFO: {
      bg: "bg-indigo-600 text-white",
      icon: Info,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
    WARNING: {
      bg: "bg-amber-500 text-amber-950 font-medium",
      icon: AlertTriangle,
      linkBg: "bg-black/10 hover:bg-black/20 text-amber-950",
    },
    CRITICAL: {
      bg: "bg-rose-600 text-white font-medium",
      icon: AlertCircle,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
    SUCCESS: {
      bg: "bg-emerald-600 text-white font-medium",
      icon: CheckCircle2,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
  }[config.type];

  const PreviewIcon = previewStyles.icon;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
              <Megaphone className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Sitewide Announcement & Maintenance Banner
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Publish real-time announcement bars across the top of the client and professional
            portals for scheduled maintenance, notices, or offers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 text-xs font-semibold shadow-2xs"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving Changes..." : "Save & Publish Banner"}
          </Button>
        </div>
      </div>

      {/* Live Preview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-indigo-600" />
            Live Preview
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              config.enabled
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {config.enabled ? "CURRENTLY ACTIVE" : "DISABLED"}
          </span>
        </div>

        {/* The Banner Render */}
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <div
            className={`w-full px-4 py-3 text-xs transition-all ${previewStyles.bg} flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <PreviewIcon className="h-4 w-4 shrink-0" />
              <span className="font-semibold truncate">
                {config.message.trim() ||
                  "Sample Announcement: Platform updates and notices will be displayed here."}
              </span>
              {config.link && (
                <span
                  className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${previewStyles.linkBg}`}
                >
                  Learn more →
                </span>
              )}
            </div>
            {config.dismissible && (
              <span className="opacity-70 hover:opacity-100 text-sm font-bold cursor-pointer">
                ✕
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Toggle On/Off Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/70">
          <div>
            <p className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Power className="h-4 w-4 text-indigo-600" />
              Broadcast Banner Active
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Turn on to immediately show this announcement banner on top of the portal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              config.enabled ? "bg-indigo-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Message Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-800">
              Announcement Message Content *
            </label>
            <span className="text-[11px] text-slate-400">{config.message.length} / 300</span>
          </div>
          <textarea
            value={config.message}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, message: e.target.value.slice(0, 300) }))
            }
            rows={3}
            placeholder="e.g. Scheduled system maintenance will take place tonight between 02:00 AM and 04:00 AM IST. All running milestones remain secured."
            className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {/* Style / Severity Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-800">
            Banner Color & Severity Style
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                type: "INFO",
                label: "Information",
                desc: "Standard notice",
                icon: Info,
                border: "border-indigo-500",
                badge: "bg-indigo-50 text-indigo-700",
              },
              {
                type: "WARNING",
                label: "Warning / Maintenance",
                desc: "Upcoming maintenance",
                icon: AlertTriangle,
                border: "border-amber-500",
                badge: "bg-amber-50 text-amber-800",
              },
              {
                type: "CRITICAL",
                label: "Critical Alert",
                desc: "Urgent advisory",
                icon: AlertCircle,
                border: "border-rose-500",
                badge: "bg-rose-50 text-rose-800",
              },
              {
                type: "SUCCESS",
                label: "Special Offer / Success",
                desc: "Marketing or promotion",
                icon: CheckCircle2,
                border: "border-emerald-500",
                badge: "bg-emerald-50 text-emerald-800",
              },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    type: item.type as BannerConfig["type"],
                  }))
                }
                className={`p-3 rounded-xl border text-left transition ${
                  config.type === item.type
                    ? `${item.border} ring-2 ring-indigo-500 bg-white shadow-2xs`
                    : "border-slate-200 bg-slate-50/50 hover:bg-white"
                }`}
              >
                <span className={`inline-flex p-1.5 rounded-lg ${item.badge}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="mt-2 font-bold text-xs text-slate-900">{item.label}</p>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-800">Target Audience</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { target: "ALL", label: "All Users", icon: Users },
              { target: "CLIENT", label: "Clients Only", icon: User },
              { target: "PROFESSIONAL", label: "Professionals Only", icon: ShieldCheck },
            ].map((t) => (
              <button
                key={t.target}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    target: t.target as BannerConfig["target"],
                  }))
                }
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition ${
                  config.target === t.target
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Link & Dismissible */}
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800">Optional Button Link URL</label>
            <Input
              value={config.link}
              onChange={(e) => setConfig((prev) => ({ ...prev, link: e.target.value }))}
              placeholder="e.g. /how-it-works or https://..."
              className="text-xs"
            />
            <p className="text-[11px] text-slate-400">
              Leave blank if no clickable link is needed.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800">Dismissible by User</label>
            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.dismissible}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, dismissible: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Allow users to close (✕) the banner for their current session
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
