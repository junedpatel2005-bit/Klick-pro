"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, MapPin, Search, ShieldCheck, Users } from "lucide-react";
import { ProCard } from "@/components/ProCard";
import { Button } from "@/components/ui/button";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HomeContent } from "@/lib/home-cms-file";
import type { MarketplaceProfessional } from "@/lib/types/marketplace";

export default function Landing({
  isAuthenticated = false,
  homeContent,
  cmsMode = false,
  onHomeChange,
  selectedFeatureId,
  onFeatureSelect,
  onFeatureDelete,
  onFeatureDuplicate,
}: {
  isAuthenticated?: boolean;
  homeContent?: HomeContent;
  cmsMode?: boolean;
  onHomeChange?: (content: HomeContent) => void;
  selectedFeatureId?: string | null;
  onFeatureSelect?: (id: string) => void;
  onFeatureDelete?: (id: string) => void;
  onFeatureDuplicate?: (id: string) => void;
}) {
  const fallback: HomeContent = {
    hero: {
      eyebrow: "VERIFIED MARKETPLACE PROFESSIONALS",
      title: "Find trusted professionals for work that matters.",
      description:
        "Post work, compare qualified professionals, and manage every project in one place.",
      primaryCta: "Browse professionals",
      secondaryCta: "Post a job",
    },
    features: [
      {
        id: "verified",
        title: "Verified Professionals",
        description:
          "All professionals are verified and vetted to ensure quality work and your peace of mind.",
        icon: "shield",
      },
      {
        id: "projects",
        title: "Project Management",
        description:
          "Track progress, communicate in real-time, and manage all projects in one centralized dashboard.",
        icon: "briefcase",
      },
      {
        id: "matching",
        title: "Expert Matching",
        description:
          "Get matched with professionals that best fit your project needs and budget requirements.",
        icon: "users",
      },
      {
        id: "local",
        title: "Local & Remote",
        description:
          "Work with professionals near you or globally - choose what works best for your project.",
        icon: "map",
      },
      {
        id: "discovery",
        title: "Easy Discovery",
        description:
          "Browse portfolios, reviews, and rates to find the right fit. Make data-driven decisions.",
        icon: "search",
      },
      {
        id: "growth",
        title: "Seamless Growth",
        description:
          "Build long-term relationships with reliable partners and scale your business together.",
        icon: "arrow",
      },
    ],
  };
  const content = homeContent ?? fallback;
  const edit = (hero: Partial<HomeContent["hero"]>) =>
    onHomeChange?.({ ...content, hero: { ...content.hero, ...hero } });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [professionals, setProfessionals] = useState<MarketplaceProfessional[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cmsMode) return;
    async function loadHome() {
      try {
        const response = await fetch("/api/v1/marketplace/professionals");
        if (!response.ok) throw new Error("Marketplace request failed");
        setProfessionals((await response.json()) as MarketplaceProfessional[]);
      } catch {
        setFailed(true);
      }
    }
    void loadHome();
  }, [cmsMode]);

  return (
    <div className="min-h-screen bg-background">
      <main>
        <section className="gradient-hero">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => edit({ eyebrow: e.currentTarget.textContent ?? "" })}
              >
                {content.hero.eyebrow}
              </span>
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => edit({ title: e.currentTarget.textContent ?? "" })}
              >
                {content.hero.title}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              <span
                contentEditable={cmsMode}
                suppressContentEditableWarning={cmsMode}
                onInput={(e) => edit({ description: e.currentTarget.textContent ?? "" })}
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
                    <span
                      contentEditable={cmsMode}
                      suppressContentEditableWarning={cmsMode}
                      onInput={(e) => edit({ primaryCta: e.currentTarget.textContent ?? "" })}
                    >
                      {content.hero.primaryCta}
                    </span>
                  </div>
                ) : (
                  <Link href="/discover">
                    <Search className="mr-2 h-4 w-4" />
                    <span>{content.hero.primaryCta}</span>
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
                    <span
                      contentEditable={cmsMode}
                      suppressContentEditableWarning={cmsMode}
                      onInput={(e) => edit({ secondaryCta: e.currentTarget.textContent ?? "" })}
                    >
                      {content.hero.secondaryCta}
                    </span>
                  </div>
                ) : (
                  <Link href="/post-job">
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>{content.hero.secondaryCta}</span>
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Why Choose Us
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              A complete platform built for seamless collaboration between professionals and clients
            </p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              if (!cmsMode || !onHomeChange || !event.over || event.active.id === event.over.id)
                return;
              const from = content.features.findIndex((item) => item.id === event.active.id);
              const to = content.features.findIndex((item) => item.id === event.over?.id);
              if (from >= 0 && to >= 0)
                onHomeChange({ ...content, features: arrayMove(content.features, from, to) });
            }}
          >
            <SortableContext
              items={content.features.map((feature) => feature.id)}
              strategy={rectSortingStrategy}
            >
              <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {content.features.map((feature) => (
                  <HomeFeature
                    key={feature.id}
                    feature={feature}
                    cmsMode={cmsMode}
                    selected={selectedFeatureId === feature.id}
                    onSelect={() => onFeatureSelect?.(feature.id)}
                    onDelete={() => onFeatureDelete?.(feature.id)}
                    onDuplicate={() => onFeatureDuplicate?.(feature.id)}
                    onChange={(changes) =>
                      onHomeChange?.({
                        ...content,
                        features: content.features.map((item) =>
                          item.id === feature.id ? { ...item, ...changes } : item,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
        <section className="bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Featured
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold">
                  Professionals ready to help
                </h2>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                href="/discover"
              >
                Browse all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {cmsMode ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  "Professional one",
                  "Professional two",
                  "Professional three",
                  "Professional four",
                ].map((name) => (
                  <div
                    key={name}
                    className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                        P
                      </div>
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-sm text-muted-foreground">Service category</p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Starting at
                      </p>
                      <p className="mt-1 text-xl font-bold">₹—</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {!cmsMode && !professionals.length && !failed && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            )}
            {!cmsMode && professionals.length > 0 && (
              <div
                data-db-section="professionals"
                className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
              >
                {professionals.slice(0, 4).map((professional) => (
                  <ProCard
                    key={professional.id}
                    pro={professional}
                    requireLogin={!isAuthenticated}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function HomeFeature({
  feature,
  cmsMode,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onChange,
}: {
  feature: HomeContent["features"][number];
  cmsMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChange: (changes: Partial<HomeContent["features"][number]>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: feature.id,
  });
  const icons = {
    shield: ShieldCheck,
    briefcase: Briefcase,
    users: Users,
    map: MapPin,
    search: Search,
    arrow: ArrowRight,
  };
  const Icon = icons[feature.icon as keyof typeof icons] ?? ShieldCheck;
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
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(cmsMode ? attributes : {})}
      {...(cmsMode ? listeners : {})}
      onClick={cmsMode ? onSelect : undefined}
      className={`relative rounded-2xl border border-border bg-card p-8 shadow-soft ${cmsMode ? "cursor-grab active:cursor-grabbing" : ""} ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${isDragging ? "z-10 scale-[1.02] opacity-70 shadow-2xl" : ""}`}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display font-semibold" {...editable("title")}>
        {feature.title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground" {...editable("description")}>
        {feature.description}
      </p>
      {cmsMode && selected && (
        <div
          className="absolute -top-3 right-3 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 text-xs shadow-lg"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <label className="text-muted-foreground">
            Icon{" "}
            <select
              value={feature.icon}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onChange({ icon: event.target.value })}
              className="bg-background text-foreground"
            >
              <option value="shield">Shield</option>
              <option value="briefcase">Briefcase</option>
              <option value="users">Users</option>
              <option value="map">Map</option>
              <option value="search">Search</option>
              <option value="arrow">Arrow</option>
            </select>
          </label>
          <button type="button" onClick={onDelete} className="text-destructive">
            Delete
          </button>
          <button type="button" onClick={onDuplicate} className="text-primary">
            Duplicate card
          </button>
        </div>
      )}
    </div>
  );
}
