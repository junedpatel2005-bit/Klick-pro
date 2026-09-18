"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
const ProfessionalDiscoveryMap = dynamic(() => import("@/components/ProfessionalDiscoveryMap"), {
  ssr: false,
});
const ProfessionalsPreviewMap = dynamic(() => import("@/components/ProfessionalsPreviewMap"), {
  ssr: false,
});
import { ProCard } from "@/components/ProCard";
import Skeleton from "react-loading-skeleton";
import type { MarketplaceCategory, MarketplaceProfessional } from "@/lib/types/marketplace";
import type { ProfessionalDiscoveryResponse } from "@/lib/types/professional-discovery";
import { Home, LocateFixed, Map, SlidersHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAllStates, getDistrictsByState } from "@/lib/india-locations";

const PAGE_SIZE = 50;
const segmentOptions: [string, string][] = [
  ["RESIDENTIAL", "Residential"],
  ["COMMERCIAL", "Commercial"],
  ["INDUSTRIAL", "Industrial"],
];

function toMarketplaceProfessional(
  professional: ProfessionalDiscoveryResponse["professionals"][number],
): MarketplaceProfessional {
  return {
    id: professional.id,
    name: professional.name,
    title: professional.title,
    avatar: professional.avatarUrl,
    rating: professional.rating,
    reviews: professional.reviewCount,
    hourlyRate: professional.hourlyRate,
    location: professional.location,
    availability: professional.availabilityStatus,
    verified: professional.verified,
    skills: professional.skills,
    bio: professional.bio,
    approximateDistanceKm: professional.approximateDistanceKm,
  };
}

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const [results, setResults] = useState<ProfessionalDiscoveryResponse | null>(null);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [minRating, setMinRating] = useState<number | "">("");
  const [availability, setAvailability] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | "">("");
  const [originLat, setOriginLat] = useState<number | null>(null);
  const [originLng, setOriginLng] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [sort, setSort] = useState<
    "recommended" | "rating" | "distance" | "most-reviewed" | "price"
  >("recommended");
  const [page, setPage] = useState(1);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const professionals = useMemo(
    () => (results ? results.professionals.map(toMarketplaceProfessional) : []),
    [results],
  );

  function requestMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOriginLat(position.coords.latitude);
        setOriginLng(position.coords.longitude);
        setDistanceKm((current) => (current === "" ? 25 : current));
        setPage(1);
        userLocationRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      },
      () => {
        alert("Unable to retrieve your location. Please enable location access or enter a city.");
      },
    );
  }

  async function requestPrimaryAddress() {
    try {
      const profileResponse = await fetch("/api/profile");
      if (!profileResponse.ok) throw new Error("Unable to load your primary address.");
      const profileData = (await profileResponse.json()) as {
        account?: { address?: string | null };
        profile?: { address?: string | null } | null;
      };
      const address = profileData.profile?.address?.trim() || profileData.account?.address?.trim();
      if (!address) {
        alert("Please add a primary address to your profile first.");
        return;
      }

      const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const geocodeData = (await geocodeResponse.json()) as {
        results?: { lat: number; lon: number }[];
        error?: string;
      };
      const location = geocodeData.results?.[0];
      if (!location) throw new Error(geocodeData.error ?? "Unable to find your primary address.");

      setOriginLat(location.lat);
      setOriginLng(location.lon);
      setDistanceKm((current) => (current === "" ? 25 : current));
      setPage(1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to use your primary address.");
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const response = await fetch("/api/v1/marketplace/categories", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load categories");
        setCategories((await response.json()) as MarketplaceCategory[]);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("discover.categories.load", error);
        }
      }
    }

    void loadCategories();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!jobId || categories.length === 0) return;
    const controller = new AbortController();
    void fetch(`/api/v1/marketplace/job?id=${encodeURIComponent(jobId)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((job: { category?: string | null } | null) => {
        if (!job?.category) return;
        const target = categories.find((c) => c.name.toLowerCase() === job.category!.toLowerCase());
        if (!target) return;
        setSegment(target.segment);
        const segmentRoot = categories.find(
          (c) => c.parentId === null && c.segment === target.segment,
        );
        setParentCategoryId(segmentRoot?.id ?? null);
        if (target.parentId === null || target.parentId === segmentRoot?.id) {
          setCategoryId(target.id);
          setSubcategoryId(null);
        } else {
          setCategoryId(target.parentId);
          setSubcategoryId(target.id);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [jobId, categories]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (segment) params.set("segment", segment);
    if (parentCategoryId !== null) params.set("parentCategoryId", String(parentCategoryId));
    if (categoryId !== null) params.set("categoryId", String(categoryId));
    if (subcategoryId !== null) params.set("subcategoryId", String(subcategoryId));
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    if (district) params.set("district", district);
    if (minRating !== "") params.set("minRating", String(minRating));
    if (availability) params.set("availability", availability);
    if (distanceKm !== "" && originLat !== null && originLng !== null) {
      params.set("distanceKm", String(distanceKm));
      params.set("originLat", String(originLat));
      params.set("originLng", String(originLng));
    }
    if (verifiedOnly) params.set("verified", "true");
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    async function loadProfessionals() {
      try {
        const response = await fetch(`/api/v1/professionals?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load professionals");
        setResults((await response.json()) as ProfessionalDiscoveryResponse);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("discover.professionals.load", error);
          setStatus("error");
        }
      }
    }

    void loadProfessionals();
    return () => controller.abort();
  }, [
    query,
    segment,
    parentCategoryId,
    categoryId,
    subcategoryId,
    city,
    state,
    district,
    minRating,
    availability,
    distanceKm,
    originLat,
    originLng,
    verifiedOnly,
    sort,
    page,
  ]);

  const totalProfessionals = results?.total ?? 0;
  const parentCategories = useMemo(
    () => categories.filter((item) => item.parentId === null),
    [categories],
  );
  const topCategories = useMemo(
    () =>
      parentCategoryId === null
        ? []
        : categories.filter((item) => item.parentId === parentCategoryId),
    [categories, parentCategoryId],
  );
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const subCategories = useMemo(
    () => (categoryId === null ? [] : categories.filter((item) => item.parentId === categoryId)),
    [categories, categoryId],
  );

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find professionals</h1>
          <p className="text-sm text-muted-foreground">
            {totalProfessionals > 0
              ? `${totalProfessionals} vetted pros available across all categories.`
              : "Browse vetted professionals across all categories."}
          </p>
        </div>
      </div>

      {jobId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="font-semibold">Choose a professional for your job</p>
            <p className="text-sm text-muted-foreground">
              When you select Hire, your job details will be included in the request.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push(`/job/${jobId}`)}>
            Back to job
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-border bg-card p-5 shadow-soft h-fit lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Filters</h2>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setQuery("");
                setSegment("");
                setParentCategoryId(null);
                setCategoryId(null);
                setSubcategoryId(null);
                setCity("");
                setState("");
                setDistrict("");
                setMinRating("");
                setAvailability("");
                setDistanceKm("");
                setOriginLat(null);
                setOriginLng(null);
                setVerifiedOnly(false);
                setPage(1);
              }}
            >
              Clear all
            </button>
          </div>

          <FilterSection title="Service type">
            <div className="mb-3 flex flex-wrap gap-2">
              {segmentOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const nextSegment = segment === value ? "" : value;
                    const parent = parentCategories.find((item) => item.segment === nextSegment);
                    setSegment(nextSegment);
                    setParentCategoryId(parent?.id ?? null);
                    setCategoryId(null);
                    setSubcategoryId(null);
                    setPage(1);
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
                    checked={categoryId === null}
                    onChange={() => {
                      setCategoryId(null);
                      setSubcategoryId(null);
                      setPage(1);
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>
                    All{" "}
                    {parentCategories.find((item) => item.id === parentCategoryId)?.name ??
                      "categories"}
                  </span>
                </label>
                {topCategories.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="category"
                      checked={categoryId === item.id}
                      onChange={() => {
                        setCategoryId(item.id);
                        setSubcategoryId(null);
                        setPage(1);
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.professionalCount}</span>
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
                  Subcategory{selectedCategory ? ` · ${selectedCategory.name}` : ""}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="subcategory"
                    checked={subcategoryId === null}
                    onChange={() => {
                      setSubcategoryId(null);
                      setPage(1);
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>All {selectedCategory?.name}</span>
                </label>
                {subCategories.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="subcategory"
                      checked={subcategoryId === item.id}
                      onChange={() => {
                        setSubcategoryId(item.id);
                        setPage(1);
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.professionalCount}</span>
                  </label>
                ))}
              </div>
            )}
          </FilterSection>

          <FilterSection title="Verified only">
            <label className="flex items-center justify-between text-sm">
              <span>Verified pros</span>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => {
                  setVerifiedOnly(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            </label>
          </FilterSection>

          <FilterSection title="City">
            <Input
              className="text-sm"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              placeholder="e.g., Toronto, Vancouver"
            />
          </FilterSection>

          <FilterSection title="State and district">
            <div className="space-y-2">
              <select
                value={state}
                onChange={(event) => {
                  setState(event.target.value);
                  setDistrict("");
                  setPage(1);
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
                onChange={(event) => {
                  setDistrict(event.target.value);
                  setPage(1);
                }}
                disabled={!state}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">All districts</option>
                {(getDistrictsByState(state) ?? []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </FilterSection>

          <FilterSection title="Distance">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={requestMyLocation}
              >
                <LocateFixed className="size-4" />
                Use my current location
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => void requestPrimaryAddress()}
              >
                <Home className="size-4" />
                Use my primary address
              </Button>
              {distanceKm !== "" && originLat !== null && originLng !== null && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="w-20">Within</span>
                    <select
                      className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                      value={distanceKm}
                      onChange={(event) => {
                        setDistanceKm(Number(event.target.value));
                        setPage(1);
                      }}
                    >
                      <option value={5}>5 km</option>
                      <option value={10}>10 km</option>
                      <option value={25}>25 km</option>
                      <option value={50}>50 km</option>
                      <option value={100}>100 km</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      setDistanceKm("");
                      setOriginLat(null);
                      setOriginLng(null);
                      userLocationRef.current = null;
                      setPage(1);
                    }}
                  >
                    Clear location
                  </button>
                </div>
              )}
            </div>
          </FilterSection>

          <FilterSection title="Minimum Rating">
            <div className="space-y-2">
              {[
                { value: 4.5, label: "4.5+ stars" },
                { value: 4, label: "4+ stars" },
                { value: 3.5, label: "3.5+ stars" },
                { value: 3, label: "3+ stars" },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="minRating"
                    checked={minRating === option.value}
                    onChange={() => {
                      setMinRating(minRating === option.value ? "" : option.value);
                      setPage(1);
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="minRating"
                  checked={minRating === ""}
                  onChange={() => {
                    setMinRating("");
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Any rating</span>
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Availability">
            <div className="space-y-2">
              {[
                { value: "AVAILABLE", label: "Available now" },
                { value: "BUSY", label: "Busy" },
                { value: "UNAVAILABLE", label: "Unavailable" },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="availability"
                    checked={availability === option.value}
                    onChange={() => {
                      setAvailability(availability === option.value ? "" : option.value);
                      setPage(1);
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="availability"
                  checked={availability === ""}
                  onChange={() => {
                    setAvailability("");
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Any availability</span>
              </label>
            </div>
          </FilterSection>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Try 'plumber', 'react developer', 'wedding photographer'"
              />
            </div>
            <select
              value={sort}
              onChange={(event) => {
                const value = event.target.value as typeof sort;
                setSort(value);
                setPage(1);
                if (value === "distance" && (originLat === null || originLng === null)) {
                  requestMyLocation();
                }
              }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="recommended">Sort: Best match</option>
              <option value="rating">Top rated</option>
              <option value="price">Lowest price</option>
              <option value="distance">Closest</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setShowMap((current) => {
                  const next = !current;
                  if (!current && mapSectionRef.current) {
                    window.requestAnimationFrame(() => {
                      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }
                  return next;
                });
              }}
            >
              <Map className="h-4 w-4" /> {showMap ? "Hide map" : "View on map"}
            </Button>
          </div>

          {!showMap && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowMap(true);
                if (mapSectionRef.current) {
                  window.requestAnimationFrame(() => {
                    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.currentTarget.click();
              }}
              className="mb-4 hidden h-40 w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-soft transition-all hover:border-primary/50 hover:shadow-elevated md:block"
            >
              <div className="flex h-full items-center justify-between gap-6">
                <div className="text-left">
                  <p className="text-sm font-semibold">All professionals</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalProfessionals} available • Click to view on map
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Browse verified professionals across all categories
                  </p>
                </div>
                <div className="h-full w-1/2">
                  <ProfessionalsPreviewMap professionals={results?.professionals ?? []} />
                </div>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ResultSkeleton />
              <ResultSkeleton />
              <ResultSkeleton />
              <ResultSkeleton />
            </div>
          )}
          {status === "error" && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Professionals could not be loaded. Refresh the page to try again.
            </div>
          )}
          {status === "ready" && professionals.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No professionals match these filters yet.
            </div>
          )}
          {status === "ready" && professionals.length > 0 && (
            <>
              {showMap && (results?.professionals?.length ?? 0) > 0 && (
                <div ref={mapSectionRef} className="mb-6">
                  <Suspense
                    fallback={
                      <div className="h-[520px] w-full overflow-hidden rounded-2xl border bg-muted animate-pulse" />
                    }
                  >
                    <ProfessionalDiscoveryMap
                      professionals={results?.professionals ?? []}
                      selectedPoint={selectedPoint ?? undefined}
                    />
                  </Suspense>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Approximate location — shown for privacy
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                {professionals.map((p) => (
                  <ProCard
                    key={p.id}
                    pro={p}
                    onCardClick={() => router.push(`/pro/${p.id}`)}
                    profileHref={
                      jobId ? `/pro/${p.id}?jobId=${encodeURIComponent(jobId)}` : undefined
                    }
                    onShowLocation={() => {
                      const proResult = results?.professionals.find((item) => item.id === p.id);
                      if (!proResult?.displayPoint) return;
                      setSelectedPoint(proResult.displayPoint);
                      setShowMap(true);
                      window.requestAnimationFrame(() => {
                        mapSectionRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      });
                    }}
                  />
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  Showing {professionals.length} of {results?.total ?? professionals.length}{" "}
                  professionals.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!results?.hasMore}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Discover() {
  return (
    <Suspense fallback={<ResultSkeleton />}>
      <DiscoverContent />
    </Suspense>
  );
}

function ResultSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-border bg-card p-5">
      <Skeleton height={18} width="38%" />
      <Skeleton className="mt-4" height={24} width="72%" />
      <Skeleton className="mt-6" height={14} count={2} />
      <Skeleton className="mt-5" height={38} borderRadius={8} />
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
