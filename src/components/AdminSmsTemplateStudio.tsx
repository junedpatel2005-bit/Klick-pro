"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Smartphone,
  RotateCcw,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit3,
  Eye,
  Columns2,
  Info,
  ShieldCheck,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HydratedSmsTemplate } from "@/lib/sms/types";
import { interpolateVariables, calculateSmsCredits } from "@/lib/sms/format";

type ViewMode = "split" | "edit" | "preview";

interface Props {
  templateKey: string;
}

export function AdminSmsTemplateStudio({ templateKey }: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [template, setTemplate] = useState<HydratedSmsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Form Fields
  const [formBodyText, setFormBodyText] = useState("");
  const [formSenderId, setFormSenderId] = useState("KLKPRO");
  const [formDltTemplateId, setFormDltTemplateId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Action states
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testPhoneRecipient, setTestPhoneRecipient] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    details?: string;
  } | null>(null);

  // Load single template
  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/sms-templates/${templateKey}`);
        if (!res.ok) throw new Error("SMS Template not found or error loading.");
        const data = await res.json();
        const tpl: HydratedSmsTemplate = data.template;
        setTemplate(tpl);
        setFormBodyText(tpl.bodyText);
        setFormSenderId(tpl.senderId || "KLKPRO");
        setFormDltTemplateId(tpl.dltTemplateId || "");
        setFormIsActive(tpl.isActive);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading SMS template");
      } finally {
        setLoading(false);
      }
    }
    void loadTemplate();
  }, [templateKey]);

  // Live interpolated text and credit stats
  const liveStats = useMemo(() => {
    if (!template) {
      return {
        sampleText: "",
        charCount: 0,
        segments: 0,
        isUnicode: false,
        maxPerSegment: 160,
        remainingInSegment: 160,
      };
    }
    const sampleText = interpolateVariables(formBodyText, template.sampleData);
    const credits = calculateSmsCredits(sampleText);
    return {
      sampleText,
      ...credits,
    };
  }, [formBodyText, template]);

  // Quick-insert variable into textarea
  const handleInsertVariable = (variableKey: string) => {
    const textarea = textareaRef.current;
    const token = `{{${variableKey}}}`;
    if (!textarea) {
      setFormBodyText((prev) => `${prev} ${token}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = formBodyText.substring(0, start) + token + formBodyText.substring(end);
    setFormBodyText(newText);

    // Set cursor after inserted token
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 50);
  };

  // Save changes
  const handleSave = async () => {
    if (!formBodyText.trim()) {
      toast.error("SMS message text cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/admin/sms-templates/${templateKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: formBodyText.trim(),
          senderId: formSenderId.trim() || "KLKPRO",
          dltTemplateId: formDltTemplateId.trim() || null,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");

      setTemplate(data.template);
      toast.success("SMS template saved successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset this SMS template to its default code copy?")) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch(`/api/admin/sms-templates/${templateKey}/reset`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset template");

      setTemplate(data.template);
      setFormBodyText(data.template.bodyText);
      setFormSenderId(data.template.senderId || "KLKPRO");
      setFormDltTemplateId(data.template.dltTemplateId || "");
      setFormIsActive(data.template.isActive);
      toast.success("SMS template reset to defaults.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  // Send live test SMS
  const handleSendTestSms = async () => {
    if (!testPhoneRecipient.trim()) {
      toast.error("Please enter a destination phone number.");
      return;
    }

    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await fetch(`/api/admin/sms-templates/${templateKey}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testPhoneRecipient.trim(),
          overrideBody: formBodyText.trim(),
          overrideSenderId: formSenderId.trim() || "KLKPRO",
          overrideDltTemplateId: formDltTemplateId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch test SMS");

      setTestResult({
        ok: true,
        message: data.message || "Test SMS sent successfully!",
        details: `Dispatched to ${data.deliveredTo} (SID: ${data.messageId})`,
      });
      toast.success("Test SMS sent successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Send failed";
      setTestResult({
        ok: false,
        message: errMsg,
      });
      toast.error(errMsg);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading SMS template studio...</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error || "Template not found"}</p>
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/sms-templates")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to templates
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* Top Studio Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/sms-templates"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Back to SMS templates"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{template.name}</h1>
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] text-slate-500 border-slate-200"
                >
                  {template.key}
                </Badge>
                {template.isCustomized ? (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700 text-[11px]"
                  >
                    Customized
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-slate-50 text-slate-500 text-[11px]"
                  >
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">{template.description}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {/* View mode switcher */}
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "split"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                Split
              </button>
              <button
                onClick={() => setViewMode("edit")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "edit"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editor
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "preview"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>

            {template.isCustomized && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetting || saving}
                className="text-xs text-slate-600 hover:text-red-600"
              >
                <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
                Reset
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestModal(true)}
              className="text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Test SMS
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-sm"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div
          className={`grid gap-8 ${
            viewMode === "split"
              ? "lg:grid-cols-12"
              : viewMode === "edit"
                ? "grid-cols-1 max-w-3xl mx-auto"
                : "grid-cols-1 max-w-md mx-auto"
          }`}
        >
          {/* LEFT: Text Editor & Settings */}
          {(viewMode === "split" || viewMode === "edit") && (
            <div className={`space-y-6 ${viewMode === "split" ? "lg:col-span-7" : ""}`}>
              {/* Message Copy Box */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-600" />
                    <h2 className="text-sm font-bold text-slate-900">SMS Text Copy</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        liveStats.segments <= 1
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {liveStats.charCount} / {liveStats.maxPerSegment} chars ({liveStats.segments}{" "}
                      {liveStats.segments === 1 ? "credit" : "credits"})
                    </span>
                  </div>
                </div>

                {/* Textarea */}
                <div className="mt-4">
                  <Textarea
                    ref={textareaRef}
                    rows={5}
                    value={formBodyText}
                    onChange={(e) => setFormBodyText(e.target.value)}
                    placeholder="Enter SMS message text here..."
                    className="font-mono text-sm leading-relaxed border-slate-200 focus:border-indigo-500 resize-y"
                  />
                </div>

                {/* Progress bar towards limit */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>
                      Segment {liveStats.segments || 1}: {liveStats.remainingInSegment} characters
                      remaining
                    </span>
                    <span>{liveStats.isUnicode ? "UCS-2 (Unicode)" : "GSM-7 Standard"}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-300 ${
                        liveStats.segments > 1
                          ? "bg-amber-500"
                          : liveStats.charCount > 140
                            ? "bg-indigo-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, ((liveStats.maxPerSegment - liveStats.remainingInSegment) / liveStats.maxPerSegment) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Variable Injector */}
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Click to insert variable
                    </span>
                    <span className="text-[11px] text-slate-400">Inserts at cursor position</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {template.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleInsertVariable(v.key)}
                        className="group inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        title={v.description}
                      >
                        <span>{`{{${v.key}}}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* DLT & Regulatory Configuration */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    Telecom &amp; DLT Configuration
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Sender Header (Sender ID)
                    </label>
                    <Input
                      type="text"
                      maxLength={11}
                      value={formSenderId}
                      onChange={(e) => setFormSenderId(e.target.value.toUpperCase())}
                      placeholder="e.g. KLKPRO"
                      className="font-mono text-sm tracking-wider uppercase"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Standard 6-character registered alphanumeric DLT header (India) or Alpha
                      Sender ID.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      DLT Template ID (Optional)
                    </label>
                    <Input
                      type="text"
                      maxLength={50}
                      value={formDltTemplateId}
                      onChange={(e) => setFormDltTemplateId(e.target.value)}
                      placeholder="e.g. 10071689234501"
                      className="font-mono text-sm"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Registered 14-digit Content Template ID from your telecom DLT portal
                      (Vilpower/Jio/Airtel).
                    </p>
                  </div>
                </div>

                {/* Status Switch */}
                <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Template Active State
                    </span>
                    <span className="text-xs text-slate-500">
                      When inactive, this SMS alert will be silently suppressed during marketplace
                      events.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formIsActive ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formIsActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Variables Reference Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Variables Reference &amp; Sample Values
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 font-medium">Variable</th>
                        <th className="pb-2 font-medium">Label</th>
                        <th className="pb-2 font-medium">Sample Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {template.variables.map((v) => (
                        <tr key={v.key} className="hover:bg-slate-50">
                          <td className="py-2 text-indigo-600 font-semibold">{`{{${v.key}}}`}</td>
                          <td className="py-2 text-slate-700 font-sans">{v.label}</td>
                          <td className="py-2 text-slate-500">
                            {template.sampleData[v.key] || v.sample}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: Smartphone Live Preview */}
          {(viewMode === "split" || viewMode === "preview") && (
            <div className={`space-y-6 ${viewMode === "split" ? "lg:col-span-5" : ""}`}>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" />
                  Live Mobile SMS Preview
                </span>

                {/* Realistic Smartphone Shell */}
                <div className="relative w-full max-w-[340px] rounded-[44px] border-[8px] border-slate-800 bg-slate-900 p-3 shadow-2xl ring-1 ring-slate-900/10">
                  {/* Phone Screen */}
                  <div className="relative h-[580px] w-full overflow-hidden rounded-[34px] bg-slate-100 flex flex-col justify-between">
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold text-slate-800">
                      <span>9:41</span>
                      {/* Notch / Speaker */}
                      <div className="h-4 w-20 rounded-full bg-slate-800" />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]">5G</span>
                        <div className="h-2.5 w-4 rounded-sm border border-slate-800 p-0.5">
                          <div className="h-full w-full bg-slate-800 rounded-2xs" />
                        </div>
                      </div>
                    </div>

                    {/* Chat Header */}
                    <div className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-sm">
                        KP
                      </div>
                      <h4 className="mt-1 text-xs font-bold text-slate-900">
                        {formSenderId || "KLKPRO"}
                      </h4>
                      <p className="text-[10px] text-slate-400">KLICK PRO Notification</p>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col justify-end">
                      <div className="text-center text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        Today 9:41 AM
                      </div>

                      {/* Incoming SMS Bubble */}
                      <div className="flex items-start gap-2">
                        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3.5 shadow-sm border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-sans break-words">
                          <p>{liveStats.sampleText || "Message preview will appear here..."}</p>
                          <span className="mt-1 block text-right text-[10px] text-slate-400">
                            9:41 AM
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Simulated Input Bar */}
                    <div className="border-t border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between rounded-full bg-slate-100 px-3.5 py-1.5 text-xs text-slate-400">
                        <span>Text Message</span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
                          <ArrowLeft className="h-3.5 w-3.5 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Info under Mockup */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-500 font-mono">
                    {liveStats.charCount} characters • {liveStats.segments} SMS{" "}
                    {liveStats.segments === 1 ? "credit" : "credits"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Live variables interpolated using sample test payload.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Send Test SMS Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Send Test SMS</h3>
              </div>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Test sending this SMS with interpolated sample variables to any mobile number.
            </p>

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Recipient Mobile Number
              </label>
              <Input
                type="tel"
                placeholder="+91 9876543210 or 10-digit number"
                value={testPhoneRecipient}
                onChange={(e) => setTestPhoneRecipient(e.target.value)}
                className="text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                In development mode, test SMS dispatches are safely simulated and logged.
              </p>
            </div>

            {/* Test result status */}
            {testResult && (
              <div
                className={`mt-4 rounded-xl p-3 text-xs ${
                  testResult.ok
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.details && <p className="mt-1 text-[11px]">{testResult.details}</p>}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTestModal(false);
                  setTestResult(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendTestSms}
                disabled={sendingTest}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {sendingTest ? "Sending..." : "Dispatch SMS"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
