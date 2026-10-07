"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Factory,
  FolderTree,
  Hammer,
  Home,
  Layers3,
  Paintbrush,
  Search,
  Shield,
  Sparkles,
  Truck,
  Wrench,
  X,
  Zap,
  Briefcase,
  Compass,
  ArrowUpRight,
  Users,
} from "lucide-react";
import type {
  CompleteCategoryHierarchy,
  HierarchyCategory,
  HierarchyParent,
  HierarchySubcategory,
} from "@/lib/queries/categories-hierarchy";
import { Button } from "@/components/ui/button";

type TabType = "parent" | "category" | "subcategory";
type SegmentFilter = "ALL" | "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";

// Segment styling configurations
const SEGMENT_CONFIG = {
  RESIDENTIAL: {
    label: "Residential",
    icon: Home,
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    gradient: "from-indigo-500/10 via-blue-500/5 to-transparent",
    accent: "text-indigo-600",
    borderHover: "hover:border-indigo-400 hover:shadow-indigo-500/10",
    pillBg: "bg-indigo-500",
    iconBox: "bg-indigo-50 text-indigo-600 border-indigo-100",
  },
  COMMERCIAL: {
    label: "Commercial",
    icon: Building2,
    badge: "bg-sky-50 text-sky-700 border-sky-200/80",
    gradient: "from-sky-500/10 via-cyan-500/5 to-transparent",
    accent: "text-sky-600",
    borderHover: "hover:border-sky-400 hover:shadow-sky-500/10",
    pillBg: "bg-sky-500",
    iconBox: "bg-sky-50 text-sky-600 border-sky-100",
  },
  INDUSTRIAL: {
    label: "Industrial",
    icon: Factory,
    badge: "bg-amber-50 text-amber-800 border-amber-200/80",
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    accent: "text-amber-600",
    borderHover: "hover:border-amber-400 hover:shadow-amber-500/10",
    pillBg: "bg-amber-500",
    iconBox: "bg-amber-50 text-amber-700 border-amber-100",
  },
} as const;

function getSegmentConfig(segment?: string) {
  const upper = segment?.toUpperCase() as keyof typeof SEGMENT_CONFIG;
  return SEGMENT_CONFIG[upper] ?? SEGMENT_CONFIG.RESIDENTIAL;
}

// Icon mapper for categories
function CategoryIcon({ name, className = "h-5 w-5" }: { name?: string; className?: string }) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("clean") || n.includes("sparkle")) return <Sparkles className={className} />;
  if (n.includes("electric") || n.includes("wire") || n.includes("power") || n.includes("zap"))
    return <Zap className={className} />;
  if (n.includes("plumb") || n.includes("pipe") || n.includes("leak") || n.includes("water"))
    return <Wrench className={className} />;
  if (n.includes("paint") || n.includes("wall")) return <Paintbrush className={className} />;
  if (n.includes("carpent") || n.includes("wood") || n.includes("furnitur") || n.includes("hammer"))
    return <Hammer className={className} />;
  if (n.includes("pack") || n.includes("move") || n.includes("truck"))
    return <Truck className={className} />;
  if (n.includes("secur") || n.includes("guard") || n.includes("cctv"))
    return <Shield className={className} />;
  if (n.includes("commercial") || n.includes("office") || n.includes("business"))
    return <Building2 className={className} />;
  if (n.includes("industrial") || n.includes("factory") || n.includes("plant"))
    return <Factory className={className} />;
  if (n.includes("home") || n.includes("house")) return <Home className={className} />;
  return <FolderTree className={className} />;
}

