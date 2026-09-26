"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  Download,
  FileText,
  Flag,
  Gavel,
  History,
  Layers,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Split,
  Trash2,
  Upload,
  Wallet,
  RotateCcw,
  ShieldAlert,
  Wrench,
  PlusCircle,
  ArrowUpDown,
  X,
  ChevronUp,
  Star,
  Reply,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CelebrationConfetti } from "@/components/CelebrationConfetti";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageActionLoading } from "@/components/PageActionLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateMilestoneMoney } from "@/lib/payment-fees";
import {
  ProjectDisputeCenter,
  DisputeData,
  DisputeMessage,
} from "@/components/ProjectDisputeCenter";
import { toast } from "sonner";

type Person = { firstName: string | null; lastName: string | null } | null;
export type DraftMilestone = {
  title: string;
  amount: number | "";
  description: string;
  percentage?: number | "";
};
type Milestone = {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  payment?: {
    status: string;
    professionalPayoutAmount?: number | null;
  } | null;
};
type Stage = {
  title: string;
  status: "COMPLETE" | "CURRENT" | "UPCOMING";
  completedAt?: string | null;
};
type Event = {
  id: number;
  type?: string;
  title: string;
  description: string | null;
  actorRole: string;
  createdAt: string;
  progress: number | null;
  stage: string | null;
  attachmentJson: string | null;
  milestoneId: number | null;
};
type Attachment = { id: number; name: string; mimeType?: string; sizeBytes?: number; url: string };
type Upload = {
  id: number;
  title: string;
  note: string | null;
  fileName: string | null;
  fileUrl: string | null;
  filesJson: string | null;
  roundNumber: number;
  status: string;
  createdAt: string;
  milestoneId: number | null;
};

