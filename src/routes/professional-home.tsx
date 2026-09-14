"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingItem, MarketingPageContent } from "@/lib/marketing-cms-shared";

type HomeJob = {
  id: number;
  title: string | null;
  category: string | null;
  description: string | null;
  locationAddress: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: "HOURLY" | string;
  clientName: string;
};

const iconMap = {
  shield: ShieldCheck,
  briefcase: Briefcase,
  users: Users,
  map: MapPin,
  search: Search,
  arrow: Award,
  clipboard: CheckCircle2,
  message: MessageCircle,
  wallet: Wallet,
  clock: Clock,
  trend: TrendingUp,
  check: Check,
  star: Star,
  mail: Mail,
};

export default function ProfessionalHome({
  cmsMode = false,
  cmsContent,
  onCmsChange,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  cmsMode?: boolean;
  cmsContent?: MarketingPageContent;
  onCmsChange?: (content: MarketingPageContent) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<HomeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const content =
    cmsContent ??
    ({
      hero: {
        label: "Grow your professional business",
        title: "Find projects that match your skills",
        description:
          "Browse available projects, bid on work, and build your reputation with satisfied clients worldwide.",
      },
      features: {
        label: "Why Professionals Choose Us",
        title: "Everything you need to grow",
        description:
          "Find quality projects, get paid safely, and build a reputation clients trust.",
      },
      items: [
        {
          id: "grow",
          title: "Grow",
          description: "Find quality projects and build your professional business.",
          icon: "trend",
        },
        {
          id: "safe",
          title: "Get paid safely",
          description: "Work with clear milestones and reliable payments.",
          icon: "shield",
        },
        {
          id: "reputation",
          title: "Build your reputation",
          description: "Deliver great work and earn reviews clients trust.",
          icon: "star",
        },
      ],
    } satisfies MarketingPageContent);

  const editHero = (field: keyof MarketingPageContent["hero"], value: string) =>
    onCmsChange?.({ ...content, hero: { ...content.hero, [field]: value } });

  const editFeatures = (field: "label" | "title" | "description", value: string) =>
    onCmsChange?.({
      ...content,
      features: {
        label: content.features?.label ?? "Why Professionals Choose Us",
        title: content.features?.title ?? "Everything you need to grow",
        description:
          content.features?.description ??
          "Find quality projects, get paid safely, and build a reputation clients trust.",
        [field]: value,
      },
    });

  const updateItemOrder = (activeId: string, overId: string) => {
    const from = content.items.findIndex((item) => item.id === activeId);
    const to = content.items.findIndex((item) => item.id === overId);
    if (from >= 0 && to >= 0) {
      onCmsChange?.({ ...content, items: arrayMove(content.items, from, to) });
    }
  };

  const updateItem = (id: string, changes: Partial<MarketingItem>) => {
    onCmsChange?.({
      ...content,
      items: content.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    });
  };

  useEffect(() => {
    async function loadJobs() {
      try {
        const response = await fetch("/api/v1/portal/professional-jobs");
        if (!response.ok) throw new Error("Professional jobs request failed");
        const data = (await response.json()) as { openJobs: HomeJob[] };
        setJobs(Array.isArray(data.openJobs) ? data.openJobs : []);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
    void loadJobs();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <main>
        {/* Hero Section */}
        <section className="gradient-hero">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editHero("label", e.currentTarget.textContent ?? "")}
              >
                {content.hero.label}
              </span>
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editHero("title", e.currentTarget.textContent ?? "")}
              >
                {content.hero.title}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editHero("description", e.currentTarget.textContent ?? "")}
              >
                {content.hero.description}
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild={!cmsMode}
                size="lg"
                type="button"
                onClick={cmsMode ? (e) => e.preventDefault() : undefined}
              >
                {cmsMode ? (
                  <div className="flex items-center">
                    <Search className="mr-2 h-4 w-4" />
                    <span contentEditable={cmsMode} suppressContentEditableWarning={cmsMode}>
                      Find Projects
                    </span>
                  </div>
                ) : (
                  <Link href="/professional/my-jobs?tab=find">
                    <Search className="mr-2 h-4 w-4" />
                    <span>Find Projects</span>
                  </Link>
                )}
              </Button>
              <Button
                asChild={!cmsMode}
                size="lg"
                variant="outline"
                type="button"
                onClick={cmsMode ? (e) => e.preventDefault() : undefined}
              >
                {cmsMode ? (
                  <div className="flex items-center">
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span contentEditable={cmsMode} suppressContentEditableWarning={cmsMode}>
                      My Dashboard
                    </span>
                  </div>
                ) : (
                  <Link href="/professional/dashboard">
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>My Dashboard</span>
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Why Choose Us & Draggable Feature Cards Section */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editFeatures("label", e.currentTarget.textContent ?? "")}
              >
                {content.features?.label ?? "Why Professionals Choose Us"}
              </span>
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editFeatures("title", e.currentTarget.textContent ?? "")}
              >
                {content.features?.title ?? "Everything you need to grow"}
              </span>
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-lg text-muted-foreground">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => editFeatures("description", e.currentTarget.textContent ?? "")}
              >
                {content.features?.description ??
                  "Find quality projects, get paid safely, and build a reputation clients trust."}
              </span>
            </p>
          </div>

          {/* Draggable Sortable Feature Cards */}
          {content.items && content.items.length > 0 && (
            <div className="mt-12">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => {
                  if (cmsMode && event.over && event.active.id !== event.over.id) {
                    updateItemOrder(String(event.active.id), String(event.over.id));
                  }
                }}
              >
                <SortableContext
                  items={content.items.map((item) => item.id)}
                  strategy={rectSortingStrategy}
                >
                  <div
                    className={`grid gap-6 ${
                      content.items.length === 1
                        ? "mx-auto max-w-md"
                        : content.items.length === 2
                          ? "md:grid-cols-2"
                          : "md:grid-cols-2 lg:grid-cols-3"
                    }`}
                  >
                    {content.items.map((item) => (
                      <SortableProfessionalCard
                        key={item.id}
                        item={item}
                        cmsMode={cmsMode}
                        selected={selectedId === item.id}
                        onSelect={() => onSelect?.(item.id)}
                        onChange={(changes) => updateItem(item.id, changes)}
                        onDelete={() => onDelete?.(item.id)}
                        onDuplicate={() => onDuplicate?.(item.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </section>

        {/* Featured Jobs Section */}
        <section className="bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Featured
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold">Jobs ready for you</h2>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                href={cmsMode ? "#" : "/professional/my-jobs?tab=find"}
                onClick={cmsMode ? (e) => e.preventDefault() : undefined}
              >
                Browse all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {loading && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            )}
            {!loading && !failed && (
              <div data-db-section="jobs" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {jobs.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    href={cmsMode ? "#" : `/professional/job/${job.id}`}
                    onClick={cmsMode ? (e) => e.preventDefault() : undefined}
                    className="flex min-h-64 flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {job.category ?? "General"}
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold">
                      {job.title ?? `Job #${job.id}`}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {job.description}
                    </p>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {job.locationAddress ?? "Remote"}
                    </p>
                    <div className="mt-auto flex items-end justify-between border-t border-border pt-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Budget
                        </p>
                        <p className="font-display text-xl font-bold">
                          {job.timingType === "HOURLY"
                            ? `₹${job.hourlyRate ?? 0}/hr`
                            : `₹${job.budgetMin ?? 0} – ₹${job.budgetMax ?? 0}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-primary">View job</span>
                    </div>
                  </Link>
                ))}
                {!jobs.length && (
                  <p className="col-span-full rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                    No open jobs are available right now.
                  </p>
                )}
              </div>
            )}
            {failed && (
              <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                Could not load jobs right now.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SortableProfessionalCard({
  item,
  cmsMode,
  selected,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: {
  item: MarketingItem;
  cmsMode: boolean;
  selected: boolean;
  onSelect?: () => void;
  onChange: (changes: Partial<MarketingItem>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const Icon = iconMap[item.icon as keyof typeof iconMap] ?? ShieldCheck;

  const editable = (field: "title" | "description") =>
    cmsMode
      ? {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onPointerDown: (event: React.PointerEvent<HTMLElement>) => event.stopPropagation(),
          onInput: (event: React.FormEvent<HTMLElement>) =>
            onChange({ [field]: event.currentTarget.textContent ?? "" }),
        }
      : {};

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(cmsMode ? attributes : {})}
      {...(cmsMode ? listeners : {})}
      onClick={cmsMode ? onSelect : undefined}
      className={`relative rounded-2xl border border-border bg-card p-7 shadow-soft transition ${
        cmsMode ? "cursor-grab active:cursor-grabbing hover:border-primary/40" : ""
      } ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${
        isDragging ? "z-10 scale-[1.02] opacity-70 shadow-2xl" : ""
      }`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="font-display text-xl font-bold text-foreground" {...editable("title")}>
        {item.title}
      </h3>

      <p
        className="mt-2 text-sm text-muted-foreground leading-relaxed"
        {...editable("description")}
      >
        {item.description}
      </p>

      {cmsMode && selected && (
        <div
          className="absolute -top-3 right-3 flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1 text-xs shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-1 font-semibold text-slate-700">
            Icon
            <select
              value={item.icon}
              onChange={(e) => onChange({ icon: e.target.value })}
              className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-800 outline-none"
            >
              <option value="trend">Trend</option>
              <option value="shield">Shield</option>
              <option value="star">Star</option>
              <option value="briefcase">Briefcase</option>
              <option value="users">Users</option>
              <option value="wallet">Wallet</option>
              <option value="check">Check</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:text-indigo-700 ml-1"
          >
            <Copy className="h-3 w-3" /> Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-rose-600 font-bold hover:text-rose-700 ml-1"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}
    </article>
  );
}
