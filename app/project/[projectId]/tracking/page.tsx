"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Download,
  FileText,
  Flag,
  History,
  Info as InfoIcon,
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
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
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

type Person = { firstName: string; lastName: string } | null;
export type DraftMilestone = {
  title: string;
  amount: number | "";
  percentage: number | "";
  description: string;
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
  payment: { status: string; professionalPayoutAmount: number } | null;
};
type Event = {
  id: number;
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
  viewerRole: "CLIENT" | "PROFESSIONAL";
  milestones: Milestone[];
  uploads: Upload[];
  revisions: { note: string | null; createdAt: string }[];
  timeline: Event[];
  agreedAmount: number | null;
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
  dispute: {
    id: number;
    issueType: string;
    priority: string;
    message: string;
    status: string;
    reporterRole: string;
    createdAt: string;
  } | null;
};

const name = (p: Person, fallback: string) => (p ? `${p.firstName} ${p.lastName}` : fallback);
const label = (status: string) =>
  ({
    READY_TO_START: "Ready to Start",
    IN_PROGRESS: "In Progress",
    AWAITING_CLIENT_REVIEW: "Awaiting Client Review",
    REVISION_REQUESTED: "Revision Requested",
    FINAL_WORK_SUBMITTED: "Final Work Submitted",
    AWAITING_PROFESSIONAL_CONFIRMATION: "Awaiting Professional Confirmation",
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
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "AWAITING_CLIENT_REVIEW") return "border-purple-200 bg-purple-50 text-purple-700";
  if (status === "REVISION_REQUESTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}
function milestoneAccent(status: string) {
  if (status === "APPROVED") return "border-l-emerald-500";
  if (status === "AWAITING_CLIENT_REVIEW") return "border-l-purple-500";
  if (status === "REVISION_REQUESTED") return "border-l-red-500";
  if (status === "IN_PROGRESS") return "border-l-amber-500";
  return "border-l-border";
}
function milestoneOverdueDays(milestone: Milestone): number | null {
  if (!milestone.dueDate || milestone.status === "APPROVED") return null;
  const diffMs = Date.now() - new Date(milestone.dueDate).getTime();
  const days = Math.ceil(diffMs / 86400000);
  return days > 0 ? days : null;
}
const needsAction = (status: string) =>
  status === "REVISION_REQUESTED" ||
  status === "AWAITING_CLIENT_REVIEW" ||
  status === "FINAL_WORK_SUBMITTED" ||
  status === "AWAITING_PROFESSIONAL_CONFIRMATION";
const disputeEligibleStatuses = [
  "READY_TO_START",
  "IN_PROGRESS",
  "AWAITING_CLIENT_REVIEW",
  "REVISION_REQUESTED",
  "FINAL_WORK_SUBMITTED",
  "COMPLETED",
  "CLOSED",
];

export default function SharedProjectTrackingPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
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
  const [requestTitle, setRequestTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
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

  const action = async (
    key: string,
    payload: Record<string, unknown> = {},
    alreadyLocked = false,
  ) => {
    if (!alreadyLocked && actionInFlight.current) return;
    if (!alreadyLocked) actionInFlight.current = true;
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/portal/project-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: key, projectId: Number(projectId), ...payload }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to update project.");
      setNote("");
      setFiles([]);
      setWorkTitle("");
      setWorkNote("");
      setWorkFiles([]);
      setWorkMilestoneId("auto");
      setShowProgress(false);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update project.");
    } finally {
      setBusy(null);
      if (!alreadyLocked) actionInFlight.current = false;
    }
  };
  const actionWithFiles = async (
    key: string,
    payload: Record<string, unknown> = {},
    selectedFiles = files,
  ) => {
    if (!selectedFiles.length) return setMessage("Choose at least one file.");
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(key);
    setMessage(null);
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
      setMessage(error instanceof Error ? error.message : "Unable to store the selected files.");
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
      await refresh().catch(() => undefined);
      setApprovalWalletBalance(result?.remainingBalance ?? null);
      setApprovalSuccess({
        charged: result?.charged ?? 0,
        professionalReceives: result?.professionalReceives ?? 0,
        adminReceives: result?.adminReceives ?? 0,
        platformEarnings: result?.platformEarnings ?? 0,
        remainingBalance: result?.remainingBalance ?? 0,
      });
      return true;
    } finally {
      actionInFlight.current = false;
      setBusy(null);
    }
  }

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
  const reviewRecipient = isClient ? professional : client;
  const ownRating = isClient ? data.review?.rating : data.review?.professionalRating;
  const ownComment = isClient ? data.review?.comment : data.review?.professionalComment;
  const receivedRating = isClient ? data.review?.professionalRating : data.review?.rating;
  const receivedComment = isClient ? data.review?.professionalComment : data.review?.comment;
  const hasOwnReview = ownRating != null;
  const hasReceivedReview = receivedRating != null;
  const current = data.milestones.find((m) =>
    ["IN_PROGRESS", "REVISION_REQUESTED", "AWAITING_CLIENT_REVIEW"].includes(m.status),
  );
  const completed = data.milestones.filter((m) => m.status === "APPROVED").length;
  const remaining = data.job?.deadline
    ? Math.ceil((new Date(data.job.deadline).getTime() - Date.now()) / 86400000)
    : null;
  const canFinal =
    data.milestones.length > 0 && data.milestones.every((m) => m.status === "APPROVED");
  const totalMilestoneValue = data.milestones.reduce(
    (total, milestone) => total + milestone.amount,
    0,
  );
  const totalAgreed = Math.max(data.agreedAmount ?? 0, totalMilestoneValue);
  const unassignedMilestoneAmount = Math.max(0, totalAgreed - totalMilestoneValue);
  const remainingMilestoneAmount = unassignedMilestoneAmount;

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

      const next: DraftMilestone[] = prev.map((m) => ({ ...m }));
      const item = next[index];
      if (!item) return prev;

      const n = next.length;
      const maxTotalPct =
        totalAgreed > 0
          ? Math.min(100, Math.round((remainingMilestoneAmount / totalAgreed) * 100))
          : 100;

      if (field === "title" || field === "description") {
        item[field] = String(val);
      } else if (field === "percentage") {
        if (val === "" || val === null) {
          item.percentage = "";
          item.amount = "";
        } else {
          const isLast = index === n - 1;
          let priorSum = 0;
          if (!isLast) {
            for (let i = 0; i < index; i++) {
              const previous = next[i];
              if (previous) {
                priorSum += Math.max(1, Number(previous.percentage) || 1);
              }
            }
          }

          const targetIndices: number[] = [];
          if (!isLast) {
            for (let i = index + 1; i < n; i++) {
              targetIndices.push(i);
            }
          } else {
            for (let i = 0; i < n - 1; i++) {
              targetIndices.push(i);
            }
          }

          const k = targetIndices.length;
          const minNeededForOthers = k * 1;
          const maxAllowed = isLast
            ? Math.max(1, maxTotalPct - minNeededForOthers)
            : Math.max(1, maxTotalPct - priorSum - minNeededForOthers);
          const pct = Math.min(maxAllowed, Math.max(1, Number(val) || 1));

          item.percentage = pct;
          item.amount =
            totalAgreed > 0
              ? Math.min(remainingMilestoneAmount, Math.round((totalAgreed * pct) / 100))
              : "";

          if (n > 1) {
            const fixedSum = isLast ? pct : priorSum + pct;
            const remainingPct = Math.max(k, maxTotalPct - fixedSum);

            if (k > 0) {
              const base = Math.floor(remainingPct / k);
              const remainder = remainingPct % k;
              targetIndices.forEach((targetIdx, mIdx) => {
                const targetMilestone = next[targetIdx];
                if (!targetMilestone) return;
                const targetPct = Math.max(1, base + (mIdx < remainder ? 1 : 0));
                targetMilestone.percentage = targetPct;
                targetMilestone.amount =
                  totalAgreed > 0
                    ? Math.min(
                        remainingMilestoneAmount,
                        Math.round((totalAgreed * targetPct) / 100),
                      )
                    : "";
              });
            }
          }
        }
      } else if (field === "amount") {
        if (val === "" || val === null) {
          item.amount = "";
          item.percentage = "";
        } else {
          const isLast = index === n - 1;
          let priorAmtSum = 0;
          if (!isLast) {
            for (let i = 0; i < index; i++) {
              const previous = next[i];
              if (previous) {
                priorAmtSum += Math.max(1, Number(previous.amount) || 1);
              }
            }
          }

          const targetIndices: number[] = [];
          if (!isLast) {
            for (let i = index + 1; i < n; i++) {
              targetIndices.push(i);
            }
          } else {
            for (let i = 0; i < n - 1; i++) {
              targetIndices.push(i);
            }
          }

          const k = targetIndices.length;
          const minAmtForOthers = k * 1;
          const maxAllowedAmt = isLast
            ? Math.max(1, remainingMilestoneAmount - minAmtForOthers)
            : Math.max(1, remainingMilestoneAmount - priorAmtSum - minAmtForOthers);
          const amt = Math.min(maxAllowedAmt, Math.max(1, Number(val) || 1));

          item.amount = amt;
          const pct =
            totalAgreed > 0 ? Math.min(maxTotalPct, Math.round((amt / totalAgreed) * 100)) : "";
          item.percentage = pct;

          if (n > 1 && remainingMilestoneAmount > 0) {
            const fixedAmtSum = isLast ? amt : priorAmtSum + amt;
            const remainingAmt = Math.max(k, remainingMilestoneAmount - fixedAmtSum);

            if (k > 0) {
              const baseAmt = Math.floor(remainingAmt / k);
              const remainderAmt = remainingAmt % k;
              targetIndices.forEach((targetIdx, mIdx) => {
                const targetMilestone = next[targetIdx];
                if (!targetMilestone) return;
                const targetAmt = Math.max(1, baseAmt + (mIdx < remainderAmt ? 1 : 0));
                targetMilestone.amount = targetAmt;
                targetMilestone.percentage =
                  totalAgreed > 0
                    ? Math.min(maxTotalPct, Math.round((targetAmt / totalAgreed) * 100))
                    : "";
              });
            }
          }
        }
      }
      return next;
    });
    setMilestoneModalError(null);
  };

  const addDraftMilestone = () => {
    const nextIndex = (data?.milestones?.length ?? 0) + draftMilestones.length + 1;
    const next: DraftMilestone[] = [
      ...draftMilestones,
      {
        title: `Milestone ${nextIndex}`,
        amount: "",
        percentage: "",
        description: "",
      },
    ];
    const count = next.length;
    const baseAmt = Math.floor(remainingMilestoneAmount / count);
    const remainderAmt = remainingMilestoneAmount % count;
    setDraftMilestones(
      next.map((m, i) => {
        const amt = Math.max(1, baseAmt + (i < remainderAmt ? 1 : 0));
        const pct =
          totalAgreed > 0
            ? Math.max(1, Math.round((amt / totalAgreed) * 100))
            : Math.floor(100 / count);
        return {
          ...m,
          amount: amt,
          percentage: pct,
        };
      }),
    );
  };

  const removeDraftMilestone = (index: number) => {
    setDraftMilestones((prev) => {
      const next: DraftMilestone[] = prev.filter((_, i) => i !== index);
      if (next.length === 0) return next;
      if (next.length === 1) {
        const amt = remainingMilestoneAmount;
        const pct = totalAgreed > 0 ? Math.min(100, Math.round((amt / totalAgreed) * 100)) : 100;
        const only = next[0];
        if (!only) return next;
        return [{ ...only, amount: amt, percentage: pct }];
      }
      const currentSum = next.reduce((sum, m) => sum + Math.max(1, Number(m.amount) || 1), 0);
      const diff = remainingMilestoneAmount - currentSum;
      if (diff > 0) {
        const targetIdx = 0;
        return next.map((m, i) => {
          if (i === targetIdx) {
            const newAmt = Math.max(1, (Number(m.amount) || 1) + diff);
            const newPct =
              totalAgreed > 0 ? Math.min(100, Math.round((newAmt / totalAgreed) * 100)) : "";
            return { ...m, amount: newAmt, percentage: newPct };
          }
          return m;
        });
      }
      const count = next.length;
      const baseAmt = Math.floor(remainingMilestoneAmount / count);
      const remainderAmt = remainingMilestoneAmount % count;
      return next.map((m, i) => {
        const amt = Math.max(1, baseAmt + (i < remainderAmt ? 1 : 0));
        const pct =
          totalAgreed > 0
            ? Math.max(1, Math.round((amt / totalAgreed) * 100))
            : Math.floor(100 / count);
        return {
          ...m,
          amount: amt,
          percentage: pct,
        };
      });
    });
    setMilestoneModalError(null);
  };

  const autoFillRemaining = () => {
    const currentSum = draftMilestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    const remainingToAllocate = Math.max(0, remainingMilestoneAmount - currentSum);
    if (remainingToAllocate <= 0) return;
    setDraftMilestones((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
      if (last && (!last.amount || last.amount === 0)) {
        const next: DraftMilestone[] = [...prev];
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
      ] satisfies DraftMilestone[];
    });
  };

  const splitDraftEvenly = () => {
    if (draftMilestones.length === 0) return;
    const count = draftMilestones.length;
    const base = Math.floor(remainingMilestoneAmount / count);
    const rem = remainingMilestoneAmount % count;
    setDraftMilestones((prev) =>
      prev.map((m, i) => {
        const amt = i === 0 ? base + rem : base;
        const pct =
          totalAgreed > 0 ? Math.round((amt / totalAgreed) * 100) : Math.floor(100 / count);
        return {
          ...m,
          amount: amt,
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

  const isMilestoneCompleted = (m?: Milestone | null) => {
    if (!m) return false;
    return (
      m.status === "APPROVED" ||
      m.status === "COMPLETED" ||
      m.payment?.status === "COMPLETED" ||
      data.project.status === "COMPLETED"
    );
  };

  const otherMilestonesTotal = editingMilestone
    ? data.milestones
        .filter((m) => m.id !== editingMilestone.id)
        .reduce((sum, m) => sum + m.amount, 0)
    : 0;
  const editMaxAllowed = Math.max(0, totalAgreed - otherMilestonesTotal);

  const openEditMilestoneModal = (milestone: Milestone) => {
    if (isMilestoneCompleted(milestone)) return;
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
      const amt = Math.min(editMaxAllowed, Math.max(0, Number(val) || 0));
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
      const maxPct =
        totalAgreed > 0 ? Math.min(100, Math.floor((editMaxAllowed / totalAgreed) * 100)) : 100;
      const pct = Math.min(maxPct, Math.max(0, Number(val) || 0));
      setEditMilestonePercentage(pct);
      setEditMilestoneAmount(
        totalAgreed > 0 ? Math.min(editMaxAllowed, Math.round((totalAgreed * pct) / 100)) : "",
      );
    }
    setEditMilestoneError(null);
  };

  const saveEditMilestone = async () => {
    if (!editingMilestone) return;
    if (isMilestoneCompleted(editingMilestone)) {
      setEditMilestoneError("Completed or approved milestones cannot be edited.");
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
    if (otherMilestonesTotal + amount > totalAgreed) {
      setEditMilestoneError(
        `Total milestone amount cannot exceed project budget of ₹${totalAgreed.toLocaleString("en-IN")}. Maximum allowed for this milestone is ₹${editMaxAllowed.toLocaleString("en-IN")}.`,
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
    if (
      isMilestoneCompleted(editingMilestone) ||
      editingMilestone.status === "AWAITING_CLIENT_REVIEW"
    ) {
      setEditMilestoneError("Active, completed, or approved milestones cannot be deleted.");
      return;
    }
    if (
      !confirm(
        `Are you sure you want to delete "${editingMilestone.title}"? This cannot be undone.`,
      )
    )
      return;
    setEditMilestoneError(null);
    try {
      await action("delete-milestone", {
        milestoneId: editingMilestone.id,
      });
      closeEditMilestoneModal();
    } catch (e) {
      setEditMilestoneError(e instanceof Error ? e.message : "Failed to delete milestone.");
    }
  };
  const milestoneMinDate = dateInputValue(data.job?.jobDate);
  const milestoneMaxDate = dateInputValue(data.job?.deadline);
  const paidToProfessional = data.milestones.reduce(
    (total, milestone) =>
      total +
      (milestone.payment?.status === "COMPLETED"
        ? (milestone.payment.professionalPayoutAmount ?? 0)
        : 0),
    0,
  );
  const clientPaidMilestoneTotal = data.milestones.reduce(
    (total, milestone) =>
      total + (milestone.payment && milestone.payment.status !== "FAILED" ? milestone.amount : 0),
    0,
  );
  const completedMilestones = data.milestones.filter(
    (m) => m.status === "APPROVED" || m.payment?.status === "COMPLETED",
  );
  const remainingProjectBalance = Math.max(0, totalAgreed - clientPaidMilestoneTotal);
  const remainingClientPayment = remainingProjectBalance;
  const unpaidMilestones = data.milestones.filter(
    (milestone) => !milestone.payment || milestone.payment.status === "FAILED",
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
    if (!note.trim() || !files.length)
      return setMessage("Enter a completion note and choose at least one file.");
    void actionWithFiles("submit-milestone", { milestoneId, note });
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-6">
        {message && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {message}
          </div>
        )}

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
                {isClient ? `Professional: ${professional}` : `Client: ${client}`}
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

        <Tabs
          defaultValue={searchParams.get("tab") === "timeline" ? "timeline" : "overview"}
          className="w-full"
        >
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

                {!isClient && data.project.status !== "COMPLETED" && (
                  <Button variant="outline" onClick={() => setShowRequestModal(true)}>
                    Request client
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              {isClient &&
              data.project.status !== "COMPLETED" &&
              data.project.status !== "AWAITING_PROFESSIONAL_CONFIRMATION" ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted p-4">
                  <div>
                    <p className="font-semibold">Ready to request project completion?</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review the current project work and ask the professional to confirm
                      completion.
                    </p>
                  </div>
                  <Button
                    disabled={busy === "complete-project"}
                    onClick={() => setShowCompleteModal(true)}
                  >
                    Request completion confirmation
                  </Button>
                </div>
              ) : !isClient && data.project.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? (
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
              ) : data.project.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? (
                <div className="rounded-2xl bg-muted p-4">
                  <p className="font-semibold">Waiting for professional confirmation</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The professional has been notified and must confirm before the project is
                    completed.
                  </p>
                </div>
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
                  label="Project amount"
                  value={
                    data.agreedAmount == null
                      ? "Amount pending"
                      : `₹${data.agreedAmount.toLocaleString("en-IN")}`
                  }
                />
                <Info
                  icon={Wallet}
                  label="Total milestone value"
                  value={`₹${totalMilestoneValue.toLocaleString("en-IN")}`}
                />
                <Info
                  icon={AlertCircle}
                  label="Unassigned milestone budget"
                  value={`₹${unassignedMilestoneAmount.toLocaleString("en-IN")}`}
                  tone={unassignedMilestoneAmount > 0 ? "text-indigo-700 font-semibold" : undefined}
                />
                <Info
                  icon={CheckCircle2}
                  label="Paid to professional"
                  value={`₹${paidToProfessional.toLocaleString("en-IN")}`}
                />
                <Info
                  icon={AlertCircle}
                  label="Remaining project balance"
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

            {!isClient && canFinal && data.project.status === "IN_PROGRESS" && (
              <section className="rounded-2xl border bg-card p-5 shadow-soft">
                <h2 className="text-lg font-semibold">Final work</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  All milestones are approved. Submit final work for client approval.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <FilePicker inputId="final-work-files" files={files} setFiles={setFiles} />
                  <Button
                    onClick={() => {
                      const finalNote = prompt("Final work note")?.trim();
                      if (!finalNote || !files.length)
                        return setMessage("Enter a final note and choose files.");
                      void actionWithFiles("submit-final-work", {
                        note: finalNote,
                      });
                    }}
                  >
                    Submit Final Work
                  </Button>
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
                        if (!data.dispute) setShowDisputeForm(true);
                        document.getElementById("project-dispute")?.scrollIntoView({
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
                  <div className="rounded-xl border bg-card p-4 shadow-soft">
                    <p className="font-medium">Your review of {reviewRecipient}</p>
                    {hasOwnReview ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">{ownRating}/5</p>
                        <p className="mt-1">{ownComment || "No comment provided."}</p>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Share your feedback about working with {reviewRecipient}.
                        </p>
                        <Button className="mt-4" size="sm" onClick={() => setShowReviewForm(true)}>
                          {isClient ? "Rate professional" : "Rate client"}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl border bg-card p-4 shadow-soft">
                    <p className="font-medium">Review from {reviewRecipient}</p>
                    {hasReceivedReview ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">{receivedRating}/5</p>
                        <p className="mt-1">{receivedComment || "No comment provided."}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reviewRecipient} has not left a review yet.
                      </p>
                    )}
                    {!isClient && hasReceivedReview && !data.review?.professionalResponse && (
                      <Button
                        className="mt-4"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReviewResponseForm(true)}
                      >
                        Respond to review
                      </Button>
                    )}
                    {!isClient && data.review?.professionalResponse && (
                      <p className="mt-3 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground">
                        Your response: {data.review.professionalResponse}
                      </p>
                    )}
                  </div>
                </div>

                {showReviewForm && !hasOwnReview && (
                  <div className="mt-4 rounded-xl border bg-card p-4">
                    <div className="grid gap-3">
                      <label className="grid gap-2 text-sm font-medium">
                        Rating
                        <select
                          value={reviewRating}
                          onChange={(event) => setReviewRating(Number(event.target.value))}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Review comment
                        <textarea
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          placeholder="Share what went well, or what could be improved."
                          className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewComment("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (!reviewRating) return;
                          void action("submit-review", {
                            rating: reviewRating,
                            comment: reviewComment.trim() || null,
                          });
                          setShowReviewForm(false);
                          setReviewComment("");
                        }}
                      >
                        Save rating & review
                      </Button>
                    </div>
                  </div>
                )}

                {showReviewResponseForm &&
                  !isClient &&
                  data.review &&
                  hasReceivedReview &&
                  !data.review.professionalResponse && (
                    <div className="mt-4 rounded-xl border bg-card p-4">
                      <label className="grid gap-2 text-sm font-medium">
                        Response to client review
                        <textarea
                          value={reviewResponse}
                          onChange={(event) => setReviewResponse(event.target.value)}
                          placeholder="Thank the client or add helpful context."
                          className="min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowReviewResponseForm(false);
                            setReviewResponse("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (!reviewResponse.trim()) return;
                            void action("respond-to-review", { response: reviewResponse.trim() });
                            setShowReviewResponseForm(false);
                            setReviewResponse("");
                          }}
                        >
                          Save response
                        </Button>
                      </div>
                    </div>
                  )}
              </section>
            )}

            {disputeEligibleStatuses.includes(data.project.status) && (
              <section
                id="project-dispute"
                className="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-soft"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Report issue / Raise dispute</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.dispute
                        ? `${data.dispute.issueType} · ${data.dispute.status}`
                        : "Escalate any unresolved payment, quality, or delivery issue."}
                    </p>
                    {data.dispute && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Raised by{" "}
                        {(data.dispute.reporterRole === "CLIENT") === isClient
                          ? "you"
                          : data.dispute.reporterRole === "CLIENT"
                            ? "the client"
                            : "the professional"}
                      </p>
                    )}
                  </div>
                  {!data.dispute && data.project.status !== "COMPLETED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisputeForm((value) => !value)}
                    >
                      {showDisputeForm
                        ? "Hide report / dispute form"
                        : "Report issue / Raise dispute"}
                    </Button>
                  )}
                </div>

                {showDisputeForm && !data.dispute && (
                  <div className="mt-4 rounded-xl border bg-card p-4">
                    <div className="grid gap-3">
                      <label className="grid gap-2 text-sm font-medium">
                        Issue type
                        <select
                          value={disputeType}
                          onChange={(event) => setDisputeType(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="PAYMENT">Payment</option>
                          <option value="QUALITY">Quality</option>
                          <option value="COMMUNICATION">Communication</option>
                          <option value="DELIVERY">Delivery</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Priority
                        <select
                          value={disputePriority}
                          onChange={(event) => setDisputePriority(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Message
                        <textarea
                          value={disputeMessage}
                          onChange={(event) => setDisputeMessage(event.target.value)}
                          placeholder="Describe the issue clearly and include any relevant context."
                          className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDisputeForm(false);
                          setDisputeMessage("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (!disputeMessage.trim()) return setMessage("Add a dispute message.");
                          void action("submit-dispute", {
                            issueType: disputeType,
                            priority: disputePriority,
                            message: disputeMessage.trim(),
                          });
                          setShowDisputeForm(false);
                          setDisputeMessage("");
                        }}
                      >
                        Raise dispute
                      </Button>
                    </div>
                  </div>
                )}
                {data.dispute && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-wide text-amber-800">
                      <span>Issue: {data.dispute.issueType.replaceAll("_", " ")}</span>
                      <span>Priority: {data.dispute.priority}</span>
                      <span>Status: {data.dispute.status}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-foreground">
                      {data.dispute.message}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Submitted {date(data.dispute.createdAt)}. The admin dispute team can review
                      this case.
                    </p>
                  </div>
                )}
              </section>
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
                    <span className="font-bold text-foreground">
                      {Math.round((completed / (data.milestones.length || 1)) * 100)}% Completed
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full items-center gap-1.5 rounded-full bg-muted/40 p-0.5">
                    {data.milestones.map((milestone, index) => {
                      const filled = milestone?.status === "APPROVED";
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
                  const pct = totalAgreed > 0 ? Math.round((m.amount / totalAgreed) * 100) : 0;
                  const isApproved = m.status === "APPROVED";
                  const isAwaitingReview = m.status === "AWAITING_CLIENT_REVIEW";
                  const isRevision = m.status === "REVISION_REQUESTED";
                  const isInProgress = m.status === "IN_PROGRESS";

                  return (
                    <div
                      key={m.id}
                      className={`relative rounded-2xl border bg-card p-5 sm:p-6 shadow-xs transition-all hover:shadow-soft space-y-4 ${
                        isApproved
                          ? "border-emerald-500/30 hover:border-emerald-500/50"
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
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
                                ₹{m.amount.toLocaleString("en-IN")}
                              </span>
                              {pct > 0 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  {pct}% of project
                                </span>
                              )}
                            </div>
                            {m.payment && (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                                <span>
                                  Payout:{" "}
                                  <strong className="text-foreground font-semibold">
                                    {m.payment.status === "COMPLETED"
                                      ? "Paid Out"
                                      : m.payment.status}
                                  </strong>
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Edit */}
                        <div className="flex h-fit flex-wrap items-center gap-2">
                          {isClient && !isMilestoneCompleted(m) && (
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
                            {isAwaitingReview && <Sparkles className="h-3.5 w-3.5" />}
                            {isRevision && <AlertCircle className="h-3.5 w-3.5" />}
                            {isInProgress && <Clock3 className="h-3.5 w-3.5" />}
                            {!isApproved && !isAwaitingReview && !isRevision && !isInProgress && (
                              <Layers className="h-3.5 w-3.5" />
                            )}
                            {label(m.status)}
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

                      {/* Uploads history */}
                      {milestoneUploads.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {milestoneUploads.map((upload) => {
                            const uploadFiles = uploadAttachments(upload);
                            return (
                              <div
                                key={upload.id}
                                className="rounded-xl border border-border/80 bg-muted/20 p-3.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
                                    <Upload className="h-3.5 w-3.5 text-primary" />
                                    {upload.roundNumber > 1
                                      ? `Revised Deliverable (Round ${upload.roundNumber})`
                                      : "Milestone Deliverable Submitted"}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    {date(upload.createdAt)}
                                  </span>
                                </div>
                                {upload.note && (
                                  <p className="mt-1.5 text-sm text-foreground">{upload.note}</p>
                                )}
                                {uploadFiles.length > 0 && (
                                  <div className="mt-2.5 flex flex-wrap gap-2">
                                    {uploadFiles.map((file) => (
                                      <Button
                                        key={file.id}
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-8 gap-1.5 text-xs"
                                      >
                                        <a href={file.url} target="_blank" rel="noreferrer">
                                          <FileText className="h-3.5 w-3.5" />
                                          {file.name}
                                        </a>
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Revision Feedback */}
                      {m.status === "REVISION_REQUESTED" && data.revisions[0] && (
                        <div className="rounded-xl border border-rose-300/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 text-rose-900 dark:text-rose-200">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4 text-rose-600" />
                              Revision Requested by Client
                            </p>
                            <span className="text-xs text-rose-700/75 dark:text-rose-300/75">
                              {date(data.revisions[0].createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed">
                            {data.revisions[0].note ||
                              "Please review the requested changes and submit your revised deliverables."}
                          </p>
                        </div>
                      )}

                      {/* Actions: Professional Submit */}
                      {!isClient && ["IN_PROGRESS", "REVISION_REQUESTED"].includes(m.status) && (
                        <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center gap-2">
                          <FilePicker
                            inputId={`milestone-${m.id}-files`}
                            files={files}
                            setFiles={setFiles}
                          />
                          <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Deliverable note or comment for client"
                            className="flex-1"
                          />
                          <Button
                            disabled={busy === "submit-milestone"}
                            onClick={() => submit(m.id)}
                            className="gap-1.5 shrink-0"
                          >
                            <Upload className="h-4 w-4" />
                            {busy === "submit-milestone" ? "Submitting…" : "Request Payment"}
                          </Button>
                        </div>
                      )}

                      {/* Actions: Client Review */}
                      {isClient && m.status === "AWAITING_CLIENT_REVIEW" && (
                        <div className="pt-2 border-t flex flex-wrap gap-2.5">
                          <Button
                            disabled={busy === "approve-milestone"}
                            onClick={() => setApprovalMilestone(m)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve & Pay (₹{m.amount.toLocaleString("en-IN")})
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              const feedback = prompt(
                                "Enter revision feedback for professional:",
                              )?.trim();
                              if (feedback)
                                void action("request-revision", {
                                  milestoneId: m.id,
                                  note: feedback,
                                });
                            }}
                            className="gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200"
                          >
                            <AlertCircle className="h-4 w-4" />
                            Request Revision
                          </Button>
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
            {!isClient && ["IN_PROGRESS", "REVISION_REQUESTED"].includes(data.project.status) && (
              <section className="rounded-2xl border bg-card p-5 shadow-soft">
                <div>
                  <h2 className="text-lg font-semibold">Upload Work</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Share ongoing work and files with the client. This does not submit a milestone.
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
                        return setMessage("Enter a work title and choose at least one file.");
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
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <h2 className="text-xl font-semibold">Project timeline</h2>
              <ol className="mt-5 space-y-5 border-l border-primary/30 pl-6">
                {data.timeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className={`absolute -left-[1.95rem] top-1 size-3 rounded-full ring-4 ring-card ${
                        event.actorRole === "CLIENT" ? "bg-cta" : "bg-primary"
                      }`}
                    />
                    <p className="font-semibold">
                      {event.title}
                      {event.progress != null ? ` — ${event.progress}%` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                    {event.stage && <p className="mt-1 text-sm">Stage: {event.stage}</p>}
                    {attachments(event).length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
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
                    <p className="mt-2 text-xs text-muted-foreground">
                      {event.actorRole === "CLIENT" ? client : professional} ·{" "}
                      {event.actorRole === "CLIENT" ? "Client" : "Professional"} ·{" "}
                      {date(event.createdAt)}
                    </p>
                  </li>
                ))}
                {data.timeline.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
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
            <DialogTitle>Request completion confirmation?</DialogTitle>
            <DialogDescription>
              This will notify the professional to review the final work and confirm completion. The
              project will not be completed until they confirm it.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-amber-800/70">Milestone total</p>
                <p className="font-semibold">INR {totalMilestoneValue.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-amber-800/70">Paid by client</p>
                <p className="font-semibold">₹{clientPaidMilestoneTotal.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-amber-800/70">Paid to professional</p>
                <p className="font-semibold">₹{paidToProfessional.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-amber-800/70">Unpaid milestones</p>
                <p className="font-semibold">₹{remainingClientPayment.toLocaleString("en-IN")}</p>
              </div>
            </div>
            {unpaidMilestones.length > 0 ? (
              <div className="mt-3 border-t border-amber-200 pt-3">
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
              <p className="mt-3 border-t border-amber-200 pt-3 text-emerald-700">
                All milestones are funded by the client.
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
            >
              {busy === "complete-project"
                ? "Sending request…"
                : remainingClientPayment > 0
                  ? "Send request with remaining amount"
                  : "Send completion request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={approvalMilestone !== null}
        onOpenChange={(open) => {
          if (!open) setApprovalMilestone(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {data.job?.paymentMethod === "OFFLINE"
                ? "Confirm offline payment"
                : "Approve milestone payment"}
            </DialogTitle>
            <DialogDescription>
              {data.job?.paymentMethod === "OFFLINE"
                ? "Confirm that you paid the professional directly for this milestone."
                : "Review the wallet payment breakdown before approving this milestone."}
            </DialogDescription>
          </DialogHeader>
          {approvalMilestone ? (
            <div className="mt-4 space-y-3">
              {(() => {
                const offlinePayment = data.job?.paymentMethod === "OFFLINE";
                const clientFee = offlinePayment ? 0 : Math.ceil(approvalMilestone.amount * 0.1);
                const clientCharge = offlinePayment
                  ? approvalMilestone.amount
                  : approvalMilestone.amount + clientFee;
                return (
                  <>
                    {approvalSuccess ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-success/10 p-4">
                          <p className="text-sm font-semibold text-success">Payment completed</p>
                          <p className="mt-1 text-2xl font-bold">
                            ₹{approvalSuccess.charged.toLocaleString("en-IN")} charged
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {offlinePayment
                              ? "Offline payment recorded. The professional was marked as paid."
                              : "Client payment received. Professional payout is waiting for admin approval."}
                          </p>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border p-4 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Professional payout pending
                            </span>
                            <span className="font-semibold text-success">
                              ₹{approvalSuccess.professionalReceives.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              {offlinePayment ? "Platform earnings" : "Admin wallet receives"}
                            </span>
                            <span className="font-semibold">
                              ₹{approvalSuccess.adminReceives.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              Platform earnings after payout
                            </span>
                            <span className="font-semibold">
                              ₹{approvalSuccess.platformEarnings.toLocaleString("en-IN")}
                            </span>
                          </div>
                          {!offlinePayment && (
                            <div className="flex justify-between gap-4 border-t border-border pt-3">
                              <span className="font-semibold">Wallet balance after payment</span>
                              <span className="font-bold text-primary">
                                ₹{approvalSuccess.remainingBalance.toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="pt-2">
                          <Button onClick={() => setApprovalMilestone(null)}>Done</Button>
                        </DialogFooter>
                      </div>
                    ) : null}
                    {!approvalSuccess ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-primary/5 p-4">
                          <p className="text-sm text-muted-foreground">{approvalMilestone.title}</p>
                          <p className="mt-1 text-2xl font-bold">
                            ₹{approvalMilestone.amount.toLocaleString("en-IN")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">Milestone value</p>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border p-4 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Milestone amount</span>
                            <span className="font-semibold">
                              ₹{approvalMilestone.amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                              {offlinePayment ? "Payment method" : "Client wallet fee (10%)"}
                            </span>
                            <span className="font-semibold">
                              +₹{clientFee.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 border-t border-border pt-3">
                            <span className="font-semibold">
                              {offlinePayment ? "Amount paid offline" : "Client wallet debit"}
                            </span>
                            <span className="font-bold text-primary">
                              ₹{clientCharge.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                        {offlinePayment ? null : (
                          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                            Approval will debit ₹{clientCharge.toLocaleString("en-IN")} from your
                            wallet. Make sure your wallet has enough balance.
                          </p>
                        )}
                        {!offlinePayment && (
                          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">Current wallet balance</span>
                            <span
                              className={`font-bold ${approvalWalletBalance !== null && approvalWalletBalance < clientCharge ? "text-destructive" : "text-success"}`}
                            >
                              {approvalWalletBalance === null
                                ? "Loading…"
                                : `₹${approvalWalletBalance.toLocaleString("en-IN")}`}
                            </span>
                          </div>
                        )}
                        {approvalError ? (
                          <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                            {approvalError}
                          </p>
                        ) : null}
                        <DialogFooter className="pt-2">
                          <Button variant="outline" onClick={() => setApprovalMilestone(null)}>
                            Cancel
                          </Button>
                          <Button
                            disabled={
                              busy === "approve-milestone" ||
                              (!offlinePayment &&
                                approvalWalletBalance !== null &&
                                approvalWalletBalance < clientCharge)
                            }
                            onClick={async () => {
                              await approveMilestoneWithPayment(approvalMilestone.id);
                            }}
                          >
                            {busy === "approve-milestone" ? "Processing…" : "Approve & pay"}
                          </Button>
                        </DialogFooter>
                      </div>
                    ) : null}
                  </>
                );
              })()}
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

            {remainingMilestoneAmount > 0 && draftMilestones.length > 0 && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Milestone Rule: Minimum 1% per milestone (no 0% or empty space)
                  </p>
                  <p>
                    Every milestone must be set to at least <strong>1%</strong>. When you adjust one
                    milestone, the remaining budget is automatically split evenly across the other
                    milestones without exceeding the project total.
                  </p>
                  {draftMilestones.length === 3 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With 3 milestones, the maximum for any single milestone is{" "}
                      <strong>98%</strong> (so the other 2 each have at least 1%). If you want to
                      allocate <strong>99%</strong> to the first milestone, delete the 3rd milestone
                      so only 2 milestones remain (e.g. 99% and 1%).
                    </p>
                  )}
                  {draftMilestones.length > 3 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With {draftMilestones.length} milestones, the maximum for any single
                      milestone is <strong>{100 - (draftMilestones.length - 1)}%</strong> so
                      remaining milestones each have at least 1%. To assign a higher percentage
                      (e.g. 99%), delete extra milestones.
                    </p>
                  )}
                  {draftMilestones.length === 2 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With 2 milestones, you can assign up to <strong>99%</strong> to the
                      first milestone, and the second milestone automatically becomes{" "}
                      <strong>1%</strong>.
                    </p>
                  )}
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
                            onBlur={() => {
                              if (!m.percentage || Number(m.percentage) < 1) {
                                updateDraftMilestone(index, "percentage", 1);
                              }
                            }}
                            placeholder="1"
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
                            onBlur={() => {
                              if (!m.amount || Number(m.amount) < 1) {
                                updateDraftMilestone(index, "amount", 1);
                              }
                            }}
                            placeholder="1"
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

            {isMilestoneCompleted(editingMilestone) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>This milestone has been completed or approved and cannot be modified.</span>
              </div>
            )}

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
                !isMilestoneCompleted(editingMilestone) &&
                editingMilestone.status !== "AWAITING_CLIENT_REVIEW" && (
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
                  isMilestoneCompleted(editingMilestone) ||
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
