"use client";

import React, { useState, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  HelpCircle,
  Paperclip,
  Scale,
  ShieldAlert,
  Trash2,
  Upload,
  X,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type DisputeAttachment = {
  id?: number;
  name: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type DisputeData = {
  id: number;
  trackingId: number;
  reporterId: number;
  reporterRole: string;
  clientId: number;
  professionalId: number;
  issueType: string;
  priority: string;
  message: string;
  attachmentsJson?: string | null;
  status: string;
  disputeRound: number;
  milestoneId?: number | null;
  responseMessage?: string | null;
  responseAttachmentsJson?: string | null;
  respondedAt?: string | null;
  respondentAction?: string | null;
  decision?: string | null;
  decisionReason?: string | null;
  decisionAt?: string | null;
  refundAmount?: number | null;
  payoutAmount?: number | null;
  createdAt: string;
  updatedAt: string;
};

type Milestone = {
  id: number;
  title: string;
  amount: number;
  status: string;
  description?: string | null;
  dueDate?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  payment?: {
    status: string;
    professionalPayoutAmount?: number | null;
  } | null;
};

interface ProjectDisputeCenterProps {
  projectId: number;
  viewerRole: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  viewerUserId: number;
  projectStatus: string;
  milestones: Milestone[];
  dispute: DisputeData | null;
  disputeCount?: number;
  disputeLimit?: number;
  canRaiseDispute?: boolean;
  onAction: (actionKey: string, payload: Record<string, unknown>) => Promise<unknown>;
  busyAction: string | null;
  onPayMilestone?: (milestone: Milestone) => void;
}

const REASON_OPTIONS = [
  {
    id: "QUALITY_OF_WORK",
    label: "Quality of Work",
    description: "Deliverables are incomplete, defective, or do not match agreed specifications.",
    icon: AlertTriangle,
  },
  {
    id: "MISSED_DEADLINE",
    label: "Missed Deadlines",
    description: "Agreed milestones or project delivery schedule was severely breached.",
    icon: Clock,
  },
  {
    id: "UNRESPONSIVE",
    label: "Unresponsive Party",
    description: "Prolonged lack of communication or unresponsiveness preventing progress.",
    icon: HelpCircle,
  },
  {
    id: "SCOPE_DISAGREEMENT",
    label: "Scope Disagreement",
    description: "Conflict over deliverables, feature changes, or out-of-scope demands.",
    icon: Scale,
  },
  {
    id: "PAYMENT_ISSUE",
    label: "Payment / Milestone Issue",
    description: "Milestone payment withholding, unauthorized changes, or billing conflict.",
    icon: Gavel,
  },
  {
    id: "OTHER",
    label: "Other Contractual Issue",
    description: "Any other substantial dispute regarding project terms or commitments.",
    icon: FileText,
  },
];

export function ProjectDisputeCenter({
  projectId,
  viewerRole,
  viewerUserId,
  projectStatus,
  milestones,
  dispute,
  disputeCount = 0,
  disputeLimit = 3,
  canRaiseDispute = false,
  onAction,
  busyAction,
  onPayMilestone,
}: ProjectDisputeCenterProps) {
  const isClient = viewerRole === "CLIENT";
  const isReporter = dispute ? dispute.reporterId === viewerUserId : false;
  const isRespondent = dispute && !isReporter;

  // Find any payable milestone (matching dispute milestone or in review/revision)
  const payableMilestone = React.useMemo(() => {
    if (!milestones || milestones.length === 0) return null;
    if (dispute?.milestoneId) {
      const matched = milestones.find((m) => m.id === dispute.milestoneId);
      if (matched && matched.status !== "APPROVED" && matched.status !== "COMPLETED") {
        return matched;
      }
    }
    return (
      milestones.find(
        (m) =>
          m.status === "AWAITING_CLIENT_REVIEW" ||
          m.status === "REVISION_REQUESTED" ||
          m.status === "IN_PROGRESS",
      ) ?? null
    );
  }, [milestones, dispute?.milestoneId]);

  // Create dispute form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]?.id ?? "POOR_QUALITY");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [targetMilestoneId, setTargetMilestoneId] = useState<string>("none");
  const [explanation, setExplanation] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<DisputeAttachment[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [formError, setFormError] = useState("");

  // Respondent response form state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [rejectEvidence, setRejectEvidence] = useState<DisputeAttachment[]>([]);
  const [uploadingRejectEvidence, setUploadingRejectEvidence] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rejectFileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse evidence from current dispute
  const complainantEvidence: DisputeAttachment[] = React.useMemo(() => {
    if (!dispute?.attachmentsJson) return [];
    try {
      return JSON.parse(dispute.attachmentsJson);
    } catch {
      return [];
    }
  }, [dispute?.attachmentsJson]);

  const respondentEvidence: DisputeAttachment[] = React.useMemo(() => {
    if (!dispute?.responseAttachmentsJson) return [];
    try {
      return JSON.parse(dispute.responseAttachmentsJson);
    } catch {
      return [];
    }
  }, [dispute?.responseAttachmentsJson]);

  const handleFileUpload = async (files: FileList | null, target: "create" | "reject") => {
    if (!files || files.length === 0) return;
    const isCreate = target === "create";
    if (isCreate) setUploadingEvidence(true);
    else setUploadingRejectEvidence(true);

    try {
      const formData = new FormData();
      formData.append("projectId", String(projectId));
      formData.append("purpose", "dispute");
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/v1/portal/project-files", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to upload file(s).");

      if (json.attachments && Array.isArray(json.attachments)) {
        if (isCreate) {
          setEvidenceFiles((prev) => [...prev, ...json.attachments]);
        } else {
          setRejectEvidence((prev) => [...prev, ...json.attachments]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error uploading evidence.";
      if (isCreate) setFormError(msg);
      else setRejectError(msg);
    } finally {
      if (isCreate) setUploadingEvidence(false);
      else setUploadingRejectEvidence(false);
    }
  };

  const handleCreateDispute = async () => {
    if (!explanation.trim() || explanation.trim().length < 10) {
      setFormError("Please provide a clear explanation with at least 10 characters.");
      return;
    }
    setFormError("");
    try {
      await onAction("submit-dispute", {
        issueType: selectedReason,
        priority,
        message: explanation.trim(),
        evidence: evidenceFiles,
        milestoneId: targetMilestoneId !== "none" ? Number(targetMilestoneId) : undefined,
      });
      setShowCreateModal(false);
      setExplanation("");
      setEvidenceFiles([]);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create dispute.");
    }
  };

  const handleAcceptDispute = async () => {
    if (!dispute) return;
    try {
      await onAction("respond-dispute", {
        disputeId: dispute.id,
        responseAction: "ACCEPT",
      });
      setShowAcceptConfirm(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to accept dispute.");
    }
  };

  const handleRejectDispute = async () => {
    if (!dispute) return;
    if (!rejectMessage.trim() || rejectMessage.trim().length < 10) {
      setRejectError(
        "Please provide an explanation of why you are contesting this dispute (min 10 characters).",
      );
      return;
    }
    setRejectError("");
    try {
      await onAction("respond-dispute", {
        disputeId: dispute.id,
        responseAction: "REJECT",
        message: rejectMessage.trim(),
        evidence: rejectEvidence,
      });
      setShowRejectForm(false);
      setRejectMessage("");
      setRejectEvidence([]);
    } catch (err: unknown) {
      setRejectError(err instanceof Error ? err.message : "Failed to contest dispute.");
    }
  };

  // Determine current active display state
  const isDisputeActive = dispute && dispute.status !== "RESOLVED";
  const isWaitingResponse = dispute?.status === "WAITING_RESPONSE" || dispute?.status === "OPEN";
  const isUnderAdminReview = dispute?.status === "UNDER_ADMIN_REVIEW";
  const isResolved = dispute?.status === "RESOLVED";

  const totalUsed = disputeCount || (dispute ? dispute.disputeRound : 0);
  const remainingAllowance = Math.max(0, disputeLimit - totalUsed);

  return (
    <section
      id="project-dispute-center"
      className="scroll-mt-24 rounded-3xl border bg-card p-6 shadow-soft transition-all duration-300"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Contract Dispute Resolution
                {dispute && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isResolved
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : ""
                    }`}
                  >
                    {isResolved ? "Resolved" : `Round ${dispute.disputeRound} of ${disputeLimit}`}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-party arbitration with mutual settlement & administrative adjudication.
              </p>
            </div>
          </div>
        </div>

        {/* Dispute counter badge */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border bg-muted/50 px-3 py-1.5 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Dispute Allowance
            </p>
            <p className="text-xs font-bold text-foreground">
              {totalUsed} of {disputeLimit} Used{" "}
              <span className="text-muted-foreground font-normal">
                ({remainingAllowance} remaining)
              </span>
            </p>
          </div>

          {!isDisputeActive && canRaiseDispute && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white shadow-sm font-semibold text-xs"
              size="sm"
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" />
              Raise Dispute
            </Button>
          )}
        </div>
      </div>

      {/* BODY CONTENT */}

      {/* Case 1: No active dispute and dispute limit reached */}
      {!dispute && totalUsed >= disputeLimit && (
        <div className="mt-5 rounded-2xl border border-border/80 bg-muted/40 p-5 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">Dispute Limit Reached</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            The maximum allowance of {disputeLimit} disputes has been reached for this project
            contract. Please reach out directly to customer support if you need further help.
          </p>
        </div>
      )}

      {/* Case 2: No active dispute and can raise */}
      {!dispute && totalUsed < disputeLimit && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Contract in good standing</p>
            <p className="text-xs text-muted-foreground">
              If an issue regarding quality, missed deadlines, scope disagreement, or milestone
              payments arises, you can initiate a structured dispute. You have {remainingAllowance}{" "}
              dispute claim(s) remaining.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 font-medium"
          >
            <ShieldAlert className="mr-1.5 h-4 w-4 text-amber-600" />
            File a Dispute Claim
          </Button>
        </div>
      )}

      {/* Case 3: Active Dispute - WAITING FOR OTHER PARTY RESPONSE */}
      {isWaitingResponse && dispute && (
        <div className="mt-5 space-y-4">
          {/* Status banner */}
          <div
            className={`rounded-2xl border p-5 ${
              isRespondent
                ? "border-amber-300 bg-amber-50/70 dark:bg-amber-950/30"
                : "border-blue-200 bg-blue-50/60 dark:bg-blue-950/30"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-bold uppercase tracking-wider ${
                      isRespondent
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-blue-100 text-blue-800 border-blue-300"
                    }`}
                  >
                    {isRespondent ? "Action Required" : "Awaiting Other Party"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Dispute #{dispute.id} (Round {dispute.disputeRound} of {disputeLimit})
                  </span>
                </div>
                <h3 className="mt-1.5 text-base font-bold text-foreground">
                  {isRespondent
                    ? "A dispute was filed against this contract"
                    : "Dispute submitted — Waiting for other party response"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
                  {isRespondent
                    ? "Review the claim details below. You can Accept to mutually settle or Contest (Reject) with counter-evidence to escalate to Admin Review."
                    : "The other party has been notified. If they accept, the dispute resolves mutually. If they contest it, the case escalates directly to a platform administrator."}
                </p>
              </div>

              {/* Respondent Action buttons */}
              {isRespondent && !showRejectForm && (
                <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setShowAcceptConfirm(true)}
                    disabled={busyAction !== null}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Accept Claim
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRejectForm(true)}
                    disabled={busyAction !== null}
                    className="border-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 font-semibold"
                  >
                    <X className="mr-1.5 h-4 w-4 text-rose-500" />
                    Contest / Reject
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Settle by Paying Milestone Banner */}
          {isClient && payableMilestone && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Settle Dispute by Paying Milestone
                </div>
                <p className="text-xs text-muted-foreground">
                  Milestone{" "}
                  <span className="font-semibold text-foreground">
                    &ldquo;{payableMilestone.title}&rdquo;
                  </span>{" "}
                  (₹{payableMilestone.amount.toLocaleString("en-IN")}) is ready for settlement.
                  Paying this milestone will automatically resolve and close this dispute.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (onPayMilestone) {
                    onPayMilestone(payableMilestone);
                  } else {
                    void onAction("approve-milestone", { milestoneId: payableMilestone.id });
                  }
                }}
                disabled={busyAction !== null}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Pay & Settle (₹{payableMilestone.amount.toLocaleString("en-IN")})
              </Button>
            </div>
          )}

          {/* Details card */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b pb-4">
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">Reason</p>
                <p className="font-bold text-foreground mt-0.5">
                  {dispute.issueType.replaceAll("_", " ")}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                  Priority
                </p>
                <p className="font-bold text-foreground mt-0.5">{dispute.priority}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                  Filed By
                </p>
                <p className="font-bold text-foreground mt-0.5">
                  {dispute.reporterRole === "CLIENT" ? "Client" : "Professional"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground uppercase text-[10px]">
                  Date Filed
                </p>
                <p className="font-bold text-foreground mt-0.5">
                  {new Date(dispute.createdAt).toLocaleDateString("en-IN", {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Claim Explanation
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-muted/40 p-4 rounded-xl border">
                {dispute.message}
              </p>
            </div>

            {/* Evidence files */}
            {complainantEvidence.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Uploaded Evidence ({complainantEvidence.length} files)
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {complainantEvidence.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border bg-muted/30 p-2.5 hover:bg-muted/60 transition text-xs font-medium text-foreground"
                    >
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Respondent Contest Form (Drawer / Inline Panel) */}
          {isRespondent && showRejectForm && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b pb-3 border-amber-200">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                  <ShieldAlert className="h-4 w-4" />
                  Contest Dispute & Submit Counter-Evidence
                </div>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Explain your position clearly. Upon submission, this dispute will be escalated
                directly to the Klick-Pro Admin Review Team for official arbitration.
              </p>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Counter-Explanation *
                </label>
                <textarea
                  value={rejectMessage}
                  onChange={(e) => setRejectMessage(e.target.value)}
                  placeholder="Explain why this claim is incorrect, work completed, or relevant context..."
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[110px]"
                />
              </div>

              {/* Upload Counter-evidence */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Counter-Evidence Attachments (Screenshots, proof of work, logs)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    multiple
                    ref={rejectFileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, "reject")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => rejectFileInputRef.current?.click()}
                    disabled={uploadingRejectEvidence}
                    className="text-xs"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingRejectEvidence ? "Uploading..." : "Attach Files"}
                  </Button>
                </div>

                {rejectEvidence.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {rejectEvidence.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium"
                      >
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setRejectEvidence((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="text-muted-foreground hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {rejectError && <p className="text-xs font-medium text-rose-600">{rejectError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRejectDispute}
                  disabled={busyAction !== null || uploadingRejectEvidence}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                  <Gavel className="mr-1.5 h-4 w-4" />
                  Submit & Escalate to Admin
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Case 4: Active Dispute - UNDER ADMIN REVIEW */}
      {isUnderAdminReview && dispute && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 p-5">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white font-bold uppercase tracking-wider text-[10px]">
                Under Administrative Review
              </Badge>
              <span className="text-xs text-muted-foreground">
                Case #{dispute.id} (Round {dispute.disputeRound} of {disputeLimit})
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-foreground">
              Official Admin Adjudication in Progress
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
              This dispute was contested and escalated. A Klick-Pro Trust & Safety Dispute Officer
              is reviewing project logs, milestones, and submitted evidence from both parties to
              deliver a binding ruling (Client Refund or Professional Payout).
            </p>

            {/* Stepper */}
            <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs border-t border-indigo-200/60 pt-4">
              <div className="space-y-1">
                <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  ✓
                </div>
                <p className="font-semibold text-foreground text-[11px]">Dispute Filed</p>
              </div>
              <div className="space-y-1">
                <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  ✓
                </div>
                <p className="font-semibold text-foreground text-[11px]">Contested</p>
              </div>
              <div className="space-y-1">
                <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-bold animate-pulse">
                  3
                </div>
                <p className="font-semibold text-indigo-700 dark:text-indigo-300 text-[11px]">
                  Admin Review
                </p>
              </div>
              <div className="space-y-1 opacity-50">
                <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted border text-muted-foreground text-[11px] font-bold">
                  4
                </div>
                <p className="font-medium text-muted-foreground text-[11px]">Decision</p>
              </div>
            </div>
          </div>

          {/* Quick Settle by Paying Milestone Banner during Admin Review */}
          {isClient && payableMilestone && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Settle Dispute by Paying Milestone
                </div>
                <p className="text-xs text-muted-foreground">
                  The milestone{" "}
                  <span className="font-semibold text-foreground">
                    &ldquo;{payableMilestone.title}&rdquo;
                  </span>{" "}
                  (₹{payableMilestone.amount.toLocaleString("en-IN")}) is completed and awaiting
                  payment. Paying this milestone will automatically close this admin dispute,
                  release earnings to the professional, and resume contract progress.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (onPayMilestone) {
                    onPayMilestone(payableMilestone);
                  } else {
                    void onAction("approve-milestone", { milestoneId: payableMilestone.id });
                  }
                }}
                disabled={busyAction !== null}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Pay Milestone & Close Dispute (₹{payableMilestone.amount.toLocaleString("en-IN")})
              </Button>
            </div>
          )}

          {/* Submissions side-by-side or stacked */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Complainant Claim */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Initial Claim ({dispute.reporterRole === "CLIENT" ? "Client" : "Professional"})
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {dispute.issueType.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                {dispute.message}
              </p>
              {complainantEvidence.length > 0 && (
                <div className="pt-2 border-t text-xs">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Attachments ({complainantEvidence.length})
                  </p>
                  <div className="space-y-1">
                    {complainantEvidence.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate">{f.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Respondent Counter-Response */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Counter-Response ({dispute.reporterRole === "CLIENT" ? "Professional" : "Client"})
                </p>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                  Contested
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                {dispute.responseMessage || "Respondent contested the dispute claim."}
              </p>
              {respondentEvidence.length > 0 && (
                <div className="pt-2 border-t text-xs">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Counter-Evidence ({respondentEvidence.length})
                  </p>
                  <div className="space-y-1">
                    {respondentEvidence.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="truncate">{f.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case 5: Dispute RESOLVED */}
      {isResolved && dispute && (
        <div className="mt-5 space-y-4">
          <div
            className={`rounded-2xl border p-5 ${
              dispute.decision === "CLIENT_WINS"
                ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30"
                : dispute.decision === "PROFESSIONAL_WINS"
                  ? "border-blue-300 bg-blue-50/60 dark:bg-blue-950/30"
                  : "border-purple-300 bg-purple-50/60 dark:bg-purple-950/30"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-bold uppercase tracking-wider text-[10px] bg-background"
                  >
                    Dispute Resolved
                  </Badge>
                  <Badge
                    className={`font-bold text-[10px] ${
                      dispute.decision === "CLIENT_WINS"
                        ? "bg-emerald-600 text-white"
                        : dispute.decision === "PROFESSIONAL_WINS"
                          ? "bg-blue-600 text-white"
                          : "bg-purple-600 text-white"
                    }`}
                  >
                    {dispute.decision === "CLIENT_WINS"
                      ? "Client Wins (Refund)"
                      : dispute.decision === "PROFESSIONAL_WINS"
                        ? "Professional Wins (Released)"
                        : dispute.decision === "MUTUAL_SETTLEMENT"
                          ? "Mutually Settled"
                          : "Partial Settlement"}
                  </Badge>
                </div>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  Case #{dispute.id} Settled
                </h3>
                {dispute.decisionReason && (
                  <p className="mt-1 text-xs text-foreground/80 leading-relaxed font-medium">
                    &ldquo;{dispute.decisionReason}&rdquo;
                  </p>
                )}
              </div>

              {/* Settlement financial box */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                  <div className="rounded-xl border bg-background/80 px-3 py-1.5 text-center">
                    <p className="text-[10px] uppercase font-bold text-emerald-600">
                      Client Refund
                    </p>
                    <p className="text-sm font-black text-foreground">
                      ₹{dispute.refundAmount.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
                {dispute.payoutAmount != null && dispute.payoutAmount > 0 && (
                  <div className="rounded-xl border bg-background/80 px-3 py-1.5 text-center">
                    <p className="text-[10px] uppercase font-bold text-blue-600">
                      Professional Payout
                    </p>
                    <p className="text-sm font-black text-foreground">
                      ₹{dispute.payoutAmount.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* If can raise another dispute later in the project */}
          {canRaiseDispute && (
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                {remainingAllowance} dispute(s) remaining for this contract if a separate issue
                occurs.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="text-xs h-7"
              >
                Raise New Dispute
              </Button>
            </div>
          )}
        </div>
      )}

      {/* CREATE DISPUTE MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-3xl border bg-background p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Step 1 of 3: Raise Dispute
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  File a Formal Contract Dispute
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form fields */}
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Reason Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Select Reason *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REASON_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedReason === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedReason(opt.id)}
                        className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 ${isSelected ? "text-amber-600" : "text-muted-foreground"}`}
                          />
                          <span className="text-xs font-bold text-foreground">{opt.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority & Milestone Selection */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
                    className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="LOW">Low - Clarification or Minor Delay</option>
                    <option value="MEDIUM">Medium - Deliverable or Scope Conflict</option>
                    <option value="HIGH">High - Total Breakdown or Critical Payment</option>
                  </select>
                </div>

                {milestones.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Target Milestone (Optional)
                    </label>
                    <select
                      value={targetMilestoneId}
                      onChange={(e) => setTargetMilestoneId(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="none">General / Entire Project</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.title} (₹{m.amount.toLocaleString("en-IN")})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Detailed Explanation */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Explain the Issue Clearly *
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Detail specifically what went wrong, contract terms breached, and your requested resolution..."
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[110px]"
                />
              </div>

              {/* Upload Evidence */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Upload Supporting Evidence (Deliverables, screenshots, chats, logs)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files, "create")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingEvidence}
                    className="text-xs"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingEvidence ? "Uploading Evidence..." : "Choose Files"}
                  </Button>
                </div>

                {evidenceFiles.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {evidenceFiles.map((file, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                      >
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[160px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="text-muted-foreground hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <p className="text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200">
                  {formError}
                </p>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateDispute}
                disabled={busyAction !== null || uploadingEvidence}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                Submit Dispute Claim
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT DISPUTE CONFIRM MODAL */}
      {showAcceptConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border bg-background p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Accept Dispute & Mutually Settle?
                </h3>
                <p className="text-xs text-muted-foreground">Mutual Settlement Confirmation</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              By accepting this dispute, you agree to mutually settle the claim with the other
              party. The dispute will be closed as resolved without requiring an administrative
              penalty or formal hearing.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAcceptConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptDispute}
                disabled={busyAction !== null}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Confirm Mutual Settlement
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
