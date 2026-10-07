"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Italic,
  Laptop,
  Layers,
  Link as LinkIcon,
  List,
  ListOrdered,
  Plus,
  Redo2,
  RemoveFormatting,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Strikethrough,
  Tablet,
  Type,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AboutFeatureCard } from "@/components/AboutFeatureCard";
import { AboutHero } from "@/components/AboutHero";
import type { CmsCard, CmsContent } from "@/lib/cms-file";
import Landing from "@/routes/index";
import ProfessionalHome from "@/routes/professional-home";
import type { HomeContent, HomeFeature } from "@/lib/home-cms-file";
import MarketingVisualPage from "@/components/MarketingVisualPage";
import {
  marketingPageIds,
  type MarketingItem,
  type MarketingPageContent,
  type MarketingPageId,
} from "@/lib/marketing-cms-shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Draft = Omit<CmsContent, "updatedAt" | "sectionOrder">;
const newId = () => `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cmsPages = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Professional Home", href: "/professional-home" },
  ...marketingPageIds
    .filter((page) => page !== "professional-home")
    .map((page) => ({
      label:
        page === "faq"
          ? "FAQ"
          : page.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      href: `/${page}`,
    })),
];

export default function CmsEditor() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [selectedPage, setSelectedPage] = useState("/about");
  const [pendingPage, setPendingPage] = useState<string | null>(null);
  const [sectionOrder, setSectionOrder] = useState<Array<"hero" | "features">>([
    "hero",
    "features",
  ]);

  // Viewport Switcher State
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // SEO & Meta Drawer State
  const [seoOpen, setSeoOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState("About Klick-Pro | Verified Local Marketplace");
  const [metaDescription, setMetaDescription] = useState(
    "Connect with vetted professionals for home, digital, and corporate projects with verified escrow payments.",
  );
  const [metaKeywords, setMetaKeywords] = useState(
    "local services, professionals, escrow, verified jobs",
  );

  // Add Block Modal State
  const [addBlockOpen, setAddBlockOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    void fetch("/api/admin/cms", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as CmsContent;
        setDraft({ hero: data.hero, cards: data.cards });
        setSectionOrder(data.sectionOrder ?? ["hero", "features"]);
        setStatus("saved");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Unable to load the saved About page.");
      });
  }, []);

  const update = (next: Draft) => {
    setDraft(next);
    setStatus("ready");
    setMessage("");
  };

  const updateCard = (id: string, changes: Partial<CmsCard>) =>
    draft &&
    update({
      ...draft,
      cards: draft.cards.map((card) => (card.id === id ? { ...card, ...changes } : card)),
    });

  const deleteCard = (id: string) =>
    draft &&
    draft.cards.length > 1 &&
    update({ ...draft, cards: draft.cards.filter((card) => card.id !== id) });

  const addCard = (customData?: Partial<CmsCard>) => {
    if (!draft) return;
    update({
      ...draft,
      cards: [
        ...draft.cards,
        {
          id: newId(),
          title: customData?.title ?? "New Highlight",
          description: customData?.description ?? "Add details for this section.",
          icon: customData?.icon ?? "shield",
        },
      ],
    });
    setAddBlockOpen(false);
  };

  const duplicateCard = (card: CmsCard) =>
    draft &&
    update({
      ...draft,
      cards: [...draft.cards, { ...card, id: newId(), title: `${card.title} copy` }],
    });

  const onDragEnd = (event: DragEndEvent) => {
    if (!draft || !event.over || event.active.id === event.over.id) return;
    const from = draft.cards.findIndex((card) => card.id === event.active.id);
    const to = draft.cards.findIndex((card) => card.id === event.over?.id);
    if (from >= 0 && to >= 0) update({ ...draft, cards: arrayMove(draft.cards, from, to) });
  };

  const handlePageChange = (page: string) => {
    if (!cmsPages.some((item) => item.href === page)) {
      setMessage("This page is not editable yet.");
      setStatus("error");
      return;
    }
    if (page === selectedPage) return;
    if (status === "ready") setPendingPage(page);
    else setSelectedPage(page);
  };

  async function save() {
    if (!draft) return false;
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, sectionOrder }),
      });
      if (!response.ok) throw new Error();
      setStatus("saved");
      setMessage("Changes saved successfully.");
      return true;
    } catch {
      setStatus("error");
      setMessage("Unable to save changes.");
      return false;
    }
  }

  const discardAndSwitch = async () => {
    if (!pendingPage) return;
    try {
      const response = await fetch("/api/admin/cms", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as CmsContent;
      setDraft({ hero: data.hero, cards: data.cards });
      setSectionOrder(data.sectionOrder ?? ["hero", "features"]);
      setStatus("saved");
      setMessage("");
      setSelectedPage(pendingPage);
      setPendingPage(null);
    } catch {
      setStatus("error");
      setMessage("Unable to discard the current changes.");
    }
  };

  if (selectedPage === "/") {
    return <HomeCmsEditor selectedPage={selectedPage} onPageChange={setSelectedPage} />;
  }

  if (selectedPage !== "/about") {
    return (
      <MarketingCmsEditor
        page={selectedPage.slice(1) as MarketingPageId}
        onPageChange={setSelectedPage}
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="py-16 text-center text-slate-500 font-medium">
        <Sparkles className="mx-auto h-8 w-8 animate-pulse text-indigo-500 mb-3" />
        Loading Visual CMS Workspace…
      </div>
    );
  }

  if (!draft) return <p className="text-rose-600 font-medium">{message}</p>;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              <Layers className="h-3.5 w-3.5" />
              Live Visual CMS
            </span>
            <span className="text-xs font-medium text-slate-400">· Real-time in-place editing</span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Visual Website Editor
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Click directly on any text or block below to edit content live on the website.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Page Picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Page:
            </label>
            <select
              value={selectedPage}
              onChange={(event) => handlePageChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
            >
              {cmsPages.map((page) => (
                <option key={page.href} value={page.href} className="text-slate-900">
                  {page.label}
                </option>
              ))}
            </select>
          </div>

          {/* SEO Modal Trigger */}
          <button
            type="button"
            onClick={() => setSeoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Globe className="h-4 w-4 text-indigo-600" />
            <span>SEO & Meta</span>
          </button>

          {/* Add Block Trigger */}
          <button
            type="button"
            onClick={() => setAddBlockOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Block</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={() => void save()}
            disabled={status === "saving"}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-60 transition"
          >
            <Save className="h-4 w-4" />
            <span>{status === "saving" ? "Saving Changes…" : "Save & Publish"}</span>
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {status === "ready" && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-2xs">
          <span>
            You have unsaved changes. Don&apos;t forget to click &quot;Save &amp; Publish&quot;.
          </span>
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-lg bg-amber-600 px-3 py-1 text-white hover:bg-amber-500 transition"
          >
            Save Now
          </button>
        </div>
      )}
      {message && status === "saved" && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Persistent Rich Formatting & Viewport Toolbar */}
      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-2.5 shadow-md shadow-slate-900/5 flex flex-wrap items-center justify-between gap-3">
        {/* Formatting Tools */}
        <RichFormattingToolbar />

        {/* Viewport Device Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            title="Desktop View (100%)"
            onClick={() => setViewport("desktop")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "desktop"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Laptop className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tablet View (768px)"
            onClick={() => setViewport("tablet")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "tablet"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Tablet className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Mobile View (375px)"
            onClick={() => setViewport("mobile")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "mobile"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas with Responsive Container Simulation */}
      <div className="flex justify-center transition-all duration-300">
        <div
          onClickCapture={(e) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor && !target.isContentEditable) {
              e.preventDefault();
            }
          }}
          className={`w-full overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-200 transition-all duration-300 ${
            viewport === "tablet"
              ? "max-w-[768px] ring-8 ring-slate-200/80 my-4"
              : viewport === "mobile"
                ? "max-w-[390px] ring-12 ring-slate-300 my-6 shadow-2xl"
                : "max-w-full"
          }`}
        >
          {/* Editable Canvas Sections */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToWindowEdges]}
            onDragEnd={(event) => {
              if (event.active.id === event.over?.id) return;
              const from = sectionOrder.indexOf(String(event.active.id) as "hero" | "features");
              const to = sectionOrder.indexOf(String(event.over?.id) as "hero" | "features");
              if (from >= 0 && to >= 0) {
                setSectionOrder(arrayMove(sectionOrder, from, to));
                setStatus("ready");
                setMessage("");
              } else onDragEnd(event);
            }}
          >
            <SortableContext items={sectionOrder} strategy={rectSortingStrategy}>
              {sectionOrder.map((section) =>
                section === "hero" ? (
                  <SortableSection key={section} id={section}>
                    <AboutHero
                      {...draft.hero}
                      editable
                      onChange={(field, value) =>
                        update({ ...draft, hero: { ...draft.hero, [field]: value } })
                      }
                    />
                  </SortableSection>
                ) : (
                  <SortableSection key={section} id={section}>
                    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        modifiers={[restrictToWindowEdges]}
                        onDragEnd={onDragEnd}
                      >
                        <SortableContext
                          items={draft.cards.map((card) => card.id)}
                          strategy={rectSortingStrategy}
                        >
                          <div
                            className={`mx-auto grid w-full gap-6 ${
                              draft.cards.length === 1
                                ? "max-w-md"
                                : draft.cards.length === 2
                                  ? "md:grid-cols-2"
                                  : draft.cards.length === 3
                                    ? "md:grid-cols-3"
                                    : "sm:grid-cols-2 lg:grid-cols-3"
                            }`}
                          >
                            {draft.cards.map((card) => (
                              <SortableVisualCard
                                key={card.id}
                                card={card}
                                selected={selectedId === card.id}
                                onSelect={() => setSelectedId(card.id)}
                                onChange={(changes) => updateCard(card.id, changes)}
                                onDelete={() => deleteCard(card.id)}
                                onDuplicate={() => duplicateCard(card)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </section>
                  </SortableSection>
                ),
              )}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Add Block Modal Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="max-w-2xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900">
              Add Content Block
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a pre-designed layout block to insert into this page.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                addCard({
                  title: "Verified Trust & Safety",
                  description: "Background-checked professionals with verified credentials.",
                  icon: "shield",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Trust &amp; Feature Card</p>
                <p className="mt-1 text-xs text-slate-500">
                  Highlights security, milestones, or guarantees.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addCard({
                  title: "Dedicated Partner Support",
                  description: "24/7 dedicated support team to assist with your projects.",
                  icon: "handshake",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Partnership &amp; Support</p>
                <p className="mt-1 text-xs text-slate-500">
                  Showcases collaboration and customer service.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addCard({
                  title: "Verified Work Worth Doing",
                  description: "From home repair to IT development, top rated services.",
                  icon: "award",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Excellence &amp; Awards</p>
                <p className="mt-1 text-xs text-slate-500">
                  Demonstrates top performance and rating standards.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addCard({
                  title: "Enterprise Solutions",
                  description: "Customized management for large project workflows.",
                  icon: "briefcase",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Custom Category Block</p>
                <p className="mt-1 text-xs text-slate-500">
                  Flexible block for custom text and benefits.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SEO & Meta Drawer Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              <span>SEO &amp; Social Meta Tags</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Customize how this page appears in Google search results and social media shares.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Meta Title */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Page Title Tag</span>
                <span className="text-slate-400 font-medium">{metaTitle.length}/60 chars</span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Meta Description</span>
                <span className="text-slate-400 font-medium">
                  {metaDescription.length}/160 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Target Keywords */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Keywords</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Google Search Live Preview */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Google Search Result Preview
              </p>
              <p className="text-xs text-slate-500 truncate">https://klickpro.com{selectedPage}</p>
              <h4 className="mt-1 font-semibold text-sm text-blue-700 hover:underline cursor-pointer">
                {metaTitle}
              </h4>
              <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {metaDescription}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSeoOpen(false)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-2xs"
            >
              Apply SEO Settings
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RichFormattingToolbar() {
  const format = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
  };

  const applyHeading = (tag: string) => {
    document.execCommand("formatBlock", false, `<${tag}>`);
  };

  const insertHyperlink = () => {
    const url = window.prompt(
      "Enter the destination web URL (e.g. https://klickpro.com/services):",
    );
    if (url) {
      document.execCommand("createLink", false, url);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Typography Select */}
      <select
        onChange={(e) => {
          if (e.target.value) applyHeading(e.target.value);
        }}
        defaultValue="p"
        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 outline-none hover:bg-slate-100 transition mr-1"
      >
        <option value="p">Normal Text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="blockquote">Quote Block</option>
      </select>

      {/* Formatting Action Buttons */}
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("bold");
          }}
          title="Bold (Ctrl+B)"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("italic");
          }}
          title="Italic (Ctrl+I)"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("underline");
          }}
          title="Underline (Ctrl+U)"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("strikeThrough");
          }}
          title="Strikethrough"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Alignment Tools */}
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("justifyLeft");
          }}
          title="Align Left"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("justifyCenter");
          }}
          title="Align Center"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("justifyRight");
          }}
          title="Align Right"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("justifyFull");
          }}
          title="Justify"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lists & Link */}
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("insertUnorderedList");
          }}
          title="Bulleted List"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("insertOrderedList");
          }}
          title="Numbered List"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertHyperlink();
          }}
          title="Insert Link"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Undo & Redo */}
      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("undo");
          }}
          title="Undo (Ctrl+Z)"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("redo");
          }}
          title="Redo (Ctrl+Y)"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-indigo-600 transition"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            format("removeFormat");
          }}
          title="Clear Formatting"
          className="rounded p-1 text-slate-700 hover:bg-white hover:text-rose-600 transition"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function HomeCmsEditor({
  selectedPage,
  onPageChange,
}: {
  selectedPage: string;
  onPageChange: (page: string) => void;
}) {
  const [content, setContent] = useState<HomeContent | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [seoOpen, setSeoOpen] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState(
    "Klick-Pro | Hire Top Local & Remote Verified Professionals",
  );
  const [metaDescription, setMetaDescription] = useState(
    "Connect with vetted professionals for home, IT, and creative services with milestone escrow security.",
  );
  const [metaKeywords, setMetaKeywords] = useState(
    "hire professionals, verified pros, escrow freelance, local services",
  );

  useEffect(() => {
    void fetch("/api/admin/cms?page=home", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setContent((await response.json()) as HomeContent);
      })
      .catch(() => setLoadError("Unable to load the Home page. Please refresh and try again."));
  }, []);

  if (loadError) return <p className="text-rose-600 font-medium">{loadError}</p>;
  if (!content) return <p className="text-slate-400 font-medium">Loading Home page…</p>;

  const update = (next: HomeContent) => {
    setContent(next);
    setSaved(false);
    setDirty(true);
  };

  const addHomeFeature = (customData?: Partial<HomeFeature>) => {
    if (!content) return;
    update({
      ...content,
      features: [
        ...content.features,
        {
          id: `feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: customData?.title ?? "New Feature Card",
          description: customData?.description ?? "Add description for this feature.",
          icon: customData?.icon ?? "shield",
        },
      ],
    });
    setAddBlockOpen(false);
  };

  const deleteFeature = (id: string) => {
    if (!content || content.features.length <= 1) return;
    update({ ...content, features: content.features.filter((feature) => feature.id !== id) });
    setSelectedFeatureId(null);
  };

  const duplicateFeature = (id: string) => {
    if (!content) return;
    const index = content.features.findIndex((feature) => feature.id === id);
    if (index < 0) return;
    const source = content.features[index];
    if (!source) return;
    const duplicate = {
      ...source,
      id: `feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `${source.title} copy`,
    };
    update({
      ...content,
      features: [
        ...content.features.slice(0, index + 1),
        duplicate,
        ...content.features.slice(index + 1),
      ],
    });
    setSelectedFeatureId(duplicate.id);
  };

  const requestPageChange = (page: string) => {
    if (!cmsPages.some((item) => item.href === page)) {
      setNotice("This page is not editable yet.");
      return;
    }
    setNotice("");
    if (page === selectedPage) return;
    if (dirty) setPendingPage(page);
    else onPageChange(page);
  };

  const saveHome = async () => {
    if (!content) return false;
    const response = await fetch("/api/admin/cms", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page: "home", content }),
    });
    if (!response.ok) return false;
    setSaved(true);
    setDirty(false);
    return true;
  };

  const discardHomeAndSwitch = async () => {
    if (!pendingPage) return;
    const response = await fetch("/api/admin/cms?page=home", { cache: "no-store" });
    if (!response.ok) return;
    setContent((await response.json()) as HomeContent);
    setDirty(false);
    setSaved(false);
    onPageChange(pendingPage);
    setPendingPage(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              <Layers className="h-3.5 w-3.5" />
              Live Visual CMS
            </span>
            <span className="text-xs font-medium text-slate-400">· Homepage layout</span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Edit Homepage
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Click directly on any headline, banner, or feature card to edit content live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Page:
            </label>
            <select
              value={selectedPage}
              onChange={(event) => requestPageChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
            >
              {cmsPages.map((page) => (
                <option key={page.href} value={page.href} className="text-slate-900">
                  {page.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSeoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Globe className="h-4 w-4 text-indigo-600" />
            <span>SEO &amp; Meta</span>
          </button>

          <button
            type="button"
            onClick={() => setAddBlockOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Block</span>
          </button>

          <button
            type="button"
            onClick={() => void saveHome()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition"
          >
            <Save className="h-4 w-4" />
            <span>Save Homepage</span>
          </button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-2xs">
          <span>You have unsaved changes on the homepage.</span>
          <button
            type="button"
            onClick={() => void saveHome()}
            className="rounded-lg bg-amber-600 px-3 py-1 text-white hover:bg-amber-500 transition"
          >
            Save Now
          </button>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Homepage changes published successfully.</span>
        </div>
      )}

      {/* Persistent Toolbar */}
      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-2.5 shadow-md shadow-slate-900/5 flex flex-wrap items-center justify-between gap-3">
        <RichFormattingToolbar />

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            title="Desktop View (100%)"
            onClick={() => setViewport("desktop")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "desktop"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Laptop className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tablet View (768px)"
            onClick={() => setViewport("tablet")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "tablet"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Tablet className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Mobile View (375px)"
            onClick={() => setViewport("mobile")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "mobile"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pendingPage && (
        <PageSwitchPrompt
          pageLabel={cmsPages.find((page) => page.href === pendingPage)?.label ?? "page"}
          onSave={async () => {
            if (await saveHome()) {
              onPageChange(pendingPage);
              setPendingPage(null);
            }
          }}
          onDiscard={() => void discardHomeAndSwitch()}
          onCancel={() => setPendingPage(null)}
        />
      )}

      {/* Canvas Viewport */}
      <div className="flex justify-center transition-all duration-300">
        <div
          onClickCapture={(e) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor && !target.isContentEditable) {
              e.preventDefault();
            }
          }}
          className={`w-full overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-200 transition-all duration-300 ${
            viewport === "tablet"
              ? "max-w-[768px] ring-8 ring-slate-200/80 my-4"
              : viewport === "mobile"
                ? "max-w-[390px] ring-12 ring-slate-300 my-6 shadow-2xl"
                : "max-w-full"
          }`}
        >
          <Landing
            isAuthenticated
            homeContent={content}
            cmsMode
            onHomeChange={update}
            selectedFeatureId={selectedFeatureId}
            onFeatureSelect={setSelectedFeatureId}
            onFeatureDelete={deleteFeature}
            onFeatureDuplicate={duplicateFeature}
          />
        </div>
      </div>

      {/* Add Block Modal Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="max-w-2xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900">
              Add Homepage Block
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a pre-designed layout block to insert into the homepage.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                addHomeFeature({
                  title: "Verified Trust & Safety",
                  description: "Background-checked professionals with verified credentials.",
                  icon: "shield",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Trust &amp; Security Card</p>
                <p className="mt-1 text-xs text-slate-500">
                  Highlights security, milestones, or guarantees.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addHomeFeature({
                  title: "Fast Matching & Hiring",
                  description: "Receive competitive bids within minutes of posting your job.",
                  icon: "briefcase",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Hiring &amp; Speed</p>
                <p className="mt-1 text-xs text-slate-500">
                  Showcases quick job matching and proposal tools.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addHomeFeature({
                  title: "Escrow Protected Payments",
                  description: "Funds are released only when you approve completed milestones.",
                  icon: "award",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Payment Protection</p>
                <p className="mt-1 text-xs text-slate-500">
                  Demonstrates safe escrow transactions.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addHomeFeature({
                  title: "24/7 Dedicated Assistance",
                  description: "Our dedicated support team is available whenever you need help.",
                  icon: "users",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Custom Category Block</p>
                <p className="mt-1 text-xs text-slate-500">
                  Flexible block for custom text and benefits.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SEO & Meta Drawer Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              <span>SEO &amp; Social Meta Tags</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Customize how the homepage appears in Google search results and social media shares.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Page Title Tag</span>
                <span className="text-slate-400 font-medium">{metaTitle.length}/60 chars</span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Meta Description</span>
                <span className="text-slate-400 font-medium">
                  {metaDescription.length}/160 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Keywords</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Google Search Result Preview
              </p>
              <p className="text-xs text-slate-500 truncate">https://klickpro.com/</p>
              <h4 className="mt-1 font-semibold text-sm text-blue-700 hover:underline cursor-pointer">
                {metaTitle}
              </h4>
              <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {metaDescription}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSeoOpen(false)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-2xs"
            >
              Apply SEO Settings
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MarketingCmsEditor({
  page,
  onPageChange,
}: {
  page: MarketingPageId;
  onPageChange: (page: string) => void;
}) {
  const [content, setContent] = useState<MarketingPageContent | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingPage, setPendingPage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [seoOpen, setSeoOpen] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const pageTitle = cmsPages.find((item) => item.href === `/${page}`)?.label ?? "Marketing Page";
  const [metaTitle, setMetaTitle] = useState(`Klick-Pro | ${pageTitle}`);
  const [metaDescription, setMetaDescription] = useState(
    `Learn more about ${pageTitle} on Klick-Pro. Connect with verified service professionals with secure milestone escrow.`,
  );
  const [metaKeywords, setMetaKeywords] = useState(
    `klick pro, ${pageTitle.toLowerCase()}, verified professionals, local services`,
  );

  useEffect(() => {
    setContent(null);
    setError("");
    setDirty(false);
    setMetaTitle(`Klick-Pro | ${pageTitle}`);
    setMetaDescription(
      `Learn more about ${pageTitle} on Klick-Pro. Connect with verified service professionals with secure milestone escrow.`,
    );
    void fetch(`/api/admin/cms?page=${page}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setContent((await response.json()) as MarketingPageContent);
      })
      .catch(() => setError("Unable to load this page."));
  }, [page, pageTitle]);

  if (error && !content) return <p className="text-rose-600 font-medium">{error}</p>;
  if (!content) return <p className="text-slate-500 font-medium">Loading page…</p>;

  const update = (next: MarketingPageContent) => {
    setContent(next);
    setDirty(true);
    setSaved(false);
  };

  const id = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addMarketingItem = (customData?: Partial<MarketingItem>) => {
    if (!content) return;
    const newItem: MarketingItem = {
      id: id(),
      title: customData?.title ?? "New Feature Card",
      description: customData?.description ?? "Add description for this item.",
      icon: customData?.icon ?? "shield",
    };
    update({ ...content, items: [...content.items, newItem] });
    setAddBlockOpen(false);
  };

  const deleteItem = (itemId: string) => {
    if (content.items.length > 1) {
      update({ ...content, items: content.items.filter((item) => item.id !== itemId) });
      setSelectedId(null);
    }
  };

  const duplicateItem = (itemId: string) => {
    const index = content.items.findIndex((item) => item.id === itemId);
    const source = content.items[index];
    if (index < 0 || !source) return;
    const duplicate = { ...source, id: id(), title: `${source.title} copy` };
    update({
      ...content,
      items: [...content.items.slice(0, index + 1), duplicate, ...content.items.slice(index + 1)],
    });
    setSelectedId(duplicate.id);
  };

  const save = async () => {
    const response = await fetch("/api/admin/cms", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page, content }),
    });
    if (!response.ok) {
      setError("Unable to save changes.");
      return false;
    }
    setDirty(false);
    setSaved(true);
    setError("");
    return true;
  };

  const switchPage = (next: string) => {
    if (next === `/${page}`) return;
    if (dirty) setPendingPage(next);
    else onPageChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              <Layers className="h-3.5 w-3.5" />
              Live Visual CMS
            </span>
            <span className="text-xs font-medium text-slate-400">· {pageTitle}</span>
          </div>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Edit {pageTitle}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Click directly on any title, subtext, or section to edit content in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Page:
            </label>
            <select
              value={`/${page}`}
              onChange={(event) => switchPage(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
            >
              {cmsPages.map((item) => (
                <option key={item.href} value={item.href} className="text-slate-900">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSeoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Globe className="h-4 w-4 text-indigo-600" />
            <span>SEO &amp; Meta</span>
          </button>

          <button
            type="button"
            onClick={() => setAddBlockOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Block</span>
          </button>

          <button
            type="button"
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition"
          >
            <Save className="h-4 w-4" />
            <span>Save &amp; Publish</span>
          </button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 shadow-2xs">
          <span>You have unsaved changes on {pageTitle}.</span>
          <button
            type="button"
            onClick={() => void save()}
            className="rounded-lg bg-amber-600 px-3 py-1 text-white hover:bg-amber-500 transition"
          >
            Save Now
          </button>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{pageTitle} published successfully.</span>
        </div>
      )}

      {/* Persistent Toolbar */}
      <div className="sticky top-20 z-20 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-2.5 shadow-md shadow-slate-900/5 flex flex-wrap items-center justify-between gap-3">
        <RichFormattingToolbar />

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            title="Desktop View (100%)"
            onClick={() => setViewport("desktop")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "desktop"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Laptop className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tablet View (768px)"
            onClick={() => setViewport("tablet")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "tablet"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Tablet className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Mobile View (375px)"
            onClick={() => setViewport("mobile")}
            className={`rounded-lg p-1.5 transition ${
              viewport === "mobile"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pendingPage && (
        <PageSwitchPrompt
          pageLabel={cmsPages.find((item) => item.href === pendingPage)?.label ?? "page"}
          onSave={async () => {
            if (await save()) {
              onPageChange(pendingPage);
              setPendingPage(null);
            }
          }}
          onDiscard={() => {
            setPendingPage(null);
            onPageChange(pendingPage);
          }}
          onCancel={() => setPendingPage(null)}
        />
      )}

      {/* Viewport Canvas Container */}
      <div className="flex justify-center transition-all duration-300">
        <div
          onClickCapture={(e) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest("a");
            if (anchor && !target.isContentEditable) {
              e.preventDefault();
            }
          }}
          className={`w-full overflow-hidden rounded-3xl bg-white shadow-xl border border-slate-200 transition-all duration-300 ${
            viewport === "tablet"
              ? "max-w-[768px] ring-8 ring-slate-200/80 my-4"
              : viewport === "mobile"
                ? "max-w-[390px] ring-12 ring-slate-300 my-6 shadow-2xl"
                : "max-w-full"
          }`}
        >
          {page === "professional-home" ? (
            <ProfessionalHome
              cmsMode
              cmsContent={content}
              onCmsChange={update}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={deleteItem}
              onDuplicate={duplicateItem}
            />
          ) : (
            <MarketingVisualPage
              page={page}
              content={content}
              cmsMode
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={update}
              onDelete={deleteItem}
              onDuplicate={duplicateItem}
            />
          )}
        </div>
      </div>

      {/* Add Block Modal Dialog */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent className="max-w-2xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900">
              Add Block to {pageTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a pre-designed layout card to insert into this page.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                addMarketingItem({
                  title: "Trust & Verification",
                  description:
                    "All professionals undergo identity verification and background screening.",
                  icon: "shield",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Trust &amp; Verification</p>
                <p className="mt-1 text-xs text-slate-500">
                  Highlights security, background checks, or badges.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addMarketingItem({
                  title: "Fast Project Matching",
                  description: "Post once and connect with qualified professionals in minutes.",
                  icon: "briefcase",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Professional Services</p>
                <p className="mt-1 text-xs text-slate-500">
                  Showcases specialized talent and project scope.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addMarketingItem({
                  title: "Secure Escrow Protection",
                  description: "Milestone payments are safely held and released upon approval.",
                  icon: "wallet",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Escrow &amp; Pricing</p>
                <p className="mt-1 text-xs text-slate-500">
                  Demonstrates payment safety and billing tiers.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                addMarketingItem({
                  title: "Top Rated Reputation",
                  description:
                    "Verified reviews and ratings from authentic clients across the platform.",
                  icon: "star",
                })
              }
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">Ratings &amp; Reviews</p>
                <p className="mt-1 text-xs text-slate-500">
                  Builds social proof and client confidence.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SEO & Meta Drawer Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-xl rounded-3xl bg-white p-6 sm:p-8 border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-display font-extrabold text-xl text-slate-900 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              <span>SEO &amp; Social Meta Tags — {pageTitle}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Customize how the {pageTitle} page appears in Google search results and social shares.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Page Title Tag</span>
                <span className="text-slate-400 font-medium">{metaTitle.length}/60 chars</span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Meta Description</span>
                <span className="text-slate-400 font-medium">
                  {metaDescription.length}/160 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Keywords</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Google Search Result Preview
              </p>
              <p className="text-xs text-slate-500 truncate">https://klickpro.com/{page}</p>
              <h4 className="mt-1 font-semibold text-sm text-blue-700 hover:underline cursor-pointer">
                {metaTitle}
              </h4>
              <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {metaDescription}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSeoOpen(false)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-2xs"
            >
              Apply SEO Settings
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageSwitchPrompt({
  pageLabel,
  onSave,
  onDiscard,
  onCancel,
}: {
  pageLabel: string;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs">
      <p className="font-semibold text-amber-950">You have unsaved changes.</p>
      <p className="mt-1 text-amber-800">Choose what to do before switching to {pageLabel}.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onSave()}
          className="rounded-xl bg-indigo-600 px-3.5 py-2 font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
        >
          Save and switch
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Discard and switch
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3 py-2 text-slate-600 hover:text-slate-900 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging ? "z-10 opacity-70 shadow-2xl" : ""}
    >
      {children}
    </div>
  );
}

function SortableVisualCard({
  card,
  selected,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
}: {
  card: CmsCard;
  selected: boolean;
  onSelect: () => void;
  onChange: (changes: Partial<CmsCard>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`${isDragging ? "z-10 scale-[1.02] opacity-70 shadow-2xl" : ""}`}
    >
      <AboutFeatureCard
        card={card}
        editable
        selected={selected}
        onSelect={onSelect}
        onChange={onChange}
        onDelete={onDelete}
      />
      {selected && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          <Copy className="h-3 w-3" /> Duplicate card
        </button>
      )}
    </div>
  );
}
