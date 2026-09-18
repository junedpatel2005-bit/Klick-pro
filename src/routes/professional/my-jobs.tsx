"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Home,
  LocateFixed,
  Search,
  Map as MapIcon,
  MapPin,
  SlidersHorizontal,
  Star,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MarketplaceCategory } from "@/lib/types/marketplace";
import { getAllStates, getDistrictsByState } from "@/lib/india-locations";

const ProfessionalJobsMap = dynamic(() => import("@/components/ProfessionalJobsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});
const JobsPreviewMap = dynamic(() => import("@/components/JobsPreviewMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});

// Keep the complete server-provided feed available to the search and filter controls.
// The API applies the professional's eligibility and service-area rules first.
const PAGE_SIZE = 100;
const DEFAULT_NEAR_ME_RADIUS_KM = 25;
const MIN_NEAR_ME_RADIUS_KM = 1;
const MAX_NEAR_ME_RADIUS_KM = 100;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}
const segmentOptions: [string, string][] = [
  ["RESIDENTIAL", "Residential"],
  ["COMMERCIAL", "Commercial"],
  ["INDUSTRIAL", "Industrial"],
];

type JobListItem = {
  id: number;
  title: string;
  category: string | null;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string | null;
  locationAddress: string | null;
  locationState: string | null;
  locationDistrict: string | null;
  locationLat: number | null;
  locationLng: number | null;
  distanceKm: number | null;
  description: string | null;
  clientName: string | null;
  clientRating: number;
  clientVerified: boolean;
  createdAt: string;
  proposalCount: number;
};

type RequestItem = {
  id: number;
  jobId: number;
  jobTitle: string;
  clientName: string;
  bidAmount: number;
  duration: string;
  coverLetter: string;
  status: string;
  lastActorRole: "CLIENT" | "PROFESSIONAL";
  createdAt: string;
};

type JobsResponse = {
  professional?: { professionalLatitude: number | null; professionalLongitude: number | null };
  openJobs: JobListItem[];
  savedJobs: JobListItem[];
  proposals: RequestItem[];
  offers: RequestItem[];
  activeProjects: unknown[];
  completedProjects: unknown[];
};

function requestStatusStyle(status: string) {
  if (status === "PENDING") return "bg-warning/10 text-warning";
  if (status === "ACCEPTED") return "bg-success/10 text-success";
  return "bg-destructive/10 text-destructive";
}

function formatBudgetAmount(value: number | null | undefined, timingType?: string | null) {
  if (timingType === "HOURLY" && value != null) return `₹${value.toLocaleString()}/hr`;
  if (value == null) return "Budget on request";
  return `₹${value.toLocaleString()}`;
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
  timingType?: string | null,
) {
  if (timingType === "HOURLY") {
    return min == null ? "Hourly rate not set" : `₹${min.toLocaleString()}/hr`;
  }
  if (min == null && max == null) return "Budget on request";
  return `₹${min?.toLocaleString() ?? "—"} – ₹${max?.toLocaleString() ?? "—"}`;
}

function ProfessionalJobsContent() {
  const router = useRouter();
  const [openJobs, setOpenJobs] = useState<JobListItem[]>([]);
  const [hasServiceLocation, setHasServiceLocation] = useState(true);
  const [savedJobs, setSavedJobs] = useState<JobListItem[]>([]);
  const [proposals, setProposals] = useState<RequestItem[]>([]);
  const [offers, setOffers] = useState<RequestItem[]>([]);
  const [view, setView] = useState<"all" | "saved" | "proposals" | "offers">("all");
  const jobs = view === "saved" ? savedJobs : openJobs;
  const savedIds = useMemo(() => new Set(savedJobs.map((job) => job.id)), [savedJobs]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [serviceLocation, setServiceLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_NEAR_ME_RADIUS_KM);
  const [sort, setSort] = useState("Best match");
  const [showMap, setShowMap] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offerBusyId, setOfferBusyId] = useState<number | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

  async function respondToOffer(offer: RequestItem, action: "accept" | "reject") {
    setOfferBusyId(offer.id);
    try {
      const response = await fetch(`/api/v1/professional/project-requests/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        alert(payload?.error || "Unable to update this request.");
        return;
      }
      if (action === "accept" && payload.project?.id) {
        router.push(`/project/${payload.project.id}/tracking`);
        return;
      }
      await loadJobs();
    } finally {
      setOfferBusyId(null);
    }
  }

  const [negotiateTarget, setNegotiateTarget] = useState<RequestItem | null>(null);
  const [negotiatePrice, setNegotiatePrice] = useState("");
  const [negotiateDuration, setNegotiateDuration] = useState("");
  const [negotiateMessage, setNegotiateMessage] = useState("");
  const [negotiateBusy, setNegotiateBusy] = useState(false);
  const [negotiateError, setNegotiateError] = useState<string | null>(null);

  function openNegotiate(item: RequestItem) {
    setNegotiateTarget(item);
    setNegotiatePrice(String(item.bidAmount));
    setNegotiateDuration(item.duration);
    setNegotiateMessage("");
    setNegotiateError(null);
  }

  async function submitNegotiation() {
    if (!negotiateTarget) return;
    const bidAmount = Number(negotiatePrice);
    if (
      !Number.isSafeInteger(bidAmount) ||
      bidAmount < 1 ||
      !negotiateDuration.trim() ||
      !negotiateMessage.trim()
    ) {
      setNegotiateError("Enter a valid price, timeline, and message.");
      return;
    }
    setNegotiateBusy(true);
    setNegotiateError(null);
    try {
      const response = await fetch(`/api/v1/professional/project-requests/${negotiateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "counter",
          bidAmount,
          duration: negotiateDuration,
          message: negotiateMessage,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to send your counter-offer.");
      setNegotiateTarget(null);
      await loadJobs();
    } catch (error) {
      setNegotiateError(
        error instanceof Error ? error.message : "Unable to send your counter-offer.",
      );
    } finally {
      setNegotiateBusy(false);
    }
  }

  const [focusedJobId, setFocusedJobId] = useState<number | null>(null);

  function showJobLocation(jobId: number) {
    setSelectedJobId(jobId);
    setFocusedJobId(jobId);
    setShowMap(true);
  }

  useEffect(() => {
    if (!showMap) return;
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [showMap, selectedJobId]);

  function toggleNearMe(checked: boolean) {
    setNearMe(checked);
    setLocationError(null);
    if (!checked || userLocation) return;
    if (!navigator.geolocation) {
      setLocationError("Location isn't available in this browser.");
      setNearMe(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocationError("Location permission was not granted.");
        setLocating(false);
        setNearMe(false);
      },
    );
  }

  function useServiceLocation() {
    if (!serviceLocation) {
      setLocationError("Please add your service location to your profile first.");
      return;
    }
    setLocationError(null);
    setUserLocation(serviceLocation);
    setNearMe(true);
  }

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/v1/portal/professional-jobs", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load jobs");
      const payload = (await response.json()) as JobsResponse;
      setOpenJobs(payload.openJobs ?? []);
      setSavedJobs(payload.savedJobs ?? []);
      setProposals(payload.proposals ?? []);
      setOffers(payload.offers ?? []);
      setHasServiceLocation(
        payload.professional?.professionalLatitude != null &&
          payload.professional?.professionalLongitude != null,
      );
      if (
        payload.professional?.professionalLatitude != null &&
        payload.professional?.professionalLongitude != null
      ) {
        setServiceLocation([
          payload.professional.professionalLatitude,
          payload.professional.professionalLongitude,
        ]);
      }
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load jobs. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("view") ?? params.get("tab");
    if (requested === "saved" || requested === "proposals" || requested === "offers")
      setView(requested);
  }, []);

  useEffect(() => {
    void fetch("/api/v1/marketplace/categories")
      .then((response) => (response.ok ? response.json() : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function bumpProposalCount(list: JobListItem[], jobId: number, delta: number) {
    return list.map((item) =>
      item.id === jobId
        ? { ...item, proposalCount: Math.max(0, item.proposalCount + delta) }
        : item,
    );
  }

  function applySaveChange(saved: boolean, job: JobListItem, delta: number) {
    setOpenJobs((current) => bumpProposalCount(current, job.id, delta));
    setSavedJobs((current) => {
      const bumped = bumpProposalCount(current, job.id, delta);
      if (saved) return bumped.filter((item) => item.id !== job.id);
      if (bumped.some((item) => item.id === job.id)) return bumped;
      return [...bumped, { ...job, proposalCount: Math.max(0, job.proposalCount + delta) }];
    });
  }

  async function toggleSave(job: JobListItem, saved: boolean) {
    const delta = saved ? -1 : 1;
    applySaveChange(saved, job, delta);
    try {
      const response = await fetch(`/api/v1/professional/favorite-jobs/${job.id}`, {
        method: saved ? "DELETE" : "POST",
      });
      if (!response.ok) throw new Error();
    } catch {
      applySaveChange(!saved, job, -delta);
      setError("Unable to update saved jobs. Please try again.");
    }
  }

  const segmentCategory = useMemo(
    () =>
      segment
        ? (categories.find((c) => c.parentId === null && c.segment === segment) ?? null)
        : null,
    [categories, segment],
  );

  const topCategories = useMemo(() => {
    if (!segment) return [];
    if (segmentCategory) {
      return categories.filter((c) => c.parentId === segmentCategory.id);
    }
    return categories.filter((c) => c.parentId === null && c.segment === segment);
  }, [categories, segment, segmentCategory]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.name === category) ?? null,
    [categories, category],
  );

  const activeTopCategory = useMemo(() => {
    if (!selectedCategory) return null;
    if (segmentCategory && selectedCategory.parentId === segmentCategory.id)
      return selectedCategory;
    if (selectedCategory.parentId === null) return selectedCategory;
    return categories.find((c) => c.id === selectedCategory.parentId) ?? null;
  }, [categories, selectedCategory, segmentCategory]);

  const subCategories = useMemo(
    () =>
      activeTopCategory && activeTopCategory.id !== segmentCategory?.id
        ? categories.filter((c) => c.parentId === activeTopCategory.id)
        : [],
    [categories, activeTopCategory, segmentCategory],
  );

  const matchingCategoryNames = useMemo(() => {
    if (!category) return null;
    const match = categories.find((c) => c.name === category);
    if (!match) return new Set([category]);
    const names = new Set<string>([match.name]);
    const addChildren = (catId: number) => {
      for (const c of categories) {
        if (c.parentId === catId) {
          names.add(c.name);
          addChildren(c.id);
        }
      }
    };
    addChildren(match.id);
    return names;
  }, [categories, category]);

  const segmentCategoryNames = useMemo(
    () =>
      new Set(
        categories.filter((item) => !segment || item.segment === segment).map((item) => item.name),
      ),
    [categories, segment],
  );

  const jobCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    const childrenMap = new Map<number, number[]>();
    for (const c of categories) {
      if (c.parentId !== null) {
        const list = childrenMap.get(c.parentId) ?? [];
        list.push(c.id);
        childrenMap.set(c.parentId, list);
      }
    }
    const getSubtreeNames = (catId: number): string[] => {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) return [];
      const names = [cat.name];
      for (const childId of childrenMap.get(catId) ?? []) {
        names.push(...getSubtreeNames(childId));
      }
      return names;
    };
    for (const cat of categories) {
      const allNames = new Set(getSubtreeNames(cat.id));
      counts[cat.name] = jobs.filter((j) => j.category && allNames.has(j.category)).length;
    }
    return counts;
  }, [categories, jobs]);

  const filteredJobs = useMemo(() => {
    const value = query.trim().toLowerCase();
    const withLiveDistance = jobs.map((job) => {
      if (!nearMe || !userLocation || job.locationLat === null || job.locationLng === null)
        return job;
      const [lat, lng] = userLocation;
      return { ...job, distanceKm: distanceKm(lat, lng, job.locationLat, job.locationLng) };
    });
    return withLiveDistance.filter((job) => {
      const matchesQuery =
        !value ||
        [job.title, job.category, job.locationAddress, job.clientName]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(value));
      const matchesSegment = !segment || segmentCategoryNames.has(job.category ?? "");
      const matchesCategory =
        !matchingCategoryNames || matchingCategoryNames.has(job.category ?? "");
      const matchesCity =
        !city || (job.locationAddress ?? "").toLowerCase().includes(city.toLowerCase());
      const matchesState = !state || job.locationState === state;
      const matchesDistrict = !district || job.locationDistrict === district;
      const matchesRating = minRating === "" || (job.clientRating ?? 0) >= Number(minRating);
      const matchesVerified = !verifiedOnly || job.clientVerified;
      const matchesNearMe = !nearMe || (job.distanceKm !== null && job.distanceKm <= radiusKm);
      return (
        matchesQuery &&
        matchesSegment &&
        matchesCategory &&
        matchesCity &&
        matchesState &&
        matchesDistrict &&
        matchesRating &&
        matchesVerified &&
        matchesNearMe
      );
    });
  }, [
    jobs,
    query,
    segment,
    segmentCategoryNames,
    matchingCategoryNames,
    city,
    state,
    district,
    minRating,
    verifiedOnly,
    nearMe,
    userLocation,
    radiusKm,
  ]);

  const visibleJobs = useMemo(() => {
    const sorted = [...filteredJobs];
    if (nearMe) {
      sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else if (sort === "Highest rated") {
      sorted.sort((a, b) => (b.clientRating ?? 0) - (a.clientRating ?? 0));
    } else if (sort === "Newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted.slice(0, PAGE_SIZE);
  }, [filteredJobs, sort, nearMe]);

  useEffect(() => {
    if (visibleJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    const firstJob = visibleJobs[0];
    if (!firstJob) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !visibleJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(firstJob.id);
    }
  }, [selectedJobId, visibleJobs]);

  const mapJobs = useMemo(
    () =>
      visibleJobs.filter(
        (job): job is JobListItem & { locationLat: number; locationLng: number } =>
          job.locationLat !== null && job.locationLng !== null,
      ),
    [visibleJobs],
  );

  const displayedMapJobs = useMemo(() => {
    if (focusedJobId != null) {
      const matched = mapJobs.filter((j) => j.id === focusedJobId);
      if (matched.length > 0) return matched;
    }
    return mapJobs;
  }, [mapJobs, focusedJobId]);

  const focusedJob = useMemo(
    () => (focusedJobId != null ? (mapJobs.find((j) => j.id === focusedJobId) ?? null) : null),
    [mapJobs, focusedJobId],
  );

  const selectedJob =
    displayedMapJobs.find((job) => job.id === selectedJobId) ?? displayedMapJobs[0] ?? null;
  const mapCenter: [number, number] = selectedJob
    ? [selectedJob.locationLat, selectedJob.locationLng]
    : [20, 0];
  const previewPoints: [number, number][] = mapJobs.map((job) => [
    job.locationLat,
    job.locationLng,
  ]);

  return (
    <>
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {view === "saved"
                ? "Saved jobs"
                : view === "proposals"
                  ? "My proposals"
                  : view === "offers"
                    ? "Hire requests"
                    : "Find jobs"}
            </h1>
            {view === "proposals" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {`${proposals.length} proposal${proposals.length === 1 ? "" : "s"} sent`}
              </p>
            ) : view === "offers" ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {`${offers.length} hire request${offers.length === 1 ? "" : "s"} received`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${view === "all" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
            >
              All jobs
            </button>
            <button
              type="button"
              onClick={() => setView("saved")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${view === "saved" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Heart className="h-3.5 w-3.5" />
              Saved ({savedJobs.length})
            </button>
            <button
              type="button"
              onClick={() => setView("proposals")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${view === "proposals" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
            >
              My Proposals ({proposals.length})
            </button>
            <button
              type="button"
              onClick={() => setView("offers")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${view === "offers" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
            >
              Hire Requests ({offers.length})
            </button>
          </div>
        </div>

        {view === "proposals" || view === "offers" ? (
          <div className="space-y-3">
            {(view === "proposals" ? proposals : offers).map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{item.jobTitle}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${requestStatusStyle(item.status)}`}
                      >
                        {item.status === "PENDING"
                          ? item.lastActorRole === "CLIENT"
                            ? "Your turn to respond"
                            : "Awaiting client"
                          : item.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {view === "proposals"
                        ? `To ${item.clientName}`
                        : `Invited by ${item.clientName}`}{" "}
                      · ₹{item.bidAmount.toLocaleString()} · {item.duration}
                      {item.coverLetter ? ` · "${item.coverLetter}"` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/professional/job/${item.jobId}`}>View Job</Link>
                    </Button>
                    {item.status === "PENDING" && item.lastActorRole === "CLIENT" && (
                      <>
                        <Button
                          size="sm"
                          disabled={offerBusyId === item.id}
                          onClick={() => void respondToOffer(item, "accept")}
                        >
                          {offerBusyId === item.id ? "Working…" : "Accept"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={offerBusyId === item.id}
                          onClick={() => openNegotiate(item)}
                        >
                          Negotiate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={offerBusyId === item.id}
                          onClick={() => void respondToOffer(item, "reject")}
                        >
                          Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {(view === "proposals" ? proposals : offers).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center text-sm text-muted-foreground">
                {view === "proposals"
                  ? "You haven't sent any proposals yet. Browse open jobs to get started."
                  : "No clients have invited you to a job yet."}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Filters</h2>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setQuery("");
                    setSegment("");
                    setCategory("");
                    setCity("");
                    setState("");
                    setDistrict("");
                    setMinRating("");
                    setVerifiedOnly(false);
                    setNearMe(false);
                    setLocationError(null);
                    setRadiusKm(DEFAULT_NEAR_ME_RADIUS_KM);
                  }}
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    State and district
                  </p>
                  <div className="space-y-2">
                    <select
                      value={state}
                      onChange={(event) => {
                        setState(event.target.value);
                        setDistrict("");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">All states</option>
                      {getAllStates().map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <select
                      value={district}
                      onChange={(event) => setDistrict(event.target.value)}
                      disabled={!state}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">All districts</option>
                      {(getDistrictsByState(state) ?? []).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Category
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {segmentOptions.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setSegment((current) => (current === value ? "" : value));
                          setCategory("");
                        }}
                        className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                          segment === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {segment ? (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="category"
                          checked={category === ""}
                          onChange={() => setCategory("")}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>All categories</span>
                      </label>
                      {topCategories.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="category"
                            checked={activeTopCategory?.name === item.name}
                            onChange={() => setCategory(item.name)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="flex-1">{item.name}</span>
                          {jobCountByCategory[item.name] ? (
                            <span className="text-xs text-muted-foreground">
                              {jobCountByCategory[item.name]}
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Select Residential, Commercial, or Industrial to see categories.
                    </p>
                  )}
                  {subCategories.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sub-categories of {activeTopCategory?.name}
                      </p>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="subcategory"
                          checked={category === activeTopCategory?.name}
                          onChange={() => setCategory(activeTopCategory?.name ?? "")}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>All {activeTopCategory?.name}</span>
                      </label>
                      {subCategories.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="subcategory"
                            checked={category === item.name}
                            onChange={() => setCategory(item.name)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="flex-1">{item.name}</span>
                          {jobCountByCategory[item.name] ? (
                            <span className="text-xs text-muted-foreground">
                              {jobCountByCategory[item.name]}
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Location
                  </p>
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => toggleNearMe(true)}
                    >
                      <LocateFixed className="size-4" />
                      Use my current location
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={useServiceLocation}
                    >
                      <Home className="size-4" />
                      Use my service location
                    </Button>
                  </div>
                  {locating && <p className="mt-1.5 text-xs text-muted-foreground">Locating…</p>}
                  {locationError && (
                    <p className="mt-1.5 text-xs text-destructive">{locationError}</p>
                  )}
                  {nearMe && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Radius</span>
                        <span className="font-semibold text-foreground">{radiusKm} km</span>
                      </div>
                      <input
                        type="range"
                        min={MIN_NEAR_ME_RADIUS_KM}
                        max={MAX_NEAR_ME_RADIUS_KM}
                        value={radiusKm}
                        onChange={(event) => setRadiusKm(Number(event.target.value))}
                        className="mt-1.5 h-1.5 w-full cursor-pointer accent-primary"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Verified only
                  </p>
                  <label className="flex items-center justify-between text-sm">
                    <span>Verified pros</span>
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(event) => setVerifiedOnly(event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    City
                  </p>
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="e.g. Toronto, Vancouver"
                  />
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Minimum rating
                  </p>
                  <select
                    value={minRating}
                    onChange={(event) =>
                      setMinRating(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Any rating</option>
                    <option value={4}>4.0+ stars</option>
                    <option value={4.5}>4.5+ stars</option>
                    <option value={4.8}>4.8+ stars</option>
                  </select>
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try 'plumber', 'react developer', 'wedding photographer'"
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                      className="h-10 appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm"
                    >
                      <option>Best match</option>
                      <option>Highest rated</option>
                      <option>Newest</option>
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowMap((current) => {
                        if (current) setFocusedJobId(null);
                        return !current;
                      });
                    }}
                    className="gap-2"
                  >
                    <MapIcon className="h-4 w-4" />
                    {showMap ? "Hide map" : "Show map"}
                  </Button>
                </div>
              </div>

              {!loading && !showMap && mapJobs.length > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setFocusedJobId(null);
                    setShowMap(true);
                    window.requestAnimationFrame(() => {
                      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.currentTarget.click();
                  }}
                  className="w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-soft transition-all hover:border-primary/50 hover:shadow-elevated sm:p-6"
                >
                  <div className="flex h-32 items-center justify-between gap-6">
                    <div className="text-left">
                      <p className="text-sm font-semibold">Jobs near you</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {mapJobs.length} available • Click to view on map
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Approximate location — shown for privacy
                      </p>
                    </div>
                    <div className="h-full w-1/2">
                      <JobsPreviewMap points={previewPoints} />
                    </div>
                  </div>
                </div>
              )}

              {error ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Jobs near you</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {visibleJobs.length} results
                  </span>
                </div>

                {!loading && !hasServiceLocation && (
                  <p className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Set your location and service radius in{" "}
                    <Link href="/professional/setup" className="font-semibold underline">
                      your profile
                    </Link>{" "}
                    to see distances and jobs sorted by how close they are to you.
                  </p>
                )}

                {showMap && (
                  <div className="mb-4">
                    {focusedJob && (
                      <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-foreground truncate">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>
                            Showing location for:{" "}
                            <strong className="font-semibold text-primary">
                              {focusedJob.title}
                            </strong>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFocusedJobId(null)}
                          className="ml-2 whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                        >
                          Show all on map ({mapJobs.length})
                        </button>
                      </div>
                    )}
                    <div
                      ref={mapSectionRef}
                      className="relative h-[320px] overflow-hidden rounded-2xl border border-border"
                    >
                      {displayedMapJobs.length > 0 ? (
                        <ProfessionalJobsMap
                          center={mapCenter}
                          jobs={displayedMapJobs}
                          onSelectJob={setSelectedJobId}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_10%),linear-gradient(180deg,#bfe8ef_0%,#b1d7df_100%)] text-sm text-muted-foreground">
                          None of your matching jobs have a pinned location yet.
                        </div>
                      )}
                    </div>
                    {displayedMapJobs.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Approximate location — shown for privacy
                      </p>
                    )}
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3">
                    <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                    <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                    <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                  </div>
                ) : visibleJobs.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {visibleJobs.map((job) => {
                      const saved = savedIds.has(job.id);
                      return (
                        <article
                          key={job.id}
                          onClick={() => router.push(`/professional/job/${job.id}`)}
                          className={`cursor-pointer rounded-2xl border bg-background p-4 transition hover:border-primary/40 ${
                            selectedJobId === job.id
                              ? "border-primary shadow-soft"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                                {job.category ?? "General"}
                              </p>
                              <h3 className="mt-2 text-[17px] font-semibold leading-tight text-foreground">
                                {job.title}
                              </h3>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>{job.locationAddress ?? "Remote"}</span>
                                {job.distanceKm !== null && (
                                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {job.distanceKm < 1
                                      ? "Less than 1 km away"
                                      : `${job.distanceKm.toFixed(1)} km away`}
                                  </span>
                                )}
                                {job.clientName ? <span>{job.clientName}</span> : null}
                                <span className="inline-flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                                  {job.clientRating.toFixed(1)}
                                </span>
                                {job.clientVerified && (
                                  <span className="inline-flex items-center gap-1 text-primary">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Verified
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                {job.status}
                              </span>
                              <button
                                type="button"
                                aria-label={saved ? "Remove from saved jobs" : "Save this job"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void toggleSave(job, saved);
                                }}
                                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                                  saved
                                    ? "bg-cta/10 text-cta"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                              </button>
                            </div>
                          </div>

                          {job.description ? (
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                              {job.description}
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {formatBudgetRange(job.budgetMin, job.budgetMax, job.timingType)}
                            </span>
                            <span>•</span>
                            <span>{formatBudgetAmount(job.hourlyRate, job.timingType)}</span>
                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Button asChild size="sm">
                                <Link
                                  href={`/professional/job/${job.id}`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  View details
                                </Link>
                              </Button>
                              {job.locationLat !== null && job.locationLng !== null && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    showJobLocation(job.id);
                                  }}
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                  Show location
                                </Button>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {job.proposalCount} pros saved
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center text-sm text-muted-foreground">
                    {view === "saved" && !savedJobs.length
                      ? "You haven't saved any jobs yet. Tap the heart on a job to save it here."
                      : "No jobs match your current filters."}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
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
              Propose a different price, timeline, or terms for {negotiateTarget?.jobTitle}. The
              client can accept, decline, or counter back.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3 [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2">
            <input
              type="number"
              min="1"
              value={negotiatePrice}
              onChange={(event) => setNegotiatePrice(event.target.value)}
              placeholder="Your counter price"
            />
            <input
              value={negotiateDuration}
              onChange={(event) => setNegotiateDuration(event.target.value)}
              placeholder="Timeline (for example, 10 days)"
            />
            <textarea
              value={negotiateMessage}
              onChange={(event) => setNegotiateMessage(event.target.value)}
              placeholder="Explain your counter-offer"
              rows={4}
            />
          </div>
          {negotiateError && <p className="mt-3 text-sm text-destructive">{negotiateError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNegotiateTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={negotiateBusy}
              onClick={() => void submitNegotiation()}
            >
              {negotiateBusy ? "Sending…" : "Send Counter-Offer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProfessionalMyJobs() {
  return (
    <Suspense fallback={null}>
      <ProfessionalJobsContent />
    </Suspense>
  );
}