type Data = {
  project: {
    id: number;
    jobId?: number;
    clientId?: number;
    professionalId?: number;
    status: string;
    progress: number;
    currentStage: string | null;
    acceptedAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  job: {
    title: string | null;
    description: string | null;
    jobDate: string | null;
    deadline: string | null;
    budgetMax: number | null;
    paymentMethod: "WALLET" | "OFFLINE";
    locationAddress: string | null;
    locationLat: number | null;
    locationLng: number | null;
  } | null;
  professional: Person;
  client: Person;
  viewerRole: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  milestones: Milestone[];
  uploads: Upload[];
  revisions: { note: string | null; createdAt: string }[];
  timeline: Event[];
  agreedAmount: number | null;
  latestNegotiation?: {
    id: number;
    senderId: number;
    senderRole: string;
    bidAmount?: number | null;
    duration?: string | null;
    message?: string | null;
    createdAt: string;
  } | null;
  negotiations?: Array<{
    id: number;
    senderId: number;
    senderRole: string;
    bidAmount?: number | null;
    duration?: string | null;
    message?: string | null;
    createdAt: string;
  }>;
  review: {
    id: number;
    rating: number | null;
    comment: string | null;
    createdAt: string;
    clientReviewedAt: string | null;
    professionalRating: number | null;
    professionalComment: string | null;
    professionalReviewedAt: string | null;
    professionalResponse: string | null;
    professionalResponseAt: string | null;
  } | null;
  dispute: DisputeData | null;
  disputes?: DisputeData[];
  disputeMessages?: DisputeMessage[];
  disputeCount?: number;
  disputeLimit?: number;
  canRaiseDispute?: boolean;
};

const name = (p: Person, fallback: string) => (p ? `${p.firstName} ${p.lastName}` : fallback);
const label = (status: string) =>
  ({
    READY_TO_START: "Ready to Start",
    IN_PROGRESS: "In Progress",
    AWAITING_CLIENT_REVIEW: "Awaiting Client Review",
    AWAITING_ADMIN_APPROVAL: "Done · Approved",
    REVISION_REQUESTED: "Revision Requested",
    FINAL_WORK_SUBMITTED: "Final Work Submitted",
    AWAITING_PROFESSIONAL_CONFIRMATION: "Awaiting Professional Confirmation",
    REOPEN_REQUESTED: "Reopen Requested",
    COMPLETED: "Completed",
  })[status] ?? status.replaceAll("_", " ");
const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "Not started yet";
const dateInputValue = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined;
function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function milestoneStatusStyle(status: string) {
  if (status === "APPROVED" || status === "AWAITING_ADMIN_APPROVAL")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "AWAITING_CLIENT_REVIEW") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "REVISION_REQUESTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}
function milestoneAccent(status: string) {
  if (status === "APPROVED" || status === "AWAITING_ADMIN_APPROVAL") return "border-l-emerald-500";
  if (status === "AWAITING_CLIENT_REVIEW") return "border-l-purple-500";
  if (status === "REVISION_REQUESTED") return "border-l-red-500";
  if (status === "IN_PROGRESS") return "border-l-amber-500";
  return "border-l-border";
}
function milestoneOverdueDays(milestone: Milestone): number | null {
  if (
    !milestone.dueDate ||
    milestone.status === "APPROVED" ||
    milestone.status === "AWAITING_ADMIN_APPROVAL"
  )
    return null;
  const diffMs = Date.now() - new Date(milestone.dueDate).getTime();
  const days = Math.ceil(diffMs / 86400000);
  return days > 0 ? days : null;
}
const needsAction = (status: string) =>
  status === "REVISION_REQUESTED" ||
  status === "AWAITING_CLIENT_REVIEW" ||
  status === "FINAL_WORK_SUBMITTED" ||
  status === "AWAITING_PROFESSIONAL_CONFIRMATION" ||
  status === "REOPEN_REQUESTED";
const disputeEligibleStatuses = [
  "READY_TO_START",
  "IN_PROGRESS",
  "AWAITING_CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "FINAL_WORK_SUBMITTED",
  "COMPLETED",
  "CLOSED",
  "REOPEN_REQUESTED",
];

function getTrackingLoadingMeta(busy: string | null): { title: string; description: string } {
  switch (busy) {
    case "respond-reopen":
      return {
        title: "Submitting reopen response…",
        description: "Updating contract terms and notifying the other party.",
      };
    case "approve-milestone":
      return {
        title: "Approving milestone payment…",
        description: "Releasing funds from escrow directly to the professional's wallet.",
      };
    case "fund-milestone":
      return {
        title: "Funding milestone escrow…",
        description: "Securing milestone funds safely in escrow.",
      };
    case "submit-milestone":
      return {
        title: "Submitting milestone deliverable…",
        description: "Uploading work files and notifying the client for review.",
      };
    case "submit-final-work":
      return {
        title: "Submitting final project work…",
        description: "Uploading final files and requesting completion review.",
      };
    case "upload-work":
      return {
        title: "Uploading files…",
        description: "Saving deliverables and file attachments to the project.",
      };
    case "start-work":
      return {
        title: "Starting project…",
        description: "Updating project status to In Progress.",
      };
    case "complete-project":
    case "confirm-project-completion":
      return {
        title: "Completing project…",
        description: "Finalizing contract terms and closing escrow.",
      };
    case "reopen-project":
      return {
        title: "Reopening project…",
        description: "Allocating work and notifying the professional.",
      };
    case "request-revision":
      return {
        title: "Requesting milestone revision…",
        description: "Submitting revision feedback to the professional.",
      };
    case "create-milestone":
    case "create-milestones":
      return {
        title: "Creating milestone…",
        description: "Adding new milestone to the project plan.",
      };
    case "update-milestone":
      return {
        title: "Updating milestone…",
        description: "Saving changes to milestone details.",
      };
    case "delete-milestone":
      return {
        title: "Deleting milestone…",
        description: "Removing milestone from the project.",
      };
    case "update-progress":
      return {
        title: "Updating progress…",
        description: "Saving milestone progress percentage.",
      };
    case "request-client":
      return {
        title: "Sending request to client…",
        description: "Notifying the client of required project details.",
      };
    default:
      return {
        title: "Processing request…",
        description: "Applying your changes to the project.",
      };
  }
}

export default function SharedProjectTrackingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryMilestoneId = searchParams.get("milestoneId");
  const queryAction = searchParams.get("action");

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (queryMilestoneId || queryTab === "milestones") return "milestones";
    if (queryTab === "timeline") return "timeline";
    if (queryTab === "uploads") return "uploads";
    return "overview";
  });

  const hasAutoScrolledMilestone = useRef<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const mId = searchParams.get("milestoneId");
    if (mId || tab === "milestones") {
      setActiveTab("milestones");
    } else if (tab === "timeline") {
      setActiveTab("timeline");
    } else if (tab === "uploads") {
      setActiveTab("uploads");
    }
  }, [searchParams]);

  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState("0");
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [workTitle, setWorkTitle] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [workFiles, setWorkFiles] = useState<File[]>([]);
  const [workMilestoneId, setWorkMilestoneId] = useState("auto");
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [approvalMilestone, setApprovalMilestone] = useState<Milestone | null>(null);
  const [approvalWalletBalance, setApprovalWalletBalance] = useState<number | null>(null);
  const [approvalError, setApprovalError] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState<{
    charged: number;
    professionalReceives: number;
    adminReceives: number;
    platformEarnings: number;
    remainingBalance: number;
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [confirmDeleteMilestoneOpen, setConfirmDeleteMilestoneOpen] = useState(false);
  const [revisionMilestone, setRevisionMilestone] = useState<Milestone | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState("");
  const [finalWorkNote, setFinalWorkNote] = useState("");
  const [draftMilestones, setDraftMilestones] = useState<DraftMilestone[]>([]);
  const [milestoneModalError, setMilestoneModalError] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState("");
  const [editMilestoneAmount, setEditMilestoneAmount] = useState<number | "">("");
  const [editMilestonePercentage, setEditMilestonePercentage] = useState<number | "">("");
  const [editMilestoneDescription, setEditMilestoneDescription] = useState("");
  const [editMilestoneError, setEditMilestoneError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState<"ISSUE" | "ADDITIONAL_WORK">("ADDITIONAL_WORK");
  const [reopenWorkDescription, setReopenWorkDescription] = useState("");
  const [reopenAmount, setReopenAmount] = useState("");
  const [reopenDuration, setReopenDuration] = useState("1-3 days");
  const [reopenModalError, setReopenModalError] = useState<string | null>(null);
  const [showNegotiateReopenModal, setShowNegotiateReopenModal] = useState(false);
  const [counterReopenAmount, setCounterReopenAmount] = useState("");
  const [counterReopenMessage, setCounterReopenMessage] = useState("");
  const [counterReopenDuration, setCounterReopenDuration] = useState("1-3 days");
  const [counterReopenError, setCounterReopenError] = useState<string | null>(null);
  const [bidViewMode, setBidViewMode] = useState<"last" | "all">("last");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverReviewRating, setHoverReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewResponseForm, setShowReviewResponseForm] = useState(false);
  const [reviewResponse, setReviewResponse] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeType, setDisputeType] = useState("PAYMENT");
  const [disputePriority, setDisputePriority] = useState("MEDIUM");
  const [disputeMessage, setDisputeMessage] = useState("");
  const actionInFlight = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/v1/portal/project?id=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load this project.");
    setData((await response.json()) as Data);
  }, [projectId]);
  useEffect(() => {
    void refresh().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "Unable to load this project."),
    );
  }, [refresh]);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const socket = io(origin, {
      path: "/api/realtime",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const onProjectUpdated = (payload?: { projectId?: number | string }) => {
      if (!payload?.projectId || String(payload.projectId) === String(projectId)) {
        void refresh().catch(() => undefined);
      }
    };

    socket.on("project:updated", onProjectUpdated);
    socket.on("dispute:update", () => void refresh().catch(() => undefined));
    socket.on("dispute:message", (payload?: { disputeId?: number; message?: DisputeMessage }) => {
      if (payload?.message) {
        setData((prev) => {
          if (!prev) return prev;
          const current = prev.disputeMessages || [];
          if (current.some((m) => m.id === payload.message!.id)) return prev;
          return { ...prev, disputeMessages: [...current, payload.message!] };
        });
      }
      void refresh().catch(() => undefined);
    });
    socket.on("notification:new", () => void refresh().catch(() => undefined));
    socket.on("proposal:new", () => void refresh().catch(() => undefined));

    const onCustomNotification = () => void refresh().catch(() => undefined);
    window.addEventListener("servio:notification", onCustomNotification);
    window.addEventListener("servio:project-update", onCustomNotification);

    // Live Heartbeat Polling fallback (ensures tracking stays synced in real-time)
    const pollInterval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refresh().catch(() => undefined);
      }
    }, 4000);

    const onFocus = () => void refresh().catch(() => undefined);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      socket.off("project:updated", onProjectUpdated);
      socket.off("dispute:update");
      socket.off("dispute:message");
      socket.off("notification:new");
      socket.off("proposal:new");
      socket.disconnect();
      window.clearInterval(pollInterval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("servio:notification", onCustomNotification);
      window.removeEventListener("servio:project-update", onCustomNotification);
    };
  }, [projectId, refresh]);

  useEffect(() => {
    if (!approvalMilestone) return;
    setApprovalError("");
    setApprovalSuccess(null);
    void fetch("/api/v1/wallet", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((wallet: { wallet?: { balance?: number } }) =>
        setApprovalWalletBalance(wallet.wallet?.balance ?? 0),
      )
      .catch(() => setApprovalWalletBalance(null));
  }, [approvalMilestone, data]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash === "#project-dispute" || hash === "#project-dispute-center") {
        setTimeout(() => {
          document.getElementById("project-dispute-center")?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    }
  }, []);

  const action = async (
    key: string,
    payload: Record<string, unknown> = {},
    alreadyLocked = false,
  ) => {
    if (!alreadyLocked && actionInFlight.current) return;
    if (!alreadyLocked) actionInFlight.current = true;
    if (key !== "send-dispute-message") setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/portal/project-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: key, projectId: Number(projectId), ...payload }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to update project.");
      if (key === "send-dispute-message" && result?.message) {
        setData((prev) => {
          if (!prev) return prev;
          const current = prev.disputeMessages || [];
          if (current.some((m) => m.id === result.message.id)) return prev;
          return { ...prev, disputeMessages: [...current, result.message] };
        });
      }
      setNote("");
      setFiles([]);
      setWorkTitle("");
      setWorkNote("");
      setWorkFiles([]);
      setWorkMilestoneId("auto");
      setShowProgress(false);
      await refresh();
      return { ok: true, error: null };
    } catch (error) {
      const errText = error instanceof Error ? error.message : "Unable to update project.";
      toast.error(errText);
      return { ok: false, error: errText };
    } finally {
      if (key !== "send-dispute-message") setBusy(null);
      if (!alreadyLocked) actionInFlight.current = false;
    }
  };
  const actionWithFiles = async (
    key: string,
    payload: Record<string, unknown> = {},
    selectedFiles = files,
  ) => {
    if (!selectedFiles.length) {
      toast.error("Choose at least one file.");
      return;
    }
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(key);
    try {
      const form = new FormData();
      form.set("projectId", String(projectId));
      selectedFiles.forEach((file) => form.append("files", file));
      const response = await fetch("/api/v1/portal/project-files", { method: "POST", body: form });
      const result = (await response.json().catch(() => null)) as {
        attachments?: Attachment[];
        error?: string;
      } | null;
      if (!response.ok || !result?.attachments?.length)
        throw new Error(result?.error || "Unable to store the selected files.");
      await action(
        key,
        { ...payload, attachmentIds: result.attachments.map((file) => file.id) },
        true,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to store the selected files.";
      toast.error(errMsg);
      setBusy(null);
    } finally {
      actionInFlight.current = false;
    }
  };

  async function approveMilestoneWithPayment(milestoneId: number) {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setBusy("approve-milestone");
    try {
      const offlinePayment = data?.job?.paymentMethod === "OFFLINE";
      const response = await fetch(
        offlinePayment ? "/api/v1/portal/project-actions" : "/api/wallet/milestone",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            offlinePayment
              ? { action: "approve-milestone", projectId: Number(projectId), milestoneId }
              : { projectId: Number(projectId), milestoneId },
          ),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        charged?: number;
        professionalReceives?: number;
        adminReceives?: number;
        platformEarnings?: number;
        remainingBalance?: number;
      } | null;
      if (!response.ok) {
        setApprovalError(
          result?.error ??
            (offlinePayment
              ? "Unable to record offline payment."
              : "Unable to complete wallet payment."),
        );
        return false;
      }
      // Close the approval popup immediately upon successful payment
      setApprovalMilestone(null);
      setApprovalSuccess(null);
      setShowCelebration(true);
      setApprovalWalletBalance(result?.remainingBalance ?? null);
      await refresh().catch(() => undefined);
      return true;
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

  const allNegotiations = useMemo(() => {
    if (data?.negotiations && data.negotiations.length > 0) {
      return data.negotiations;
    }
    if (data?.latestNegotiation) {
      return [data.latestNegotiation];
    }
    const pending = data?.milestones?.find((m) => m.status === "PENDING_CONFIRMATION");
    if (pending) {
      return [
        {
          id: -pending.id,
          senderId: data?.project?.clientId ?? 0,
          senderRole: "CLIENT",
          bidAmount: pending.amount,
          duration: "1-3 days",
          message: pending.description,
          createdAt: data?.project?.acceptedAt || new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [data?.negotiations, data?.latestNegotiation, data?.milestones, data?.project]);

  const disputePaymentMilestone = useMemo(() => {
    if (!data?.dispute || data.dispute.decision !== "PROFESSIONAL_WINS") return null;
    if (data.viewerRole !== "CLIENT") return null;
    const targetMilestoneId = data.dispute.milestoneId;
    if (targetMilestoneId) {
      const matched = data.milestones?.find((m) => m.id === targetMilestoneId);
      if (matched && matched.status !== "APPROVED" && matched.status !== "COMPLETED") {
        return matched;
      }
    }
    return (
      data.milestones?.find(
        (m) =>
          m.status === "AWAITING_CLIENT_REVIEW" ||
          m.status === "REVISION_REQUESTED" ||
          m.status === "IN_PROGRESS",
      ) ?? null
    );
  }, [data?.dispute, data?.milestones, data?.viewerRole]);

  const hasAutoPromptedDisputePayment = useRef(false);
  useEffect(() => {
    if (disputePaymentMilestone && !approvalMilestone && !hasAutoPromptedDisputePayment.current) {
      hasAutoPromptedDisputePayment.current = true;
      setApprovalMilestone(disputePaymentMilestone);
      toast.info(
        `Dispute decided in favor of professional. Please review and pay "${disputePaymentMilestone.title}".`,
      );
    }
  }, [disputePaymentMilestone, approvalMilestone]);

  useEffect(() => {
    const mId = searchParams.get("milestoneId");
    if (!mId || !data?.milestones) return;
    if (hasAutoScrolledMilestone.current === mId) return;

    setActiveTab("milestones");

    const timer = setTimeout(() => {
      const el = document.getElementById(`milestone-${mId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        hasAutoScrolledMilestone.current = mId;
      }
    }, 400);

    const action = searchParams.get("action");
    if ((action === "approve" || action === "pay") && data.viewerRole === "CLIENT") {
      const target = data.milestones.find((m) => String(m.id) === mId);
      if (target && target.status !== "APPROVED" && target.status !== "COMPLETED") {
        setApprovalMilestone(target);
      }
    }

    return () => clearTimeout(timer);
  }, [searchParams, data?.milestones, data?.viewerRole]);

  if (!data)
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl">
          <div className="h-40 animate-pulse rounded-3xl bg-muted" />
          <div className="mt-6 h-10 w-72 animate-pulse rounded-xl bg-muted" />
          <div className="mt-4 h-48 animate-pulse rounded-2xl bg-muted" />
          {message && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {message}
            </p>
          )}
        </div>
      </AppShell>
    );

  const client = name(data.client, "Client"),
    professional = name(data.professional, "Professional");
  const isClient = data.viewerRole === "CLIENT";
  const isAdmin = data.viewerRole === "ADMIN";
  const isProfessional = data.viewerRole === "PROFESSIONAL";
  const reviewRecipient = isClient ? professional : client;
  const ownRating = isClient ? data.review?.rating : data.review?.professionalRating;
  const ownComment = isClient ? data.review?.comment : data.review?.professionalComment;
  const receivedRating = isClient ? data.review?.professionalRating : data.review?.rating;
  const receivedComment = isClient ? data.review?.professionalComment : data.review?.comment;
  const hasOwnReview = ownRating != null;
  const hasReceivedReview = receivedRating != null;
  const current =
    data.milestones.find((m) =>
      ["IN_PROGRESS", "REVISION_REQUESTED", "AWAITING_CLIENT_REVIEW"].includes(m.status),
    ) || data.milestones.find((m) => !["APPROVED", "COMPLETED", "CANCELLED"].includes(m.status));
  const completed = data.milestones.filter(
    (m) =>
      m.status === "APPROVED" ||
      m.status === "COMPLETED" ||
      m.payment?.status === "COMPLETED" ||
      m.payment?.status === "FUNDED" ||
      m.status === "AWAITING_ADMIN_APPROVAL",
  ).length;
  const remaining = data.job?.deadline
    ? Math.ceil((new Date(data.job.deadline).getTime() - Date.now()) / 86400000)
    : null;
  const canFinal =
    data.milestones.length > 0 &&
    data.milestones.every(
      (m) =>
        m.status === "APPROVED" ||
        m.status === "COMPLETED" ||
        m.payment?.status === "COMPLETED" ||
        m.payment?.status === "FUNDED" ||
        m.status === "AWAITING_ADMIN_APPROVAL",
    );
  const totalMilestoneValue = data.milestones.reduce(
    (total, milestone) => total + milestone.amount,
    0,
  );
  const totalAgreed =
    data.agreedAmount && data.agreedAmount > 0 ? data.agreedAmount : totalMilestoneValue;
  const unassignedMilestoneAmount = Math.max(0, totalAgreed - totalMilestoneValue);
  const remainingMilestoneAmount = unassignedMilestoneAmount;

  const pendingMilestone = data.milestones.find((m) => m.status === "PENDING_CONFIRMATION");
  const latestNegotiationBid =
    allNegotiations[allNegotiations.length - 1] ?? data.latestNegotiation ?? null;

  const renderNegotiationBidsCard = () => {
    const latestBid = latestNegotiationBid;
    const isLatestFromMe = latestBid?.senderRole === (isClient ? "CLIENT" : "PROFESSIONAL");
    const activeAmount = latestBid?.bidAmount ?? pendingMilestone?.amount ?? 0;
    const activeDuration = latestBid?.duration || "1-3 days";

    return (
      <div className="rounded-xl border border-primary/20 bg-background/80 p-4 space-y-3 text-sm">
        {/* Toggle Bar: Last Bid vs All Bids */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-xs uppercase tracking-wider text-foreground">
              {bidViewMode === "last"
                ? "Current Active Terms"
                : `All Bids & Counter-Offers (${allNegotiations.length})`}
            </span>
          </div>

          <div className="flex items-center rounded-lg bg-muted/80 p-0.5 border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setBidViewMode("last")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                bidViewMode === "last"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Last Bid
            </button>
            <button
              type="button"
              onClick={() => setBidViewMode("all")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                bidViewMode === "all"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Show All Bids</span>
              {allNegotiations.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    bidViewMode === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {allNegotiations.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {bidViewMode === "last" ? (
          /* LAST BID VIEW */
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  {latestBid
                    ? latestBid.senderRole === "CLIENT"
                      ? isClient
                        ? "Your Proposed Terms"
                        : `${client} (Client)'s Terms`
                      : isProfessional
                        ? "Your Counter Terms"
                        : `${professional} (Professional)'s Counter-Offer`
                    : "Proposed Milestone Amount"}
                </span>
                <span className="text-2xl font-extrabold text-primary">
                  ₹{activeAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Latest / Active Bid
                </span>
                {activeDuration && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Timeline:{" "}
                    <span className="font-semibold text-foreground">{activeDuration}</span>
                  </p>
                )}
              </div>
            </div>

            {pendingMilestone && (
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/50 text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wide text-[10px] block mb-0.5">
                  Deliverable Scope
                </span>
                <p className="text-foreground/90 font-medium">{pendingMilestone.title}</p>
                {pendingMilestone.description && (
                  <p className="text-muted-foreground mt-1">{pendingMilestone.description}</p>
                )}
              </div>
            )}

            {latestBid?.message && (
              <div className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
                <span className="font-semibold text-muted-foreground">
                  {isLatestFromMe ? "Your Note: " : "Note: "}
                </span>
                &ldquo;{latestBid.message}&rdquo;
              </div>
            )}

            {allNegotiations.length > 1 && (
              <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
                <span>{allNegotiations.length} total bids in this negotiation.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBidViewMode("all")}
                  className="h-6 text-xs text-primary hover:underline gap-1 p-0 font-medium"
                >
                  <History className="h-3 w-3" /> View all bids ({allNegotiations.length})
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ALL BIDS VIEW */
          <div className="space-y-3">
            {allNegotiations.map((bid, idx) => {
              const isLatest = idx === allNegotiations.length - 1;
              const isSenderClient = bid.senderRole === "CLIENT";
              const isMe = (isClient && isSenderClient) || (isProfessional && !isSenderClient);
              const senderDisplayName = isSenderClient ? client : professional;
              const senderRoleTitle = isSenderClient ? "Client" : "Professional";

              return (
                <div
                  key={bid.id ?? idx}
                  className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                    isLatest
                      ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20 shadow-xs"
                      : "border-border/70 bg-background/70"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md font-bold text-[10px] ${
                          isLatest
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-foreground">{senderDisplayName}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {senderRoleTitle}
                      </span>
                      {isMe && (
                        <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isLatest ? (
                        <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Current / Last Bid
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted/80 text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                          Previous Offer
                        </span>
                      )}
                      {bid.createdAt && (
                        <span className="text-muted-foreground text-[10px]">
                          {date(bid.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Proposed:
                      </span>
                      <span className="text-base font-bold text-primary">
                        ₹{(bid.bidAmount ?? 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {bid.duration && (
                      <div className="text-xs text-muted-foreground">
                        Timeline:{" "}
                        <span className="font-semibold text-foreground">{bid.duration}</span>
                      </div>
                    )}
                  </div>

                  {bid.message && (
                    <p className="text-xs text-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
                      &ldquo;{bid.message}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>Showing all {allNegotiations.length} bids exchanged.</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBidViewMode("last")}
                className="h-6 text-xs text-primary hover:underline gap-1 p-0 font-medium"
              >
                <ChevronUp className="h-3.5 w-3.5" /> Show last bid only
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const recommendedMilestonePercentages = (count: number) => {
    if (count <= 0) return [];
    if (count === 1) return [100];
    if (count === 2) return [50, 50];

    const distribution = [50];
    const remainingForOthers = 50;
    const remainingSlots = count - 1;
    const base = Math.floor(remainingForOthers / remainingSlots);
    const remainder = remainingForOthers % remainingSlots;

    for (let index = 1; index < count; index += 1) {
      distribution.push(base + (index - 1 < remainder ? 1 : 0));
    }

    return distribution;
  };

  const resetDraftMilestones = (customUnallocated?: number) => {
    const unallocated =
      customUnallocated !== undefined ? customUnallocated : unassignedMilestoneAmount;
    const agreed = totalAgreed;
    const initialAmt = unallocated > 0 ? unallocated : "";
    const initialPct =
      agreed > 0 && typeof initialAmt === "number"
        ? Math.min(100, Math.round((initialAmt / agreed) * 100))
        : "";
    const nextIdx = (data?.milestones?.length ?? 0) + 1;

    setDraftMilestones([
      {
        title: `Milestone ${nextIdx}`,
        amount: initialAmt,
        percentage: initialPct,
        description: "",
      },
    ]);
    setMilestoneModalError(null);
  };

  const openCreateMilestoneModal = () => {
    resetDraftMilestones();
    setShowMilestoneModal(true);
  };

  const closeCreateMilestoneModal = () => {
    setShowMilestoneModal(false);
    setDraftMilestones([]);
    setMilestoneModalError(null);
  };

  const updateDraftMilestone = (
    index: number,
    field: keyof DraftMilestone,
    val: string | number,
  ) => {
    setDraftMilestones((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const next = [...prev];
      const item: DraftMilestone = { ...current };
      if (field === "title" || field === "description") {
        item[field] = String(val);
      } else if (field === "percentage") {
        if (val === "" || val === null) {
          item.percentage = "";
          item.amount = "";
        } else {
          const pct = Math.min(100, Math.max(0, Number(val) || 0));
          item.percentage = pct;
          item.amount = totalAgreed > 0 ? Math.round((totalAgreed * pct) / 100) : "";
        }
      } else if (field === "amount") {
        if (val === "" || val === null) {
          item.amount = "";
          item.percentage = "";
        } else {
          const amt = Math.max(0, Number(val) || 0);
          item.amount = amt;
          item.percentage =
            totalAgreed > 0 ? Math.min(100, Math.round((amt / totalAgreed) * 100)) : "";
        }
      }
      next[index] = item;
      return next;
    });
    setMilestoneModalError(null);
  };

  const addDraftMilestone = () => {
    const currentSum = draftMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    const left = Math.max(0, remainingMilestoneAmount - currentSum);
    const nextIndex = (data?.milestones?.length ?? 0) + draftMilestones.length + 1;
    const distribution = recommendedMilestonePercentages(draftMilestones.length + 1);
    const suggestedPct = distribution[distribution.length - 1] ?? 100;
    const suggestedAmount =
      left > 0 && totalAgreed > 0 ? Math.round((left * suggestedPct) / 100) : left;

    setDraftMilestones((prev) => [
      ...prev,
      {
        title: `Milestone ${nextIndex}`,
        amount: left > 0 ? suggestedAmount : "",
        percentage: left > 0 ? suggestedPct : "",
        description: "",
      },
    ]);
  };

  const removeDraftMilestone = (index: number) => {
    setDraftMilestones((prev) => prev.filter((_, i) => i !== index));
    setMilestoneModalError(null);
  };

  const autoFillRemaining = () => {
    const currentSum = draftMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    const remainingToAllocate = Math.max(0, remainingMilestoneAmount - currentSum);
    if (remainingToAllocate <= 0) return;
    setDraftMilestones((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
      if (last && (!last.amount || last.amount === 0)) {
        const next = [...prev];
        const updatedLast: DraftMilestone = { ...last };
        const newAmt = (Number(updatedLast.amount) || 0) + remainingToAllocate;
        updatedLast.amount = newAmt;
        updatedLast.percentage = totalAgreed > 0 ? Math.round((newAmt / totalAgreed) * 100) : 100;
        next[next.length - 1] = updatedLast;
        return next;
      }
      const nextIndex = (data?.milestones?.length ?? 0) + prev.length + 1;
      return [
        ...prev,
        {
          title: `Milestone ${nextIndex}`,
          amount: remainingToAllocate,
          percentage: totalAgreed > 0 ? Math.round((remainingToAllocate / totalAgreed) * 100) : 100,
          description: "",
        },
      ];
    });
  };

  const splitDraftEvenly = () => {
    if (draftMilestones.length === 0) return;
    const count = draftMilestones.length;
    const distribution = recommendedMilestonePercentages(count);
    let allocated = 0;

    setDraftMilestones((prev) =>
      prev.map((m, index) => {
        const pct = distribution[index] ?? 1;
        const rawAmount = totalAgreed > 0 ? Math.round((remainingMilestoneAmount * pct) / 100) : 0;
        const amount =
          index === prev.length - 1 ? Math.max(0, remainingMilestoneAmount - allocated) : rawAmount;
        allocated += amount;
        return {
          ...m,
          amount,
          percentage: pct,
        };
      }),
    );
  };

  const saveDraftMilestones = async () => {
    const valid = draftMilestones.filter((m) => m.title.trim().length > 0 && Number(m.amount) > 0);
    if (valid.length === 0) {
      setMilestoneModalError("Please provide a milestone title and valid amount.");
      return;
    }
    const totalAmount = valid.reduce((sum, m) => sum + Number(m.amount), 0);
    if (totalAmount > remainingMilestoneAmount) {
      setMilestoneModalError(
        `Total milestone amount (₹${totalAmount.toLocaleString("en-IN")}) exceeds remaining project amount (₹${remainingMilestoneAmount.toLocaleString("en-IN")}).`,
      );
      return;
    }
    setMilestoneModalError(null);
    try {
      if (valid.length === 1 && valid[0]) {
        const first = valid[0];
        await action("create-milestone", {
          title: first.title.trim(),
          amount: Number(first.amount),
          description: first.description.trim() || null,
        });
      } else {
        await action("create-milestones", {
          milestones: valid.map((m) => ({
            title: m.title.trim(),
            amount: Number(m.amount),
            description: m.description.trim() || null,
          })),
        });
      }
      closeCreateMilestoneModal();
    } catch (e) {
      setMilestoneModalError(e instanceof Error ? e.message : "Failed to create milestone(s).");
    }
  };

  const totalDraftAmount = draftMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  const totalDraftPercentage =
    totalAgreed > 0 ? Math.round((totalDraftAmount / totalAgreed) * 100) : 0;
  const totalCommittedInProject = totalMilestoneValue + totalDraftAmount;
  const projectAllocationPercentage =
    totalAgreed > 0
      ? Math.min(100, Math.round((totalCommittedInProject / totalAgreed) * 100))
      : 100;
  const isMilestoneExceeded = totalDraftAmount > remainingMilestoneAmount;
  const isFullyAllocated = totalAgreed > 0 && totalCommittedInProject >= totalAgreed;
  const remainingInModal = Math.max(0, remainingMilestoneAmount - totalDraftAmount);

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (milestone.status === "APPROVED" || milestone.status === "COMPLETED") {
      setEditMilestoneError("Completed or approved milestones cannot be modified.");
      return;
    }
    const hasWork =
      data.uploads.some((u) => u.milestoneId === milestone.id) ||
      milestone.status === "AWAITING_CLIENT_REVIEW" ||
      Boolean(milestone.submittedAt);
    if (hasWork) {
      setEditMilestoneError(
        "Work has already been submitted for this milestone, so it can no longer be edited.",
      );
      return;
    }
    if (data?.project.status === "COMPLETED") {
      setEditMilestoneError("This project is completed, so milestones can no longer be edited.");
      return;
    }

    setEditingMilestone(milestone);
    setEditMilestoneTitle(milestone.title);
    setEditMilestoneAmount(milestone.amount);
    const pct = totalAgreed > 0 ? Math.round((milestone.amount / totalAgreed) * 100) : "";
    setEditMilestonePercentage(pct);
    setEditMilestoneDescription(milestone.description || "");
    setEditMilestoneError(null);
  };

  const closeEditMilestoneModal = () => {
    setEditingMilestone(null);
    setEditMilestoneTitle("");
    setEditMilestoneAmount("");
    setEditMilestonePercentage("");
    setEditMilestoneDescription("");
    setEditMilestoneError(null);
  };

  const handleEditAmountChange = (val: string) => {
    if (val === "" || val === null) {
      setEditMilestoneAmount("");
      setEditMilestonePercentage("");
    } else {
      const amt = Math.max(0, Number(val) || 0);
      setEditMilestoneAmount(amt);
      setEditMilestonePercentage(
        totalAgreed > 0 ? Math.min(100, Math.round((amt / totalAgreed) * 100)) : "",
      );
    }
    setEditMilestoneError(null);
  };

  const handleEditPercentageChange = (val: string) => {
    if (val === "" || val === null) {
      setEditMilestonePercentage("");
      setEditMilestoneAmount("");
    } else {
      const pct = Math.min(100, Math.max(0, Number(val) || 0));
      setEditMilestonePercentage(pct);
      setEditMilestoneAmount(totalAgreed > 0 ? Math.round((totalAgreed * pct) / 100) : "");
    }
    setEditMilestoneError(null);
  };

  const saveEditMilestone = async () => {
    if (!editingMilestone) return;
    if (editingMilestone.status === "APPROVED" || editingMilestone.status === "COMPLETED") {
      setEditMilestoneError("Completed or approved milestones cannot be modified.");
      return;
    }
    const hasWork =
      data.uploads.some((u) => u.milestoneId === editingMilestone.id) ||
      editingMilestone.status === "AWAITING_CLIENT_REVIEW" ||
      Boolean(editingMilestone.submittedAt);
    if (hasWork) {
      setEditMilestoneError(
        "Work has already been submitted for this milestone, so it can no longer be edited.",
      );
      return;
    }
    if (data?.project.status === "COMPLETED") {
      setEditMilestoneError("This project is completed, so milestones can no longer be edited.");
      return;
    }

    const title = editMilestoneTitle.trim();
    const amount = Number(editMilestoneAmount);
    if (!title) {
      setEditMilestoneError("Milestone title is required.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setEditMilestoneError("Milestone amount must be greater than 0.");
      return;
    }
    const otherMilestonesTotal = data.milestones
      .filter((m) => m.id !== editingMilestone.id)
      .reduce((sum, m) => sum + m.amount, 0);
    if (otherMilestonesTotal + amount > totalAgreed) {
      const maxAllowed = Math.max(0, totalAgreed - otherMilestonesTotal);
      setEditMilestoneError(
        `Total milestone amount cannot exceed project budget of ₹${totalAgreed.toLocaleString("en-IN")}. Maximum allowed for this milestone is ₹${maxAllowed.toLocaleString("en-IN")}.`,
      );
      return;
    }
    setEditMilestoneError(null);
    try {
      await action("update-milestone", {
        milestoneId: editingMilestone.id,
        title,
        amount,
        description: editMilestoneDescription.trim() || null,
      });
      closeEditMilestoneModal();
    } catch (e) {
      setEditMilestoneError(e instanceof Error ? e.message : "Failed to update milestone.");
    }
  };

  const deleteCurrentMilestone = async () => {
    if (!editingMilestone) return;
    const hasWork =
      data.uploads.some((u) => u.milestoneId === editingMilestone.id) ||
      editingMilestone.status === "AWAITING_CLIENT_REVIEW" ||
      Boolean(editingMilestone.submittedAt);
    if (
      editingMilestone.status === "APPROVED" ||
      editingMilestone.status === "COMPLETED" ||
      hasWork ||
      data?.project.status === "COMPLETED"
    ) {
      setEditMilestoneError(
        "This milestone has submitted work, is active, completed, or approved and cannot be deleted.",
      );
      return;
    }
    setConfirmDeleteMilestoneOpen(true);
  };

  const executeDeleteMilestone = async () => {
    if (!editingMilestone) return;
    setEditMilestoneError(null);
    try {
      await action("delete-milestone", {
        milestoneId: editingMilestone.id,
      });
      closeEditMilestoneModal();
      setConfirmDeleteMilestoneOpen(false);
    } catch (e) {
      setEditMilestoneError(e instanceof Error ? e.message : "Failed to delete milestone.");
    }
  };

  const otherMilestonesTotal = editingMilestone
    ? data.milestones
        .filter((m) => m.id !== editingMilestone.id)
        .reduce((sum, m) => sum + m.amount, 0)
    : 0;
  const editMaxAllowed = Math.max(0, totalAgreed - otherMilestonesTotal);
  const milestoneMinDate = dateInputValue(data.job?.jobDate);
  const milestoneMaxDate = dateInputValue(data.job?.deadline);
  const paidToProfessional = data.milestones.reduce(
    (total, milestone) =>
      total +
      (milestone.status === "APPROVED" ||
      milestone.status === "COMPLETED" ||
      milestone.payment?.status === "COMPLETED"
        ? milestone.amount
        : 0),
    0,
  );
  const clientPaidMilestoneTotal = data.milestones.reduce(
    (total, milestone) =>
      total +
      (milestone.status === "APPROVED" ||
      milestone.status === "COMPLETED" ||
      milestone.payment?.status === "FUNDED" ||
      milestone.payment?.status === "COMPLETED"
        ? milestone.amount
        : 0),
    0,
  );
  const completedMilestones = data.milestones.filter(
    (m) =>
      m.status === "APPROVED" ||
      m.status === "COMPLETED" ||
      m.payment?.status === "COMPLETED" ||
      m.payment?.status === "FUNDED" ||
      m.status === "AWAITING_ADMIN_APPROVAL",
  );
  const remainingProjectBalance = Math.max(
    0,
    (totalMilestoneValue > 0 ? totalMilestoneValue : totalAgreed) - clientPaidMilestoneTotal,
  );
  const remainingClientPayment = remainingProjectBalance;
  const unpaidMilestones = data.milestones.filter(
    (milestone) =>
      milestone.status !== "APPROVED" &&
      milestone.status !== "COMPLETED" &&
      milestone.payment?.status !== "COMPLETED" &&
      milestone.payment?.status !== "FUNDED",
  );
  const attachments = (event: Event): Attachment[] => {
    try {
      const parsed: unknown = JSON.parse(event.attachmentJson ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter(
            (value): value is Attachment =>
              typeof value === "object" &&
              value !== null &&
              typeof value.id === "number" &&
              typeof value.name === "string" &&
              typeof value.url === "string",
          )
        : [];
    } catch {
      return [];
    }
  };
  const uploadAttachments = (upload: Upload): Attachment[] => {
    try {
      const parsed: unknown = JSON.parse(upload.filesJson ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter(
            (value): value is Attachment =>
              typeof value === "object" &&
              value !== null &&
              typeof value.id === "number" &&
              typeof value.name === "string" &&
              typeof value.url === "string",
          )
        : [];
    } catch {
      return [];
    }
  };
  const submit = (milestoneId: number) => {
    if (!files.length && !note.trim()) {
      toast.error("Enter a completion note and choose at least one file.");
      return;
    }
    if (!files.length) {
      toast.error("Please choose at least one deliverable file/document.");
      return;
    }
    if (!note.trim()) {
      toast.error("Please enter a deliverable completion note.");
      return;
    }
    void actionWithFiles("submit-milestone", { milestoneId, note });
  };

  return (
    <AppShell>
      <CelebrationConfetti active={showCelebration} onComplete={() => setShowCelebration(false)} />
      <main className="mx-auto max-w-6xl space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
          <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                <Sparkles className="h-3.5 w-3.5" /> Project tracking
              </p>
              <h1 className="mt-3 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {data.job?.title ?? `Project #${data.project.id}`}
              </h1>
              <p className="mt-2 text-sm text-white/75">
                {isAdmin
                  ? `Admin Audit Oversight · Client: ${client} · Professional: ${professional}`
                  : isClient
                    ? `Professional: ${professional}`
                    : `Client: ${client}`}
              </p>
            </div>
            <div className="flex items-center">
              {(isClient ? data.project.professionalId : data.project.clientId) && (
                <Link
                  href={
                    isClient
                      ? `/messages?recipientId=${data.project.professionalId}&projectId=${data.project.id}`
                      : `/professional/messages?recipientId=${data.project.clientId}&projectId=${data.project.id}`
                  }
                  aria-label={`Open chat with ${isClient ? professional : client}`}
                  title={`Open chat with ${isClient ? professional : client}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <MessageSquare className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
        </section>

        {isAdmin && (
          <div className="flex items-center gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-purple-950 dark:text-purple-200 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 font-bold text-xs uppercase text-purple-700 dark:text-purple-300">
              Admin
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Admin Project Oversight Mode</p>
              <p className="text-xs text-purple-800/85 dark:text-purple-300/85">
                Viewing workspace in read-only audit mode. Full access to inspect deliverables,
                revisions, financial breakdown, and project timeline events.
              </p>
            </div>
          </div>
        )}

        {disputePaymentMilestone && (
          <div className="rounded-2xl border-2 border-blue-400 bg-blue-50/90 dark:bg-blue-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">
                <Gavel className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">
                    Dispute Ruled in Favor of Professional — Milestone Payment Required
                  </h4>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 px-2 py-0.5 text-[10px] font-bold">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  The dispute was decided in favor of {professional}. Please pay and approve{" "}
                  <strong>{disputePaymentMilestone.title}</strong> (₹
                  {disputePaymentMilestone.amount.toLocaleString("en-IN")}) to complete the
                  settlement and advance the project.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 shadow-sm gap-1.5"
              onClick={() => setApprovalMilestone(disputePaymentMilestone)}
            >
              <CreditCard className="h-4 w-4" />
              Pay Milestone (₹{disputePaymentMilestone.amount.toLocaleString("en-IN")})
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-1.5">
              <Flag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Milestones</span>
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Work Upload</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <section
              className={`rounded-2xl border p-5 shadow-soft ${
                needsAction(data.project.status)
                  ? "border-amber-300/50 bg-amber-50/60"
                  : "border-primary/20 bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    needsAction(data.project.status)
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {needsAction(data.project.status) ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      needsAction(data.project.status) ? "text-amber-700" : "text-primary"
                    }`}
                  >
                    {needsAction(data.project.status) ? "Action required" : "Current status"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {statusHeading(data.project.status, current?.title)}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {statusText(
                      data.project.status,
                      isClient,
                      client,
                      professional,
                      current?.title,
                      data.revisions[0]?.note,
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.viewerRole === "CLIENT" && data.project.status === "READY_TO_START" && (
                  <Button
                    disabled={busy === "start-work"}
                    onClick={() => void action("start-work")}
                  >
                    {busy === "start-work" ? "Starting…" : "Start Work"}
                  </Button>
                )}

                {isProfessional && data.project.status !== "COMPLETED" && (
                  <Button variant="outline" onClick={() => setShowRequestModal(true)}>
                    Request client
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              {data.project.status === "REOPEN_REQUESTED" ? (
                isProfessional ? (
                  data.latestNegotiation && data.latestNegotiation.senderRole === "PROFESSIONAL" ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-base text-foreground flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-primary" />
                            Counter-Offer Sent to Client
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            You proposed counter terms for reopening this project. Waiting for the
                            client to review and respond.
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary shrink-0">
                          Awaiting Client Decision
                        </span>
                      </div>

                      {renderNegotiationBidsCard()}

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <Button
                          variant="outline"
                          disabled={busy === "respond-reopen"}
                          onClick={() => {
                            setCounterReopenAmount(String(data.latestNegotiation?.bidAmount ?? ""));
                            setCounterReopenMessage(data.latestNegotiation?.message ?? "");
                            setCounterReopenDuration(
                              data.latestNegotiation?.duration ?? "1-3 days",
                            );
                            setCounterReopenError(null);
                            setShowNegotiateReopenModal(true);
                          }}
                          className="gap-1.5 font-medium"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                          Revise Counter-Offer
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy === "respond-reopen"}
                          onClick={() => void action("respond-reopen", { decision: "REJECT" })}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                        >
                          <X className="h-4 w-4" />
                          Decline Reopen
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                          onClick={() => {
                            document
                              .getElementById("project-dispute-center")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          Raise Dispute
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-base text-amber-950 dark:text-amber-200 flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            Client Requested to Reopen This Project
                          </p>
                          <p className="text-sm text-amber-900/90 dark:text-amber-300/90 mt-1">
                            The client has proposed to reopen this project for additional work or
                            rework. Review the details below to Accept, Negotiate, or Decline.
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                          Awaiting Your Decision
                        </span>
                      </div>

                      {renderNegotiationBidsCard()}

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <Button
                          disabled={busy === "respond-reopen"}
                          onClick={() => void action("respond-reopen", { decision: "ACCEPT" })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {busy === "respond-reopen" ? "Accepting…" : "Accept & Start Work"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy === "respond-reopen"}
                          onClick={() => {
                            const pending = data.milestones.find(
                              (m) => m.status === "PENDING_CONFIRMATION",
                            );
                            setCounterReopenAmount(pending ? String(pending.amount) : "");
                            setCounterReopenMessage("");
                            setCounterReopenDuration("1-3 days");
                            setCounterReopenError(null);
                            setShowNegotiateReopenModal(true);
                          }}
                          className="gap-1.5"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                          Negotiate Terms
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy === "respond-reopen"}
                          onClick={() => void action("respond-reopen", { decision: "REJECT" })}
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                        >
                          <X className="h-4 w-4" />
                          Decline
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                          onClick={() => {
                            document
                              .getElementById("project-dispute-center")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <ShieldAlert className="h-4 w-4" />
                          Raise Dispute
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-base text-amber-950 dark:text-amber-200 flex items-center gap-2">
                          <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          {data.latestNegotiation &&
                          data.latestNegotiation.senderRole === "PROFESSIONAL"
                            ? "Professional Proposed Counter Terms"
                            : "Reopen Request Pending Professional Approval"}
                        </p>
                        <p className="text-sm text-amber-900/90 dark:text-amber-300/90 mt-1">
                          {data.latestNegotiation &&
                          data.latestNegotiation.senderRole === "PROFESSIONAL"
                            ? "The professional proposed counter terms for your reopen request. Please review below to Accept, Counter Back, or Decline."
                            : "You requested to reopen this project. Waiting for the professional to accept, decline, or negotiate terms."}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                        {data.latestNegotiation &&
                        data.latestNegotiation.senderRole === "PROFESSIONAL"
                          ? "Counter-Offer Received"
                          : "Pending Professional Response"}
                      </span>
                    </div>

                    {renderNegotiationBidsCard()}

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      {data.latestNegotiation &&
                      data.latestNegotiation.senderRole === "PROFESSIONAL" ? (
                        <>
                          <Button
                            disabled={busy === "respond-reopen"}
                            onClick={() => void action("respond-reopen", { decision: "ACCEPT" })}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {busy === "respond-reopen"
                              ? "Accepting…"
                              : "Accept Counter & Start Work"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy === "respond-reopen"}
                            onClick={() => {
                              setCounterReopenAmount(
                                String(data.latestNegotiation?.bidAmount ?? ""),
                              );
                              setCounterReopenMessage("");
                              setCounterReopenDuration(
                                data.latestNegotiation?.duration ?? "1-3 days",
                              );
                              setCounterReopenError(null);
                              setShowNegotiateReopenModal(true);
                            }}
                            className="gap-1.5"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                            Counter Back
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy === "respond-reopen"}
                            onClick={() => void action("respond-reopen", { decision: "REJECT" })}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="outline"
                            disabled={busy === "respond-reopen"}
                            onClick={() => void action("respond-reopen", { decision: "REJECT" })}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 font-medium"
                          >
                            <X className="h-4 w-4" />
                            {busy === "respond-reopen" ? "Cancelling…" : "Cancel Reopen Request"}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Waiting for the professional to respond. You can cancel this request
                            anytime.
                          </p>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                        onClick={() => {
                          document
                            .getElementById("project-dispute-center")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Raise Dispute
                      </Button>
                    </div>
                  </div>
                )
              ) : data.project.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? (
                isProfessional ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-50 p-4">
                    <div>
                      <p className="font-semibold text-amber-950">Client requested completion</p>
                      <p className="mt-1 text-sm text-amber-800">
                        Confirm that the final work is complete to close this project.
                      </p>
                    </div>
                    <Button
                      disabled={busy === "confirm-project-completion"}
                      onClick={() => void action("confirm-project-completion")}
                    >
                      {busy === "confirm-project-completion" ? "Confirming…" : "Confirm completion"}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted p-4">
                    <p className="font-semibold">Waiting for professional confirmation</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The professional has been notified and must confirm before the project is
                      completed.
                    </p>
                  </div>
                )
              ) : data.project.status === "COMPLETED" ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4">
                  <div>
                    <p className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Project Completed
                    </p>
                    <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-400/90">
                      All deliverables were completed. Need follow-up rework, a warranty fix, or
                      additional work?
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isClient && (
                      <Button
                        className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          setReopenModalError(null);
                          setReopenWorkDescription("");
                          setReopenAmount("");
                          setShowReopenModal(true);
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reopen Project for Work
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        document
                          .getElementById("project-dispute-center")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Raise Dispute
                    </Button>
                  </div>
                </div>
              ) : isClient ? (
                canFinal ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 p-4">
                    <div>
                      <p className="font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        All Milestones Approved! Ready to close project?
                      </p>
                      <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-400/90">
                        All milestone deliverables have been verified and approved. You can now
                        close and complete this project.
                      </p>
                    </div>
                    <Button
                      disabled={busy === "complete-project"}
                      onClick={() => setShowCompleteModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete Project
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted/60 border border-border p-4">
                    <div>
                      <p className="font-semibold text-foreground">Project in Progress</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {completed} of {data.milestones.length} milestone deliverables approved.
                        Once all milestones are completed, you can complete this project.
                      </p>
                    </div>
                    <Button
                      disabled
                      variant="outline"
                      className="opacity-70 text-xs font-semibold cursor-not-allowed"
                    >
                      {data.milestones.length - completed} milestone(s) pending approval
                    </Button>
                  </div>
                )
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info icon={Clock3} label="Started" value={date(data.project.startedAt)} />
                <Info icon={CalendarDays} label="Deadline" value={date(data.job?.deadline)} />
                <Info
                  icon={AlertCircle}
                  label="Time remaining"
                  value={
                    remaining == null
                      ? "Not set"
                      : remaining < 0
                        ? `${Math.abs(remaining)} days overdue`
                        : `${remaining} days`
                  }
                  tone={remaining != null && remaining < 0 ? "text-destructive" : undefined}
                />
                <Info
                  icon={Wallet}
                  label="Milestone amount"
                  value={`₹${(totalMilestoneValue > 0 ? totalMilestoneValue : (data.agreedAmount ?? 0)).toLocaleString("en-IN")}`}
                />
                <Info
                  icon={CheckCircle2}
                  label="Paid to professional"
                  value={`₹${paidToProfessional.toLocaleString("en-IN")}`}
                />
                <Info
                  icon={AlertCircle}
                  label="Remaining balance"
                  value={`₹${remainingProjectBalance.toLocaleString("en-IN")}`}
                  tone={remainingProjectBalance > 0 ? "text-amber-700" : "text-emerald-700"}
                />
              </div>
              {(data.job?.locationAddress ||
                (data.job?.locationLat !== null && data.job?.locationLng !== null)) && (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <h2 className="text-base font-semibold">Project location</h2>

                      <p className="text-sm text-muted-foreground">
                        {isClient
                          ? "Where you asked the professional to work"
                          : "Exact address — visible now that you're hired"}
                      </p>
                    </div>
                  </div>
                  {data.job?.locationAddress && (
                    <p className="mt-2 text-sm font-medium">{data.job.locationAddress}</p>
                  )}
                  {data.job?.locationLat != null && data.job?.locationLng != null && (
                    <iframe
                      title="Project location"
                      className="mt-3 h-[220px] w-full rounded-2xl border border-border"
                      loading="lazy"
                      src={`https://www.google.com/maps?q=${data.job.locationLat},${data.job.locationLng}&z=15&output=embed`}
                    />
                  )}
                </div>
              )}
            </section>

            {data.job?.description && (
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">Project Description</h2>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {data.job.description}
                </p>
              </section>
            )}

            {isClient && data.project.status !== "COMPLETED" && (
              <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-card p-5 sm:p-6 shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Flag className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">Project Milestones</h2>
                        {unassignedMilestoneAmount > 0 ? (
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                            ₹{unassignedMilestoneAmount.toLocaleString("en-IN")} Unallocated
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            100% Budget Allocated
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                        {unassignedMilestoneAmount > 0
                          ? "Define milestones and deliverables to release escrow payments in phases, just like when posting a job."
                          : "All project funds are allocated across milestones. You can add further delivery checkpoints if needed."}
                      </p>
                    </div>
                  </div>
                  <Button onClick={openCreateMilestoneModal} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> Add Milestones
                  </Button>
                </div>
              </section>
            )}

            {isProfessional && canFinal && data.project.status === "IN_PROGRESS" && (
              <section className="rounded-2xl border bg-card p-5 shadow-soft space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">Final work</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All milestones are approved. Submit final work for client approval.
                  </p>
                </div>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={finalWorkNote}
                    onChange={(e) => setFinalWorkNote(e.target.value)}
                    placeholder="Enter a note about the final deliverables..."
                    className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <FilePicker inputId="final-work-files" files={files} setFiles={setFiles} />
                    <Button
                      disabled={busy === "submit-final-work"}
                      onClick={() => {
                        const note = finalWorkNote.trim();
                        if (!note || !files.length)
                          return toast.error("Enter a final note and choose files.");
                        void actionWithFiles("submit-final-work", {
                          note,
                        });
                      }}
                    >
                      {busy === "submit-final-work" ? "Submitting…" : "Submit Final Work"}
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {["COMPLETED", "CLOSED"].includes(data.project.status) && (
              <section
                id="project-feedback"
                className="scroll-mt-24 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Project completion
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">Project feedback</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tell us about your experience with {isClient ? professional : client}.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <a href={`/api/v1/portal/projects/${projectId}/export`}>
                        <Download className="mr-2 h-4 w-4" />
                        Download full project PDF
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        document.getElementById("project-dispute-center")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Report issue / Raise dispute
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border bg-card p-5 shadow-soft transition-all">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        Your review of {reviewRecipient}
                      </p>
                      {hasOwnReview && (
                        <div className="flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= (ownRating || 0)
                                  ? "fill-amber-400 text-amber-500"
                                  : "fill-transparent text-muted-foreground/30"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-xs font-bold text-foreground">
                            {ownRating}/5
                          </span>
                        </div>
                      )}
                    </div>
                    {hasOwnReview ? (
                      <div className="mt-3 rounded-xl border bg-muted/30 p-3.5 text-sm text-foreground">
                        <p className="italic text-muted-foreground">
                          &ldquo;{ownComment || "No comment provided."}&rdquo;
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Share your feedback and experience working with {reviewRecipient}.
                        </p>
                        <Button
                          className="mt-4 gap-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 shadow-sm"
                          size="sm"
                          onClick={() => {
                            setReviewRating(5);
                            setShowReviewForm(true);
                          }}
                        >
                          <Star className="h-4 w-4 fill-white" />
                          {isClient ? "Rate Professional" : "Rate Client"}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-card p-5 shadow-soft transition-all">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        Review from {reviewRecipient}
                      </p>
                      {hasReceivedReview && (
                        <div className="flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= (receivedRating || 0)
                                  ? "fill-amber-400 text-amber-500"
                                  : "fill-transparent text-muted-foreground/30"
                              }`}
                            />
                          ))}
                          <span className="ml-1 text-xs font-bold text-foreground">
                            {receivedRating}/5
                          </span>
                        </div>
                      )}
                    </div>
                    {hasReceivedReview ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-xl border bg-muted/30 p-3.5 text-sm text-foreground">
                          <p className="italic text-muted-foreground">
                            &ldquo;{receivedComment || "No comment provided."}&rdquo;
                          </p>
                        </div>
                        {isProfessional && !data.review?.professionalResponse && (
                          <Button
                            className="gap-2 rounded-xl"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowReviewResponseForm(true)}
                          >
                            <Reply className="h-4 w-4" />
                            Respond to review
                          </Button>
                        )}
                        {data.review?.professionalResponse && (
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                              {isProfessional ? "Your response" : "Professional response"}
                            </p>
                            <p className="mt-1 text-foreground/90">
                              {data.review.professionalResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {reviewRecipient} has not left a review yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Rate & Review Modal Popup */}
                <Dialog
                  open={showReviewForm && !hasOwnReview}
                  onOpenChange={(open) => {
                    setShowReviewForm(open);
                    if (!open) {
                      setHoverReviewRating(null);
                    }
                  }}
                >
                  <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-7 bg-background text-foreground shadow-2xl">
                    <DialogHeader className="space-y-1 text-left">
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        {isClient ? "Rate & Review Professional" : "Rate & Review Client"}
                      </DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                        {data.job?.title ?? `Project #${data.project.id}`} ·{" "}
                        {isClient ? "Professional" : "Client"}: {reviewRecipient}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                      {/* Rating section */}
                      <div className="space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {isClient
                            ? "OVERALL QUALITY & SERVICE"
                            : "CLIENT COLLABORATION & COMMUNICATION"}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <div
                            className="flex items-center gap-1"
                            onMouseLeave={() => setHoverReviewRating(null)}
                          >
                            {[1, 2, 3, 4, 5].map((star) => {
                              const activeRating = hoverReviewRating ?? reviewRating;
                              const isFilled = star <= activeRating;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setReviewRating(star)}
                                  onMouseEnter={() => setHoverReviewRating(star)}
                                  className="p-0.5 text-muted-foreground/30 transition-transform hover:scale-110 focus:outline-none"
                                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                >
                                  <Star
                                    className={`h-7 w-7 transition-colors ${
                                      isFilled
                                        ? "fill-amber-400 text-amber-500"
                                        : "fill-transparent text-muted-foreground/30 hover:text-amber-300"
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-xs font-semibold text-foreground sm:text-sm">
                            {(hoverReviewRating ?? reviewRating) === 5 &&
                              (isClient
                                ? "5 - Outstanding Quality & Service"
                                : "5 - Excellent Client to Work With")}
                            {(hoverReviewRating ?? reviewRating) === 4 &&
                              (isClient
                                ? "4 - Great Work & Professional"
                                : "4 - Great Client, Clear Requirements")}
                            {(hoverReviewRating ?? reviewRating) === 3 &&
                              (isClient
                                ? "3 - Satisfactory Delivery"
                                : "3 - Good Experience Overall")}
                            {(hoverReviewRating ?? reviewRating) === 2 &&
                              (isClient
                                ? "2 - Needs Improvement"
                                : "2 - Difficult Communication / Delayed")}
                            {(hoverReviewRating ?? reviewRating) === 1 &&
                              (isClient
                                ? "1 - Unsatisfactory Experience"
                                : "1 - Poor Experience / Unresponsive")}
                          </span>
                        </div>
                      </div>

                      {/* Comment section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isClient
                              ? "SHARE YOUR FEEDBACK ON THIS PROFESSIONAL (OPTIONAL)"
                              : "SHARE YOUR FEEDBACK ON WORKING WITH THIS CLIENT (OPTIONAL)"}
                          </p>
                        </div>
                        <div className="relative">
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            maxLength={1000}
                            rows={4}
                            placeholder={
                              isClient
                                ? "Describe your experience with the professional's quality of work, turnaround time, communication, and overall delivery."
                                : "How was the client's communication, clarity of requirements, and milestone responsiveness?"
                            }
                            className="w-full resize-none rounded-xl border border-input bg-background/50 p-3.5 pb-7 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="absolute bottom-2.5 right-3 text-[11px] text-muted-foreground">
                            {reviewComment.length} characters
                          </span>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-5"
                        disabled={busy === "submit-review"}
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewComment("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="min-w-[130px] rounded-xl bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700"
                        disabled={busy === "submit-review" || !reviewRating}
                        onClick={async () => {
                          if (!reviewRating) return;
                          const result = await action("submit-review", {
                            rating: reviewRating,
                            comment: reviewComment.trim() || null,
                          });
                          if (result?.ok) {
                            setShowReviewForm(false);
                            setReviewComment("");
                          }
                        }}
                      >
                        {busy === "submit-review" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Rating"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Professional Review Response Modal */}
                <Dialog
                  open={
                    showReviewResponseForm &&
                    isProfessional &&
                    hasReceivedReview &&
                    !data.review?.professionalResponse
                  }
                  onOpenChange={setShowReviewResponseForm}
                >
                  <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-7 bg-background text-foreground shadow-2xl">
                    <DialogHeader className="space-y-1 text-left">
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        Respond to Client Review
                      </DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                        {data.job?.title ?? `Project #${data.project.id}`} · Client:{" "}
                        {reviewRecipient}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                      <div className="rounded-xl border bg-muted/40 p-3.5 text-sm">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className="flex text-amber-500">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-4 w-4 ${
                                  s <= (receivedRating || 0)
                                    ? "fill-amber-400 text-amber-500"
                                    : "fill-transparent text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-semibold text-foreground text-xs">
                            {receivedRating}/5
                          </span>
                        </div>
                        <p className="text-muted-foreground italic">
                          &ldquo;{receivedComment || "No comment provided."}&rdquo;
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          YOUR PUBLIC RESPONSE
                        </p>
                        <div className="relative">
                          <textarea
                            value={reviewResponse}
                            onChange={(e) => setReviewResponse(e.target.value)}
                            maxLength={1000}
                            rows={4}
                            placeholder="Thank the client for their feedback or provide helpful context about the project."
                            className="w-full resize-none rounded-xl border border-input bg-background/50 p-3.5 pb-7 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <span className="absolute bottom-2.5 right-3 text-[11px] text-muted-foreground">
                            {reviewResponse.length} characters
                          </span>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl px-5"
                        disabled={busy === "respond-to-review"}
                        onClick={() => {
                          setShowReviewResponseForm(false);
                          setReviewResponse("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="min-w-[130px] rounded-xl bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700"
                        disabled={busy === "respond-to-review" || !reviewResponse.trim()}
                        onClick={async () => {
                          if (!reviewResponse.trim()) return;
                          const result = await action("respond-to-review", {
                            response: reviewResponse.trim(),
                          });
                          if (result?.ok) {
                            setShowReviewResponseForm(false);
                            setReviewResponse("");
                          }
                        }}
                      >
                        {busy === "respond-to-review" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Response"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </section>
            )}

            {disputeEligibleStatuses.includes(data.project.status) && (
              <ProjectDisputeCenter
                projectId={Number(projectId)}
                viewerRole={data.viewerRole}
                viewerUserId={
                  isClient ? (data.project.clientId ?? 0) : (data.project.professionalId ?? 0)
                }
                clientName={client}
                professionalName={professional}
                projectStatus={data.project.status}
                milestones={data.milestones}
                dispute={data.dispute}
                disputeMessages={data.disputeMessages}
                disputeCount={data.disputeCount}
                disputeLimit={data.disputeLimit ?? 3}
                canRaiseDispute={data.canRaiseDispute}
                onAction={async (actionKey, payload) => {
                  await action(actionKey, payload);
                }}
                busyAction={busy}
                onPayMilestone={(m) => {
                  const target = data.milestones.find((item) => item.id === m.id);
                  if (target) setApprovalMilestone(target);
                }}
              />
            )}
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="space-y-6">
            <section className="rounded-3xl border bg-card p-6 shadow-soft">
              {/* Header & Overview */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Flag className="h-4 w-4" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Project Milestones</h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Deliverables, progress checkpoints, and released escrow payouts.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground">
                    {completed} of {data.milestones.length} completed
                  </span>
                  {unassignedMilestoneAmount > 0 ? (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                      ₹{unassignedMilestoneAmount.toLocaleString("en-IN")} unassigned
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      100% Budget Allocated
                    </span>
                  )}
                  {isClient && data.project.status !== "COMPLETED" && (
                    <Button onClick={openCreateMilestoneModal} size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" /> Add Milestone
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress track */}
              {data.milestones.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span>Milestone Progress</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                        {completed} of {data.milestones.length} Done
                      </span>
                      <span className="text-muted-foreground font-normal">
                        ({Math.round((completed / (data.milestones.length || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full items-center gap-1.5 rounded-full bg-muted/40 p-0.5">
                    {data.milestones.map((milestone, index) => {
                      const filled =
                        milestone?.status === "APPROVED" ||
                        milestone?.status === "COMPLETED" ||
                        milestone?.payment?.status === "COMPLETED" ||
                        milestone?.payment?.status === "FUNDED" ||
                        milestone?.status === "AWAITING_ADMIN_APPROVAL";
                      const active =
                        milestone &&
                        ["IN_PROGRESS", "REVISION_REQUESTED", "AWAITING_CLIENT_REVIEW"].includes(
                          milestone.status,
                        );
                      return (
                        <div
                          key={index}
                          className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            filled
                              ? "bg-emerald-500"
                              : milestone?.status === "REVISION_REQUESTED"
                                ? "bg-rose-500"
                                : active
                                  ? "bg-amber-400"
                                  : "bg-muted-foreground/20"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Milestones Cards List */}
              <div className="mt-6 space-y-4">
                {data.milestones.map((m, index) => {
                  const overdueDays = milestoneOverdueDays(m);
                  const milestoneUploads = data.uploads.filter(
                    (upload) => upload.milestoneId === m.id,
                  );
                  const hasSubmittedWork =
                    milestoneUploads.length > 0 ||
                    m.status === "AWAITING_CLIENT_REVIEW" ||
                    Boolean(m.submittedAt);
                  const pct = totalAgreed > 0 ? Math.round((m.amount / totalAgreed) * 100) : 0;
                  const isApproved =
                    m.status === "APPROVED" ||
                    m.status === "COMPLETED" ||
                    m.payment?.status === "COMPLETED" ||
                    m.payment?.status === "FUNDED" ||
                    m.status === "AWAITING_ADMIN_APPROVAL";
                  const isAwaitingReview = m.status === "AWAITING_CLIENT_REVIEW";
                  const isAwaitingAdmin = false;
                  const isRevision = m.status === "REVISION_REQUESTED";
                  const isPrecedingApproved =
                    index === 0 ||
                    data.milestones
                      .slice(0, index)
                      .every(
                        (prev) =>
                          prev.status === "APPROVED" ||
                          prev.status === "COMPLETED" ||
                          prev.payment?.status === "COMPLETED" ||
                          prev.payment?.status === "FUNDED",
                      );
                  const isCurrentActive = current?.id === m.id;
                  const isInProgress =
                    m.status === "IN_PROGRESS" ||
                    (!isApproved &&
                      !isAwaitingReview &&
                      !isRevision &&
                      isPrecedingApproved &&
                      isCurrentActive);
                  const isEligibleToWork =
                    !isApproved &&
                    (["IN_PROGRESS", "REVISION_REQUESTED"].includes(m.status) ||
                      isPrecedingApproved);

                  const isTargetMilestone = queryMilestoneId === String(m.id);

                  return (
                    <div
                      key={m.id}
                      id={`milestone-${m.id}`}
                      className={`relative rounded-2xl border bg-card p-5 sm:p-6 shadow-xs transition-all hover:shadow-soft space-y-4 scroll-mt-24 ${
                        isTargetMilestone
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/60 shadow-lg"
                          : isApproved
                            ? "border-emerald-500/30 hover:border-emerald-500/50"
                            : isAwaitingAdmin
                              ? "border-indigo-500/30 hover:border-indigo-500/50"
                              : isAwaitingReview
                                ? "border-purple-500/30 hover:border-purple-500/50"
                                : isRevision
                                  ? "border-rose-500/30 hover:border-rose-500/50"
                                  : isInProgress
                                    ? "border-amber-500/30 hover:border-amber-500/50"
                                    : "border-border"
                      }`}
                    >
                      {/* Top Row: Index, Title, Amount & Status */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                              isApproved
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : isAwaitingAdmin
                                  ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                                  : isAwaitingReview
                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                    : isInProgress
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                      : "bg-primary/10 text-primary"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-base sm:text-lg text-foreground">
                                {m.title}
                              </h3>
                              {isTargetMilestone && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2.5 py-0.5 text-[11px] font-bold shadow-xs animate-pulse">
                                  <Flag className="h-3 w-3" />
                                  Selected Milestone
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                                ₹{m.amount.toLocaleString("en-IN")}
                              </span>
                              {pct > 0 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  {pct}% of project
                                </span>
                              )}
                            </div>
                            {(m.payment || isApproved) && (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                                <span>
                                  {isClient ? "Payment: " : "Payout: "}
                                  <strong className="text-foreground font-semibold">
                                    {isClient
                                      ? isApproved ||
                                        m.payment?.status === "FUNDED" ||
                                        m.payment?.status === "COMPLETED"
                                        ? "Paid"
                                        : (m.payment?.status ?? "Pending")
                                      : m.payment?.status === "COMPLETED"
                                        ? "Paid Out"
                                        : m.payment?.status === "FUNDED"
                                          ? "Funded"
                                          : isApproved
                                            ? "Approved"
                                            : (m.payment?.status ?? "Pending")}
                                  </strong>
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Edit */}
                        <div className="flex h-fit flex-wrap items-center gap-2">
                          {isClient &&
                            data.project.status !== "COMPLETED" &&
                            m.status !== "APPROVED" &&
                            m.status !== "COMPLETED" &&
                            !hasSubmittedWork && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditMilestoneModal(m)}
                                className="h-7 gap-1.5 px-2.5 text-xs font-semibold hover:border-primary hover:text-primary"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </Button>
                            )}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                              isApproved
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : isAwaitingAdmin
                                  ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                                  : isAwaitingReview
                                    ? "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                    : isRevision
                                      ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                      : isInProgress
                                        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                        : "border-border bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {isAwaitingAdmin && <Clock3 className="h-3.5 w-3.5" />}
                            {isAwaitingReview && <Sparkles className="h-3.5 w-3.5" />}
                            {isRevision && <AlertCircle className="h-3.5 w-3.5" />}
                            {isInProgress && <Clock3 className="h-3.5 w-3.5" />}
                            {!isApproved &&
                              !isAwaitingAdmin &&
                              !isAwaitingReview &&
                              !isRevision &&
                              !isInProgress && <Layers className="h-3.5 w-3.5" />}
                            {isApproved
                              ? isClient
                                ? "Done · Paid"
                                : m.payment?.status === "COMPLETED"
                                  ? "Done · Paid Out"
                                  : "Done · Approved"
                              : isInProgress
                                ? "In Progress"
                                : label(m.status)}
                          </span>
                          {overdueDays !== null && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              {overdueDays}d overdue
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Deliverables / Scope Note */}
                      {m.description && (
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs sm:text-sm text-foreground/90">
                          <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary" /> Deliverables & Scope
                          </span>
                          <p className="leading-relaxed">{m.description}</p>
                        </div>
                      )}

                      {/* Milestone Deliverables & Proof History (Requirement 8) */}
                      {milestoneUploads.length > 0 &&
                        (() => {
                          const sortedUploads = [...milestoneUploads].sort(
                            (a, b) =>
                              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                          );
                          const latestUpload = sortedUploads[sortedUploads.length - 1];
                          const earlierUploads = sortedUploads.slice(0, -1);
                          const milestoneRevisions = data.timeline.filter(
                            (e) =>
                              e.milestoneId === m.id &&
                              (e.type === "REVISION_REQUESTED" ||
                                e.title.toLowerCase().includes("revision requested")),
                          );

                          return (
                            <div className="space-y-3 pt-2">
                              {/* Comparison header if multiple rounds exist */}
                              {earlierUploads.length > 0 && (
                                <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3.5 py-2.5 text-xs font-semibold text-primary">
                                  <Split className="h-4 w-4 shrink-0" />
                                  <span>
                                    Deliverable History: {sortedUploads.length} rounds submitted.
                                    You can compare earlier submissions with the latest proof below.
                                  </span>
                                </div>
                              )}

                              {/* Earlier Submissions (Archived Proofs) */}
                              {earlierUploads.map((upload, uIdx) => {
                                const uploadFiles = uploadAttachments(upload);
                                const relatedRevision =
                                  milestoneRevisions[uIdx] || data.revisions[0];
                                return (
                                  <div key={upload.id} className="space-y-2">
                                    <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 opacity-90">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                          <History className="h-3.5 w-3.5 text-muted-foreground" />
                                          Earlier Proof (Round {upload.roundNumber || uIdx + 1})
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                          {date(upload.createdAt)}
                                        </span>
                                      </div>
                                      {upload.note && (
                                        <p className="mt-1.5 text-sm text-foreground/80 italic">
                                          &ldquo;{upload.note}&rdquo;
                                        </p>
                                      )}
                                      {uploadFiles.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-2">
                                          {uploadFiles.map((file) => (
                                            <Button
                                              key={file.id}
                                              size="sm"
                                              variant="outline"
                                              asChild
                                              className="h-7 gap-1.5 text-xs bg-background"
                                            >
                                              <a href={file.url} target="_blank" rel="noreferrer">
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                {file.name}
                                              </a>
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Client revision request feedback following this submission */}
                                    {relatedRevision && (
                                      <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-rose-900 dark:text-rose-200 text-xs">
                                        <p className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400">
                                          <AlertCircle className="h-3.5 w-3.5" />
                                          Client Requested Changes (Round{" "}
                                          {upload.roundNumber || uIdx + 1})
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed">
                                          {"description" in relatedRevision
                                            ? relatedRevision.description
                                            : relatedRevision.note}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Latest Submission (Current Deliverable) */}
                              {latestUpload &&
                                (() => {
                                  const latestFiles = uploadAttachments(latestUpload);
                                  const isResubmission = latestUpload.roundNumber > 1;
                                  return (
                                    <div
                                      className={`rounded-xl border p-4 shadow-xs ${
                                        isApproved
                                          ? "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10"
                                          : isAwaitingReview
                                            ? "border-purple-500/40 bg-purple-50/30 dark:bg-purple-950/20 ring-1 ring-purple-500/20"
                                            : isRevision
                                              ? "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10"
                                              : "border-border/90 bg-muted/20"
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                                          <Upload className="h-3.5 w-3.5 text-primary" />
                                          {isResubmission
                                            ? `Latest Resubmitted Proof (Round ${latestUpload.roundNumber})`
                                            : "Milestone Deliverable Submitted"}
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                          {date(latestUpload.createdAt)}
                                        </span>
                                      </div>
                                      {latestUpload.note && (
                                        <p className="mt-2 text-sm text-foreground font-medium">
                                          {latestUpload.note}
                                        </p>
                                      )}
                                      {latestFiles.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-2">
                                          {latestFiles.map((file) => (
                                            <Button
                                              key={file.id}
                                              size="sm"
                                              variant="outline"
                                              asChild
                                              className="h-8 gap-1.5 text-xs font-medium"
                                            >
                                              <a href={file.url} target="_blank" rel="noreferrer">
                                                <FileText className="h-3.5 w-3.5 text-primary" />
                                                {file.name}
                                              </a>
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })()}

                      {/* Active Revision Request feedback if milestone is awaiting resubmission */}
                      {m.status === "REVISION_REQUESTED" && (
                        <div className="rounded-xl border border-rose-300/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 text-rose-900 dark:text-rose-200">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-rose-600" />
                              Revision Requested by Client (Pending Resubmission)
                            </p>
                            <span className="text-xs text-rose-700/75 dark:text-rose-300/75">
                              {date(data.revisions[0]?.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed">
                            {data.revisions[0]?.note ||
                              "Please review the requested changes and submit your revised deliverables."}
                          </p>
                        </div>
                      )}

                      {/* Actions: Professional Submit */}
                      {isProfessional && isEligibleToWork && (
                        <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center gap-2">
                          <FilePicker
                            inputId={`milestone-${m.id}-files`}
                            files={files}
                            setFiles={setFiles}
                          />
                          <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={
                              m.status === "REVISION_REQUESTED"
                                ? "Describe changes/fixes made in this revised deliverable..."
                                : "Deliverable note or comment for client"
                            }
                            className="flex-1"
                          />
                          <Button
                            disabled={busy === "submit-milestone"}
                            onClick={() => submit(m.id)}
                            className="gap-1.5 shrink-0"
                          >
                            <Upload className="h-4 w-4" />
                            {busy === "submit-milestone"
                              ? "Submitting…"
                              : m.status === "REVISION_REQUESTED"
                                ? "Submit Revised Proof"
                                : "Request Payment"}
                          </Button>
                        </div>
                      )}

                      {/* Actions: Client Review */}
                      {isClient &&
                        (m.status === "AWAITING_CLIENT_REVIEW" ||
                          (disputePaymentMilestone?.id === m.id &&
                            m.status !== "APPROVED" &&
                            m.status !== "COMPLETED")) && (
                          <div className="pt-2 border-t flex flex-wrap gap-2.5">
                            <Button
                              disabled={busy === "approve-milestone"}
                              onClick={() => setApprovalMilestone(m)}
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {disputePaymentMilestone?.id === m.id
                                ? `Pay & Settle Dispute (₹${m.amount.toLocaleString("en-IN")})`
                                : `Approve & Pay (₹${m.amount.toLocaleString("en-IN")})`}
                            </Button>
                            {m.status === "AWAITING_CLIENT_REVIEW" && !disputePaymentMilestone && (
                              <Button
                                variant="outline"
                                disabled={
                                  busy === "request-revision" || busy === "approve-milestone"
                                }
                                onClick={() => {
                                  setRevisionMilestone(m);
                                  setRevisionFeedback("");
                                  setRevisionError("");
                                }}
                                className="gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200"
                              >
                                <AlertCircle className="h-4 w-4" />
                                Request Revision
                              </Button>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })}

                {/* Empty State */}
                {data.milestones.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-8 text-center bg-muted/20">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                      <Flag className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold">No Milestones Yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                      Break this project into structured milestones with deliverables and payments,
                      just like in your job posting.
                    </p>
                    {isClient && data.project.status !== "COMPLETED" && (
                      <Button size="sm" className="mt-4 gap-2" onClick={openCreateMilestoneModal}>
                        <Plus className="h-4 w-4" /> Create First Milestone
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </TabsContent>

          {/* Work Upload Tab */}
          <TabsContent value="uploads" className="space-y-6">
            {isProfessional &&
              ["IN_PROGRESS", "REVISION_REQUESTED"].includes(data.project.status) && (
                <section className="rounded-2xl border bg-card p-5 shadow-soft">
                  <div>
                    <h2 className="text-lg font-semibold">Upload Work</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Share ongoing work and files with the client. This does not submit a
                      milestone.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
                    <input
                      value={workTitle}
                      onChange={(e) => setWorkTitle(e.target.value)}
                      placeholder="Work title (for example, Homepage Design)"
                    />
                    <textarea
                      value={workNote}
                      onChange={(e) => setWorkNote(e.target.value)}
                      placeholder="Work update / description"
                    />
                    <label className="grid gap-1 text-sm font-medium">
                      Related milestone{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                      <select
                        value={workMilestoneId}
                        onChange={(e) => setWorkMilestoneId(e.target.value)}
                      >
                        <option value="auto">
                          {current ? `Current milestone: ${current.title}` : "No current milestone"}
                        </option>
                        <option value="none">No related milestone</option>
                        {data.milestones
                          .filter((milestone) =>
                            ["IN_PROGRESS", "REVISION_REQUESTED"].includes(milestone.status),
                          )
                          .map((milestone) => (
                            <option key={milestone.id} value={milestone.id}>
                              {milestone.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <FilePicker
                      inputId="work-upload-files"
                      files={workFiles}
                      setFiles={setWorkFiles}
                    />
                  </div>
                  <div className="mt-4">
                    <Button
                      disabled={busy === "upload-work"}
                      onClick={() => {
                        if (!workTitle.trim() || !workFiles.length)
                          return toast.error("Enter a work title and choose at least one file.");
                        void actionWithFiles(
                          "upload-work",
                          {
                            milestoneId:
                              workMilestoneId === "auto"
                                ? (current?.id ?? null)
                                : workMilestoneId === "none"
                                  ? null
                                  : Number(workMilestoneId),
                            title: workTitle,
                            note: workNote || null,
                          },
                          workFiles,
                        );
                      }}
                    >
                      {busy === "upload-work" ? "Uploading…" : "Upload Work"}
                    </Button>
                  </div>
                </section>
              )}
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Work uploads</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Uploaded work files are available for preview and download by both sides.
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {data.uploads.length} upload{data.uploads.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {data.uploads.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-2">No work uploads yet.</p>
                  </div>
                ) : (
                  data.uploads.map((upload) => {
                    const files = uploadAttachments(upload);
                    return (
                      <div key={upload.id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{upload.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {upload.note || "No description."} ·{" "}
                              {upload.roundNumber > 1 ? "Revision" : "Work"}
                            </p>
                          </div>
                          <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {upload.roundNumber > 1 ? "Revision" : "Upload"}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {files.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No files available.</p>
                          ) : (
                            files.map((file) => (
                              <div
                                key={file.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.mimeType ?? "File"} · {formatFileSize(file.sizeBytes)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={file.url} target="_blank" rel="noreferrer">
                                      Preview
                                    </a>
                                  </Button>
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={file.url} download={file.name}>
                                      Download
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <section className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-soft">
              <div className="border-b border-border bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-5 text-white">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                      Project activity
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">Every step, in order</h2>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                    {data.timeline.length} events
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                  Negotiation, approvals, work updates, milestones, and disputes are recorded here.
                </p>
              </div>
              <ol className="relative space-y-4 px-5 py-6 sm:px-8">
                {data.timeline.map((event) => (
                  <li key={event.id} className="relative pl-8 sm:pl-10">
                    <span
                      className={`absolute left-0 top-5 size-3 -translate-x-1/2 rounded-full ring-4 ring-card ${
                        event.actorRole === "CLIENT"
                          ? "bg-cta"
                          : event.actorRole === "ADMIN"
                            ? "bg-purple-600"
                            : "bg-primary"
                      }`}
                    />
                    <div className="rounded-2xl border border-border/80 bg-background/70 p-4 shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/[0.02]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {event.title}
                            {event.progress != null ? ` — ${event.progress}%` : ""}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {event.description || "Activity recorded for this project."}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {event.type?.replaceAll("_", " ") ?? "Activity"}
                        </span>
                      </div>
                      {event.stage && (
                        <p className="mt-3 inline-flex rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                          Stage: {event.stage}
                        </p>
                      )}
                      {attachments(event).length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm">
                          {attachments(event).map((file) => (
                            <li key={file.id} className="flex flex-wrap items-center gap-2">
                              <span>{file.name}</span>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-primary hover:underline"
                              >
                                View
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                        {event.actorRole === "CLIENT"
                          ? client
                          : event.actorRole === "ADMIN"
                            ? "System / Admin"
                            : professional}{" "}
                        ·{" "}
                        {event.actorRole === "CLIENT"
                          ? "Client"
                          : event.actorRole === "ADMIN"
                            ? "Admin Audit"
                            : "Professional"}{" "}
                        · {date(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
                {data.timeline.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No activity yet.
                  </p>
                )}
              </ol>
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request action from client</DialogTitle>
            <DialogDescription>
              Ask the client to review details, share files, or respond with additional information.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Request subject
              <input
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="What do you need from the client?"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Request details
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="Write a clear request for the client."
                className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowRequestModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy === "request-client" || !requestMessage.trim()}
              onClick={() => {
                void action("request-client", {
                  title: requestTitle || undefined,
                  note: requestMessage,
                });
                setShowRequestModal(false);
              }}
            >
              {busy === "request-client" ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Project</DialogTitle>
            <DialogDescription>
              All milestones have been reviewed and approved. Confirming will complete this project,
              finalize records, and invite both parties to exchange ratings and reviews.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-200">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs opacity-80">Milestone total</p>
                <p className="font-semibold">₹{totalMilestoneValue.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Paid by client</p>
                <p className="font-semibold">₹{clientPaidMilestoneTotal.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Paid to professional</p>
                <p className="font-semibold">₹{paidToProfessional.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Remaining pending</p>
                <p className="font-semibold">₹{remainingClientPayment.toLocaleString("en-IN")}</p>
              </div>
            </div>
            {unpaidMilestones.length > 0 ? (
              <div className="mt-3 border-t border-emerald-500/20 pt-3">
                Unpaid milestones:
                <ul className="mt-1 list-disc pl-5">
                  {unpaidMilestones.map((milestone) => (
                    <li key={milestone.id}>
                      {milestone.title} — ₹{milestone.amount.toLocaleString("en-IN")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 border-t border-emerald-500/20 pt-3 font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                All milestones are fully funded and approved.
              </p>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy === "complete-project"}
              onClick={() => {
                setShowCompleteModal(false);
                void action("complete-project");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {busy === "complete-project" ? "Completing project…" : "Complete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showReopenModal}
        onOpenChange={(open) => {
          setShowReopenModal(open);
          if (!open) setReopenModalError(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Reopen Project for Work</DialogTitle>
                <DialogDescription>
                  Specify the work needed and offered payment. No complex milestone setup needed.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {reopenModalError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reopenModalError}</span>
              </div>
            )}

            {/* Reason Selection Cards (dispute-like option cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setReopenReason("ISSUE");
                  if (!reopenAmount || reopenAmount === "0") setReopenAmount("0");
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                  reopenReason === "ISSUE"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Wrench className="h-4 w-4" /> Issue / Warranty Rework
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Completed work stopped working or needs fixing (e.g. AC cooling problem, leaks).
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReopenReason("ADDITIONAL_WORK");
                  if (reopenAmount === "0") setReopenAmount("");
                }}
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                  reopenReason === "ADDITIONAL_WORK"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <PlusCircle className="h-4 w-4" /> Additional Work / New Task
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Request extra work or a new task (e.g. Fit washing machine, install parts).
                </span>
              </button>
            </div>

            {/* Work Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Work Description</span>
                <span className="text-xs font-normal text-muted-foreground">
                  What needs to be done?
                </span>
              </label>
              <textarea
                value={reopenWorkDescription}
                onChange={(e) => setReopenWorkDescription(e.target.value)}
                placeholder={
                  reopenReason === "ISSUE"
                    ? "E.g., The AC stopped cooling after 2 days and is making a strange sound. Please inspect and fix."
                    : "E.g., Please also install the washing machine in the utility room and connect the inlet piping."
                }
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Money / Amount */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Offered Amount (₹)</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {reopenReason === "ISSUE"
                    ? "Enter ₹0 if covered under warranty, or offer a fee"
                    : "Proposed budget for this work"}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={reopenAmount}
                  onChange={(e) => setReopenAmount(e.target.value)}
                  placeholder={reopenReason === "ISSUE" ? "0" : "500"}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You and the professional can still negotiate this amount before work begins.
              </p>
            </div>

            {/* Dispute Escalation Notice */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                <span>Having a dispute or unresolved conflict with the professional?</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setShowReopenModal(false);
                  document
                    .getElementById("project-dispute-center")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Raise Dispute
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowReopenModal(false)}
              disabled={busy === "reopen-project"}
            >
              Cancel
            </Button>
            <Button
              disabled={busy === "reopen-project" || !reopenWorkDescription.trim()}
              onClick={async () => {
                if (!reopenWorkDescription.trim()) {
                  setReopenModalError("Please describe the work needed.");
                  return;
                }
                const numAmount = Number(reopenAmount);
                if (isNaN(numAmount) || numAmount < 0) {
                  setReopenModalError("Enter a valid amount (₹0 allowed for warranty/rework).");
                  return;
                }
                setReopenModalError(null);
                const res = await action("reopen-project", {
                  projectId: Number(projectId),
                  reason: reopenReason,
                  workDescription: reopenWorkDescription.trim(),
                  amount: numAmount,
                  duration: reopenDuration || "1-3 days",
                });
                if (res?.ok === false) {
                  setReopenModalError(res.error || "Unable to reopen project.");
                  return;
                }
                setShowReopenModal(false);
                setReopenWorkDescription("");
                setReopenAmount("");
              }}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="h-4 w-4" />
              {busy === "reopen-project" ? "Reopening…" : "Reopen & Propose Work"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Negotiate / Counter-Offer Reopen Modal */}
      <Dialog
        open={showNegotiateReopenModal}
        onOpenChange={(open) => {
          setShowNegotiateReopenModal(open);
          if (!open) setCounterReopenError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ArrowUpDown className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Negotiate Reopen Terms</DialogTitle>
                <DialogDescription>
                  Propose your revised amount and message for the reopened work.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {counterReopenError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{counterReopenError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Proposed Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={counterReopenAmount}
                  onChange={(e) => setCounterReopenAmount(e.target.value)}
                  placeholder="e.g. 800"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Estimated Timeline</label>
              <Input
                type="text"
                value={counterReopenDuration}
                onChange={(e) => setCounterReopenDuration(e.target.value)}
                placeholder="e.g. 1-2 days"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Message / Explanation</label>
              <textarea
                value={counterReopenMessage}
                onChange={(e) => setCounterReopenMessage(e.target.value)}
                placeholder="Explain why you are proposing these terms (e.g., requires additional parts, gas refill, or travel)."
                rows={3}
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowNegotiateReopenModal(false)}
              disabled={busy === "respond-reopen"}
            >
              Cancel
            </Button>
            <Button
              disabled={busy === "respond-reopen" || !counterReopenAmount.trim()}
              onClick={async () => {
                const num = Number(counterReopenAmount);
                if (isNaN(num) || num < 0) {
                  setCounterReopenError("Enter a valid amount.");
                  return;
                }
                setCounterReopenError(null);
                const res = await action("respond-reopen", {
                  projectId: Number(projectId),
                  decision: "COUNTER",
                  counterAmount: num,
                  message: counterReopenMessage.trim(),
                  duration: counterReopenDuration || "1-3 days",
                });
                if (res?.ok === false) {
                  setCounterReopenError(res.error || "Unable to send counter-offer.");
                  return;
                }
                setShowNegotiateReopenModal(false);
              }}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ArrowUpDown className="h-4 w-4" />
              {busy === "respond-reopen" ? "Sending…" : "Send Counter-Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={approvalMilestone !== null}
        onOpenChange={(open) => {
          if (!open) {
            setApprovalMilestone(null);
            setApprovalSuccess(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[min(90vh,680px)] flex flex-col p-0 overflow-hidden sm:rounded-2xl border border-border shadow-2xl">
          {approvalMilestone
            ? (() => {
                const offlinePayment = data.job?.paymentMethod === "OFFLINE";
                const isDisputeSettlement = Boolean(
                  data?.dispute &&
                  (data.dispute.milestoneId === approvalMilestone.id ||
                    !data.dispute.milestoneId) &&
                  (data.dispute.status === "OPEN" ||
                    data.dispute.status === "UNDER_REVIEW" ||
                    data.dispute.status === "WAITING_RESPONSE" ||
                    data.dispute.status === "UNDER_ADMIN_REVIEW" ||
                    data.dispute.decision === "PROFESSIONAL_WINS"),
                );
                const milestoneMoney = calculateMilestoneMoney(approvalMilestone.amount);
                const clientFee = offlinePayment ? 0 : milestoneMoney.clientFeeAmount;
                const clientCharge = offlinePayment
                  ? approvalMilestone.amount
                  : milestoneMoney.clientChargeAmount;
                const isInsufficient =
                  !offlinePayment &&
                  approvalWalletBalance !== null &&
                  approvalWalletBalance < clientCharge;
                const shortAmount = isInsufficient
                  ? Math.ceil(clientCharge - approvalWalletBalance)
                  : 0;

                if (approvalSuccess) {
                  return (
                    <div className="flex flex-col h-full">
                      <div className="border-b border-border/80 px-6 py-4 bg-muted/30">
                        <DialogTitle className="text-base font-semibold text-foreground">
                          Payment Successful
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                          Milestone settled and released to {professional}.
                        </DialogDescription>
                      </div>
                      <div className="p-6 overflow-y-auto space-y-4 text-center flex-1">
                        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/30 opacity-75" />
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 className="h-8 w-8" />
                          </div>
                        </div>

                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <Sparkles className="h-3.5 w-3.5" />
                            {offlinePayment
                              ? "Milestone Approved & Paid! 🎉"
                              : "Milestone Paid & Completed! 🎉"}
                          </span>
                          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
                            ₹{approvalSuccess.charged.toLocaleString("en-IN")}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {offlinePayment
                              ? `Marked as paid directly to ${professional}.`
                              : "Payment confirmed. Milestone completed and funds credited to professional."}
                          </p>
                        </div>

                        <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-left text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Milestone</span>
                            <span className="font-semibold text-foreground">
                              {approvalMilestone.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Professional receives</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{approvalSuccess.professionalReceives.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Platform service fee</span>
                            <span className="font-medium text-foreground">
                              ₹{clientFee.toLocaleString("en-IN")}
                            </span>
                          </div>
                          {!offlinePayment && (
                            <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                              <span className="text-muted-foreground">Remaining balance</span>
                              <span className="font-bold text-foreground">
                                ₹{approvalSuccess.remainingBalance.toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-border/80 px-6 py-3 bg-muted/20 flex justify-end">
                        <Button
                          onClick={() => {
                            setApprovalMilestone(null);
                            setApprovalSuccess(null);
                          }}
                          className="px-6 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="border-b border-border/80 px-5 py-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            isDisputeSettlement
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isDisputeSettlement ? (
                            <Gavel className="h-4 w-4" />
                          ) : (
                            <CreditCard className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                            {isDisputeSettlement
                              ? "Pay Milestone & Settle Dispute"
                              : offlinePayment
                                ? "Confirm Offline Payment"
                                : "Approve Milestone Payment"}
                          </DialogTitle>
                          <DialogDescription className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {isDisputeSettlement
                              ? `Fulfill dispute settlement and release funds to ${professional}.`
                              : offlinePayment
                                ? `Confirm direct payment made to ${professional}.`
                                : "Review wallet payment breakdown before approving."}
                          </DialogDescription>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-4 overflow-y-auto space-y-3.5 flex-1">
                      {/* Dispute Settlement Banner */}
                      {isDisputeSettlement && (
                        <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 dark:border-blue-900/60 dark:bg-blue-950/40 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                          <Gavel className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                          <div className="leading-relaxed">
                            <span className="font-bold">Dispute Settlement Payment:</span> Paying
                            this milestone fulfills the claim, releases funds to{" "}
                            <span className="font-semibold text-foreground">{professional}</span>,
                            and marks the dispute resolved.
                          </div>
                        </div>
                      )}

                      {/* Payment Breakdown Card */}
                      <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Milestone Deliverable
                            </span>
                            <h4 className="text-sm font-bold text-foreground mt-0.5">
                              {approvalMilestone.title}
                            </h4>
                          </div>
                          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold">
                            ₹{approvalMilestone.amount.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="border-t border-border/60 pt-2.5 space-y-1.5 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Milestone deliverable amount</span>
                            <span className="font-semibold text-foreground">
                              ₹{approvalMilestone.amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Client service fee {offlinePayment ? "" : "(10%)"}</span>
                            <span className="font-semibold text-foreground">
                              ₹{clientFee.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-border/60 pt-2.5 text-sm font-semibold">
                            <span className="text-foreground">
                              {offlinePayment ? "Amount paid offline" : "Total charged to wallet"}
                            </span>
                            <span className="text-base font-bold text-primary">
                              ₹{clientCharge.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Wallet Balance & Funding Status */}
                      {!offlinePayment && (
                        <div
                          className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                            isInsufficient
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-border/80 bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Wallet
                                className={`h-4 w-4 ${isInsufficient ? "text-destructive" : "text-muted-foreground"}`}
                              />
                              <span className="text-xs font-semibold text-foreground">
                                Current Wallet Balance
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-sm font-bold ${
                                  isInsufficient
                                    ? "text-destructive"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {approvalWalletBalance === null
                                  ? "Loading…"
                                  : `₹${approvalWalletBalance.toLocaleString("en-IN")}`}
                              </span>
                              <button
                                type="button"
                                title="Refresh wallet balance"
                                onClick={() => {
                                  void fetch("/api/v1/wallet", { cache: "no-store" })
                                    .then((res) => (res.ok ? res.json() : Promise.reject()))
                                    .then((w: { wallet?: { balance?: number } }) =>
                                      setApprovalWalletBalance(w.wallet?.balance ?? 0),
                                    )
                                    .catch(() => undefined);
                                }}
                                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isInsufficient ? (
                            <div className="space-y-2 border-t border-destructive/20 pt-2 text-xs">
                              <div className="flex items-center justify-between font-semibold text-destructive">
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Insufficient Wallet Balance
                                </span>
                                <span>Short by ₹{shortAmount.toLocaleString("en-IN")}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                You have ₹{approvalWalletBalance.toLocaleString("en-IN")}, but this
                                settlement requires ₹{clientCharge.toLocaleString("en-IN")}. Please
                                top up your wallet.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  window.open(
                                    `/wallet?tab=deposit&amount=${shortAmount}`,
                                    "_blank",
                                  );
                                }}
                                className="w-full h-8 text-xs font-semibold bg-cta text-cta-foreground hover:bg-cta/90 shadow-sm gap-1.5"
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                Top Up Wallet (Deposit ₹{shortAmount.toLocaleString("en-IN")})
                              </Button>
                            </div>
                          ) : (
                            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Sufficient funds available
                              </span>
                              <span>
                                Remaining after pay: ₹
                                {((approvalWalletBalance ?? 0) - clientCharge).toLocaleString(
                                  "en-IN",
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {approvalError && (
                        <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                          {approvalError}
                        </p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border/80 px-5 py-3.5 bg-muted/20 flex items-center justify-end gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setApprovalMilestone(null)}
                        className="h-9 px-4 text-xs font-semibold"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          busy === "approve-milestone" ||
                          (!offlinePayment &&
                            approvalWalletBalance !== null &&
                            approvalWalletBalance < clientCharge)
                        }
                        onClick={async () => {
                          await approveMilestoneWithPayment(approvalMilestone.id);
                        }}
                        className={`h-9 px-5 text-xs font-semibold text-white shadow-sm ${
                          isInsufficient
                            ? "bg-muted-foreground/50 hover:bg-muted-foreground/50 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {busy === "approve-milestone" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Processing…
                          </>
                        ) : isInsufficient ? (
                          "Top Up to Settle"
                        ) : isDisputeSettlement ? (
                          "Pay & Settle Dispute"
                        ) : offlinePayment ? (
                          "Approve & Pay"
                        ) : (
                          "Approve & Fund"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })()
            : null}
        </DialogContent>
      </Dialog>

      {/* Client Revision Request Dialog */}
      <Dialog
        open={Boolean(revisionMilestone)}
        onOpenChange={(open) => {
          if (!open) {
            setRevisionMilestone(null);
            setRevisionFeedback("");
            setRevisionError("");
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden sm:rounded-2xl">
          {revisionMilestone ? (
            <div>
              <DialogHeader className="p-6 pb-4 border-b bg-amber-50/60 dark:bg-amber-950/20">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    <AlertCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                      Request Milestone Revision
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Send detailed change requests back to the professional
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4">
                {/* Milestone Summary Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Milestone
                      </p>
                      <h4 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                        {revisionMilestone.title}
                      </h4>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      ₹{revisionMilestone.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Feedback Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="revision-feedback"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Feedback & required changes <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="revision-feedback"
                    value={revisionFeedback}
                    onChange={(e) => {
                      setRevisionFeedback(e.target.value);
                      if (revisionError) setRevisionError("");
                    }}
                    placeholder="Describe specifically what needs to be changed, corrected, or updated before you can approve this milestone..."
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-amber-900/40"
                    autoFocus
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Be specific to help the professional revise quickly.</span>
                    <span>{revisionFeedback.length} / 2000</span>
                  </div>
                </div>

                {revisionError && (
                  <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    {revisionError}
                  </div>
                )}
              </div>

              <DialogFooter className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submittingRevision}
                  onClick={() => {
                    setRevisionMilestone(null);
                    setRevisionFeedback("");
                    setRevisionError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={submittingRevision || !revisionFeedback.trim()}
                  onClick={async () => {
                    const trimmed = revisionFeedback.trim();
                    if (!trimmed) {
                      setRevisionError("Please enter feedback explaining the requested changes.");
                      return;
                    }
                    setSubmittingRevision(true);
                    setRevisionError("");
                    try {
                      await action("request-revision", {
                        milestoneId: revisionMilestone.id,
                        note: trimmed,
                      });
                      setRevisionMilestone(null);
                      setRevisionFeedback("");
                    } catch (err) {
                      setRevisionError(
                        err instanceof Error ? err.message : "Unable to request revision.",
                      );
                    } finally {
                      setSubmittingRevision(false);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-sm"
                >
                  <AlertCircle className="h-4 w-4" />
                  {submittingRevision ? "Sending Request…" : "Send Revision Request"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showMilestoneModal}
        onOpenChange={(open) => {
          if (!open) closeCreateMilestoneModal();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>Milestone Builder</span>
            </div>
            <DialogTitle className="text-xl font-bold mt-1">Create Project Milestones</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Add delivery milestones with clear deliverables and payments, just like in your job
              posting.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Budget Allocation Tracker */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <span className="text-muted-foreground">Project Budget Allocation</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    isMilestoneExceeded
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : isFullyAllocated
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {isMilestoneExceeded
                    ? `Exceeds available budget by ₹${(totalDraftAmount - remainingMilestoneAmount).toLocaleString("en-IN")}`
                    : isFullyAllocated
                      ? `100% Allocated (₹${totalCommittedInProject.toLocaleString("en-IN")} / ₹${totalAgreed.toLocaleString("en-IN")})`
                      : `${projectAllocationPercentage}% allocated (₹${remainingInModal.toLocaleString("en-IN")} unallocated)`}
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    isMilestoneExceeded
                      ? "bg-destructive"
                      : isFullyAllocated
                        ? "bg-emerald-500"
                        : "bg-primary"
                  }`}
                  style={{
                    width: `${projectAllocationPercentage}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>
                  Project Budget:{" "}
                  <strong className="text-foreground">
                    ₹{totalAgreed.toLocaleString("en-IN")}
                  </strong>
                </span>
                <span>
                  Available to Assign:{" "}
                  <strong
                    className={`font-bold ${remainingMilestoneAmount > 0 ? "text-primary" : "text-emerald-600"}`}
                  >
                    ₹{remainingMilestoneAmount.toLocaleString("en-IN")}
                  </strong>
                </span>
              </div>
            </div>

            {remainingMilestoneAmount === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">100% of project budget is currently allocated</p>
                  <p className="mt-0.5 text-emerald-700/90 dark:text-emerald-400/90">
                    All ₹{totalAgreed.toLocaleString("en-IN")} is allocated among your existing{" "}
                    {data.milestones.length} milestones. You can edit any existing milestone
                    directly from the Milestones tab to adjust amounts or deliverables.
                  </p>
                </div>
              </div>
            )}

            {/* Milestone Cards */}
            <div className="space-y-4">
              {draftMilestones.map((m, index) => {
                const milestoneNumber = (data?.milestones?.length ?? 0) + index + 1;
                return (
                  <div
                    key={index}
                    className="relative rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition hover:border-muted-foreground/40 space-y-3.5"
                  >
                    <div className="flex items-center justify-between gap-3 border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {milestoneNumber}
                        </span>
                        <span className="text-sm font-semibold">Milestone {milestoneNumber}</span>
                        {Number(m.amount) > 0 && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            ₹{Number(m.amount).toLocaleString("en-IN")}
                          </span>
                        )}
                        {Number(m.percentage) > 0 && (
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {m.percentage}% of project
                          </span>
                        )}
                      </div>
                      {draftMilestones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDraftMilestone(index)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove milestone"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Milestone Title <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={m.title}
                          onChange={(e) => updateDraftMilestone(index, "title", e.target.value)}
                          placeholder="e.g. Design & Planning Phase"
                          maxLength={160}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Percentage (%)
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={m.percentage}
                            onChange={(e) =>
                              updateDraftMilestone(index, "percentage", e.target.value)
                            }
                            placeholder="0"
                            className="pr-7"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Amount (₹) <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                            ₹
                          </span>
                          <Input
                            type="number"
                            min="1"
                            max={remainingMilestoneAmount}
                            value={m.amount}
                            onChange={(e) => updateDraftMilestone(index, "amount", e.target.value)}
                            placeholder="0"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Deliverables / Description (Optional)
                        </label>
                        <Input
                          value={m.description}
                          onChange={(e) =>
                            updateDraftMilestone(index, "description", e.target.value)
                          }
                          placeholder="Brief summary of deliverables for this milestone"
                          maxLength={500}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDraftMilestone}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add Milestone
                </Button>
                {remainingInModal > 0 && draftMilestones.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={autoFillRemaining}
                    className="text-xs"
                  >
                    Auto-fill remaining (₹{remainingInModal.toLocaleString("en-IN")})
                  </Button>
                )}
                {draftMilestones.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={splitDraftEvenly}
                    className="text-xs"
                  >
                    Split evenly
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => resetDraftMilestones()}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Reset
              </Button>
            </div>

            {milestoneModalError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{milestoneModalError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={closeCreateMilestoneModal}>
              Cancel
            </Button>
            <Button
              disabled={
                busy === "create-milestone" ||
                busy === "create-milestones" ||
                draftMilestones.length === 0 ||
                draftMilestones.some(
                  (m) => !m.title.trim() || !m.amount || Number(m.amount) <= 0,
                ) ||
                isMilestoneExceeded
              }
              onClick={saveDraftMilestones}
              className="gap-2"
            >
              {busy === "create-milestone" || busy === "create-milestones" ? (
                "Creating…"
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {draftMilestones.length > 1
                    ? `Create ${draftMilestones.length} Milestones`
                    : "Create Milestone"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Project Progress</DialogTitle>
            <DialogDescription>
              Adjust completion percentage and add optional status updates for the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span className="text-slate-700">Completion</span>
                <span className="text-xl font-extrabold text-indigo-600">{progress || "0"}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress || "0"}
                onChange={(e) => setProgress(e.target.value)}
                className="mt-3 w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
              />
              <div className="mt-2.5 flex items-center justify-between gap-1.5">
                {[0, 25, 50, 75, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setProgress(String(preset))}
                    className={`flex-1 rounded-lg py-1 text-xs font-bold border transition cursor-pointer ${
                      Number(progress) === preset
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Current Phase / Stage (Optional)
              </label>
              <Input
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="e.g. Cutting phase, Assembly, Final Inspection…"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Progress Update Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Brief update note on what was completed…"
                className="w-full min-h-[72px] rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowProgress(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy === "update-progress"}
              onClick={async () => {
                const value = Number(progress);
                if (isNaN(value) || value < 0 || value > 100) return;
                await action("update-progress", {
                  progress: value,
                  stage: stage.trim() || undefined,
                  note: note.trim() || undefined,
                });
                setShowProgress(false);
              }}
            >
              {busy === "update-progress" ? "Saving…" : "Save Progress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingMilestone)}
        onOpenChange={(open) => {
          if (!open) closeEditMilestoneModal();
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Edit Milestone</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Modify milestone title, budget allocation, and deliverables.
                  </DialogDescription>
                </div>
              </div>
              {editingMilestone && (
                <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground shrink-0">
                  {label(editingMilestone.status)}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Allocation summary info */}
            <div className="rounded-xl border bg-muted/30 p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground block">Project Agreed Budget</span>
                <strong className="text-foreground font-bold">
                  ₹{totalAgreed.toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block">Max Allowed for this Milestone</span>
                <strong className="text-primary font-bold">
                  ₹{editMaxAllowed.toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Milestone Title <span className="text-destructive">*</span>
                </label>
                <Input
                  value={editMilestoneTitle}
                  onChange={(e) => {
                    setEditMilestoneTitle(e.target.value);
                    setEditMilestoneError(null);
                  }}
                  placeholder="e.g. Design & Planning Phase"
                  maxLength={160}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Amount (₹) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                      ₹
                    </span>
                    <Input
                      type="number"
                      min="1"
                      max={editMaxAllowed}
                      value={editMilestoneAmount}
                      onChange={(e) => handleEditAmountChange(e.target.value)}
                      placeholder="0"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Percentage (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max={100}
                      value={editMilestonePercentage}
                      onChange={(e) => handleEditPercentageChange(e.target.value)}
                      placeholder="0"
                      className="pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Deliverables / Scope (Optional)
                </label>
                <textarea
                  value={editMilestoneDescription}
                  onChange={(e) => {
                    setEditMilestoneDescription(e.target.value);
                    setEditMilestoneError(null);
                  }}
                  placeholder="Summary of deliverables, requirements, or scope for this milestone…"
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-hidden"
                />
              </div>
            </div>

            {editMilestoneError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editMilestoneError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
            <div>
              {editingMilestone &&
                !["APPROVED", "COMPLETED", "AWAITING_CLIENT_REVIEW"].includes(
                  editingMilestone.status,
                ) &&
                !data.uploads.some((u) => u.milestoneId === editingMilestone.id) &&
                !editingMilestone.submittedAt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy === "delete-milestone"}
                    onClick={deleteCurrentMilestone}
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {busy === "delete-milestone" ? "Deleting…" : "Delete Milestone"}
                  </Button>
                )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={closeEditMilestoneModal}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  busy === "update-milestone" ||
                  !editMilestoneTitle.trim() ||
                  !editMilestoneAmount ||
                  Number(editMilestoneAmount) <= 0 ||
                  Number(editMilestoneAmount) > editMaxAllowed
                }
                onClick={saveEditMilestone}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy === "update-milestone" ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteMilestoneOpen}
        onOpenChange={setConfirmDeleteMilestoneOpen}
        title={editingMilestone ? `Delete "${editingMilestone.title}"?` : "Delete Milestone?"}
        description="Are you sure you want to delete this milestone? This cannot be undone."
        confirmLabel="Delete Milestone"
        variant="destructive"
        loading={busy === "delete-milestone"}
        onConfirm={executeDeleteMilestone}
      />

      <PageActionLoading
        active={busy !== null && busy !== "send-dispute-message"}
        title={getTrackingLoadingMeta(busy).title}
        description={getTrackingLoadingMeta(busy).description}
      />
    </AppShell>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs transition-all hover:border-primary/30 hover:shadow-soft">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-sm sm:text-base font-bold ${tone ?? "text-foreground"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
function FilePicker({
  inputId,
  files,
  setFiles,
}: {
  inputId: string;
  files: File[];
  setFiles: (files: File[]) => void;
}) {
  const addFiles = (selected: File[]) => setFiles([...files, ...selected].slice(0, 10));
  return (
    <div
      className="rounded-xl border border-dashed bg-muted/30 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        id={inputId}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.txt"
        className="sr-only"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        Choose Files
      </label>
      <span className="ml-2 text-xs text-muted-foreground">or drag and drop files here</span>
      <p className="mt-2 text-xs text-muted-foreground">
        Images, PDFs, Word, or text files (15 MB each).
      </p>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                className="text-xs font-medium text-destructive hover:underline"
                onClick={() => setFiles(files.filter((_, fileIndex) => fileIndex !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function Form({
  title,
  children,
  onSubmit,
  onCancel,
  busy,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
        {children}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={onSubmit}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
function statusHeading(status: string, milestone?: string) {
  if (status === "READY_TO_START") return "Ready to Start";
  if (status === "AWAITING_CLIENT_REVIEW") return `${milestone ?? "Milestone"} submitted`;
  if (status === "REVISION_REQUESTED") return "Revision Requested";
  if (status === "FINAL_WORK_SUBMITTED") return "Final Work Submitted";
  if (status === "AWAITING_PROFESSIONAL_CONFIRMATION") return "Awaiting Professional Confirmation";
  return label(status);
}
function statusText(
  status: string,
  isClient: boolean,
  client: string,
  professional: string,
  milestone?: string,
  feedback?: string | null,
) {
  if (status === "READY_TO_START")
    return isClient
      ? `${professional} accepted your project. Start work when you are ready.`
      : "The client has hired you. Waiting for the client to start work.";
  if (status === "AWAITING_CLIENT_REVIEW")
    return isClient
      ? `${professional} submitted ${milestone ?? "work"} for your review.`
      : "Your milestone was submitted successfully. Waiting for client review.";
  if (status === "REVISION_REQUESTED")
    return isClient
      ? "Revision has been requested. Waiting for updated work."
      : `Client feedback: ${feedback ?? "Please review the requested changes."}`;
  if (status === "FINAL_WORK_SUBMITTED")
    return isClient
      ? `${professional} submitted final work for approval.`
      : "Final work was submitted. Waiting for client approval.";
  if (status === "AWAITING_PROFESSIONAL_CONFIRMATION")
    return isClient
      ? `${professional} has been notified and must confirm project completion.`
      : "The client requested completion confirmation. Please review and confirm the project.";
  if (status === "COMPLETED") return "This project has been completed.";
  return isClient
    ? `${professional} is working on this project.`
    : `You are working on ${milestone ?? "this project"}.`;
}
