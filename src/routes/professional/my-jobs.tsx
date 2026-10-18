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
  AlertCircle,
  Home,
  LocateFixed,
  Search,
  Map as MapIcon,
  MapPin,
  SlidersHorizontal,
  Star,
  ShieldCheck,
  Heart,
  Check,
  X,
  ArrowUpDown,
  Briefcase,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import type { MarketplaceCategory } from "@/lib/types/marketplace";
import { getAllStates, getDistrictsByState } from "@/lib/india-locations";
import { getCityCoordinates } from "@/lib/city-coordinates";
import { capitalizeWords, capitalizeFirst, formatReadableLabel } from "@/lib/utils";
import { ServiceTypeDropdown } from "@/components/ServiceTypeDropdown";

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

function normalizeCategoryKey(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function categoryMatches(jobCategory: string | null | undefined, allowedNames: Set<string>) {
  const normalizedJobCategory = normalizeCategoryKey(jobCategory);
  if (!normalizedJobCategory) return true;
  if (allowedNames.has(normalizedJobCategory)) return true;
  return Array.from(allowedNames).some((name) => name === normalizedJobCategory);
}

const segmentOptions: [string, string][] = [
  ["RESIDENTIAL", "Residential"],
  ["COMMERCIAL", "Commercial"],
  ["INDUSTRIAL", "Industrial"],
  ["HEALTH_CARE", "Health Care"],
  ["PERSONAL_CARE", "Personal Care & Home Services"],
  ["EDUCATION", "Education"],
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
  hourlyRate?: number | null;
  totalJobHours?: number | null;
  duration: string;
  coverLetter: string;
  status: string;
  lastActorRole: "CLIENT" | "PROFESSIONAL";
  projectId?: number | null;
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
  const [expandedRequestIds, setExpandedRequestIds] = useState<Set<number>>(new Set());
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
        toast.error(payload?.error || "Unable to update this request.");
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
    setNegotiatePrice("");
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
    if (negotiateTarget.bidAmount != null && bidAmount === negotiateTarget.bidAmount) {
      setNegotiateError(
        `Counter-offer amount cannot be the same as the current bid amount (₹${negotiateTarget.bidAmount.toLocaleString("en-IN")}). Please propose a different amount.`,
      );
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

  function toggleNearMe(checked: boolean = true) {
    setNearMe(checked);
    setLocationError(null);
    if (!checked) return;

    setShowMap(true);
    setLocating(true);
    toast.info("Detecting your location via GPS...");

    if (!navigator.geolocation) {
      const fallback = serviceLocation ?? (getCityCoordinates(city) ? [getCityCoordinates(city)!.lat, getCityCoordinates(city)!.lng] : [19.076, 72.8777]);
      setUserLocation(fallback as [number, number]);
      setLocating(false);
      toast.info("Location is not supported in this browser; using default coordinates.");
      window.requestAnimationFrame(() => {
        mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
        setShowMap(true);
        toast.success("Location set to your current GPS position");
        window.requestAnimationFrame(() => {
          mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      },
      () => {
        const fallback = serviceLocation ?? (getCityCoordinates(city) ? [getCityCoordinates(city)!.lat, getCityCoordinates(city)!.lng] : [19.076, 72.8777]);
        setUserLocation(fallback as [number, number]);
        setLocating(false);
        setShowMap(true);
        toast.info("GPS access not granted; using service or city coordinates.");
        window.requestAnimationFrame(() => {
          mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function useServiceLocation() {
    setLocationError(null);
    const targetLoc: [number, number] = serviceLocation ?? (getCityCoordinates(city) ? [getCityCoordinates(city)!.lat, getCityCoordinates(city)!.lng] : [19.076, 72.8777]);
    setUserLocation(targetLoc);
    setNearMe(true);
    setShowMap(true);
    if (serviceLocation) {
      toast.success("Location set to your service address");
    } else {
      toast.info("Using city coordinates as search center");
    }
    window.requestAnimationFrame(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  useRealtimeRefresh(
    ["servio:proposal", "servio:project-update", "servio:notification", "servio:job-posted"],
    () => {
      void loadJobs();
    },
  );

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
    () =>
      categories.find(
        (c) =>
          normalizeCategoryKey(c.name) === normalizeCategoryKey(category) ||
          normalizeCategoryKey(c.slug) === normalizeCategoryKey(category),
      ) ?? null,
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
    const match =
      categories.find(
        (c) =>
          normalizeCategoryKey(c.name) === normalizeCategoryKey(category) ||
          normalizeCategoryKey(c.slug) === normalizeCategoryKey(category),
      ) ?? null;
    const names = new Set<string>(
      [
        normalizeCategoryKey(match?.name ?? category),
        normalizeCategoryKey(match?.slug ?? category),
      ].filter(Boolean),
    );
    const addChildren = (catId: number) => {
      for (const c of categories) {
        if (c.parentId === catId) {
          names.add(normalizeCategoryKey(c.name));
          names.add(normalizeCategoryKey(c.slug));
          addChildren(c.id);
        }
      }
    };
    if (match) addChildren(match.id);
    return names;
  }, [categories, category]);

  const segmentCategoryNames = useMemo(
    () =>
      new Set(
        categories
          .filter(
            (item) =>
              !segment || normalizeCategoryKey(item.segment) === normalizeCategoryKey(segment),
          )
          .flatMap((item) => [normalizeCategoryKey(item.name), normalizeCategoryKey(item.slug)]),
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
      const names = [normalizeCategoryKey(cat.name), normalizeCategoryKey(cat.slug)];
      for (const childId of childrenMap.get(catId) ?? []) {
        names.push(...getSubtreeNames(childId));
      }
      return names;
    };
    for (const cat of categories) {
      const allNames = new Set(getSubtreeNames(cat.id).filter(Boolean));
      counts[cat.name] = jobs.filter((j) => categoryMatches(j.category, allNames)).length;
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
      const matchesSegment = !segment || categoryMatches(job.category, segmentCategoryNames);
      const matchesCategory =
        !matchingCategoryNames || categoryMatches(job.category, matchingCategoryNames);
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
  const cityCoord = getCityCoordinates(city);
  const mapCenter: [number, number] = userLocation && nearMe
    ? userLocation
    : selectedJob
      ? [selectedJob.locationLat, selectedJob.locationLng]
      : userLocation
        ? userLocation
        : cityCoord
          ? [cityCoord.lat, cityCoord.lng]
          : mapJobs[0]
            ? [mapJobs[0].locationLat, mapJobs[0].locationLng]
            : [19.076, 72.8777];
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
            {(view === "proposals" ? proposals : offers).map((item) => {
              const isExpanded = expandedRequestIds.has(item.id);
              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border bg-card p-4 shadow-soft transition-all ${
                    item.status === "ACCEPTED"
                      ? "border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                      : item.status === "REJECTED"
                        ? "border-destructive/30 bg-destructive/5"
                        : item.lastActorRole === "CLIENT"
                          ? "border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10"
                          : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-foreground">
                            {item.jobTitle}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              item.status === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                : item.status === "REJECTED"
                                  ? "bg-destructive/10 text-destructive"
                                  : item.lastActorRole === "CLIENT"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                            }`}
                          >
                            {item.status === "ACCEPTED" ? (
                              <>
                                <Check className="h-3 w-3" /> Accepted · Active Project
                              </>
                            ) : item.status === "REJECTED" ? (
                              <>
                                <X className="h-3 w-3" /> Declined
                              </>
                            ) : item.lastActorRole === "CLIENT" ? (
                              <>
                                <ArrowUpDown className="h-3 w-3" /> Action Required · Client
                                Response
                              </>
                            ) : (
                              "Awaiting Client Decision"
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {view === "proposals"
                            ? `Submitted to ${capitalizeWords(item.clientName)}`
                            : `Direct Hire from ${capitalizeWords(item.clientName)}`}
                        </p>
                      </div>

                      {/* Pricing badge */}
                      <div className="text-right">
                        {item.hourlyRate && item.totalJobHours ? (
                          <div>
                            <div className="text-xs font-semibold text-foreground">
                              ₹{item.hourlyRate.toLocaleString("en-IN")}/hr × {item.totalJobHours}{" "}
                              hrs
                            </div>
                            <div className="text-xs font-bold text-primary">
                              Total: ₹{item.bidAmount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-bold text-foreground">
                            ₹{item.bidAmount.toLocaleString("en-IN")}{" "}
                            <span className="text-[10px] font-normal text-muted-foreground">
                              (Fixed)
                            </span>
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          Timeline: {item.duration || "Standard"}
                        </div>
                      </div>
                    </div>

                    {/* Pitch / Cover Letter */}
                    {item.coverLetter && (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
                            {item.lastActorRole === "CLIENT" && item.status === "PENDING"
                              ? "Client Note"
                              : "Proposal Pitch"}
                          </span>
                          {item.coverLetter.length > 120 && (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedRequestIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5"
                            >
                              {isExpanded ? (
                                <>
                                  Less <ChevronUp className="h-3 w-3" />
                                </>
                              ) : (
                                <>
                                  More <ChevronDown className="h-3 w-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <p
                          className={`mt-1 text-xs text-foreground whitespace-pre-wrap ${
                            !isExpanded && item.coverLetter.length > 120 ? "line-clamp-2" : ""
                          }`}
                        >
                          {item.coverLetter}
                        </p>
                      </div>
                    )}

                    {/* The 4 Action Buttons + View Job */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Button 1: Accept */}
                      {item.status === "PENDING" && item.lastActorRole === "CLIENT" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm h-8 px-3 text-xs"
                          disabled={offerBusyId === item.id}
                          onClick={() => void respondToOffer(item, "accept")}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {offerBusyId === item.id ? "Working…" : "Accept"}
                        </Button>
                      ) : item.status === "ACCEPTED" ? (
                        <Button
                          size="sm"
                          disabled
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 h-8 px-3 text-xs"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Accepted
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
                      {item.status === "PENDING" && item.lastActorRole === "CLIENT" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-3 text-xs"
                          disabled={offerBusyId === item.id}
                          onClick={() => void respondToOffer(item, "reject")}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Decline
                        </Button>
                      ) : item.status === "REJECTED" ? (
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
                      {item.status === "PENDING" && item.lastActorRole === "CLIENT" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-muted font-medium h-8 px-3 text-xs"
                          disabled={offerBusyId === item.id}
                          onClick={() => openNegotiate(item)}
                        >
                          <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Counter
                        </Button>
                      ) : item.status === "PENDING" && item.lastActorRole === "PROFESSIONAL" ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="hover:bg-muted font-medium h-8 px-3 text-xs"
                        >
                          <Link href={`/professional/job/${item.jobId}`}>
                            <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Modify
                          </Link>
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

                      {/* Button 4: Work */}
                      {item.status === "ACCEPTED" && item.projectId ? (
                        <Button
                          size="sm"
                          asChild
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm h-8 px-3 text-xs"
                        >
                          <Link href={`/project/${item.projectId}/tracking`}>
                            <Briefcase className="h-3.5 w-3.5 mr-1" /> Work{" "}
                            <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled
                          variant="outline"
                          className="text-muted-foreground opacity-50 cursor-not-allowed h-8 px-3 text-xs"
                          title="Work begins after acceptance"
                        >
                          <Briefcase className="h-3.5 w-3.5 mr-1" /> Work
                        </Button>
                      )}

                      {/* View Job Link */}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="ml-auto h-8 px-2.5 text-xs"
                      >
                        <Link href={`/professional/job/${item.jobId}`}>View Job</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
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
                  <div className="mb-3">
                    <ServiceTypeDropdown
                      allowAll
                      value={segment}
                      onChange={(nextSegment) => {
                        setSegment(nextSegment);
                        setCategory("");
                      }}
                    />
                  </div>
                  {segment && topCategories.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="relative">
                        <select
                          value={activeTopCategory?.name ?? ""}
                          onChange={(e) => setCategory(e.target.value)}
                          className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-8 text-xs font-medium text-foreground transition-colors hover:border-foreground/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs capitalize"
                        >
                          <option value="">All Categories</option>
                          {topCategories.map((item) => (
                            <option key={item.id} value={item.name}>
                              {capitalizeWords(item.name)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>

                      {subCategories.length > 0 && (
                        <div className="relative">
                          <select
                            value={category === activeTopCategory?.name ? "" : category}
                            onChange={(e) =>
                              setCategory(e.target.value || (activeTopCategory?.name ?? ""))
                            }
                            className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-8 text-xs font-medium text-foreground transition-colors hover:border-foreground/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs capitalize"
                          >
                            <option value="">
                              All {activeTopCategory?.name ? capitalizeWords(activeTopCategory.name) : "Subcategories"}
                            </option>
                            {subCategories.map((item) => (
                              <option key={item.id} value={item.name}>
                                {capitalizeWords(item.name)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Search Radius & Distance
                  </p>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full justify-center gap-2 rounded-xl text-xs font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all shadow-xs"
                        onClick={() => toggleNearMe(true)}
                      >
                        <LocateFixed className="h-3.5 w-3.5 text-primary" />
                        Current Location
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full justify-center gap-2 rounded-xl text-xs font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all shadow-xs"
                        onClick={useServiceLocation}
                      >
                        <Home className="h-3.5 w-3.5 text-primary" />
                        Service Location
                      </Button>
                    </div>

                    {locating && <p className="text-xs text-muted-foreground">Locating…</p>}
                    {locationError && (
                      <p className="text-xs text-destructive">{locationError}</p>
                    )}

                    {/* Active Center Indicator */}
                    <div className="rounded-lg border bg-muted/40 p-2.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Center:</span>
                        <span className="font-semibold text-foreground truncate max-w-[140px]">
                          {nearMe && userLocation ? "Location Active" : "Pick Location"}
                        </span>
                      </div>
                    </div>

                    {/* Radius Drag Slider System */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-foreground">
                          Radius:{" "}
                          <span className="font-semibold text-primary">
                            {nearMe ? `${radiusKm} km` : "Select radius"}
                          </span>
                        </span>
                        {nearMe && (
                          <button
                            type="button"
                            className="text-[11px] font-medium text-primary hover:underline"
                            onClick={() => {
                              setNearMe(false);
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={MIN_NEAR_ME_RADIUS_KM}
                            max={MAX_NEAR_ME_RADIUS_KM}
                            value={radiusKm}
                            onChange={(event) => {
                              const val = Number(event.target.value);
                              setRadiusKm(val);
                              setNearMe(true);
                              setShowMap(true);
                              if (!userLocation) {
                                if (serviceLocation) {
                                  setUserLocation(serviceLocation);
                                } else {
                                  const fallback = getCityCoordinates(city) ?? { lat: 19.076, lng: 72.8777 };
                                  setUserLocation([fallback.lat, fallback.lng]);
                                }
                              }
                            }}
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                          />
                          <span className="w-14 text-right text-xs font-bold text-primary">
                            {nearMe ? `${radiusKm} km` : `${radiusKm} km`}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                          <span>1 km</span>
                          <span>25 km</span>
                          <span>50 km</span>
                          <span>100 km</span>
                        </div>
                      </div>

                      {nearMe && (
                        <button
                          type="button"
                          className="pt-1 text-xs text-muted-foreground hover:text-destructive hover:underline"
                          onClick={() => {
                            setNearMe(false);
                          }}
                        >
                          Clear location filter
                        </button>
                      )}
                    </div>
                  </div>
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
                      <JobsPreviewMap points={previewPoints} fallbackCenter={mapCenter} />
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
                      className="relative h-[360px] overflow-hidden rounded-2xl border border-border"
                    >
                      <ProfessionalJobsMap
                        center={mapCenter}
                        jobs={displayedMapJobs}
                        radiusKm={nearMe ? radiusKm : null}
                        userLocation={nearMe && userLocation ? userLocation : null}
                        onSelectJob={setSelectedJobId}
                      />
                      {nearMe && displayedMapJobs.length === 0 && (
                        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card/90 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur border border-border">
                          No jobs found within {radiusKm} km — drag slider to expand radius
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Approximate location — shown for privacy</span>
                      {nearMe && (
                        <span>
                          Radius: <strong className="text-foreground">{radiusKm} km</strong>
                        </span>
                      )}
                    </div>
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
                                {capitalizeWords(job.category ?? "General")}
                              </p>
                              <h3 className="mt-2 text-[17px] font-semibold leading-tight text-foreground">
                                {capitalizeWords(job.title)}
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
                                {job.clientName ? <span>{capitalizeWords(job.clientName)}</span> : null}
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
                                {formatReadableLabel(job.status)}
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

          {negotiateTarget?.bidAmount != null && (
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">
                  Current / Last Bid Amount:
                </span>
                <span className="text-sm font-bold text-foreground">
                  ₹{negotiateTarget.bidAmount.toLocaleString("en-IN")}
                </span>
              </div>
              {negotiateTarget.duration && (
                <div className="flex items-center justify-between border-t border-border/60 pt-1.5">
                  <span className="text-muted-foreground font-medium">Current Timeline:</span>
                  <span className="font-semibold text-foreground">{negotiateTarget.duration}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 grid gap-3.5 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-xl [&_input]:border [&_input]:border-border [&_input]:bg-background [&_input]:px-3.5 [&_input]:py-2.5 [&_input]:text-sm [&_input]:shadow-2xs [&_input]:transition-all [&_input]:placeholder:text-muted-foreground/50 focus-within:[&_input]:border-primary focus-within:[&_input]:ring-2 focus-within:[&_input]:ring-primary/20 [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border [&_textarea]:bg-background [&_textarea]:px-3.5 [&_textarea]:py-2.5 [&_textarea]:text-sm [&_textarea]:shadow-2xs [&_textarea]:transition-all [&_textarea]:placeholder:text-muted-foreground/50 [&_textarea]:min-h-[96px] [&_textarea]:resize-y focus-within:[&_textarea]:border-primary focus-within:[&_textarea]:ring-2 focus-within:[&_textarea]:ring-primary/20">
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
                className={negotiateError && !negotiatePrice ? "!border-destructive !placeholder:text-destructive/60" : ""}
              />
              {negotiateTarget?.bidAmount != null &&
                negotiatePrice.trim() !== "" &&
                Number(negotiatePrice) === negotiateTarget.bidAmount && (
                  <p className="mt-1.5 text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Amount cannot be the same as the current bid (₹
                    {negotiateTarget.bidAmount.toLocaleString("en-IN")}). Please propose a different
                    amount.
                  </p>
                )}
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Proposed Timeline <span className="text-destructive">*</span>
              </label>
              <input
                value={negotiateDuration}
                onChange={(event) => setNegotiateDuration(event.target.value)}
                placeholder="Timeline (for example, 10 days)"
                className={negotiateError && !negotiateDuration ? "!border-destructive !placeholder:text-destructive/60" : ""}
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
                className={negotiateError && !negotiateMessage ? "!border-destructive !placeholder:text-destructive/60" : ""}
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
                (negotiateTarget?.bidAmount != null &&
                  Number(negotiatePrice) === negotiateTarget.bidAmount) ||
                !negotiatePrice.trim() ||
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
