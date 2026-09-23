"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Paperclip,
  AlertTriangle,
  Search,
  Star,
  CheckCircle2,
  ArrowUpDown,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  Inbox,
  RotateCcw,
  Wrench,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageActionLoading } from "@/components/PageActionLoading";
import { usePortalTitle } from "@/components/PortalShell";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarketplaceJob } from "@/lib/types/marketplace";
import type {
  ProfessionalDiscoveryResponse,
  ProfessionalDiscoveryResult,
} from "@/lib/types/professional-discovery";

export type JobMilestoneView = {
  id?: number;
  title: string;
  percentage: number;
  amount?: number | null;
  description?: string | null;
};

type OwnerJob = {
  id: number;
  title: string | null;
  description: string | null;
  category: string | null;
  mainCategory: string | null;
  categorySegment: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  workMode: "ON_SITE" | "REMOTE" | "BOTH";
  locationLabel: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  jobDate: string | null;
  deadline: string | null;
  timingType: "FIXED" | "HOURLY";
  hourlyRate: number | null;
  totalJobHours: number | null;
  projectId: number | null;
  projectStatus?: string | null;
  previousProfessional?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    professionalCategory?: string | null;
  } | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
  createdAt: string;
  attachments: {
    id: number;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    previewUrl: string | null;
  }[];
  milestones?: JobMilestoneView[];
};

type ViewJob = {
  title: string;
  description: string;
  category: string;
  mainCategory: string | null;
  categorySegment: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  workMode: "ON_SITE" | "REMOTE" | "BOTH";
  location: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  jobDate: string | null;
  deadline: string | null;
  timingType: "FIXED" | "HOURLY";
  hourlyRate: number | null;
  totalJobHours: number | null;
  projectId?: number | null;
  projectStatus?: string | null;
  previousProfessional?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    professionalCategory?: string | null;
  } | null;
  createdAt: string;
  status?: "DRAFT" | "OPEN" | "CLOSED";
  proposalCount?: number;
  client?: {
    id?: number;
    name: string;
    avatar: string | null;
    rating: number;
    reviewCount?: number;
    reviewsList?: Array<{
      id: number;
      rating: number;
      comment: string | null;
      createdAt: string;
      reviewerName: string;
      reviewerAvatar?: string | null;
      projectTitle?: string | null;
      reviewerCategory?: string | null;
    }>;
  };
  attachments: {
    id: number;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    previewUrl: string | null;
  }[];
  milestones?: JobMilestoneView[];
};
type JobProposal = {
  id: number;
  professionalId: number;
  bidAmount: number;
  hourlyRate?: number | null;
  totalJobHours?: number | null;
  duration: string;
  coverLetter: string;
  status: string;
  lastActorRole: "CLIENT" | "PROFESSIONAL";
  createdAt: string;
  previous?: {
    bidAmount: number | null;
    hourlyRate?: number | null;
    totalJobHours?: number | null;
    duration: string | null;
    message: string | null;
  } | null;
  professional: {
    id: number;
    firstName: string;
    lastName: string;
    professionalCategory: string | null;
    professionalCity: string | null;
    averageRating: number;
    reviewCount: number;
    isVerified: boolean;
    avatarUrl?: string | null;
  } | null;
  projectId?: number | null;
};
type JobHireRequest = JobProposal;