export function ServicesCatalog({ data }: { data: CompleteCategoryHierarchy }) {
  // 3 Primary Tabs
  const [activeTab, setActiveTab] = useState<TabType>("parent");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Domain Segment filter
  const [selectedSegment, setSelectedSegment] = useState<SegmentFilter>("ALL");

  // Parent Category filter for Category & Sub-Category tabs
  const [filterParentId, setFilterParentId] = useState<number | null>(null);

  // Category filter for Sub-Category tab
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Cross-tab drilldown navigation:
  const handleSelectParent = (parentId: number) => {
    setFilterParentId(parentId);
    setFilterCategoryId(null);
    setActiveTab("category");
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handleSelectCategory = (categoryId: number, parentId?: number) => {
    if (parentId) setFilterParentId(parentId);
    setFilterCategoryId(categoryId);
    setActiveTab("subcategory");
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSegment("ALL");
    setFilterParentId(null);
    setFilterCategoryId(null);
  };

  // Filtered Tier 1: Parents
  const filteredParents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.parents.filter((item) => {
      const matchSegment = selectedSegment === "ALL" || item.segment === selectedSegment;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.previewCategories.some((c) => c.name.toLowerCase().includes(q));
      return matchSegment && matchSearch;
    });
  }, [data.parents, searchQuery, selectedSegment]);

  // Filtered Tier 2: Categories
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.categories.filter((item) => {
      const matchSegment = selectedSegment === "ALL" || item.segment === selectedSegment;
      const matchParent = filterParentId === null || item.parentId === filterParentId;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.parentName.toLowerCase().includes(q) ||
        item.previewSubcategories.some((s) => s.name.toLowerCase().includes(q));
      return matchSegment && matchParent && matchSearch;
    });
  }, [data.categories, filterParentId, searchQuery, selectedSegment]);

  // Filtered Tier 3: Subcategories
  const filteredSubcategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.subcategories.filter((item) => {
      const matchSegment = selectedSegment === "ALL" || item.segment === selectedSegment;
      const matchParent = filterParentId === null || item.parentId === filterParentId;
      const matchCat = filterCategoryId === null || item.categoryId === filterCategoryId;
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q) ||
        item.parentName.toLowerCase().includes(q);
      return matchSegment && matchParent && matchCat && matchSearch;
    });
  }, [data.subcategories, filterCategoryId, filterParentId, searchQuery, selectedSegment]);

  // Find parent/category metadata for active filter badges
  const activeParentObj = useMemo(
    () => data.parents.find((p) => p.id === filterParentId) ?? null,
    [data.parents, filterParentId],
  );

  const activeCategoryObj = useMemo(
    () => data.categories.find((c) => c.id === filterCategoryId) ?? null,
    [data.categories, filterCategoryId],
  );

  return (
    <div className="relative min-h-screen bg-slate-50/50 pb-28 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Aura */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden opacity-60"
        aria-hidden="true"
      >
        <div className="absolute -top-40 left-1/2 -z-10 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-200/40 via-sky-200/30 to-purple-200/40 blur-3xl" />
        <div className="absolute top-48 left-1/4 -z-10 h-72 w-72 rounded-full bg-blue-100/50 blur-2xl" />
      </div>

      {/* Hero Header */}
      <header className="relative pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-xs font-bold text-indigo-700 shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>Marketplace Services Directory</span>
            <span className="h-1 w-1 rounded-full bg-indigo-300" />
            <span className="text-slate-500">3-Tier Hierarchy</span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Explore All{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-800 bg-clip-text text-transparent">
              Categories & Services
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Seamlessly navigate through parent domains, main service categories, and hundreds of
            specialized tasks delivered by verified professionals.
          </p>

          {/* Quick Metrics Ribbon */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-xs sm:gap-4 sm:text-sm">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2 font-medium text-slate-700 shadow-2xs">
              <Layers3 className="h-4 w-4 text-indigo-600" />
              <span>
                <strong>{data.totalCounts.parents}</strong> Parent Domains
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2 font-medium text-slate-700 shadow-2xs">
              <FolderTree className="h-4 w-4 text-blue-600" />
              <span>
                <strong>{data.totalCounts.categories}</strong> Categories
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2 font-medium text-slate-700 shadow-2xs">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>
                <strong>{data.totalCounts.subcategories}</strong> Sub-Categories
              </span>
            </div>
          </div>

          {/* Real-time Global Search Input */}
          <div className="relative mx-auto mt-9 max-w-xl">
            <div className="group relative flex items-center rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-md shadow-slate-200/40 transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15">
              <Search className="ml-3.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any parent category, service, or task…"
                className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Tab Navigation Bar */}
      <nav
        aria-label="Category levels"
        className="sticky top-16 z-30 border-y border-slate-200/80 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row sm:px-6 lg:px-8">
          {/* THE 3 TABS */}
          <div className="inline-flex w-full items-center rounded-2xl border border-slate-200/80 bg-slate-100/90 p-1.5 shadow-inner sm:w-auto">
            {/* TAB 1: PARENT CATEGORY */}
            <button
              type="button"
              onClick={() => setActiveTab("parent")}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:flex-initial sm:px-5 sm:text-sm cursor-pointer ${
                activeTab === "parent"
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Layers3 className="h-4 w-4 shrink-0" />
              <span>Parent Category</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "parent"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {filteredParents.length}
              </span>
            </button>

            {/* TAB 2: CATEGORY */}
            <button
              type="button"
              onClick={() => setActiveTab("category")}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:flex-initial sm:px-5 sm:text-sm cursor-pointer ${
                activeTab === "category"
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <FolderTree className="h-4 w-4 shrink-0" />
              <span>Category</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "category"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {filteredCategories.length}
              </span>
            </button>

            {/* TAB 3: SUB-CATEGORY */}
            <button
              type="button"
              onClick={() => setActiveTab("subcategory")}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:flex-initial sm:px-5 sm:text-sm cursor-pointer ${
                activeTab === "subcategory"
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Sub-Category</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "subcategory"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                {filteredSubcategories.length}
              </span>
            </button>
          </div>

          {/* Segment Filter Pill Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Segment:
            </span>
            {(["ALL", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL"] as const).map((segment) => {
              const isActive = selectedSegment === segment;
              return (
                <button
                  key={segment}
                  type="button"
                  onClick={() => setSelectedSegment(segment)}
                  className={`rounded-xl px-3 py-1.5 font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {segment === "ALL"
                    ? "All Domains"
                    : segment.charAt(0) + segment.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Sub-filter Breadcrumb strip if drill-down is active */}
        {(filterParentId !== null || filterCategoryId !== null || searchQuery) && (
          <div className="mx-auto mt-2.5 flex max-w-7xl flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <span className="font-medium text-slate-400">Filtered by:</span>
              {activeParentObj && (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 border border-indigo-200">
                  {activeParentObj.name}
                  <button
                    type="button"
                    onClick={() => {
                      setFilterParentId(null);
                      setFilterCategoryId(null);
                    }}
                    className="hover:text-indigo-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {activeCategoryObj && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-200">
                    {activeCategoryObj.name}
                    <button
                      type="button"
                      onClick={() => setFilterCategoryId(null)}
                      className="hover:text-blue-950"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  &ldquo;{searchQuery}&rdquo;
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="hover:text-black"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* =========================================================================
            TAB 1: PARENT CATEGORIES
           ========================================================================= */}
        {activeTab === "parent" && (
          <section className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Parent Service Domains
                </h2>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Top-level service domains dividing residential, commercial, and industrial
                  operations.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Showing {filteredParents.length} of {data.parents.length} domains
              </span>
            </div>

            {filteredParents.length === 0 ? (
              <EmptyState onReset={clearFilters} />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredParents.map((parent) => {
                  const conf = getSegmentConfig(parent.segment);
                  const ParentIcon = conf.icon;

                  return (
                    <div
                      key={parent.id}
                      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${conf.borderHover}`}
                    >
                      {/* Top aura gradient inside card */}
                      <div
                        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${conf.gradient} opacity-80`}
                      />

                      <div>
                        {/* Header: Icon & Segment Badge */}
                        <div className="relative flex items-center justify-between">
                          <div
                            className={`grid h-14 w-14 place-items-center rounded-2xl border shadow-xs transition-transform duration-300 group-hover:scale-105 ${conf.iconBox}`}
                          >
                            <ParentIcon className="h-7 w-7" />
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${conf.badge}`}
                          >
                            {conf.label}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h3 className="relative mt-5 text-2xl font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {parent.name}
                        </h3>
                        <p className="relative mt-2.5 text-sm leading-relaxed text-slate-600">
                          {parent.description}
                        </p>

                        {/* Counters ribbon */}
                        <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs">
                          <div className="flex-1">
                            <span className="text-[11px] text-slate-400 block font-medium">
                              Categories
                            </span>
                            <span className="text-base font-extrabold text-slate-900">
                              {parent.categoryCount}
                            </span>
                          </div>
                          <div className="h-7 w-px bg-slate-200" />
                          <div className="flex-1">
                            <span className="text-[11px] text-slate-400 block font-medium">
                              Sub-Services
                            </span>
                            <span className="text-base font-extrabold text-slate-900">
                              {parent.subcategoryCount}
                            </span>
                          </div>
                        </div>

                        {/* Preview Categories Chips */}
                        {parent.previewCategories.length > 0 && (
                          <div className="relative mt-6">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                              Top Categories:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {parent.previewCategories.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectCategory(cat.id, parent.id);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 transition cursor-pointer"
                                >
                                  <span>{cat.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    ({cat.subcategoryCount})
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Button */}
                      <div className="relative mt-8 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleSelectParent(parent.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xs transition-all hover:bg-indigo-600 cursor-pointer"
                        >
                          <span>Explore Categories</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* =========================================================================
            TAB 2: MAIN CATEGORIES
           ========================================================================= */}
        {activeTab === "category" && (
          <section className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Main Service Categories
                </h2>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Specialized service verticals with full verified workforce backing.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Showing {filteredCategories.length} of {data.categories.length} categories
              </span>
            </div>

            {filteredCategories.length === 0 ? (
              <EmptyState onReset={clearFilters} />
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCategories.map((cat) => {
                  const conf = getSegmentConfig(cat.segment);

                  return (
                    <div
                      key={cat.id}
                      className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-xl"
                    >
                      <div>
                        {/* Header: Parent breadcrumb & segment badge */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFilterParentId(cat.parentId);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition"
                          >
                            <span>{cat.parentName}</span>
                          </button>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${conf.badge}`}
                          >
                            {conf.label}
                          </span>
                        </div>

                        {/* Title & Icon */}
                        <div className="mt-4 flex items-start gap-3.5">
                          <div
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${conf.iconBox} shadow-2xs group-hover:scale-105 transition-transform`}
                          >
                            <CategoryIcon name={cat.name} className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {cat.name}
                            </h3>
                            <span className="text-xs font-semibold text-indigo-600">
                              {cat.subcategoryCount} Specialized Tasks
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="mt-3 text-xs leading-relaxed text-slate-600">
                          {cat.description}
                        </p>

                        {/* Subcategory Preview Chips */}
                        {cat.previewSubcategories.length > 0 && (
                          <div className="mt-4">
                            <div className="flex flex-wrap gap-1.5">
                              {cat.previewSubcategories.map((sub) => (
                                <span
                                  key={sub.id}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                                >
                                  {sub.name}
                                </span>
                              ))}
                              {cat.subcategoryCount > cat.previewSubcategories.length && (
                                <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                                  +{cat.subcategoryCount - cat.previewSubcategories.length} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Action Button */}
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleSelectCategory(cat.id, cat.parentId)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 border border-slate-200/90 px-3.5 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-indigo-600 hover:text-white hover:border-indigo-600 cursor-pointer"
                        >
                          <span>View Sub-Categories ({cat.subcategoryCount})</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* =========================================================================
            TAB 3: SUB-CATEGORIES
           ========================================================================= */}
        {activeTab === "subcategory" && (
          <section className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Specialized Sub-Categories
                </h2>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Individual service jobs ready for direct hiring or milestone quoting.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                Showing {filteredSubcategories.length} of {data.subcategories.length} services
              </span>
            </div>

            {filteredSubcategories.length === 0 ? (
              <EmptyState onReset={clearFilters} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSubcategories.map((sub) => {
                  const conf = getSegmentConfig(sub.segment);

                  return (
                    <div
                      key={sub.id}
                      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
                    >
                      <div>
                        {/* Two-tier Breadcrumb Badge */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                          <span className="text-slate-500">{sub.parentName}</span>
                          <span>/</span>
                          <span className="text-indigo-600">{sub.categoryName}</span>
                        </div>

                        {/* Title & Icon */}
                        <div className="mt-3 flex items-start gap-3">
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${conf.iconBox} shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition-colors`}
                          >
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {sub.name}
                            </h3>
                            <span
                              className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${conf.badge}`}
                            >
                              {conf.label}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="mt-3 text-xs leading-relaxed text-slate-600 line-clamp-3">
                          {sub.description}
                        </p>
                      </div>

                      {/* Direct Marketplace Action CTAs */}
                      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3.5">
                        <Link
                          href={`/find-professionals?category=${encodeURIComponent(sub.name)}`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>Find Pros</span>
                        </Link>
                        <Link
                          href={`/client/jobs/new?category=${encodeURIComponent(sub.name)}`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-2xs"
                        >
                          <span>Post Job</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
      <Boxes className="mx-auto h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-bold text-slate-800">No matching categories found</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
        We couldn&apos;t find any service categories matching your search or segment filters.
      </p>
      <div className="mt-6">
        <Button onClick={onReset} variant="outline" size="sm">
          Reset All Filters
        </Button>
      </div>
    </div>
  );
}
