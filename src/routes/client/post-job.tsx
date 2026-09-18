"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MarketplaceCategory } from "@/lib/types/marketplace";
import { getAllStates } from "@/lib/india-locations";

export type JobFormMilestone = {
  id?: number;
  title: string;
  percentage: number;
  description?: string;
};

type Form = {
  title: string;
  category: string;
  description: string;
  timingType: "FIXED" | "HOURLY";
  paymentMethod: "WALLET" | "OFFLINE";
  budgetMin: string;
  budgetMax: string;
  hourlyRate: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
  jobDate: string;
  deadline: string;
  workMode: "ON_SITE" | "REMOTE" | "BOTH";
  locationLabel: string;
  locationAddress: string;
  locationState: string;
  locationDistrict: string;
  locationLat: number | null;
  locationLng: number | null;
  milestones: JobFormMilestone[];
};
type PostingTiming = "TODAY" | "SCHEDULED";
type SavedLocation = { id: number; label: string; address: string; isPrimary: boolean };
const empty: Form = {
  title: "",
  category: "",
  description: "",
  timingType: "FIXED",
  paymentMethod: "WALLET",
  budgetMin: "",
  budgetMax: "",
  hourlyRate: "",
  urgency: "MEDIUM",
  jobDate: "",
  deadline: "",
  workMode: "ON_SITE",
  locationLabel: "",
  locationAddress: "",
  locationState: "",
  locationDistrict: "",
  locationLat: null,
  locationLng: null,
  milestones: [],
};
const steps = ["Details", "Budget & schedule", "Milestones", "Job type", "Location", "Review"];
const postJobDraftKey = "klick-pro:post-job-draft";
const segmentOptions: [string, string][] = [
  ["RESIDENTIAL", "Residential"],
  ["COMMERCIAL", "Commercial"],
  ["INDUSTRIAL", "Industrial"],
];
const asDate = (value: string | Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
const money = (value: number | null | undefined) =>
  value == null ? "Not set" : `₹${value.toLocaleString("en-US")}`;

export default function PostJob() {
  const router = useRouter();
  const editJobId =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("edit");
  const [step, setStep] = useState(0),
    [maxStep, setMaxStep] = useState(0),
    [form, setForm] = useState<Form>(empty),
    [id, setId] = useState<number | null>(null),
    [categories, setCategories] = useState<MarketplaceCategory[]>([]),
    [primary, setPrimary] = useState<string>(""),
    [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [segment, setSegment] = useState(""),
    [hydrated, setHydrated] = useState(false),
    [postingTiming, setPostingTiming] = useState<PostingTiming>("TODAY");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((old) => ({ ...old, [key]: value }));
    setErrors((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
  };
  const selectPaymentMethod = (paymentMethod: Form["paymentMethod"]) => {
    setForm((old) => ({
      ...old,
      paymentMethod,
    }));
    setErrors((old) => {
      const next = { ...old };
      delete next.paymentMethod;
      delete next.workMode;
      return next;
    });
  };
  useEffect(() => {
    void fetch("/api/v1/marketplace/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setMessage("Categories could not be loaded."));
    void fetch("/api/v1/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            profile?: {
              address?: string | null;
            } | null;
          } | null,
        ) => {
          if (!data) return;
          const address = data.profile?.address ?? "";
          setPrimary(address);
          if (address) {
            setForm((current) =>
              current.locationAddress
                ? current
                : { ...current, locationLabel: "Primary address", locationAddress: address },
            );
          }
        },
      )
      .catch(() => {});
    void fetch("/api/v1/profile/locations")
      .then((r) => (r.ok ? r.json() : { locations: [] }))
      .then((data: { locations?: SavedLocation[] }) => setSavedLocations(data.locations ?? []))
      .catch(() => setSavedLocations([]));
    const edit = editJobId;
    if (!edit) {
      try {
        const draft = JSON.parse(localStorage.getItem(postJobDraftKey) ?? "null");
        if (draft?.form) {
          const draftForm = { ...empty, ...draft.form } as Form;
          setForm({
            ...draftForm,
            jobDate: draftForm.jobDate || today,
            milestones: Array.isArray(draftForm.milestones) ? draftForm.milestones : [],
          });
          setPostingTiming(draftForm.jobDate && draftForm.jobDate > today ? "SCHEDULED" : "TODAY");
        } else {
          setForm((current) => ({ ...current, jobDate: today }));
        }
        if (typeof draft?.step === "number") setStep(draft.step);
        if (typeof draft?.maxStep === "number") setMaxStep(draft.maxStep);
      } catch {
        // Ignore an invalid local draft and start with a blank form.
      }
    }
    setHydrated(true);
    if (edit && /^\d+$/.test(edit)) {
      void fetch(`/api/v1/client/jobs/${edit}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ job }) => {
          setId(job.id);
          setMaxStep(5);
          setForm({
            title: job.title ?? "",
            category: job.category ?? "",
            description: job.description ?? "",
            timingType: job.timingType === "HOURLY" ? "HOURLY" : "FIXED",
            paymentMethod: job.paymentMethod === "OFFLINE" ? "OFFLINE" : "WALLET",
            budgetMin: job.budgetMin?.toString() ?? "",
            budgetMax: job.budgetMax?.toString() ?? "",
            hourlyRate: job.hourlyRate?.toString() ?? "",
            urgency: job.urgency,
            jobDate: asDate(job.jobDate) || today,
            deadline: asDate(job.deadline),
            workMode: job.workMode,
            locationLabel: job.locationLabel ?? "",
            locationAddress: job.locationAddress ?? "",
            locationState: job.locationState ?? "",
            locationDistrict: job.locationDistrict ?? "",
            locationLat: job.locationLat,
            locationLng: job.locationLng,
            milestones: Array.isArray(job.milestones)
              ? job.milestones.map(
                  (m: {
                    id?: number;
                    title?: string;
                    percentage?: number;
                    description?: string;
                  }) => ({
                    id: m.id,
                    title: m.title ?? "",
                    percentage: m.percentage ?? 100,
                    description: m.description ?? "",
                  }),
                )
              : [],
          });
          setPostingTiming(job.jobDate && asDate(job.jobDate) > today ? "SCHEDULED" : "TODAY");
        })
        .catch(() => setMessage("This draft could not be opened."));
    }
  }, [editJobId, today]);
  useEffect(() => {
    if (!hydrated || editJobId) return;
    localStorage.setItem(postJobDraftKey, JSON.stringify({ form, step, maxStep }));
  }, [editJobId, form, hydrated, maxStep, step]);

  const rebalanceMilestones = (milestones: JobFormMilestone[]) => {
    if (milestones.length === 0) return milestones;
    const base = Math.floor(100 / milestones.length);
    const remainder = 100 % milestones.length;
    return milestones.map((milestone, index) => ({
      ...milestone,
      percentage: index === 0 ? base + remainder : base,
    }));
  };

  const addMilestone = () => {
    const currentSum = form.milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
    if (form.milestones.length === 1 && currentSum >= 100) {
      setErrors((old) => ({
        ...old,
        milestones:
          "Milestone percentage is already 100% complete. Reduce an existing milestone before adding another.",
      }));
      return;
    }
    const nextIndex = form.milestones.length + 1;
    const next = [
      ...form.milestones,
      {
        title: `Milestone ${nextIndex}`,
        percentage: 0,
        description: "",
      },
    ];
    update("milestones", rebalanceMilestones(next));
  };

  const removeMilestone = (index: number) => {
    const next = form.milestones.filter((_, i) => i !== index);
    update("milestones", rebalanceMilestones(next));
  };

  const updateMilestone = <K extends keyof JobFormMilestone>(
    index: number,
    field: K,
    val: JobFormMilestone[K],
  ) => {
    const next = form.milestones.map((m, i) => (i === index ? { ...m, [field]: val } : m));
    update("milestones", next);
  };

  const autoFillRemaining = () => {
    const currentSum = form.milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
    const remaining = 100 - currentSum;
    if (remaining <= 0) return;
    if (form.milestones.length === 0) {
      update("milestones", [{ title: "Milestone 1", percentage: 100, description: "" }]);
    } else {
      const lastIndex = form.milestones.length - 1;
      const last = form.milestones[lastIndex];
      if (last) {
        updateMilestone(lastIndex, "percentage", (last.percentage || 0) + remaining);
      }
    }
  };

  const splitMilestonesEvenly = () => {
    update("milestones", rebalanceMilestones(form.milestones));
  };

  const totalMilestonePercentage = useMemo(
    () => form.milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0),
    [form.milestones],
  );
  const remainingMilestonePercentage = Math.max(0, 100 - totalMilestonePercentage);
  const isMilestoneExceeded = totalMilestonePercentage > 100;

  const payload = (mode: "draft" | "publish") => ({
    ...form,
    budgetMin: form.budgetMin === "" ? null : Number(form.budgetMin),
    budgetMax: form.budgetMax === "" ? null : Number(form.budgetMax),
    hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
    jobDate: form.jobDate || null,
    deadline: form.deadline || null,
    locationLabel: form.locationLabel || null,
    locationAddress: form.locationAddress || null,
    milestones: form.milestones
      .filter((m) => m.title.trim())
      .map((m) => ({
        title: m.title.trim(),
        percentage: Number(m.percentage) || 100,
        description: m.description?.trim() || null,
      })),
    mode,
  });
  const clientCheck = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.title.trim()) e.title = "Enter a job title.";
      if (!form.category) e.category = "Choose a category.";
      if (!form.description.trim()) e.description = "Describe the work needed.";
    }
    if (step === 1) {
      if (postingTiming === "SCHEDULED" && (!form.jobDate || form.jobDate <= today))
        e.jobDate = "Choose a future date for a scheduled job.";
      if (form.timingType === "HOURLY" && !form.hourlyRate) e.hourlyRate = "Enter an hourly rate.";
      if (form.timingType === "FIXED" && (!form.budgetMin || !form.budgetMax))
        e.budgetMin = "Enter a budget range.";
      if (form.budgetMin && form.budgetMax && Number(form.budgetMin) > Number(form.budgetMax))
        e.budgetMax = "Maximum budget must be at least the minimum.";
      if (!form.deadline) e.deadline = "Choose a deadline.";
      if (form.jobDate && form.deadline && form.deadline < form.jobDate)
        e.deadline = "Deadline cannot be before the preferred job date.";
    }
    if (step === 2) {
      if (form.milestones.length > 0) {
        const total = form.milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
        if (total > 100) {
          e.milestones = `Total percentage of all milestones must not exceed 100% (currently ${total}%).`;
        }
        form.milestones.forEach((m, i) => {
          if (!m.title.trim()) {
            e[`milestone_${i}_title`] = "Enter a title for this milestone.";
          }
          if (!m.percentage || m.percentage <= 0 || m.percentage > 100) {
            e[`milestone_${i}_percentage`] = "Percentage must be between 1% and 100%.";
          }
        });
      }
    }
    if (step === 4 && form.workMode !== "REMOTE") {
      if (!form.locationAddress.trim()) e.locationAddress = "Choose a job location.";
      else if (form.locationLat === null || form.locationLng === null)
        e.locationAddress =
          "Select the address from the search results or drop a pin on the map so professionals can find you nearby.";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };
  async function save(mode: "draft" | "publish") {
    setSaving(true);
    setMessage("");
    try {
      const url = id ? `/api/v1/client/jobs/${id}` : "/api/v1/client/jobs";
      const r = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(mode)),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setErrors(data?.fields ?? {});
        setMessage(
          data?.error ??
            (r.status >= 500
              ? `Server error (${r.status}). Please try again or check database migrations.`
              : "Could not save the job."),
        );
        const focus = Object.keys(data?.fields ?? {})[0];
        const focusStep =
          focus && ["title", "category", "description"].includes(focus)
            ? 0
            : focus && ["budgetMin", "budgetMax", "hourlyRate", "deadline"].includes(focus)
              ? 1
              : focus && ["milestones"].includes(focus)
                ? 2
                : focus === "workMode"
                  ? 3
                  : focus === "locationAddress"
                    ? 4
                    : null;
        if (focusStep !== null) {
          setStep(focusStep);
          setMaxStep((prev) => Math.max(prev, focusStep));
        }
        return;
      }
      if (data?.job) {
        setId(data.job.id);
      }
      if (mode === "publish") {
        localStorage.removeItem(postJobDraftKey);
        router.push("/my-jobs?posted=1");
      } else setMessage("Draft saved.");
    } catch {
      setMessage("A network error occurred. Your form values are still here.");
    } finally {
      setSaving(false);
    }
  }
  const segmentCategory = useMemo(
    () => categories.find((c) => c.parentId === null && c.segment === segment) ?? null,
    [categories, segment],
  );
  const topCategories = useMemo(
    () => (segmentCategory ? categories.filter((c) => c.parentId === segmentCategory.id) : []),
    [categories, segmentCategory],
  );
  const selectedCategory = useMemo(
    () => categories.find((c) => c.name === form.category) ?? null,
    [categories, form.category],
  );
  const activeTopCategory = useMemo(() => {
    if (!selectedCategory) return null;
    if (selectedCategory.parentId === segmentCategory?.id) return selectedCategory;
    return categories.find((c) => c.id === selectedCategory.parentId) ?? null;
  }, [categories, selectedCategory, segmentCategory]);
  const subCategories = useMemo(
    () => (activeTopCategory ? categories.filter((c) => c.parentId === activeTopCategory.id) : []),
    [categories, activeTopCategory],
  );
  useEffect(() => {
    if (!segment && activeTopCategory) setSegment(activeTopCategory.segment);
  }, [segment, activeTopCategory]);
  const locationOptions = useMemo(
    () => [
      ...(primary ? [{ key: "primary", label: "Primary address", address: primary }] : []),
      ...savedLocations
        .filter((location) => !location.isPrimary && location.address !== primary)
        .map((location) => ({
          key: `saved-${location.id}`,
          label: /^primary address$/i.test(location.label) ? "Saved address" : location.label,
          address: location.address,
        })),
    ],
    [primary, savedLocations],
  );
  async function chooseLocation(key: string) {
    const option = locationOptions.find((item) => item.key === key);
    if (!option) return;
    update("locationLabel", option.label);
    update("locationAddress", option.address);
    update("locationLat", null);
    update("locationLng", null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(option.address)}`);
      const result = (await response.json()) as {
        results?: Array<{ lat: number; lon: number }>;
      };
      const match = result.results?.[0];
      if (match && Number.isFinite(match.lat) && Number.isFinite(match.lon)) {
        update("locationLat", match.lat);
        update("locationLng", match.lon);
      }
    } catch {
      // The client can still place the map pin manually if lookup fails.
    }
  }
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Create a job</h1>
      <p className="mt-1 text-muted-foreground">Tell qualified professionals what you need.</p>
      <ol className="mt-7 grid grid-cols-6 gap-1" aria-label="Job posting steps">
        {steps.map((label, index) => {
          const reachable = index <= maxStep;
          const stepLabel = (
            <>
              {index + 1}. <span className="hidden sm:inline">{label}</span>
            </>
          );
          return (
            <li key={label} className="min-w-0">
              <div className={`h-1 rounded ${index <= step ? "bg-primary" : "bg-muted"}`} />
              {reachable ? (
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={`mt-2 block w-full text-center text-xs sm:text-sm ${index === step ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {stepLabel}
                </button>
              ) : (
                <span className="mt-2 block text-center text-xs text-muted-foreground sm:text-sm">
                  {stepLabel}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <section className="mt-7 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Tell us about the job</h2>
            <Field label="Job title" error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                maxLength={160}
                placeholder="What do you need done?"
              />
            </Field>
            <Field label="Category" error={errors.category}>
              <div className="flex flex-wrap gap-2">
                {segmentOptions.map(([value, label]) => (
                  <Choice
                    key={value}
                    checked={segment === value}
                    onClick={() => {
                      setSegment(value);
                      update("category", "");
                    }}
                    label={label}
                  />
                ))}
              </div>
            </Field>
            {segment && (
              <Field label="Which category?" error={errors.category}>
                <select
                  value={activeTopCategory?.id ?? ""}
                  onChange={(e) => {
                    const top = topCategories.find((c) => c.id === Number(e.target.value));
                    update("category", top?.name ?? "");
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">Select a category</option>
                  {topCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {subCategories.length > 0 && (
              <Field label="Sub-category">
                <select
                  value={selectedCategory?.parentId != null ? selectedCategory.name : ""}
                  onChange={(e) =>
                    update("category", e.target.value || (activeTopCategory?.name ?? ""))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">General {activeTopCategory?.name}</option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Description" error={errors.description}>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                maxLength={5000}
                className="min-h-36 w-full rounded-md border border-input bg-background p-3"
                placeholder="Tell professionals what needs to be done..."
              />
            </Field>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Budget & schedule</h2>
            <div className="flex gap-4">
              <Choice
                checked={form.timingType === "FIXED"}
                onClick={() => update("timingType", "FIXED")}
                label="Budget range"
              />
              <Choice
                checked={form.timingType === "HOURLY"}
                onClick={() => update("timingType", "HOURLY")}
                label="Hourly rate"
              />
            </div>
            {form.timingType === "FIXED" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimum budget (INR)" error={errors.budgetMin}>
                  <Input
                    type="number"
                    min="0"
                    value={form.budgetMin}
                    onChange={(e) => update("budgetMin", e.target.value)}
                    placeholder="₹ 0"
                  />
                </Field>
                <Field label="Maximum budget (INR)" error={errors.budgetMax}>
                  <Input
                    type="number"
                    min="0"
                    value={form.budgetMax}
                    onChange={(e) => update("budgetMax", e.target.value)}
                    placeholder="₹ 0"
                  />
                </Field>
              </div>
            ) : (
              <Field label="Hourly rate (INR)" error={errors.hourlyRate}>
                <Input
                  type="number"
                  min="0"
                  value={form.hourlyRate}
                  onChange={(e) => update("hourlyRate", e.target.value)}
                  placeholder="₹ 0 / hour"
                />
              </Field>
            )}
            <Field label="How urgent is this job?">
              <select
                value={form.urgency}
                onChange={(e) => update("urgency", e.target.value as Form["urgency"])}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="HIGH">Urgent — as soon as possible</option>
                <option value="MEDIUM">Soon — within a few days</option>
                <option value="LOW">Flexible — timing is flexible</option>
              </select>
            </Field>
            <Field label="Payment method">
              <div className="grid gap-3 sm:grid-cols-2">
                <Mode
                  checked={form.paymentMethod === "WALLET"}
                  onClick={() => selectPaymentMethod("WALLET")}
                  title="Wallet payment"
                  text="Pay milestone amounts through the platform wallet."
                />
                <Mode
                  checked={form.paymentMethod === "OFFLINE"}
                  onClick={() => selectPaymentMethod("OFFLINE")}
                  title="Offline payment"
                  text="Pay the professional directly outside the platform."
                />
              </div>
            </Field>
            <Field label="When should this job be posted?">
              <div className="grid gap-3 sm:grid-cols-2">
                <Mode
                  checked={postingTiming === "TODAY"}
                  onClick={() => {
                    setPostingTiming("TODAY");
                    update("jobDate", today);
                  }}
                  title="Post today"
                  text="Show this job to professionals today."
                />
                <Mode
                  checked={postingTiming === "SCHEDULED"}
                  onClick={() => {
                    setPostingTiming("SCHEDULED");
                    if (!form.jobDate || form.jobDate <= today) update("jobDate", tomorrow);
                  }}
                  title="Schedule for later"
                  text="Choose when professionals can see it."
                />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project start date" error={errors.jobDate}>
                <Input
                  type="date"
                  min={postingTiming === "SCHEDULED" ? tomorrow : today}
                  value={form.jobDate}
                  disabled={postingTiming === "TODAY"}
                  onChange={(e) => {
                    setPostingTiming("SCHEDULED");
                    update("jobDate", e.target.value);
                  }}
                />
              </Field>
              <Field label="Project end date" error={errors.deadline}>
                <Input
                  type="date"
                  min={form.jobDate || new Date().toISOString().slice(0, 10)}
                  value={form.deadline}
                  onChange={(e) => update("deadline", e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Project Milestones</h2>
                <p className="text-sm text-muted-foreground">
                  Divide your project into payment milestones, or skip to use a single 100%
                  completion milestone.
                </p>
              </div>
              {form.milestones.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`font-semibold px-2.5 py-1 rounded-full text-xs ${
                      isMilestoneExceeded
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : totalMilestonePercentage === 100
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                          : "bg-primary/10 text-primary border border-primary/20"
                    }`}
                  >
                    {isMilestoneExceeded
                      ? `Total: ${totalMilestonePercentage}% (Exceeds by ${totalMilestonePercentage - 100}%)`
                      : totalMilestonePercentage === 100
                        ? "100% Allocated"
                        : `${totalMilestonePercentage}% Allocated (${remainingMilestonePercentage}% unallocated)`}
                  </span>
                </div>
              )}
            </div>

            {form.milestones.length > 0 && (
              <div className="space-y-1.5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isMilestoneExceeded
                        ? "bg-destructive"
                        : totalMilestonePercentage === 100
                          ? "bg-green-600"
                          : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, totalMilestonePercentage)}%` }}
                  />
                </div>
                {errors.milestones && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {errors.milestones}
                  </p>
                )}
              </div>
            )}

            {form.milestones.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-6 text-center sm:p-8 bg-muted/30">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold">Default 100% Milestone on Completion</h3>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
                  If you don't need to split this job into multiple milestones, you can skip this
                  step. The platform will automatically create a single milestone of{" "}
                  <strong>100%</strong> released upon full project completion.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      update("milestones", [
                        {
                          title: "Milestone 1: Project Kickoff & Initial Deliverable",
                          percentage: 50,
                          description: "",
                        },
                        {
                          title: "Milestone 2: Final Delivery & Handover",
                          percentage: 50,
                          description: "",
                        },
                      ]);
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add Custom Milestones
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {form.milestones.map((milestone, index) => {
                  const estAmount =
                    form.budgetMax || form.budgetMin
                      ? Math.round(
                          (Number(form.budgetMax || form.budgetMin) * (milestone.percentage || 0)) /
                            100,
                        )
                      : null;
                  return (
                    <div
                      key={index}
                      className="relative rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition hover:border-muted-foreground/40 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3 border-b pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <span className="text-sm font-semibold">Milestone {index + 1}</span>
                          {estAmount !== null && (
                            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              ≈ ₹{estAmount.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(index)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Remove milestone"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <Field label="Milestone Title" error={errors[`milestone_${index}_title`]}>
                            <Input
                              value={milestone.title}
                              onChange={(e) => updateMilestone(index, "title", e.target.value)}
                              placeholder="e.g. Design & Planning Phase"
                              maxLength={160}
                            />
                          </Field>
                        </div>
                        <div>
                          <Field
                            label="Percentage (%)"
                            error={errors[`milestone_${index}_percentage`]}
                          >
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={milestone.percentage || ""}
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? 0
                                      : Math.min(
                                          100,
                                          Math.max(0, parseInt(e.target.value, 10) || 0),
                                        );
                                  updateMilestone(index, "percentage", val);
                                }}
                                placeholder="0"
                                className="pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
                                %
                              </span>
                            </div>
                          </Field>
                        </div>
                      </div>

                      <Field label="Deliverables / Description (Optional)">
                        <Input
                          value={milestone.description || ""}
                          onChange={(e) => updateMilestone(index, "description", e.target.value)}
                          placeholder="Brief summary of deliverables for this milestone"
                          maxLength={500}
                        />
                      </Field>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMilestone}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" /> Add Milestone
                    </Button>
                    {remainingMilestonePercentage > 0 && form.milestones.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={autoFillRemaining}
                        className="text-xs"
                      >
                        Auto-fill remaining ({remainingMilestonePercentage}%)
                      </Button>
                    )}
                    {form.milestones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={splitMilestonesEvenly}
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
                    onClick={() => update("milestones", [])}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Reset to single 100% default
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">What type of job is this?</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Mode
                checked={form.workMode === "ON_SITE"}
                onClick={() => update("workMode", "ON_SITE")}
                title="On-site"
                text="A professional comes to the job location."
              />
              <Mode
                checked={form.workMode === "REMOTE"}
                onClick={() => update("workMode", "REMOTE")}
                title="Remote"
                text="The work can be completed remotely."
              />
              <Mode
                checked={form.workMode === "BOTH"}
                onClick={() => update("workMode", "BOTH")}
                title="Hybrid"
                text="A mix of remote and on-site work."
              />
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Where will the job take place?</h2>
            {form.workMode === "REMOTE" ? (
              <p className="rounded-lg bg-muted p-4 text-sm">
                This job is remote and does not need a physical location.
              </p>
            ) : (
              <>
                {locationOptions.length > 0 && (
                  <div className="space-y-2">
                    <div className="hidden">
                      {locationOptions.slice(1).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`w-full rounded-xl border p-3 text-left ${
                            form.locationAddress === option.address
                              ? "border-primary bg-primary/5"
                              : "border-input hover:border-primary"
                          }`}
                          onClick={() => void chooseLocation(option.key)}
                        >
                          <span className="block font-medium">Use {option.label}</span>
                          <span className="text-sm text-muted-foreground">{option.address}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="saved-job-location" className="text-sm font-medium">
                        Choose a saved location
                      </label>
                      <select
                        id="saved-job-location"
                        value={
                          locationOptions.find((option) => option.address === form.locationAddress)
                            ?.key ?? (primary ? "primary" : "")
                        }
                        onChange={(event) => void chooseLocation(event.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3"
                      >
                        <option value="">Select a saved address</option>
                        {locationOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label} — {option.address}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div
                  className={
                    errors.locationAddress ? "rounded-lg border border-destructive p-2" : ""
                  }
                >
                  <AddressMapPicker
                    id="job-location"
                    value={form.locationAddress}
                    coordinates={
                      form.locationLat !== null && form.locationLng !== null
                        ? [form.locationLat, form.locationLng]
                        : null
                    }
                    onChange={(value) => update("locationAddress", value)}
                    onCoordinatesChange={(lat, lng) => {
                      update("locationLat", lat);
                      update("locationLng", lng);
                    }}
                    onLocationChange={(state, city) => {
                      update("locationState", state);
                      update("locationDistrict", city);
                    }}
                  />
                  {errors.locationAddress && (
                    <p className="mt-2 text-sm text-destructive">{errors.locationAddress}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="State">
                    <select
                      value={form.locationState}
                      onChange={(event) => {
                        update("locationState", event.target.value);
                        update("locationDistrict", "");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select state</option>
                      {getAllStates().map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="City">
                    <Input
                      value={form.locationDistrict}
                      onChange={(event) => update("locationDistrict", event.target.value)}
                      placeholder="City will be detected from the address"
                    />
                  </Field>
                </div>
                <Field label="Enter address manually">
                  <Input
                    value={form.locationAddress}
                    onChange={(e) => update("locationAddress", e.target.value)}
                    placeholder="Enter the complete address manually"
                  />
                </Field>
              </>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">Review your job</h2>
            <Review label="Title" value={form.title || "Not set"} onEdit={() => setStep(0)} />
            <Review label="Category" value={form.category || "Not set"} onEdit={() => setStep(0)} />
            <Review
              label="Description"
              value={form.description || "Not set"}
              onEdit={() => setStep(0)}
            />
            <Review
              label="Budget"
              value={
                form.timingType === "HOURLY"
                  ? `${money(form.hourlyRate === "" ? null : Number(form.hourlyRate))} / hour`
                  : `${money(form.budgetMin === "" ? null : Number(form.budgetMin))} – ${money(form.budgetMax === "" ? null : Number(form.budgetMax))}`
              }
              onEdit={() => setStep(1)}
            />
            <Review
              label="Payment method"
              value={form.paymentMethod === "OFFLINE" ? "Offline payment" : "Wallet payment"}
              onEdit={() => setStep(1)}
            />
            <Review
              label="Urgency"
              value={{ HIGH: "Urgent", MEDIUM: "Soon", LOW: "Flexible" }[form.urgency]}
              onEdit={() => setStep(1)}
            />
            <Review
              label="Project end date"
              value={form.deadline || "Not set"}
              onEdit={() => setStep(1)}
            />
            <Review
              label="Posting date"
              value={postingTiming === "TODAY" ? "Today" : form.jobDate || "Not set"}
              onEdit={() => setStep(1)}
            />
            <Review
              label="Milestones"
              value={
                form.milestones.length > 0
                  ? form.milestones
                      .map(
                        (m, idx) =>
                          `${idx + 1}. ${m.title} (${m.percentage}%${
                            form.budgetMax
                              ? ` • ₹${Math.round((Number(form.budgetMax) * m.percentage) / 100).toLocaleString("en-IN")}`
                              : ""
                          })${m.description ? `\n   ${m.description}` : ""}`,
                      )
                      .join("\n")
                  : "Default: 100% on Project Completion"
              }
              onEdit={() => setStep(2)}
            />
            <Review
              label="Job type"
              value={{ ON_SITE: "On-site", REMOTE: "Remote", BOTH: "Hybrid" }[form.workMode]}
              onEdit={() => setStep(3)}
            />
            {form.workMode !== "REMOTE" && (
              <Review
                label="Location"
                value={form.locationAddress || "Not set"}
                onEdit={() => setStep(4)}
              />
            )}
          </div>
        )}
        {message && (
          <p
            role="status"
            className={`mt-5 text-sm ${message.includes("saved") ? "text-green-700" : "text-destructive"}`}
          >
            {message}
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t pt-5">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void save("draft")}
            >
              {saving ? "Saving..." : "Save draft"}
            </Button>
            {step < 5 ? (
              <Button
                type="button"
                onClick={() => {
                  if (clientCheck()) {
                    setStep(step + 1);
                    setMaxStep((prev) => Math.max(prev, step + 1));
                  }
                }}
              >
                Continue
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void save("publish")}>
                {saving ? "Posting..." : "Post job"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-2">{children}</div>
      {error && <span className="mt-1 block text-sm text-destructive">{error}</span>}
    </label>
  );
}
function Choice({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm ${checked ? "border-primary bg-primary/5 text-primary" : "border-input"}`}
    >
      {checked ? "●" : "○"} {label}
    </button>
  );
}
function Mode({
  checked,
  onClick,
  title,
  text,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left ${checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary"}`}
    >
      <span className="block font-semibold">
        {checked ? "●" : "○"} {title}
      </span>
      <span className="mt-2 block text-sm text-muted-foreground">{text}</span>
    </button>
  );
}
function Review({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3">
      <div>
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Edit
        </button>
      )}
    </div>
  );
}