function JobShell({
  children,
  viewerRole,
  embedded = false,
}: {
  children: React.ReactNode;
  viewerRole: "CLIENT" | "PROFESSIONAL" | null;
  embedded?: boolean;
}) {
  const { isInsidePortal } = usePortalTitle();
  if (embedded || isInsidePortal) return <>{children}</>;
  if (viewerRole) return <AppShell>{children}</AppShell>;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function fromMarketplace(job: MarketplaceJob): ViewJob {
  return {
    ...job,
    mainCategory: null,
    categorySegment: null,
    locationLat: job.locationLat,
    locationLng: job.locationLng,
    proposalCount: job.proposalCount,
    client: job.client,
    attachments: job.attachments,
    milestones: job.milestones,
  };
}

function fromOwner(job: OwnerJob): ViewJob {
  return {
    title: job.title ?? "Untitled job",
    description: job.description ?? "",
    category: job.category ?? "Uncategorized",
    mainCategory: null,
    categorySegment: job.categorySegment,
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    urgency: job.urgency,
    workMode: job.workMode,
    location: job.locationLabel,
    locationAddress: job.locationAddress,
    locationLat: job.locationLat,
    locationLng: job.locationLng,
    jobDate: job.jobDate,
    deadline: job.deadline,
    timingType: job.timingType,
    hourlyRate: job.hourlyRate,
    totalJobHours: job.totalJobHours,
    projectId: job.projectId,
    projectStatus: job.projectStatus,
    previousProfessional: job.previousProfessional,
    createdAt: job.createdAt,
    status: job.status,
    attachments: job.attachments,
    milestones: job.milestones,
  };
}

function formatBudget(job: ViewJob) {
  if (job.timingType === "HOURLY" && job.hourlyRate !== null) {
    return job.totalJobHours
      ? `₹${job.hourlyRate.toLocaleString()}/hr × ${job.totalJobHours} hours = ₹${(job.hourlyRate * job.totalJobHours).toLocaleString()}`
      : `₹${job.hourlyRate.toLocaleString()}/hr`;
  }
  return job.budgetMin === null && job.budgetMax === null
    ? "Budget on request"
    : `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`;
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  return diffMs <= 0 ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JobDetails({
  embedded = false,
  initialViewerRole = null,
}: {
  embedded?: boolean;
  initialViewerRole?: "CLIENT" | "PROFESSIONAL" | null;
} = {}) {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ViewJob | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [finderOpen, setFinderOpen] = useState(false);
  const [professionals, setProfessionals] = useState<ProfessionalDiscoveryResult[]>([]);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderStatus, setFinderStatus] = useState<"idle" | "loading" | "error">("idle");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [hireTarget, setHireTarget] = useState<ProfessionalDiscoveryResult | null>(null);
  const [hireBidAmount, setHireBidAmount] = useState("");
  const [hireDuration, setHireDuration] = useState("1 week");
  const [hireCoverLetter, setHireCoverLetter] = useState("");
  const [hireBusy, setHireBusy] = useState(false);
  const [hireMessage, setHireMessage] = useState<string | null>(null);
  const [hireMessageStatus, setHireMessageStatus] = useState<"idle" | "error" | "success">("idle");
  const [viewerRole, setViewerRole] = useState<"CLIENT" | "PROFESSIONAL" | null>(initialViewerRole);
  const [ownProposal, setOwnProposal] = useState<{
    id: number;
    status: string;
    bidAmount: number;
    hourlyRate?: number | null;
    totalJobHours?: number | null;
    duration: string;
    coverLetter: string;
    lastActorRole: "CLIENT" | "PROFESSIONAL";
    origin?: string;
    previousBidAmount?: number | null;
    previousHourlyRate?: number | null;
    previousTotalJobHours?: number | null;
    previousDuration?: string | null;
    previousMessage?: string | null;
  } | null>(null);
  const [ownProposalProjectId, setOwnProposalProjectId] = useState<number | null>(null);
  const [clientProposals, setClientProposals] = useState<JobProposal[]>([]);
  const [sentHireRequests, setSentHireRequests] = useState<JobHireRequest[]>([]);
  const [proposalsTab, setProposalsTab] = useState<"PROPOSALS" | "HIRE_REQUESTS">("PROPOSALS");
  const [proposalSearchQuery, setProposalSearchQuery] = useState("");
  const [proposalStatusFilter, setProposalStatusFilter] = useState<
    "ALL" | "PENDING" | "ACCEPTED" | "REJECTED"
  >("ALL");
  const [proposalSortBy, setProposalSortBy] = useState<
    "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING_DESC"
  >("NEWEST");
  const [proposalPage, setProposalPage] = useState(1);
  const [expandedProposalIds, setExpandedProposalIds] = useState<Set<number>>(new Set());
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalPrice, setProposalPrice] = useState("");
  const [proposalHourlyRate, setProposalHourlyRate] = useState("");
  const [proposalTotalJobHours, setProposalTotalJobHours] = useState("");
  const [proposalDuration, setProposalDuration] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [acceptedProjectId, setAcceptedProjectId] = useState<number | null>(null);
  const [pendingAcceptProposal, setPendingAcceptProposal] = useState<JobProposal | null>(null);
  type NegotiationKind = "clientProposal" | "sentHireRequest" | "ownProposal";
  const [negotiateTarget, setNegotiateTarget] = useState<{
    kind: NegotiationKind;
    id: number;
    lastBidAmount?: number;
    lastHourlyRate?: number | null;
    lastTotalJobHours?: number | null;
    lastDuration?: string;
  } | null>(null);
  const [negotiatePrice, setNegotiatePrice] = useState("");
  const [negotiateHourlyRate, setNegotiateHourlyRate] = useState("");
  const [negotiateTotalJobHours, setNegotiateTotalJobHours] = useState("");
  const [negotiateDuration, setNegotiateDuration] = useState("");
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const [negotiateBusy, setNegotiateBusy] = useState(false);
  const [negotiateError, setNegotiateError] = useState<string | null>(null);
  const [closeJobConfirmOpen, setCloseJobConfirmOpen] = useState(false);
  const [reopenJobConfirmOpen, setReopenJobConfirmOpen] = useState(false);
  const [reopenWorkDescription, setReopenWorkDescription] = useState("");
  const [reopenAmount, setReopenAmount] = useState("");
  const [reopenReason, setReopenReason] = useState<"ISSUE" | "ADDITIONAL_WORK">("ADDITIONAL_WORK");
  const [reopenAssignPreviousPro, setReopenAssignPreviousPro] = useState(true);
  const [reopenDuration, setReopenDuration] = useState("1-3 days");
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  async function handleCloseJob() {
    setStatusBusy(true);
    try {
      const response = await fetch(`/api/v1/client/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error || "Unable to close job.");
        return;
      }
      const { job: updatedJob } = await response.json();
      setJob(fromOwner(updatedJob));
      setCloseJobConfirmOpen(false);
      toast.success("Job closed successfully.");
    } catch {
      toast.error("Unable to close job.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleReopenJob() {
    if (!reopenWorkDescription.trim()) {
      setReopenError("Please describe the work needed.");
      return;
    }
    const numAmount = Number(reopenAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      setReopenError("Enter a valid amount (₹0 allowed for warranty/rework).");
      return;
    }
    setStatusBusy(true);
    setReopenError(null);
    try {
      const response = await fetch(`/api/v1/client/jobs/${jobId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDescription: reopenWorkDescription.trim(),
          amount: numAmount,
          reason: reopenReason,
          assignPreviousPro: reopenAssignPreviousPro,
          duration: reopenDuration || "1-3 days",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setReopenError(data?.error || "Unable to reopen job.");
        return;
      }
      toast.success(data?.message || "Job reopened successfully with new work allocated.");
      setReopenJobConfirmOpen(false);
      setReopenWorkDescription("");
      setReopenAmount("");
      await refresh();
    } catch {
      setReopenError("Unable to reopen job.");
    } finally {
      setStatusBusy(false);
    }
  }
  const refresh = useCallback(async () => {
    try {
      const authResponse = await fetch("/api/v1/auth/me");
      const auth = (await authResponse.json().catch(() => null)) as {
        user?: { role?: "CLIENT" | "PROFESSIONAL" } | null;
      } | null;
      setViewerRole(auth?.user?.role ?? null);
      const projectResponse = await fetch(
        `/api/v1/portal/project?jobId=${encodeURIComponent(jobId)}`,
      );
      if (projectResponse.ok) {
        const projectData = (await projectResponse.json()) as { project?: { id?: number } };
        if (projectData.project?.id) {
          setAcceptedProjectId(projectData.project.id);
        }
      }
      const ownerResponse = await fetch(`/api/v1/client/jobs/${encodeURIComponent(jobId)}`);
      if (ownerResponse.ok) {
        const {
          job: ownerJob,
          proposals,
          hireRequests,
        } = (await ownerResponse.json()) as {
          job: OwnerJob;
          proposals: JobProposal[];
          hireRequests: JobHireRequest[];
        };
        setJob(fromOwner(ownerJob));
        setClientProposals(proposals ?? []);
        setSentHireRequests(hireRequests ?? []);
        setStatus("ready");
        return;
      }
      if (ownerResponse.status !== 404) throw new Error("Unable to load job");

      const response = await fetch(`/api/v1/marketplace/job?id=${encodeURIComponent(jobId)}`);
      if (!response.ok) {
        if (response.status === 404) return setStatus("missing");
        throw new Error("Unable to load job");
      }
      const marketplaceJob = fromMarketplace((await response.json()) as MarketplaceJob);
      marketplaceJob.status = marketplaceJob.status ?? "OPEN";
      if (auth?.user?.role === "PROFESSIONAL") {
        const proposalResponse = await fetch(
          `/api/v1/professional/proposals?jobId=${encodeURIComponent(jobId)}`,
        );
        if (proposalResponse.ok) {
          const proposalData = (await proposalResponse.json()) as {
            proposal: {
              id: number;
              status: string;
              bidAmount: number;
              hourlyRate?: number | null;
              totalJobHours?: number | null;
              duration: string;
              coverLetter: string;
              lastActorRole: "CLIENT" | "PROFESSIONAL";
              origin?: string;
              previousBidAmount?: number | null;
              previousHourlyRate?: number | null;
              previousTotalJobHours?: number | null;
              previousDuration?: string | null;
              previousMessage?: string | null;
            } | null;
            negotiation?: {
              senderRole: string;
              previousBidAmount: number | null;
              previousHourlyRate?: number | null;
              previousTotalJobHours?: number | null;
              previousDuration: string | null;
              previousMessage: string | null;
            } | null;
            projectId?: number | null;
          };
          setOwnProposal(
            proposalData.proposal
              ? {
                  ...proposalData.proposal,
                  previousBidAmount: proposalData.negotiation?.previousBidAmount,
                  previousHourlyRate: proposalData.negotiation?.previousHourlyRate,
                  previousTotalJobHours: proposalData.negotiation?.previousTotalJobHours,
                  previousDuration: proposalData.negotiation?.previousDuration,
                  previousMessage: proposalData.negotiation?.previousMessage,
                }
              : null,
          );
          if (proposalData.projectId) {
            setOwnProposalProjectId(proposalData.projectId);
          }
          if (proposalData.proposal) {
            setProposalPrice(String(proposalData.proposal.bidAmount));
            setProposalHourlyRate(String(proposalData.proposal.hourlyRate ?? ""));
            setProposalTotalJobHours(String(proposalData.proposal.totalJobHours ?? ""));
            setProposalDuration(proposalData.proposal.duration);
            setProposalMessage(proposalData.proposal.coverLetter);
          }
        }
      }
      setJob(marketplaceJob);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function toggleProposalExpanded(id: number) {
    setExpandedProposalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const effectiveProjectId = job?.projectId ?? acceptedProjectId ?? ownProposalProjectId ?? null;
  const activeList = proposalsTab === "PROPOSALS" ? clientProposals : sentHireRequests;

  const proposalCounts = useMemo(() => {
    const total = activeList.length;
    const pending = activeList.filter((p) => p.status === "PENDING").length;
    const accepted = activeList.filter((p) => p.status === "ACCEPTED").length;
    const rejected = activeList.filter((p) => p.status === "REJECTED").length;
    return { total, pending, accepted, rejected };
  }, [activeList]);

  const filteredAndSortedProposals = useMemo(() => {
    let result = [...activeList];

    if (proposalStatusFilter !== "ALL") {
      result = result.filter((p) => p.status === proposalStatusFilter);
    }

    const q = proposalSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const name =
          `${p.professional?.firstName ?? ""} ${p.professional?.lastName ?? ""}`.toLowerCase();
        const category = (p.professional?.professionalCategory ?? "").toLowerCase();
        const city = (p.professional?.professionalCity ?? "").toLowerCase();
        const letter = (p.coverLetter ?? "").toLowerCase();
        return name.includes(q) || category.includes(q) || city.includes(q) || letter.includes(q);
      });
    }

    result.sort((a, b) => {
      if (proposalSortBy === "PRICE_ASC") {
        return a.bidAmount - b.bidAmount;
      }
      if (proposalSortBy === "PRICE_DESC") {
        return b.bidAmount - a.bidAmount;
      }
      if (proposalSortBy === "RATING_DESC") {
        const rA = a.professional?.averageRating ?? 0;
        const rB = b.professional?.averageRating ?? 0;
        return rB - rA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [activeList, proposalStatusFilter, proposalSearchQuery, proposalSortBy]);

  const PROPOSALS_PER_PAGE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedProposals.length / PROPOSALS_PER_PAGE));
  const currentPage = Math.min(proposalPage, totalPages);

  const paginatedProposals = useMemo(() => {
    const startIndex = (currentPage - 1) * PROPOSALS_PER_PAGE;
    return filteredAndSortedProposals.slice(startIndex, startIndex + PROPOSALS_PER_PAGE);
  }, [filteredAndSortedProposals, currentPage]);

  function handleTabChange(tab: "PROPOSALS" | "HIRE_REQUESTS") {
    setProposalsTab(tab);
    setProposalPage(1);
  }

  function handleStatusFilterChange(filter: "ALL" | "PENDING" | "ACCEPTED" | "REJECTED") {
    setProposalStatusFilter(filter);
    setProposalPage(1);
  }

  function handleSearchChange(query: string) {
    setProposalSearchQuery(query);
    setProposalPage(1);
  }

  function handleSortChange(sort: "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING_DESC") {
    setProposalSortBy(sort);
    setProposalPage(1);
  }

  async function searchProfessionals(query = finderQuery) {
    setFinderStatus("loading");
    try {
      const params = new URLSearchParams({ limit: "50" });
      // The finder belongs to this job, so show verified professionals from
      // the job's main segment (Residential, Commercial, or Industrial).
      if (job?.categorySegment) {
        params.set("segment", job.categorySegment);
      }
      if (job?.category && job.category !== "Uncategorized") {
        params.set("category", job.category);
      }
      if (query.trim()) params.set("query", query.trim());
      const response = await fetch(`/api/v1/professionals?${params.toString()}`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as ProfessionalDiscoveryResponse;
      setProfessionals(data.professionals);
      setFinderStatus("idle");
    } catch {
      setFinderStatus("error");
    }
  }

  function openFinder() {
    setFinderOpen(true);
    if (!professionals.length) void searchProfessionals("");
  }
  function defaultHireBid() {
    if (!job) return null;
    if (job.timingType === "HOURLY") return job.hourlyRate ?? null;
    if (job.budgetMin != null && job.budgetMax != null) {
      return Math.round((job.budgetMin + job.budgetMax) / 2);
    }
    return null;
  }
  function openSelectHire(professional: ProfessionalDiscoveryResult) {
    setHireTarget(professional);
    setSelectError(null);
    setHireMessage(null);
    setHireMessageStatus("idle");
    setHireCoverLetter("");
    setHireDuration("1 week");
    const fallback = defaultHireBid();
    setHireBidAmount(fallback !== null ? String(fallback) : "");
  }
  function closeSelectHire() {
    if (hireBusy) return;
    setHireTarget(null);
    setSelectError(null);
    setHireMessage(null);
    setHireMessageStatus("idle");
  }
  async function submitHire() {
    if (!hireTarget) return;
    const bidAmount = Number(hireBidAmount);
    if (!Number.isFinite(bidAmount) || bidAmount < 1) {
      setSelectError("Enter a valid bid amount.");
      return;
    }
    if (!hireDuration.trim()) {
      setSelectError("Enter a timeline.");
      return;
    }
    setHireBusy(true);
    setSelectError(null);
    setHireMessage(null);
    try {
      const response = await fetch("/api/v1/client/project-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: Number(jobId),
          professionalId: hireTarget.id,
          bidAmount: Math.round(bidAmount),
          duration: hireDuration,
          coverLetter: hireCoverLetter,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setHireMessage(payload?.error || "Unable to send the hire request.");
        setHireMessageStatus("error");
        return;
      }
      setHireMessage(`Hire request sent to ${hireTarget.name}.`);
      setHireMessageStatus("success");
      await refresh();
      setTimeout(() => {
        setHireTarget(null);
        setFinderOpen(false);
        setHireMessage(null);
        setHireMessageStatus("idle");
      }, 1200);
    } catch {
      setHireMessage("Unable to send the hire request right now.");
      setHireMessageStatus("error");
    } finally {
      setHireBusy(false);
    }
  }
  async function sendProposal() {
    const hourlyRate = Number(proposalHourlyRate);
    const totalJobHours = Number(proposalTotalJobHours);
    const isHourlyJob = job?.timingType === "HOURLY";
    const bidAmount = isHourlyJob ? hourlyRate * totalJobHours : Number(proposalPrice);
    const duration = proposalDuration.trim();
    const message = proposalMessage.trim();
    if (
      !Number.isFinite(bidAmount) ||
      !Number.isInteger(bidAmount) ||
      bidAmount < 1 ||
      (isHourlyJob &&
        (!Number.isSafeInteger(hourlyRate) ||
          hourlyRate < 1 ||
          !Number.isSafeInteger(totalJobHours) ||
          totalJobHours < 1)) ||
      !duration ||
      message.length < 10
    ) {
      setProposalError(
        !Number.isFinite(bidAmount) || !Number.isInteger(bidAmount) || bidAmount < 1
          ? isHourlyJob
            ? "Enter a valid hourly rate and total job hours."
            : "Enter a valid price."
          : !duration
            ? "Enter a delivery estimate."
            : "Your message must be at least 10 characters.",
      );
      return;
    }
    setProposalBusy(true);
    setProposalError(null);
    try {
      const response = await fetch("/api/v1/professional/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: Number(jobId),
          bidAmount,
          hourlyRate: isHourlyJob ? hourlyRate : undefined,
          totalJobHours: isHourlyJob ? totalJobHours : undefined,
          duration,
          coverLetter: message,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to send your proposal.");
      setOwnProposal({
        id: payload.proposal.id,
        status: payload.proposal.status,
        bidAmount: payload.proposal.bidAmount,
        hourlyRate: payload.proposal.hourlyRate,
        totalJobHours: payload.proposal.totalJobHours,
        duration: payload.proposal.duration,
        coverLetter: payload.proposal.coverLetter,
        lastActorRole: "PROFESSIONAL",
      });
      setShowProposalForm(false);
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : "Unable to send your proposal.");
    } finally {
      setProposalBusy(false);
    }
  }
  function negotiationEndpoint(kind: NegotiationKind, id: number) {
    return kind === "ownProposal"
      ? `/api/v1/professional/project-requests/${id}`
      : `/api/v1/client/project-requests/${id}`;
  }
  async function respondToRequest(kind: NegotiationKind, id: number, action: "accept" | "reject") {
    const response = await fetch(negotiationEndpoint(kind, id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      // A double-click or a stale page can retry an already accepted request.
      // Treat it as success when the project now exists instead of showing an error.
      if (action === "accept" && response.status === 409) {
        const projectResponse = await fetch(
          `/api/v1/portal/project?jobId=${encodeURIComponent(jobId)}`,
        );
        const projectPayload = await projectResponse.json().catch(() => null);
        if (projectResponse.ok && projectPayload?.project?.id) {
          setAcceptedProjectId(projectPayload.project.id);
          return;
        }
      }
      toast.error(payload?.error || "Unable to update this request.");
      return;
    }
    if (action === "accept" && payload.project?.id) {
      setAcceptedProjectId(payload.project.id);
      return;
    }
    await refresh();
  }
  function openNegotiate(
    kind: NegotiationKind,
    item: {
      id: number;
      bidAmount: number;
      duration: string;
      hourlyRate?: number | null;
      totalJobHours?: number | null;
    },
  ) {
    setNegotiateTarget({
      kind,
      id: item.id,
      lastBidAmount: item.bidAmount,
      lastHourlyRate: item.hourlyRate,
      lastTotalJobHours: item.totalJobHours,
      lastDuration: item.duration,
    });
    setNegotiatePrice("");
    setNegotiateHourlyRate(
      item.hourlyRate != null ? String(item.hourlyRate) : String(job?.hourlyRate ?? ""),
    );
    setNegotiateTotalJobHours(
      item.totalJobHours != null ? String(item.totalJobHours) : String(job?.totalJobHours ?? ""),
    );
    setNegotiateDuration(item.duration);
    setNegotiateMessage("");
    setNegotiateError(null);
  }
  async function submitNegotiation() {
    if (!negotiateTarget) return;
    const isHourlyJob = job?.timingType === "HOURLY";
    const hourlyRate = Number(negotiateHourlyRate);
    const totalJobHours = Number(negotiateTotalJobHours);
    const bidAmount = isHourlyJob ? hourlyRate * totalJobHours : Number(negotiatePrice);
    if (
      !Number.isSafeInteger(bidAmount) ||
      bidAmount < 1 ||
      (isHourlyJob &&
        (!Number.isSafeInteger(hourlyRate) ||
          hourlyRate < 1 ||
          !Number.isSafeInteger(totalJobHours) ||
          totalJobHours < 1)) ||
      !negotiateDuration.trim() ||
      !negotiateMessage.trim()
    ) {
      setNegotiateError(
        isHourlyJob
          ? "Enter a valid hourly rate, total job hours, timeline, and message."
          : "Enter a valid price, timeline, and message.",
      );
      return;
    }
    if (
      isHourlyJob
        ? hourlyRate === negotiateTarget.lastHourlyRate &&
          totalJobHours === negotiateTarget.lastTotalJobHours
        : negotiateTarget.lastBidAmount != null && bidAmount === negotiateTarget.lastBidAmount
    ) {
      setNegotiateError(
        isHourlyJob
          ? "Change the hourly rate or total job hours before sending your counter-offer."
          : `Counter-offer amount cannot be the same as the current bid amount (₹${(negotiateTarget.lastBidAmount ?? 0).toLocaleString("en-IN")}). Please propose a different amount.`,
      );
      return;
    }
    setNegotiateBusy(true);
    setNegotiateError(null);
    try {
      const response = await fetch(negotiationEndpoint(negotiateTarget.kind, negotiateTarget.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "counter",
          bidAmount,
          hourlyRate: isHourlyJob ? hourlyRate : undefined,
          totalJobHours: isHourlyJob ? totalJobHours : undefined,
          duration: negotiateDuration,
          message: negotiateMessage,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to send your counter-offer.");
      setNegotiateTarget(null);
      await refresh();
    } catch (error) {
      setNegotiateError(
        error instanceof Error ? error.message : "Unable to send your counter-offer.",
      );
    } finally {
      setNegotiateBusy(false);
    }
  }
  if (status === "loading")
    return (
      <JobShell viewerRole={viewerRole} embedded={embedded}>
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </JobShell>
    );
  if (status === "missing")
    return (
      <JobShell viewerRole={viewerRole} embedded={embedded}>
        <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          This job is no longer available.
        </p>
      </JobShell>
    );
  if (status === "error" || !job)
    return (
      <JobShell viewerRole={viewerRole} embedded={embedded}>
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          The job could not be loaded. Please try again.
        </p>
      </JobShell>
    );

  const isOwner = !job.client;
  const jobDateFormatted = formatDate(job.jobDate);
  const deadlineFormatted = formatDate(job.deadline);
  const isDeadlinePassed = job.deadline ? new Date(job.deadline) < new Date() : false;

  return (
    <JobShell viewerRole={viewerRole} embedded={embedded}>
      <article className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap gap-2 text-xs">
          {job.mainCategory && job.mainCategory !== job.category && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              {job.mainCategory}
            </span>
          )}
          {job.categorySegment && (
            <span className="rounded-full bg-muted px-3 py-1 capitalize">
              {job.categorySegment.toLowerCase()}
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{job.category}</span>
          <span className="rounded-full bg-muted px-3 py-1">
            {job.urgency.toLowerCase()} urgency
          </span>
          {job.status && (
            <span
              className={`rounded-full px-3 py-1 ${
                job.status === "OPEN"
                  ? "bg-success/10 text-success"
                  : job.status === "CLOSED"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted"
              }`}
            >
              {job.status.toLowerCase()}
            </span>
          )}
          <span className="rounded-full bg-blue/10 px-3 py-1 text-blue">
            {job.timingType === "HOURLY" ? "Hourly" : "Fixed Price"}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.title}</h1>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {job.location ?? "Remote"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Posted {new Date(job.createdAt).toLocaleDateString()}
          </span>
          {job.proposalCount !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              {job.proposalCount} saved applications
            </span>
          )}
        </div>

        {/* Key Details Grid */}
        <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border p-4">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Budget
            </dt>
            <dd className="mt-1 font-semibold">{formatBudget(job)}</dd>
          </div>
          <div className="rounded-xl border border-border p-4">
            <dt className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Work mode
            </dt>
            <dd className="mt-1 font-semibold">{job.workMode.replace("_", " ")}</dd>
          </div>
          {jobDateFormatted && (
            <div className="rounded-xl border border-border p-4">
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Preferred date
              </dt>
              <dd className="mt-1 font-semibold">{jobDateFormatted}</dd>
            </div>
          )}
          {deadlineFormatted && (
            <div className="rounded-xl border border-border p-4">
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Deadline
              </dt>
              <dd className={`mt-1 font-semibold ${isDeadlinePassed ? "text-destructive" : ""}`}>
                {deadlineFormatted}
                {isDeadlinePassed && (
                  <span className="ml-1 text-xs text-destructive">(Passed)</span>
                )}
              </dd>
            </div>
          )}
          {job.client && (
            <div className="rounded-xl border border-border p-4 sm:col-span-2 lg:col-span-1">
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Client rating
              </dt>
              <dd className="mt-1 font-semibold">{job.client.rating.toFixed(1)} / 5</dd>
            </div>
          )}
          {job.locationAddress && (
            <div className="rounded-xl border border-border p-4 sm:col-span-2 lg:col-span-2">
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Full address
              </dt>
              <dd className="mt-1 font-medium text-sm">{job.locationAddress}</dd>
            </div>
          )}
        </dl>

        {(job.locationAddress || (job.locationLat !== null && job.locationLng !== null)) && (
          <section className="mt-6 w-full">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Project location</h2>
                <p className="text-sm text-muted-foreground">Where this job was posted</p>
              </div>
            </div>
            <iframe
              title={`Map for ${job.title}`}
              className="mt-3 h-[240px] w-full rounded-2xl border border-border sm:h-[260px]"
              loading="lazy"
              src={
                job.locationLat !== null && job.locationLng !== null
                  ? `https://www.google.com/maps?q=${job.locationLat},${job.locationLng}&z=15&output=embed`
                  : `https://www.google.com/maps?q=${encodeURIComponent(job.locationAddress ?? job.location ?? "")}&output=embed`
              }
            />
          </section>
        )}

        {/* Attachments */}
        {job.attachments && job.attachments.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </h2>
            <div className="mt-3 space-y-2">
              {job.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{attachment.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.fileType ? `${attachment.fileType.toUpperCase()} • ` : ""}
                        {formatFileSize(attachment.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!attachment.previewUrl}
                    asChild={Boolean(attachment.previewUrl)}
                  >
                    {attachment.previewUrl ? (
                      <a href={attachment.previewUrl} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    ) : (
                      "Download"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Description */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="mt-3 whitespace-pre-wrap leading-7 text-muted-foreground">
            {job.description}
          </p>
        </section>

        {/* Milestones */}
        {job.milestones && job.milestones.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                Project Milestones ({job.milestones.length})
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Payment milestones defined by the client for this project
            </p>
            <div className="mt-4 space-y-3">
              {job.milestones.map((milestone, idx) => (
                <div
                  key={milestone.id ?? idx}
                  className="rounded-xl border border-border bg-card/60 p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <h3 className="font-semibold text-sm sm:text-base">{milestone.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {milestone.percentage}%
                      </span>
                      {milestone.amount != null && (
                        <span className="text-xs font-medium text-muted-foreground">
                          ≈ ₹{milestone.amount.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                  {milestone.description && (
                    <p className="mt-2 text-sm text-muted-foreground pl-8">
                      {milestone.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Client History & Reviews from Professionals */}
        {job.client && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">About the Client</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Feedback from professionals who previously worked with this client
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-base font-bold text-amber-600 dark:text-amber-400">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span>{job.client.rating.toFixed(1)}</span>
                  <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  ({job.client.reviewsList?.length ?? job.client.reviewCount ?? 0} reviews)
                </span>
              </div>
            </div>

            {!job.client.reviewsList || job.client.reviewsList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  This client has no previous professional reviews yet.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {job.client.reviewsList.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-border/80 bg-muted/20 p-4 transition-colors hover:border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {review.reviewerName[0]?.toUpperCase() ?? "P"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {review.reviewerName}
                          </p>
                          {review.reviewerCategory && (
                            <p className="text-xs text-muted-foreground">
                              {review.reviewerCategory}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    {review.comment ? (
                      <p className="mt-2.5 text-sm text-foreground/90 whitespace-pre-wrap">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs italic text-muted-foreground">Rating only</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isOwner && (
          <section className="mt-8 border-t border-border pt-6">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    Proposals &amp; Direct Hires
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Review candidate bids, negotiate terms, accept offers, and manage project
                    workrooms
                  </p>
                </div>
              </div>
            </div>

            {/* 2 Tabs: Proposals vs Direct Hire Requests */}
            <div className="flex border-b border-border mb-4">
              <button
                type="button"
                onClick={() => handleTabChange("PROPOSALS")}
                className={`relative flex items-center gap-2 py-3 px-4 font-semibold text-sm transition-colors ${
                  proposalsTab === "PROPOSALS"
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Inbox className="h-4 w-4" />
                <span>Proposals from Professionals</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    proposalsTab === "PROPOSALS"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {clientProposals.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("HIRE_REQUESTS")}
                className={`relative flex items-center gap-2 py-3 px-4 font-semibold text-sm transition-colors ${
                  proposalsTab === "HIRE_REQUESTS"
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Send className="h-4 w-4" />
                <span>Direct Hire Requests (Client Sent)</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    proposalsTab === "HIRE_REQUESTS"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {sentHireRequests.length}
                </span>
              </button>
            </div>

            {/* Controls Toolbar: Search, Filter, Sort (optimized for 1,000+ items) */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Search Bar */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={proposalSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search candidates, skills, or notes..."
                  className="pl-9 h-9 text-xs sm:text-sm rounded-lg"
                />
                {proposalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Right: Status Filters & Sort Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Pills */}
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs font-medium">
                  {(
                    [
                      { id: "ALL", label: "All", count: proposalCounts.total },
                      { id: "PENDING", label: "Pending", count: proposalCounts.pending },
                      { id: "ACCEPTED", label: "Accepted", count: proposalCounts.accepted },
                      { id: "REJECTED", label: "Declined", count: proposalCounts.rejected },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleStatusFilterChange(tab.id)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        proposalStatusFilter === tab.id
                          ? "bg-background text-foreground shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label} {tab.count > 0 && `(${tab.count})`}
                    </button>
                  ))}
                </div>

                {/* Sorter */}
                <select
                  value={proposalSortBy}
                  onChange={(e) =>
                    handleSortChange(
                      e.target.value as "NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "RATING_DESC",
                    )
                  }
                  className="h-8 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="NEWEST">Newest First</option>
                  <option value="PRICE_ASC">Price: Low to High</option>
                  <option value="PRICE_DESC">Price: High to Low</option>
                  <option value="RATING_DESC">Top Rated First</option>
                </select>
              </div>
            </div>

            {/* Proposals List (Paginated, High Density) */}
            <div className="space-y-3">
              {paginatedProposals.map((item) => {
                const isItemAccepted = item.status === "ACCEPTED";
                const isItemRejected = item.status === "REJECTED";
                const isItemPending = item.status === "PENDING";
                const canClientAct =
                  isItemPending && job.status === "OPEN" && item.lastActorRole === "PROFESSIONAL";

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Row 1: Candidate Bio & Financials */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* Bio */}
                        <div className="flex items-start gap-3">
                          {item.professional?.avatarUrl ? (
                            <img
                              src={item.professional.avatarUrl}
                              alt={item.professional.firstName}
                              className="h-11 w-11 shrink-0 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
                              {item.professional
                                ? `${item.professional.firstName[0]}${item.professional.lastName[0]}`
                                : "PR"}
                            </div>
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-base text-foreground leading-snug">
                                {item.professional
                                  ? `${item.professional.firstName} ${item.professional.lastName}`
                                  : "Professional"}
                              </h3>
                              {item.professional?.isVerified && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <Check className="h-3 w-3" /> Verified
                                </span>
                              )}
                              {item.professional && (
                                <Link
                                  href={`/pro/${item.professional.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 font-medium ml-1"
                                >
                                  Profile <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                              )}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                              <span>
                                {item.professional?.professionalCategory ?? "Professional"}
                              </span>
                              {item.professional?.professionalCity && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <MapPin className="h-3 w-3" />{" "}
                                    {item.professional.professionalCity}
                                  </span>
                                </>
                              )}
                              {item.professional && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                    {item.professional.averageRating.toFixed(1)}
                                    <span className="text-muted-foreground font-normal">
                                      ({item.professional.reviewCount})
                                    </span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Quote & Status */}
                        <div className="flex flex-wrap sm:flex-col items-end justify-between sm:justify-start gap-1.5 shrink-0">
                          <div className="text-left sm:text-right">
                            {item.hourlyRate && item.totalJobHours ? (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  ₹{item.hourlyRate.toLocaleString("en-IN")}/hr ×{" "}
                                  {item.totalJobHours} hrs
                                </p>
                                <p className="text-lg font-bold text-foreground leading-tight">
                                  ₹{item.bidAmount.toLocaleString("en-IN")}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs text-muted-foreground">Total Quote</p>
                                <p className="text-lg font-bold text-foreground leading-tight">
                                  ₹{item.bidAmount.toLocaleString("en-IN")}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              <Clock className="h-3 w-3" /> {item.duration}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isItemPending
                                  ? item.lastActorRole === "PROFESSIONAL"
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                    : "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                  : isItemAccepted
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              {isItemPending
                                ? item.lastActorRole === "PROFESSIONAL"
                                  ? proposalsTab === "HIRE_REQUESTS"
                                    ? "Professional Countered"
                                    : "Pending Review"
                                  : "Awaiting Professional"
                                : isItemAccepted
                                  ? "Accepted"
                                  : "Declined"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Previous Offer Banner (if countered) */}
                      {item.previous?.bidAmount != null && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
                          <span className="font-semibold">Previous offer:</span> ₹
                          {item.previous.bidAmount.toLocaleString("en-IN")}
                          {item.previous.duration ? ` · ${item.previous.duration}` : ""}
                          {item.previous.message && (
                            <span className="italic"> — &quot;{item.previous.message}&quot;</span>
                          )}
                        </div>
                      )}

                      {/* Description / Cover Letter */}
                      {item.coverLetter && (
                        <div className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
                          <p
                            className={
                              expandedProposalIds.has(item.id)
                                ? "whitespace-pre-wrap"
                                : "line-clamp-2"
                            }
                          >
                            {item.coverLetter}
                          </p>
                          {item.coverLetter.length > 120 && (
                            <button
                              type="button"
                              onClick={() => toggleProposalExpanded(item.id)}
                              className="mt-1 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              {expandedProposalIds.has(item.id) ? (
                                <>
                                  Show less <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  Show more <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Row 3: The 4 Action Buttons Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                        <div className="text-xs text-muted-foreground">
                          Submitted {new Date(item.createdAt).toLocaleDateString()}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Button 1: Accept */}
                          {canClientAct ? (
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1 shadow-sm"
                              onClick={() => {
                                if (proposalsTab === "PROPOSALS") {
                                  setPendingAcceptProposal(item);
                                } else {
                                  void respondToRequest("sentHireRequest", item.id, "accept");
                                }
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {proposalsTab === "PROPOSALS" ? "Accept & Hire" : "Accept Terms"}
                            </Button>
                          ) : isItemAccepted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 bg-emerald-50/50 opacity-90 cursor-default"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accepted
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 opacity-40 cursor-not-allowed"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept
                            </Button>
                          )}

                          {/* Button 2: Reject / Decline */}
                          {canClientAct ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1"
                              onClick={() =>
                                void respondToRequest(
                                  proposalsTab === "PROPOSALS"
                                    ? "clientProposal"
                                    : "sentHireRequest",
                                  item.id,
                                  "reject",
                                )
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                              Decline
                            </Button>
                          ) : isItemRejected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 text-destructive/70 border-destructive/20 opacity-90 cursor-default"
                            >
                              <X className="h-3.5 w-3.5" />
                              Declined
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 opacity-40 cursor-not-allowed"
                            >
                              <X className="h-3.5 w-3.5" />
                              Decline
                            </Button>
                          )}

                          {/* Button 3: Negotiate */}
                          {isItemPending && job.status === "OPEN" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1 hover:border-primary/50"
                              onClick={() =>
                                openNegotiate(
                                  proposalsTab === "PROPOSALS"
                                    ? "clientProposal"
                                    : "sentHireRequest",
                                  item,
                                )
                              }
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" />
                              Negotiate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 opacity-40 cursor-not-allowed"
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" />
                              Negotiate
                            </Button>
                          )}

                          {/* Button 4: Work / Go to Project Tracking */}
                          {isItemAccepted && effectiveProjectId ? (
                            <Button
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1 shadow-sm"
                              asChild
                            >
                              <Link href={`/project/${effectiveProjectId}/tracking`}>
                                <Briefcase className="h-3.5 w-3.5" />
                                Workroom
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs gap-1 opacity-40 cursor-not-allowed"
                              title="Workroom opens once proposal is accepted"
                            >
                              <Briefcase className="h-3.5 w-3.5" />
                              Work
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Empty state: No proposals in this tab at all */}
              {!activeList.length && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
                  <p className="font-semibold text-foreground">
                    {proposalsTab === "PROPOSALS"
                      ? "No proposals received yet"
                      : "No direct hire requests sent yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {proposalsTab === "PROPOSALS"
                      ? "Share this job or invite verified professionals to get competitive bids."
                      : "Use 'Find a professional' above to invite experts directly to this job."}
                  </p>
                </div>
              )}

              {/* Empty state: Filters produced no matches */}
              {activeList.length > 0 && !filteredAndSortedProposals.length && (
                <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  <Search className="h-7 w-7 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="font-semibold text-foreground">No matching proposals found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No proposals match your current filter or search criteria.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 text-xs"
                    onClick={() => {
                      setProposalSearchQuery("");
                      setProposalStatusFilter("ALL");
                      setProposalPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              )}
            </div>

            {/* Pagination Controls (Essential for 1,000+ proposals) */}
            {filteredAndSortedProposals.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <div>
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {(currentPage - 1) * PROPOSALS_PER_PAGE + 1}
                  </span>
                  –
                  <span className="font-semibold text-foreground">
                    {Math.min(currentPage * PROPOSALS_PER_PAGE, filteredAndSortedProposals.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {filteredAndSortedProposals.length}
                  </span>{" "}
                  proposals
                  {filteredAndSortedProposals.length !== activeList.length && (
                    <span> (filtered from {activeList.length} total)</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={() => setProposalPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                  </Button>

                  <span className="px-2 font-medium">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= totalPages}
                    onClick={() => setProposalPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 text-xs"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
        {!isOwner && job.client && viewerRole === "PROFESSIONAL" && (
          <section className="mt-8 border-t border-border pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">
                    {ownProposal
                      ? ownProposal.origin === "CLIENT_HIRE"
                        ? "Direct Hire Request from Client"
                        : "Your Proposal"
                      : "Send Your Proposal"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {ownProposal
                      ? "Review terms, negotiate, or access your project workroom"
                      : "Submit your bid and let the client review your offer"}
                  </p>
                </div>
              </div>
            </div>

            {ownProposal ? (
              <div
                className={`rounded-2xl border bg-card p-5 shadow-soft transition-all ${
                  ownProposal.status === "ACCEPTED"
                    ? "border-emerald-500/40 bg-emerald-50/15 dark:bg-emerald-950/10"
                    : ownProposal.status === "REJECTED"
                      ? "border-destructive/30 bg-destructive/5"
                      : ownProposal.lastActorRole === "CLIENT"
                        ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                        : "border-border"
                }`}
              >
                {/* Status bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        ownProposal.status === "ACCEPTED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : ownProposal.status === "REJECTED"
                            ? "bg-destructive/10 text-destructive"
                            : ownProposal.lastActorRole === "CLIENT"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                      }`}
                    >
                      {ownProposal.status === "ACCEPTED" ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Proposal Accepted · Active Contract
                        </>
                      ) : ownProposal.status === "REJECTED" ? (
                        <>
                          <X className="h-3.5 w-3.5" /> Proposal Declined
                        </>
                      ) : ownProposal.lastActorRole === "CLIENT" ? (
                        <>
                          <ArrowUpDown className="h-3.5 w-3.5" /> Action Required · Client Countered
                          Your Offer
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Submitted · Awaiting Client Decision
                        </>
                      )}
                    </span>
                    {ownProposal.origin === "CLIENT_HIRE" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Direct Hire Request
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">Job #{jobId}</span>
                </div>

                {/* Previous terms if countered */}
                {ownProposal.status === "PENDING" &&
                  ownProposal.lastActorRole === "CLIENT" &&
                  ownProposal.previousBidAmount != null && (
                    <div className="mt-3.5 rounded-xl border border-border/80 bg-muted/30 p-3 text-xs">
                      <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                        Your previous proposal terms
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {ownProposal.previousHourlyRate && ownProposal.previousTotalJobHours
                          ? `₹${ownProposal.previousHourlyRate.toLocaleString("en-IN")}/hr × ${ownProposal.previousTotalJobHours} hrs = ₹${ownProposal.previousBidAmount.toLocaleString("en-IN")}`
                          : `₹${ownProposal.previousBidAmount.toLocaleString("en-IN")}`}{" "}
                        · Timeline: {ownProposal.previousDuration ?? "Not specified"}
                      </p>
                      {ownProposal.previousMessage && (
                        <p className="mt-1 text-muted-foreground italic">
                          &ldquo;{ownProposal.previousMessage}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                {/* Rate & Pricing Breakdown Grid */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-background/80 p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ownProposal.lastActorRole === "CLIENT" && ownProposal.status === "PENDING"
                        ? "Client's Proposed Rate & Price"
                        : "Your Rate & Bid Price"}
                    </p>
                    <div className="mt-1.5">
                      {ownProposal.hourlyRate && ownProposal.totalJobHours ? (
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-foreground">
                              ₹{ownProposal.hourlyRate.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs text-muted-foreground">/hr</span>
                            <span className="text-xs text-muted-foreground">
                              × {ownProposal.totalJobHours} hrs
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-primary mt-0.5">
                            Total: ₹{ownProposal.bidAmount.toLocaleString("en-IN")}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <span className="text-lg font-bold text-foreground">
                            ₹{ownProposal.bidAmount.toLocaleString("en-IN")}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">(Fixed Price)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-background/80 p-3.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Delivery Timeline
                    </p>
                    <p className="mt-1.5 text-lg font-bold text-foreground">
                      {ownProposal.duration || "Not specified"}
                    </p>
                  </div>
                </div>

                {/* Client's note if countered */}
                {ownProposal.status === "PENDING" &&
                  ownProposal.lastActorRole === "CLIENT" &&
                  ownProposal.coverLetter && (
                    <div className="mt-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Client&apos;s Note
                      </p>
                      <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                        {ownProposal.coverLetter}
                      </p>
                    </div>
                  )}

                {/* Professional's cover letter / pitch */}
                {ownProposal.coverLetter &&
                  (ownProposal.lastActorRole !== "CLIENT" || ownProposal.status !== "PENDING") && (
                    <div className="mt-3.5 rounded-xl border border-border/80 bg-background/60 p-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                          Your Proposal Pitch & Scope
                        </p>
                        {ownProposal.coverLetter.length > 150 && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedProposalIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(ownProposal.id)) {
                                  next.delete(ownProposal.id);
                                } else {
                                  next.add(ownProposal.id);
                                }
                                return next;
                              });
                            }}
                            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {expandedProposalIds.has(ownProposal.id) ? (
                              <>
                                Show less <ChevronUp className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                Read more <ChevronDown className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <p
                        className={`mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap ${
                          !expandedProposalIds.has(ownProposal.id) &&
                          ownProposal.coverLetter.length > 150
                            ? "line-clamp-2"
                            : ""
                        }`}
                      >
                        {ownProposal.coverLetter}
                      </p>
                    </div>
                  )}

                {/* The 4 Standard Action Buttons: Accept | Reject | Negotiate | Work */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                  {/* Button 1: Accept */}
                  {ownProposal.status === "PENDING" && ownProposal.lastActorRole === "CLIENT" ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm h-8 px-3 text-xs"
                      onClick={() => void respondToRequest("ownProposal", ownProposal.id, "accept")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept Terms
                    </Button>
                  ) : ownProposal.status === "ACCEPTED" ? (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 h-8 px-3 text-xs"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Terms Accepted
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="text-muted-foreground opacity-50 h-8 px-3 text-xs"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept
                    </Button>
                  )}

                  {/* Button 2: Reject / Decline */}
                  {ownProposal.status === "PENDING" && ownProposal.lastActorRole === "CLIENT" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-3 text-xs"
                      onClick={() => void respondToRequest("ownProposal", ownProposal.id, "reject")}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Decline
                    </Button>
                  ) : ownProposal.status === "REJECTED" ? (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="text-destructive/60 border-destructive/20 h-8 px-3 text-xs"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Declined
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="text-muted-foreground opacity-50 h-8 px-3 text-xs"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Decline
                    </Button>
                  )}

                  {/* Button 3: Negotiate */}
                  {ownProposal.status === "PENDING" && ownProposal.lastActorRole === "CLIENT" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-muted font-medium h-8 px-3 text-xs"
                      onClick={() => openNegotiate("ownProposal", ownProposal)}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Counter-Offer
                    </Button>
                  ) : ownProposal.status === "PENDING" &&
                    ownProposal.lastActorRole === "PROFESSIONAL" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-muted font-medium h-8 px-3 text-xs"
                      onClick={() => setShowProposalForm(true)}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Modify Proposal
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="text-muted-foreground opacity-50 h-8 px-3 text-xs"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Negotiate
                    </Button>
                  )}

                  {/* Button 4: Work / Go to Project Tracking */}
                  {effectiveProjectId && ownProposal.status === "ACCEPTED" ? (
                    <Button
                      size="sm"
                      asChild
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm h-8 px-3 text-xs ml-auto"
                    >
                      <Link href={`/project/${effectiveProjectId}/tracking`}>
                        <Briefcase className="h-3.5 w-3.5 mr-1" /> Go to Project Workroom{" "}
                        <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      variant="outline"
                      className="text-muted-foreground opacity-50 cursor-not-allowed h-8 px-3 text-xs ml-auto"
                      title="Available after proposal is accepted and project begins"
                    >
                      <Briefcase className="h-3.5 w-3.5 mr-1" /> Work
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border p-6 bg-card">
                <p className="text-sm text-muted-foreground mb-4">
                  Submit a proposal for this job. Include your price, delivery estimate, and a
                  message for the client.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    const defaultPrice =
                      job.timingType === "HOURLY"
                        ? job.hourlyRate
                        : job.budgetMin !== null && job.budgetMax !== null
                          ? Math.round((job.budgetMin + job.budgetMax) / 2)
                          : (job.budgetMax ?? job.budgetMin);
                    setProposalPrice(String(defaultPrice ?? ""));
                    setProposalHourlyRate(String(job.hourlyRate ?? ""));
                    setProposalTotalJobHours(String(job.totalJobHours ?? ""));
                    const daysLeft = daysUntilDeadline(job.deadline);
                    setProposalDuration(
                      daysLeft !== null ? `${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "",
                    );
                    setProposalError(null);
                    setShowProposalForm(true);
                  }}
                >
                  Submit Proposal
                </Button>
              </div>
            )}
          </section>
        )}
        {/* Actions - Footer Section */}
        <div className="mt-8 border-t border-border pt-6">
          {job.client ? (
            <p className="font-medium text-slate-700">Posted by {job.client.name}</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="font-medium text-muted-foreground">This is your job posting.</p>
              {job.projectId ? (
                <div className="flex flex-wrap gap-2">
                  <Button className="w-full sm:w-auto" asChild>
                    <Link href={`/project/${job.projectId}/tracking`}>Track Project</Link>
                  </Button>
                  {job.status === "CLOSED" && (
                    <Button variant="outline" className="w-full sm:w-auto" asChild>
                      <Link href={`/project/${job.projectId}/tracking#project-feedback`}>
                        Write Review
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto text-destructive border-destructive/30 hover:bg-destructive/10"
                    asChild
                  >
                    <Link href={`/project/${job.projectId}/tracking#project-dispute-center`}>
                      <ShieldAlert className="h-4 w-4 mr-1.5" />
                      Raise Dispute
                    </Link>
                  </Button>
                </div>
              ) : (
                job.status === "OPEN" && (
                  <>
                    <Button className="w-full sm:w-auto" onClick={openFinder}>
                      Find a professional
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/post-job?edit=${jobId}`} className="w-full sm:w-auto">
                        Edit Job
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() => setCloseJobConfirmOpen(true)}
                    >
                      Close Job
                    </Button>
                  </>
                )
              )}
              {job.status === "CLOSED" && (
                <Button
                  className="w-full sm:w-auto gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setReopenError(null);
                    setReopenWorkDescription("");
                    setReopenAmount("");
                    setReopenJobConfirmOpen(true);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reopen Job
                </Button>
              )}
              {job.status === "DRAFT" && (
                <Button className="w-full sm:w-auto" asChild>
                  <a href={`/post-job?edit=${jobId}`}>Publish Job</a>
                </Button>
              )}
            </div>
          )}
        </div>
      </article>
      <Dialog
        open={showProposalForm}
        onOpenChange={(open) => {
          setShowProposalForm(open);
          if (!open) setProposalError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Proposal</DialogTitle>
            <DialogDescription>
              Enter your price, delivery estimate, and a message for the client.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 grid gap-3 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendProposal();
            }}
          >
            {job.timingType === "HOURLY" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={proposalHourlyRate}
                    onChange={(event) => {
                      setProposalHourlyRate(event.target.value);
                      setProposalError(null);
                    }}
                    placeholder="Your hourly rate (₹)"
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={proposalTotalJobHours}
                    onChange={(event) => {
                      setProposalTotalJobHours(event.target.value);
                      setProposalError(null);
                    }}
                    placeholder="Total job hours"
                  />
                </div>
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold">
                  Project total: ₹
                  {Number.isSafeInteger(Number(proposalHourlyRate)) &&
                  Number.isSafeInteger(Number(proposalTotalJobHours)) &&
                  Number(proposalHourlyRate) > 0 &&
                  Number(proposalTotalJobHours) > 0
                    ? (Number(proposalHourlyRate) * Number(proposalTotalJobHours)).toLocaleString(
                        "en-IN",
                      )
                    : "—"}
                </p>
              </>
            ) : (
              <input
                type="number"
                min="1"
                step="1"
                value={proposalPrice}
                onChange={(event) => {
                  setProposalPrice(event.target.value);
                  setProposalError(null);
                }}
                placeholder="Your price"
              />
            )}
            <div>
              <input
                value={proposalDuration}
                onChange={(event) => {
                  setProposalDuration(event.target.value);
                  setProposalError(null);
                }}
                placeholder="Estimated delivery (for example, 14 days)"
                className="w-full"
              />
              {deadlineFormatted && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Client&apos;s deadline: {deadlineFormatted}
                  {(() => {
                    const daysLeft = daysUntilDeadline(job.deadline);
                    return daysLeft !== null
                      ? ` (${daysLeft} day${daysLeft === 1 ? "" : "s"} from today)`
                      : "";
                  })()}
                </p>
              )}
            </div>
            <textarea
              value={proposalMessage}
              minLength={10}
              onChange={(event) => {
                setProposalMessage(event.target.value);
                setProposalError(null);
              }}
              placeholder="Message to Client"
              rows={5}
            />
            {proposalError && <p className="text-sm text-destructive">{proposalError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowProposalForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-cta text-cta-foreground hover:bg-cta/90"
                disabled={proposalBusy}
              >
                {proposalBusy ? "Sending…" : "Send Proposal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={acceptedProjectId !== null}
        onOpenChange={(open) => {
          if (!open) setAcceptedProjectId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewerRole === "PROFESSIONAL"
                ? "Project is now yours"
                : "Professional Hired Successfully"}
            </DialogTitle>
            <DialogDescription>
              {viewerRole === "PROFESSIONAL"
                ? "The client's terms were accepted. You can now manage this project from Active Projects."
                : "You have accepted the proposal. You can now track project milestones, fund escrow, and collaborate with your hired professional."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {viewerRole === "PROFESSIONAL" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push("/professional/running-projects")}
                >
                  Go to Active Projects
                </Button>
                <Button
                  onClick={() => {
                    if (acceptedProjectId !== null) router.push(`/project/${acceptedProjectId}`);
                  }}
                >
                  View Project Workroom
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => router.push("/my-jobs")}>
                  Go to My Projects
                </Button>
                <Button
                  onClick={() => {
                    if (acceptedProjectId !== null) router.push(`/project/${acceptedProjectId}`);
                  }}
                >
                  View Project &amp; Escrow
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingAcceptProposal !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAcceptProposal(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm hire</DialogTitle>
            <DialogDescription>
              {pendingAcceptProposal
                ? `Hire ${pendingAcceptProposal.professional?.firstName ?? "this professional"} for ₹${pendingAcceptProposal.bidAmount.toLocaleString()}?`
                : "Hire this professional?"}
            </DialogDescription>
          </DialogHeader>

          {pendingAcceptProposal && (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Job:</span> {job.title}
              </p>
              <p>
                <span className="font-semibold text-foreground">Agreed amount:</span> ₹
                {pendingAcceptProposal.bidAmount.toLocaleString()}
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingAcceptProposal(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!pendingAcceptProposal) return;
                setPendingAcceptProposal(null);
                await respondToRequest("clientProposal", pendingAcceptProposal.id, "accept");
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={negotiateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNegotiateTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send a counter-offer</DialogTitle>
            <DialogDescription>
              Propose a different price, timeline, or terms. The other side can accept, decline, or
              counter back.
            </DialogDescription>
          </DialogHeader>

          {negotiateTarget?.lastBidAmount != null && (
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  {job.timingType === "HOURLY"
                    ? "Current hourly terms:"
                    : "Current / Last Bid Amount:"}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {job.timingType === "HOURLY" &&
                  negotiateTarget.lastHourlyRate != null &&
                  negotiateTarget.lastTotalJobHours != null
                    ? `₹${negotiateTarget.lastHourlyRate.toLocaleString("en-IN")}/hr × ${negotiateTarget.lastTotalJobHours} hours = ₹${negotiateTarget.lastBidAmount.toLocaleString("en-IN")}`
                    : `₹${negotiateTarget.lastBidAmount.toLocaleString("en-IN")}`}
                </span>
              </div>
              {negotiateTarget.lastDuration && (
                <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
                  <span className="text-muted-foreground font-medium">Current Timeline:</span>
                  <span className="font-semibold text-foreground">
                    {negotiateTarget.lastDuration}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-1 grid gap-3 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
            {job.timingType === "HOURLY" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Your hourly rate (₹) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={negotiateHourlyRate}
                      onChange={(event) => {
                        setNegotiateHourlyRate(event.target.value);
                        setNegotiateError(null);
                      }}
                      placeholder="Hourly rate"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Total job hours <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={negotiateTotalJobHours}
                      onChange={(event) => {
                        setNegotiateTotalJobHours(event.target.value);
                        setNegotiateError(null);
                      }}
                      placeholder="Total hours"
                    />
                  </div>
                </div>
                <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold">
                  Project total: ₹
                  {Number.isSafeInteger(Number(negotiateHourlyRate)) &&
                  Number.isSafeInteger(Number(negotiateTotalJobHours)) &&
                  Number(negotiateHourlyRate) > 0 &&
                  Number(negotiateTotalJobHours) > 0
                    ? (Number(negotiateHourlyRate) * Number(negotiateTotalJobHours)).toLocaleString(
                        "en-IN",
                      )
                    : "—"}
                </p>
              </>
            ) : (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Your Counter-Offer Price (₹) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={negotiatePrice}
                  onChange={(event) => {
                    setNegotiatePrice(event.target.value);
                    setNegotiateError(null);
                  }}
                  placeholder="Enter counter price (must differ from current bid)"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Proposed Timeline <span className="text-destructive">*</span>
              </label>
              <input
                value={negotiateDuration}
                onChange={(event) => setNegotiateDuration(event.target.value)}
                placeholder="Timeline (for example, 10 days)"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Message / Notes <span className="text-destructive">*</span>
              </label>
              <textarea
                value={negotiateMessage}
                onChange={(event) => setNegotiateMessage(event.target.value)}
                placeholder="Explain why you are proposing these new terms..."
                rows={3}
              />
            </div>
          </div>
          {negotiateError && <p className="mt-2 text-sm text-destructive">{negotiateError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNegotiateTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={
                negotiateBusy ||
                (job.timingType === "HOURLY"
                  ? !negotiateHourlyRate.trim() || !negotiateTotalJobHours.trim()
                  : !negotiatePrice.trim()) ||
                !negotiateDuration.trim() ||
                !negotiateMessage.trim()
              }
              onClick={() => void submitNegotiation()}
            >
              {negotiateBusy ? "Sending…" : "Send Counter-Offer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finderOpen} onOpenChange={setFinderOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Find a professional</DialogTitle>
            <DialogDescription>
              Choose a verified professional for {job.title}. Their hire request will include this
              job.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void searchProfessionals();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={finderQuery}
                onChange={(event) => setFinderQuery(event.target.value)}
                placeholder="Search by name, service, or skill"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={finderStatus === "loading"}>
              {finderStatus === "loading" ? "Searching..." : "Search"}
            </Button>
          </form>
          {finderStatus === "error" && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Professionals could not be loaded. Please try again.
            </p>
          )}
          {finderStatus === "loading" && !professionals.length && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-36 animate-pulse rounded-2xl bg-muted" />
              <div className="h-36 animate-pulse rounded-2xl bg-muted" />
            </div>
          )}
          {finderStatus !== "loading" && professionals.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {professionals.map((professional) => (
                <article key={professional.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    {professional.avatarUrl ? (
                      <img
                        src={professional.avatarUrl}
                        alt={professional.name}
                        className="h-11 w-11 shrink-0 rounded-xl object-cover"
                        onError={(event) => {
                          (event.currentTarget as HTMLImageElement).style.display = "none";
                          const fallback = (event.currentTarget as HTMLImageElement)
                            .nextElementSibling;
                          if (fallback instanceof HTMLElement) fallback.style.display = "grid";
                        }}
                      />
                    ) : null}
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted font-semibold ${
                        professional.avatarUrl ? "hidden" : ""
                      }`}
                    >
                      {professional.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{professional.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{professional.title}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {professional.rating.toFixed(1)} · {professional.reviewCount} reviews
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {professional.verified ? "Verified professional" : "Verification pending"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {professional.hourlyRate == null
                        ? "Contact for pricing"
                        : `₹${professional.hourlyRate}/hr`}{" "}
                      · {professional.location ?? "Remote"}
                    </p>
                    <Button
                      size="sm"
                      className="bg-cta text-cta-foreground hover:bg-cta/90"
                      disabled={selectingId === professional.id}
                      onClick={() => openSelectHire(professional)}
                    >
                      {selectingId === professional.id ? "Selecting…" : "Select"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {finderStatus === "idle" && professionals.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No verified professionals match this search.
            </p>
          )}
          <div className="border-t border-border pt-4 text-right">
            <Button variant="link" asChild>
              <Link href={`/discover?jobId=${encodeURIComponent(jobId)}`}>
                Open full professional search
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={hireTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeSelectHire();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hire {hireTarget?.name ?? "professional"}</DialogTitle>
            <DialogDescription>
              Send a hire request for {job?.title ?? "this job"}. The professional can accept,
              decline, or counter.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
            <input
              type="number"
              min="1"
              value={hireBidAmount}
              onChange={(event) => setHireBidAmount(event.target.value)}
              placeholder="Your offer"
            />
            <input
              value={hireDuration}
              onChange={(event) => setHireDuration(event.target.value)}
              placeholder="Timeline (for example, 1 week)"
            />
            <textarea
              value={hireCoverLetter}
              onChange={(event) => setHireCoverLetter(event.target.value)}
              placeholder="Add a short note (optional)"
              rows={3}
            />
          </div>
          {selectError && <p className="mt-3 text-sm text-destructive">{selectError}</p>}
          {hireMessage && (
            <p
              className={`mt-3 text-sm ${
                hireMessageStatus === "success" ? "text-success" : "text-destructive"
              }`}
            >
              {hireMessage}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={closeSelectHire} disabled={hireBusy}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={hireBusy}
              onClick={() => void submitHire()}
            >
              {hireBusy ? "Sending…" : "Send Hire Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={closeJobConfirmOpen}
        onOpenChange={setCloseJobConfirmOpen}
        title="Close this job?"
        description="This job will no longer appear in the marketplace and professionals will not be able to send new proposals."
        confirmLabel="Close Job"
        variant="destructive"
        loading={statusBusy}
        onConfirm={handleCloseJob}
      />

      <Dialog
        open={reopenJobConfirmOpen}
        onOpenChange={(open) => {
          setReopenJobConfirmOpen(open);
          if (!open) setReopenError(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Reopen Job for Work</DialogTitle>
                <DialogDescription>
                  Specify the work needed and offered payment. No milestone setup needed.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {reopenError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{reopenError}</span>
              </div>
            )}

            {/* Reason Selection */}
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
                  Completed work stopped working or needs fixing (e.g. AC cooling issue).
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

            {/* Target Professional Checkbox */}
            {job.previousProfessional && (
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="assignPreviousPro"
                  checked={reopenAssignPreviousPro}
                  onChange={(e) => setReopenAssignPreviousPro(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="assignPreviousPro"
                  className="text-xs text-foreground cursor-pointer select-none"
                >
                  <span className="font-semibold block text-sm">
                    Directly request {job.previousProfessional.firstName}{" "}
                    {job.previousProfessional.lastName}
                  </span>
                  Send this work request directly to your previous professional so they can accept
                  or negotiate right away.
                </label>
              </div>
            )}

            {/* Dispute Escalation Notice */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                <span>Having a dispute or unresolved conflict with the professional?</span>
              </div>
              {job.projectId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  asChild
                >
                  <Link href={`/project/${job.projectId}/tracking#project-dispute-center`}>
                    Raise Dispute
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setReopenJobConfirmOpen(false)}
              disabled={statusBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReopenJob}
              disabled={statusBusy || !reopenWorkDescription.trim()}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              {statusBusy ? "Reopening…" : "Reopen & Propose Work"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageActionLoading
        active={proposalBusy || hireBusy || negotiateBusy || statusBusy}
        title={
          proposalBusy
            ? "Submitting your proposal…"
            : hireBusy
              ? "Creating contract & hiring…"
              : negotiateBusy
                ? "Sending counter-offer…"
                : "Updating job listing…"
        }
        description={
          proposalBusy
            ? "Sending your proposal, rate, and duration estimate to the client."
            : hireBusy
              ? "Setting up the project contract and sending your hire offer."
              : negotiateBusy
                ? "Delivering your updated terms to the professional."
                : "Applying changes to the marketplace status."
        }
      />
    </JobShell>
  );
}
