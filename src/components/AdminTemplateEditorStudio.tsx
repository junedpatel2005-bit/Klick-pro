"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  RotateCcw,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  Sparkles,
  Edit3,
  Eye,
  Columns2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { HydratedEmailTemplate } from "@/lib/email-templates/types";
import { interpolateVariables, renderEmailHtml } from "@/lib/email-templates/render";

type ViewMode = "split" | "edit" | "preview";

interface Props {
  templateKey: string;
}

export function AdminTemplateEditorStudio({ templateKey }: Props) {
  const router = useRouter();
  const [template, setTemplate] = useState<HydratedEmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewDevice, setViewDevice] = useState<"desktop" | "mobile">("desktop");
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  // Form Fields
  const [formSubject, setFormSubject] = useState("");
  const [formHeading, setFormHeading] = useState("");
  const [formBodyText, setFormBodyText] = useState("");
  const [formActionText, setFormActionText] = useState("");
  const [formActionUrl, setFormActionUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Action states
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);

  // Load single template
  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/email-templates/${templateKey}`);
        if (!res.ok) throw new Error("Template not found or error loading.");
        const data = await res.json();
        const tpl: HydratedEmailTemplate = data.template;
        setTemplate(tpl);
        setFormSubject(tpl.subject);
        setFormHeading(tpl.heading);
        setFormBodyText(tpl.bodyText);
        setFormActionText(tpl.actionText || "");
        setFormActionUrl(tpl.actionUrl || "");
        setFormIsActive(tpl.isActive);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error loading template");
      } finally {
        setLoading(false);
      }
    }
    void loadTemplate();
  }, [templateKey]);

  // Real-time client-side live rendered email
  const livePreview = useMemo(() => {
    if (!template) return { subject: "", html: "" };

    const renderedSubject = interpolateVariables(formSubject, template.sampleData);
    const renderedHeading = interpolateVariables(formHeading, template.sampleData);
    const renderedBody = interpolateVariables(formBodyText, template.sampleData);
    const renderedActionUrl = formActionUrl
      ? interpolateVariables(formActionUrl, template.sampleData)
      : null;

    const html = renderEmailHtml({
      subject: renderedSubject,
      heading: renderedHeading,
      bodyText: renderedBody,
      actionText: formActionText.trim() || null,
      actionUrl: renderedActionUrl,
    });

    return {
      subject: renderedSubject,
      html,
    };
  }, [template, formSubject, formHeading, formBodyText, formActionText, formActionUrl]);

  // Insert variable into active field
  const insertVariable = (variableKey: string) => {
    const token = `{{${variableKey}}}`;
    setFormBodyText((prev) => `${prev} ${token}`);
    toast.success(`Inserted ${token}`);
  };

  // Save changes
  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${template.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formSubject,
          heading: formHeading,
          bodyText: formBodyText,
          actionText: formActionText.trim() || null,
          actionUrl: formActionUrl.trim() || null,
          isActive: formIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template.");

      toast.success("Email template saved successfully.");
      setTemplate((prev) => (prev ? { ...prev, ...data.template, isCustomized: true } : prev));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error saving template.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!template) return;
    const confirmed = window.confirm(
      `Revert "${template.name}" back to system default? Any customized changes will be removed.`,
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${template.key}/reset`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset template.");

      toast.success("Template reverted to system default.");
      setTemplate(data.template);
      setFormSubject(data.template.subject);
      setFormHeading(data.template.heading);
      setFormBodyText(data.template.bodyText);
      setFormActionText(data.template.actionText || "");
      setFormActionUrl(data.template.actionUrl || "");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error resetting template.");
    } finally {
      setResetting(false);
    }
  };

  // Send test email
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !testEmailRecipient.trim()) return;

    setSendingTest(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${template.key}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim(),
          subject: formSubject,
          heading: formHeading,
          bodyText: formBodyText,
          actionText: formActionText.trim() || null,
          actionUrl: formActionUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed sending test email.");

      toast.success(data.message || "Test email sent!");
      setShowTestModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error sending test email.");
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading template studio...</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800 space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h2 className="text-lg font-semibold">Template Not Found</h2>
        </div>
        <p className="text-sm text-red-700">{error || "Could not locate this email template."}</p>
        <Button variant="outline" onClick={() => router.push("/admin/templates")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Template Library
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/80 pb-4">
        {/* Left: Back Button & Title */}
        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            href="/admin/templates"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition shadow-2xs"
            title="Back to Template Library"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 truncate">
                {template.name}
              </h1>

              {template.audience === "CLIENT" ? (
                <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                  Client Email
                </span>
              ) : template.audience === "PROFESSIONAL" ? (
                <span className="rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 border border-violet-200">
                  Professional Email
                </span>
              ) : (
                <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                  Auth / System
                </span>
              )}

              {template.isCustomized ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Customized Override
                </span>
              ) : (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 border border-slate-200">
                  System Default
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-0.5 truncate">{template.description}</p>
          </div>
        </div>

        {/* Right: View Toggles & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "split"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Columns2 className="h-4 w-4" />
              <span>Split View (50/50)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "edit"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>Editor Only</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "preview"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>Live Preview Only</span>
            </button>
          </div>

          {template.isCustomized && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={resetting}
              className="text-xs h-10 rounded-xl text-slate-600 hover:text-red-600 hover:border-red-200"
            >
              <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
              Reset to Default
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTestModal(true)}
            className="text-xs h-10 rounded-xl text-slate-700 bg-white"
          >
            <Send className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
            Send Test Email
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs h-10 rounded-xl shadow-xs px-4"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Saving Changes..." : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Workspace: Full Width Canvas */}
      <div
        className={`grid gap-6 ${
          viewMode === "split"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* PANE 1: Content Editor */}
        {(viewMode === "split" || viewMode === "edit") && (
          <div
            className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5 ${
              viewMode === "edit" ? "max-w-4xl mx-auto w-full" : "w-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                <Edit3 className="h-4 w-4 text-indigo-600" />
                Template Copy &amp; Settings
              </span>
              <span className="text-xs text-slate-400">Live syncs with preview</span>
            </div>

            {/* Subject Line */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Email Subject Line</label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Welcome to Klick-Pro, {{client_name}}"
                className="text-sm font-semibold text-slate-900 rounded-xl h-11"
              />
              <p className="text-[11px] text-slate-400">
                Supports merge tags like <code className="text-indigo-600 font-semibold">{`{{client_name}}`}</code>
              </p>
            </div>

            {/* Headline */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Email Heading / Banner Title</label>
              <Input
                value={formHeading}
                onChange={(e) => setFormHeading(e.target.value)}
                placeholder="e.g. Find the right verified professional..."
                className="text-sm rounded-xl h-11 font-medium"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Email Body Text</label>
                <span className="text-xs font-mono text-slate-400">{formBodyText.length} characters</span>
              </div>
              <Textarea
                rows={9}
                value={formBodyText}
                onChange={(e) => setFormBodyText(e.target.value)}
                placeholder="Enter email content with paragraphs and merge tags..."
                className="text-sm font-mono leading-relaxed resize-y rounded-xl p-3.5"
              />
              <p className="text-[11px] text-slate-500">
                Separate paragraphs with double blank lines. HTML characters are safely escaped automatically.
              </p>
            </div>

            {/* Call to Action Button */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Primary Call-to-Action Button</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Optional</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Button Label</label>
                  <Input
                    value={formActionText}
                    onChange={(e) => setFormActionText(e.target.value)}
                    placeholder="e.g. Review Milestone Work"
                    className="text-xs h-10 bg-white rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Destination URL / Path</label>
                  <Input
                    value={formActionUrl}
                    onChange={(e) => setFormActionUrl(e.target.value)}
                    placeholder="e.g. /project/{{project_id}}/tracking"
                    className="text-xs h-10 bg-white rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Merge Tags Palette */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">
                  Available Merge Tags for this Template
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Click any tag below to append it to the message body:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {template.variables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => insertVariable(variable.key)}
                    title={`${variable.label}: "${variable.sample}"`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-mono font-medium text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition shadow-2xs"
                  >
                    <span>{`{{${variable.key}}}`}</span>
                    <span className="text-[10px] text-indigo-400 font-sans font-normal">
                      ({variable.label})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANE 2: Live HTML Sandboxed Inbox Preview */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`rounded-2xl border border-slate-200 bg-slate-100/70 p-5 flex flex-col space-y-3.5 shadow-2xs ${
              viewMode === "preview" ? "max-w-4xl mx-auto w-full" : "w-full"
            }`}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                <Eye className="h-4 w-4 text-indigo-600" />
                Real-Time Inbox Preview
              </div>

              {/* Device Mode Toggle */}
              <div className="flex items-center rounded-xl border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewDevice("desktop")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewDevice === "desktop"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop View (600px)
                </button>
                <button
                  type="button"
                  onClick={() => setViewDevice("mobile")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewDevice === "mobile"
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile View (375px)
                </button>
              </div>
            </div>

            {/* Simulated Mail Client Header */}
            <div className="rounded-t-2xl border-x border-t border-slate-200 bg-white p-3.5 shadow-2xs space-y-1.5">
              <div className="flex items-center text-xs">
                <span className="w-16 font-semibold text-slate-400">From:</span>
                <span className="font-semibold text-slate-800">
                  Klick-Pro &lt;notifications@klick-pro.com&gt;
                </span>
              </div>
              <div className="flex items-center text-xs">
                <span className="w-16 font-semibold text-slate-400">Subject:</span>
                <span className="font-bold text-slate-900 truncate">{livePreview.subject}</span>
              </div>
            </div>

            {/* Sandboxed iframe container: spacious canvas */}
            <div className="flex-1 overflow-auto flex justify-center rounded-b-2xl border border-slate-200 bg-slate-200/60 p-4 sm:p-6 min-h-[620px]">
              <div
                className={`transition-all duration-200 w-full rounded-2xl overflow-hidden bg-white shadow-lg ${
                  viewDevice === "mobile" ? "max-w-[375px]" : "max-w-[620px]"
                }`}
              >
                <iframe
                  title="Email Sandbox Preview"
                  srcDoc={livePreview.html}
                  className="w-full h-[620px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900">Send Test Email</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Dispatches a live preview of <strong>&quot;{template.name}&quot;</strong> to test email formatting in Gmail, Apple Mail, Outlook, etc.
            </p>

            <form onSubmit={handleSendTest} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Recipient Email Address</label>
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  className="text-sm rounded-xl"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTestModal(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sendingTest || !testEmailRecipient}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs"
                >
                  {sendingTest ? "Sending..." : "Send Test Now"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

