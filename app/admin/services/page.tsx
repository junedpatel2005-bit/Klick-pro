"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Factory,
  FolderPlus,
  FolderTree,
  Home,
  Layers3,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Segment = "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL";

type Service = {
  id: number;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  segment?: Segment;
  parentId: number | null;
  sortOrder: number;
  jobCount?: number;
};

type Job = {
  id: number;
  title: string | null;
  description: string | null;
  category: string | null;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  locationLabel: string | null;
  createdAt: string;
};

const domainConfigs: Record<
  Segment,
  {
    label: string;
    icon: typeof Home;
    badge: string;
    activeBorder: string;
    activeBg: string;
    text: string;
  }
> = {
  RESIDENTIAL: {
    label: "Residential Services",
    icon: Home,
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    activeBorder: "border-indigo-600 ring-2 ring-indigo-100",
    activeBg: "bg-indigo-50/50",
    text: "text-indigo-600",
  },
  COMMERCIAL: {
    label: "Commercial Services",
    icon: Building2,
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    activeBorder: "border-sky-600 ring-2 ring-sky-100",
    activeBg: "bg-sky-50/50",
    text: "text-sky-600",
  },
  INDUSTRIAL: {
    label: "Industrial Services",
    icon: Factory,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    activeBorder: "border-amber-600 ring-2 ring-amber-100",
    activeBg: "bg-amber-50/50",
    text: "text-amber-600",
  },
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLevel, setCreateLevel] = useState<"PARENT" | "CATEGORY" | "SUBCATEGORY">("CATEGORY");
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    segment: "RESIDENTIAL" as Segment,
    parentId: null as number | null,
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  const [jobsModalOpen, setJobsModalOpen] = useState(false);
  const [jobsService, setJobsService] = useState<Service | null>(null);
  const [categoryJobs, setCategoryJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/admin/services", { cache: "no-store" });
      const data = (await response.json()) as { services?: Service[]; error?: string };
      if (!response.ok || !data.services) throw new Error(data.error ?? "Could not load services.");
      setServices(data.services);

      // Auto-select first parent and its first category
      const rootParents = data.services.filter((s) => s.parentId === null);
      if (rootParents.length > 0) {
        const firstParent = rootParents[0]!;
        setSelectedParentId(firstParent.id);

        const firstCats = data.services.filter((s) => s.parentId === firstParent.id);
        if (firstCats.length > 0) {
          setSelectedCategoryId(firstCats[0]!.id);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // 1. Level 1: Parent Domains (parentId === null)
  const parents = useMemo(() => services.filter((item) => item.parentId === null), [services]);

  // Children lookup map: parentId -> children list
  const childrenByParentId = useMemo(() => {
    const map = new Map<number, Service[]>();
    for (const item of services) {
      if (item.parentId !== null) {
        const list = map.get(item.parentId) ?? [];
        list.push(item);
        map.set(item.parentId, list);
      }
    }
    return map;
  }, [services]);

  // Active Parent
  const activeParent = useMemo(() => {
    if (!selectedParentId && parents.length > 0) return parents[0];
    return parents.find((p) => p.id === selectedParentId) ?? parents[0];
  }, [parents, selectedParentId]);

  // Categories under Active Parent
  const activeCategories = useMemo(() => {
    if (!activeParent) return [];
    const list = childrenByParentId.get(activeParent.id) ?? [];
    if (!categorySearch.trim()) return list;
    const q = categorySearch.toLowerCase();
    return list.filter(
      (cat) => cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q),
    );
  }, [activeParent, categorySearch, childrenByParentId]);

  // Active Category (Level 2)
  const activeCategory = useMemo(() => {
    if (selectedCategoryId) {
      const found = services.find((s) => s.id === selectedCategoryId);
      if (found && found.parentId === activeParent?.id) return found;
    }
    return activeCategories[0] ?? null;
  }, [activeCategories, activeParent, selectedCategoryId, services]);

  // Subcategories under Active Category (Level 3)
  const activeSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    const list = childrenByParentId.get(activeCategory.id) ?? [];
    if (!subcategorySearch.trim()) return list;
    const q = subcategorySearch.toLowerCase();
    return list.filter(
      (sub) => sub.name.toLowerCase().includes(q) || sub.slug.toLowerCase().includes(q),
    );
  }, [activeCategory, childrenByParentId, subcategorySearch]);

  // Select a Parent Domain
  const handleSelectParent = (parentId: number) => {
    setSelectedParentId(parentId);
    const cats = childrenByParentId.get(parentId) ?? [];
    if (cats.length > 0) {
      setSelectedCategoryId(cats[0]!.id);
    } else {
      setSelectedCategoryId(null);
    }
    setCategorySearch("");
    setSubcategorySearch("");
  };

  // Open Create Dialog
  const openCreateModal = (
    level: "PARENT" | "CATEGORY" | "SUBCATEGORY",
    targetParentId?: number,
  ) => {
    setCreateLevel(level);

    if (level === "PARENT") {
      setCreateForm({
        name: "",
        description: "",
        segment: "RESIDENTIAL",
        parentId: null,
      });
    } else if (level === "CATEGORY") {
      const pid = targetParentId ?? activeParent?.id ?? parents[0]?.id ?? null;
      const p = parents.find((item) => item.id === pid);
      setCreateForm({
        name: "",
        description: "",
        segment: p?.segment ?? "RESIDENTIAL",
        parentId: pid,
      });
    } else {
      // SUBCATEGORY
      const cid = targetParentId ?? activeCategory?.id ?? activeCategories[0]?.id ?? null;
      const cat = services.find((s) => s.id === cid);
      setCreateForm({
        name: "",
        description: "",
        segment: cat?.segment ?? "RESIDENTIAL",
        parentId: cid,
      });
    }

    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Please enter a name.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await response.json()) as { service?: Service; error?: string };
      if (!response.ok || !data.service) throw new Error(data.error ?? "Could not create service.");

      setServices((prev) => [...prev, { ...data.service!, jobCount: 0 }]);
      setCreateModalOpen(false);

      if (createLevel === "CATEGORY") {
        setSelectedCategoryId(data.service.id);
      }

      const label =
        createLevel === "PARENT"
          ? "Parent Domain"
          : createLevel === "CATEGORY"
            ? "Category"
            : "Subcategory";
      toast.success(`${label} "${data.service.name}" created successfully!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creation failed.");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setEditForm({
      name: service.name,
      description: service.description ?? "",
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingService || !editForm.name.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/services?id=${editingService.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = (await response.json()) as { service?: Service; error?: string };
      if (!response.ok || !data.service) throw new Error(data.error ?? "Could not update service.");

      setServices((prev) =>
        prev.map((item) =>
          item.id === data.service!.id ? { ...data.service!, jobCount: item.jobCount } : item,
        ),
      );
      setEditModalOpen(false);
      toast.success("Updated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: Service, levelLabel: string) => {
    const promptMessage = `Delete ${levelLabel} "${service.name}"? This will permanently remove all nested services under it.`;
    if (!window.confirm(promptMessage)) return;

    try {
      const response = await fetch(`/api/v1/admin/services?id=${service.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete service.");

      const toDelete = new Set<number>([service.id]);
      let added = true;
      while (added) {
        added = false;
        for (const s of services) {
          if (s.parentId !== null && toDelete.has(s.parentId) && !toDelete.has(s.id)) {
            toDelete.add(s.id);
            added = true;
          }
        }
      }

      setServices((prev) => prev.filter((item) => !toDelete.has(item.id)));
      toast.success(`"${service.name}" deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const openJobsModal = async (service: Service) => {
    setJobsService(service);
    setJobsModalOpen(true);
    setJobsLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/services?categoryId=${service.id}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { jobs?: Job[] };
      setCategoryJobs(data.jobs ?? []);
    } catch {
      toast.error("Failed to load jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              Admin Control Suite
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Marketplace Taxonomy
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Service Catalog &amp; Taxonomy
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Configure parent domains, main categories, and actionable subcategories for marketplace
            jobs and search.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openCreateModal("CATEGORY", activeParent?.id)}
            className="gap-1.5 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
          >
            <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />+ New Category
          </Button>
          <Button
            onClick={() => openCreateModal("SUBCATEGORY", activeCategory?.id)}
            className="gap-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />+ New Subcategory
          </Button>
        </div>
      </div>

      {/* 3 Main Interactive Parent Category Selector Buttons */}
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="tablist"
        aria-label="Service domains"
      >
        {parents.map((parent) => {
          const pCats = childrenByParentId.get(parent.id) ?? [];
          const pSubCount = pCats.reduce(
            (acc, cat) => acc + (childrenByParentId.get(cat.id)?.length ?? 0),
            0,
          );
          const pJobCount = pCats.reduce((acc, cat) => {
            const subs = childrenByParentId.get(cat.id) ?? [];
            return (
              acc + (cat.jobCount ?? 0) + subs.reduce((sAcc, s) => sAcc + (s.jobCount ?? 0), 0)
            );
          }, parent.jobCount ?? 0);

          const domainSegment = parent.segment ?? "RESIDENTIAL";
          const domainMeta = domainConfigs[domainSegment] ?? domainConfigs.RESIDENTIAL;
          const DomainIcon = domainMeta.icon;
          const isSelected = activeParent?.id === parent.id;

          return (
            <button
              key={parent.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleSelectParent(parent.id)}
              className={`group relative flex items-start justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                isSelected
                  ? `${domainMeta.activeBorder} ${domainMeta.activeBg} shadow-sm`
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border transition ${
                    isSelected ? "bg-white shadow-xs border-white" : domainMeta.badge
                  }`}
                >
                  <DomainIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-bold text-slate-900 tracking-tight">
                      {parent.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {pCats.length} Categories · {pSubCount} Subcategories
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {pJobCount} Live Jobs
                    </span>
                    <span>·</span>
                    <span className="font-mono text-[10px]">/{parent.slug}</span>
                  </div>
                </div>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                {isSelected ? "Active" : "Select"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Senior Master-Detail 2-Column Taxonomy Explorer */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Categories List (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Categories Search & Header */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Categories ({activeCategories.length})
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCreateModal("CATEGORY", activeParent?.id)}
                className="h-7 px-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>

            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder={`Search ${activeParent?.name ?? ""} categories…`}
                className="h-8 pl-8 pr-3 text-xs rounded-xl bg-white border-slate-200 shadow-2xs"
              />
            </div>
          </div>

          {/* Categories List Body */}
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : activeCategories.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-400">No categories found.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCreateModal("CATEGORY", activeParent?.id)}
                  className="mt-2 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add First Category
                </Button>
              </div>
            ) : (
              activeCategories.map((cat) => {
                const subCount = childrenByParentId.get(cat.id)?.length ?? 0;
                const isSelected = activeCategory?.id === cat.id;

                return (
                  <div
                    key={cat.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCategoryId(cat.id);
                      }
                    }}
                    className={`group flex items-center justify-between p-3 px-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-l-2 border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold"
                        : "border-l-2 border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs truncate ${isSelected ? "font-bold text-indigo-950" : "font-medium"}`}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate">/{cat.slug}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-indigo-200/80 text-indigo-900"
                            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                        }`}
                      >
                        {subCount} subs
                      </span>

                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(cat);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-white"
                          title="Edit Category"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat, "Category");
                          }}
                          className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Category"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <ChevronRight
                        className={`h-3.5 w-3.5 transition ${isSelected ? "text-indigo-600" : "text-slate-300"}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Subcategories & Management (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {activeCategory ? (
            <div>
              {/* Category Detail Header */}
              <div className="p-5 border-b border-slate-100 bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        {activeCategory.name}
                      </h2>
                      <span className="rounded-md bg-slate-200/60 px-2 py-0.5 text-[11px] font-mono text-slate-600 font-semibold">
                        /{activeCategory.slug}
                      </span>
                      <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                        {activeSubcategories.length} Subcategories
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeCategory.description ||
                        "Manage specific actionable service subcategories below."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openJobsModal(activeCategory)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 shadow-2xs transition"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {activeCategory.jobCount ?? 0} Tagged Jobs
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </button>

                    <Button
                      onClick={() => openCreateModal("SUBCATEGORY", activeCategory.id)}
                      className="gap-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Subcategory
                    </Button>
                  </div>
                </div>

                {/* Subcategory Filter Input */}
                <div className="mt-4 relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={subcategorySearch}
                    onChange={(e) => setSubcategorySearch(e.target.value)}
                    placeholder={`Filter subcategories in ${activeCategory.name}…`}
                    className="h-8 pl-8 pr-3 text-xs rounded-xl bg-white border-slate-200 shadow-2xs"
                  />
                  {subcategorySearch && (
                    <button
                      onClick={() => setSubcategorySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Subcategories Grid */}
              <div className="p-5 sm:p-6">
                {activeSubcategories.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
                    <Layers3 className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {subcategorySearch
                        ? `No subcategories match "${subcategorySearch}".`
                        : `No subcategories added to "${activeCategory.name}" yet.`}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreateModal("SUBCATEGORY", activeCategory.id)}
                      className="mt-3 text-xs font-semibold"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Create First Subcategory
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {activeSubcategories.map((sub) => (
                      <div
                        key={sub.id}
                        className="group flex min-h-[148px] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/30 p-4 shadow-2xs transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                                <Wrench className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition truncate">
                                  {sub.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 truncate">
                                  /{sub.slug}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => openEditModal(sub)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                                title="Edit Subcategory"
                              >
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(sub, "Subcategory")}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Delete Subcategory"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>

                          {sub.description && (
                            <p className="mt-2 text-[11px] text-slate-500 line-clamp-2">
                              {sub.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => openJobsModal(sub)}
                            className="font-semibold text-slate-500 hover:text-indigo-600 transition flex items-center gap-1"
                          >
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 font-bold text-slate-700">
                              {sub.jobCount ?? 0}
                            </span>
                            <span>{sub.jobCount === 1 ? "Job" : "Jobs"}</span>
                            <ExternalLink className="h-2 w-2 opacity-50" />
                          </button>
                          <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Inline Add Card */}
                    <button
                      type="button"
                      onClick={() => openCreateModal("SUBCATEGORY", activeCategory.id)}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-xs font-semibold text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600 transition"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Subcategory</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center">
              <FolderTree className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">Select a category on the left</p>
              <p className="mt-1 text-xs text-slate-400">
                Click any category on the left panel to inspect and manage its subcategories.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Category / Subcategory */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createLevel === "PARENT"
                ? "Create Parent Domain"
                : createLevel === "CATEGORY"
                  ? "Create Category"
                  : "Create Subcategory"}
            </DialogTitle>
            <DialogDescription>
              {createLevel === "PARENT"
                ? "Add a top-level root domain (Level 1)."
                : createLevel === "CATEGORY"
                  ? "Add a main category under a parent domain (Level 2)."
                  : "Add a specific actionable subcategory under a category (Level 3)."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700">
                {createLevel === "PARENT"
                  ? "Parent Domain Name"
                  : createLevel === "CATEGORY"
                    ? "Category Name"
                    : "Subcategory Name"}{" "}
                *
              </label>
              <Input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder={
                  createLevel === "PARENT"
                    ? "e.g. Special Events"
                    : createLevel === "CATEGORY"
                      ? "e.g. Solar Energy Services"
                      : "e.g. Solar Panel Cleaning"
                }
                className="mt-1.5"
              />
            </div>

            {/* Target Selector */}
            {createLevel === "CATEGORY" && (
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Assign to Parent Domain *
                </label>
                <select
                  value={createForm.parentId ?? ""}
                  onChange={(e) => {
                    const pid = Number(e.target.value) || null;
                    const p = parents.find((t) => t.id === pid);
                    setCreateForm({
                      ...createForm,
                      parentId: pid,
                      segment: p?.segment ?? createForm.segment,
                    });
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-hidden"
                >
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.segment})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createLevel === "SUBCATEGORY" && (
              <div>
                <label className="text-xs font-bold text-slate-700">Assign to Category *</label>
                <select
                  value={createForm.parentId ?? ""}
                  onChange={(e) => {
                    const pid = Number(e.target.value) || null;
                    const cat = services.find((t) => t.id === pid);
                    setCreateForm({
                      ...createForm,
                      parentId: pid,
                      segment: cat?.segment ?? createForm.segment,
                    });
                  }}
                  className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold focus:outline-hidden"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {createLevel === "PARENT" && (
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Marketplace Domain / Segment
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL"] as Segment[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, segment: s })}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
                        createForm.segment === s
                          ? "bg-white text-indigo-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {s[0] + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700">Description (Optional)</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Brief summary of services included under this node…"
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-hidden"
              />
            </div>

            <DialogFooter className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white hover:bg-indigo-500"
              >
                {saving ? "Creating…" : "Create Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Category */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit: {editingService?.name}</DialogTitle>
            <DialogDescription>
              Update the name and public description for this service.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700">Name *</label>
              <Input
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-hidden"
              />
            </div>

            <DialogFooter className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white hover:bg-indigo-500"
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: View Assigned Jobs */}
      <Dialog open={jobsModalOpen} onOpenChange={setJobsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-indigo-600" />
              <span>Jobs in "{jobsService?.name}"</span>
            </DialogTitle>
            <DialogDescription>
              Live marketplace jobs currently categorized under this service.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 max-h-96 overflow-y-auto space-y-2.5 pr-1">
            {jobsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : categoryJobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-600">No jobs tagged yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  When clients post jobs under this category, they will appear here.
                </p>
              </div>
            ) : (
              categoryJobs.map((job) => (
                <a
                  key={job.id}
                  href={`/job/${job.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-xl border border-slate-200/90 bg-white p-3.5 transition hover:border-indigo-300 hover:bg-slate-50/50 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                        {job.title || `Job #${job.id}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                        {job.description || "No description provided."}
                      </p>
                    </div>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shrink-0">
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>{job.locationLabel ?? "Location pending"}</span>
                    <span>
                      {job.budgetMin || job.budgetMax
                        ? `₹${job.budgetMin?.toLocaleString("en-IN") ?? 0} - ₹${job.budgetMax?.toLocaleString("en-IN") ?? "Open"}`
                        : "Budget not specified"}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setJobsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
