"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Info, MapPin, Plus, Trash2 } from "lucide-react";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import { PageActionLoading } from "@/components/PageActionLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MarketplaceCategory } from "@/lib/types/marketplace";
import { getAllStates, inferLocationFromAddress, matchIndiaLocation } from "@/lib/india-locations";

export type JobFormMilestone = {
  id?: number;
  title: string;
  percentage: number | "";
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
  totalJobHours: string;
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
  totalJobHours: "",
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

export const HOURS_PER_WORK_DAY = 8;

export function calculateDaysFromHours(hours: number, pace: number = HOURS_PER_WORK_DAY): number {
  if (!Number.isFinite(hours) || hours <= 0 || pace <= 0) return 0;
  return Math.max(1, Math.ceil(hours / pace));
}

export function computeDeadlineDate(
  startDateStr: string,
  hours: number,
  pace: number = HOURS_PER_WORK_DAY,
): string {
  const days = calculateDaysFromHours(hours, pace);
  if (days <= 0 || !startDateStr) return "";
  const parts = startDateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return "";
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
    [selectedSavedLocationKey, setSelectedSavedLocationKey] = useState<string>(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [savingMode, setSavingMode] = useState<"draft" | "publish" | null>(null),
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
  const [workPaceHours, setWorkPaceHours] = useState<number>(8);
  const calculatedDays = useMemo(
    () => calculateDaysFromHours(Number(form.totalJobHours), workPaceHours),
    [form.totalJobHours, workPaceHours],
  );

  const handleHoursChange = (rawHours: string, pace = workPaceHours) => {
    const hours = Number(rawHours);
    const activeStartDate =
      postingTiming === "SCHEDULED" ? form.jobDate || tomorrow : form.jobDate || today;

    if (Number.isFinite(hours) && hours > 0) {
      const autoDeadline = computeDeadlineDate(activeStartDate, hours, pace);
      setForm((old) => ({
        ...old,
        totalJobHours: rawHours,
        deadline: autoDeadline || old.deadline,
      }));
      setErrors((old) => {
        const next = { ...old };
        delete next.totalJobHours;
        delete next.deadline;
        return next;
      });
    } else {
      update("totalJobHours", rawHours);
    }
  };

  const handleStartDateChange = (newStartDate: string) => {
    setPostingTiming("SCHEDULED");
    const hours = Number(form.totalJobHours);
    if (form.timingType === "HOURLY" && Number.isFinite(hours) && hours > 0) {
      const autoDeadline = computeDeadlineDate(newStartDate, hours, workPaceHours);
      setForm((old) => ({
        ...old,
        jobDate: newStartDate,
        deadline: autoDeadline || old.deadline,
      }));
      setErrors((old) => {
        const next = { ...old };
        delete next.jobDate;
        delete next.deadline;
        return next;
      });
    } else {
      update("jobDate", newStartDate);
    }
  };

  const handleSelectPostToday = () => {
    setPostingTiming("TODAY");
    const hours = Number(form.totalJobHours);
    if (form.timingType === "HOURLY" && Number.isFinite(hours) && hours > 0) {
      const autoDeadline = computeDeadlineDate(today, hours, workPaceHours);
      setForm((old) => ({
        ...old,
        jobDate: today,
        deadline: autoDeadline || old.deadline,
      }));
      setErrors((old) => {
        const next = { ...old };
        delete next.jobDate;
        delete next.deadline;
        return next;
      });
    } else {
      update("jobDate", today);
    }
  };

  const handleSelectScheduleLater = () => {
    setPostingTiming("SCHEDULED");
    const nextDate = !form.jobDate || form.jobDate <= today ? tomorrow : form.jobDate;
    const hours = Number(form.totalJobHours);
    if (form.timingType === "HOURLY" && Number.isFinite(hours) && hours > 0) {
      const autoDeadline = computeDeadlineDate(nextDate, hours, workPaceHours);
      setForm((old) => ({
        ...old,
        jobDate: nextDate,
        deadline: autoDeadline || old.deadline,
      }));
      setErrors((old) => {
        const next = { ...old };
        delete next.jobDate;
        delete next.deadline;
        return next;
      });
    } else {
      update("jobDate", nextDate);
    }
  };

  const handleWorkPaceChange = (newPace: number) => {
    setWorkPaceHours(newPace);
    const hours = Number(form.totalJobHours);
    if (form.timingType === "HOURLY" && Number.isFinite(hours) && hours > 0) {
      const activeStartDate =
        postingTiming === "SCHEDULED" ? form.jobDate || tomorrow : form.jobDate || today;
      const autoDeadline = computeDeadlineDate(activeStartDate, hours, newPace);
      if (autoDeadline) {
        setForm((old) => ({
          ...old,
          deadline: autoDeadline,
        }));
        setErrors((old) => {
          const next = { ...old };
          delete next.deadline;
          return next;
        });
      }
    }
  };

  const handleSelectHourlyTiming = () => {
    update("timingType", "HOURLY");
    const hours = Number(form.totalJobHours);
    if (Number.isFinite(hours) && hours > 0) {
      const activeStartDate =
        postingTiming === "SCHEDULED" ? form.jobDate || tomorrow : form.jobDate || today;
      const autoDeadline = computeDeadlineDate(activeStartDate, hours, workPaceHours);
      if (autoDeadline) {
        setForm((old) => ({
          ...old,
          timingType: "HOURLY",
          deadline: autoDeadline,
        }));
        setErrors((old) => {
          const next = { ...old };
          delete next.deadline;
          return next;
        });
      }
    }
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
            setForm((current) => {
              if (current.locationAddress) return current;
              void chooseLocation("primary", address, "Primary address");
              return { ...current, locationLabel: "Primary address", locationAddress: address };
            });
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
            totalJobHours: job.totalJobHours?.toString() ?? "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      percentage: base + (index < remainder ? 1 : 0),
    }));
  };

  const addMilestone = () => {
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

  const getMaxPercentageForMilestone = (milestones: JobFormMilestone[], index: number) => {
    const n = milestones.length;
    if (n <= 1) return 100;
    const isLast = index === n - 1;
    let priorSum = 0;
    if (!isLast) {
      for (let i = 0; i < index; i++) {
        const m = milestones[i];
        if (m) {
          priorSum += Math.max(1, Number(m.percentage) || 1);
        }
      }
    }
    const k = isLast ? n - 1 : n - 1 - index;
    const minNeededForOthers = k * 1;
    return isLast
      ? Math.max(1, 100 - minNeededForOthers)
      : Math.max(1, 100 - priorSum - minNeededForOthers);
  };

  const removeMilestone = (index: number) => {
    const next = form.milestones.filter((_, i) => i !== index);
    if (next.length === 0) {
      update("milestones", []);
      return;
    }
    if (next.length === 1) {
      const first = next[0];
      if (first) {
        update("milestones", [{ ...first, percentage: 100 }]);
      }
      return;
    }
    // Maintain exactly 100% total by allocating the deleted milestone's percentage
    // e.g. If user had 3 milestones: [98%, 1%, 1%] and deletes 3rd milestone,
    // the first milestone automatically absorbs the 1% and becomes 99%!
    const currentSum = next.reduce((sum, m) => sum + Math.max(1, Number(m.percentage) || 1), 0);
    const diff = 100 - currentSum;
    if (diff > 0) {
      const targetIdx = 0;
      const updated = next.map((m, i) =>
        i === targetIdx ? { ...m, percentage: Math.max(1, (Number(m.percentage) || 1) + diff) } : m,
      );
      update("milestones", updated);
    } else {
      update("milestones", rebalanceMilestones(next));
    }
  };

  const distributeMilestonePercentages = (
    milestones: JobFormMilestone[],
    editedIndex: number,
    newPercentage: number,
  ): JobFormMilestone[] => {
    const n = milestones.length;
    if (n <= 1) {
      return milestones.map((m, i) => (i === editedIndex ? { ...m, percentage: 100 } : m));
    }

    const isLast = editedIndex === n - 1;
    let priorSum = 0;
    if (!isLast) {
      for (let i = 0; i < editedIndex; i++) {
        const m = milestones[i];
        if (m) {
          priorSum += Math.max(1, Number(m.percentage) || 1);
        }
      }
    }

    const targetIndices: number[] = [];
    if (!isLast) {
      for (let i = editedIndex + 1; i < n; i++) {
        targetIndices.push(i);
      }
    } else {
      for (let i = 0; i < n - 1; i++) {
        targetIndices.push(i);
      }
    }

    const k = targetIndices.length;
    // Each other milestone must receive AT LEAST 1% (no 0% or empty space)
    const minNeededForOthers = k * 1;
    const maxAllowed = isLast
      ? Math.max(1, 100 - minNeededForOthers)
      : Math.max(1, 100 - priorSum - minNeededForOthers);

    // Each milestone must be at least 1%, and at most maxAllowed
    const clampedVal = Math.min(maxAllowed, Math.max(1, newPercentage));

    const result = milestones.map((m, i) =>
      i === editedIndex ? { ...m, percentage: clampedVal } : { ...m },
    );

    const fixedSum = isLast ? clampedVal : priorSum + clampedVal;
    const remaining = Math.max(k, 100 - fixedSum);

    if (k > 0) {
      const base = Math.floor(remaining / k);
      const remainder = remaining % k;
      targetIndices.forEach((targetIdx, mIdx) => {
        const item = result[targetIdx];
        if (item) {
          result[targetIdx] = {
            ...item,
            percentage: Math.max(1, base + (mIdx < remainder ? 1 : 0)),
          };
        }
      });
    }

    return result;
  };

  const updateMilestone = (
    index: number,
    field: keyof JobFormMilestone,
    val: string | number | "",
  ) => {
    if (field === "percentage") {
      if (val === "" || val === null) {
        const next = form.milestones.map((m, i) => (i === index ? { ...m, percentage: "" } : m));
        update("milestones", next as JobFormMilestone[]);
        return;
      }
      const numVal = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
      if (form.milestones.length > 1) {
        const next = distributeMilestonePercentages(form.milestones, index, numVal);
        update("milestones", next as JobFormMilestone[]);
        return;
      } else if (form.milestones.length === 1) {
        const first = form.milestones[0];
        if (first) {
          const clamped = Math.min(100, Math.max(0, numVal));
          const next = [{ ...first, percentage: clamped }];
          update("milestones", next as JobFormMilestone[]);
        }
        return;
      }
    }
    const next = form.milestones.map((m, i) =>
      i === index ? { ...m, [field]: val } : m,
    ) as JobFormMilestone[];
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
  const hourlyProjectTotal = useMemo(() => {
    const hourlyRate = Number(form.hourlyRate);
    const totalJobHours = Number(form.totalJobHours);
    return Number.isFinite(hourlyRate) &&
      Number.isFinite(totalJobHours) &&
      hourlyRate > 0 &&
      totalJobHours > 0
      ? hourlyRate * totalJobHours
      : null;
  }, [form.hourlyRate, form.totalJobHours]);

  const payload = (mode: "draft" | "publish") => ({
    ...form,
    budgetMin:
      form.timingType === "HOURLY"
        ? hourlyProjectTotal
        : form.budgetMin === ""
          ? null
          : Number(form.budgetMin),
    budgetMax:
      form.timingType === "HOURLY"
        ? hourlyProjectTotal
        : form.budgetMax === ""
          ? null
          : Number(form.budgetMax),
    hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
    totalJobHours: form.totalJobHours === "" ? null : Number(form.totalJobHours),
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
      if (form.timingType === "HOURLY" && !form.totalJobHours)
        e.totalJobHours = "Enter the total job hours.";
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
    let keepLoadingUntilNavigation = false;
    setSaving(true);
    setSavingMode(mode);
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
            : focus &&
                ["budgetMin", "budgetMax", "hourlyRate", "totalJobHours", "deadline"].includes(
                  focus,
                )
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
        try {
          sessionStorage.setItem("klickpro:job-posted", "1");
        } catch {
          /* ignore storage error */
        }
        keepLoadingUntilNavigation = true;
        router.push("/my-jobs?posted=1");
      } else setMessage("Draft saved.");
    } catch {
      setMessage("A network error occurred. Your form values are still here.");
    } finally {
      if (!keepLoadingUntilNavigation) {
        setSaving(false);
        setSavingMode(null);
      }
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
  const locationOptions = useMemo(() => {
    const list: Array<{ key: string; label: string; address: string }> = [];
    const trimmedPrimary = primary?.trim() ?? "";
    if (trimmedPrimary) {
      list.push({ key: "primary", label: "Primary address", address: trimmedPrimary });
    }
    for (const location of savedLocations) {
      const trimmedAddress = location.address?.trim() ?? "";
      if (!trimmedAddress) continue;
      if (trimmedPrimary && trimmedAddress.toLowerCase() === trimmedPrimary.toLowerCase()) continue;
      list.push({
        key: `saved-${location.id}`,
        label: location.isPrimary
          ? "Primary address"
          : /^primary address$/i.test(location.label)
            ? "Saved address"
            : location.label || "Saved address",
        address: trimmedAddress,
      });
    }
    return list;
  }, [primary, savedLocations]);

  const activeSavedKey =
    selectedSavedLocationKey ||
    locationOptions.find(
      (option) => option.address.toLowerCase() === form.locationAddress.trim().toLowerCase(),
    )?.key ||
    "";

  async function chooseLocation(key: string, fallbackAddress?: string, fallbackLabel?: string) {
    if (!key) {
      setSelectedSavedLocationKey("");
      return;
    }
    const option = locationOptions.find((item) => item.key === key);
    const label = option?.label ?? fallbackLabel ?? "Saved address";
    const address = option?.address ?? fallbackAddress ?? "";
    if (!address) return;

    setSelectedSavedLocationKey(key);
    const inferred = inferLocationFromAddress(address);

    setForm((current) => ({
      ...current,
      locationLabel: label,
      locationAddress: address,
      ...(inferred.state ? { locationState: inferred.state } : {}),
      ...(inferred.district ? { locationDistrict: inferred.district } : {}),
    }));
    setErrors((old) => {
      const next = { ...old };
      delete next.locationAddress;
      delete next.locationState;
      delete next.locationDistrict;
      return next;
    });

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const result = (await response.json()) as {
        results?: Array<{
          lat: number;
          lon: number;
          state?: string | null;
          district?: string | null;
          city?: string | null;
        }>;
      };
      const match = result.results?.[0];
      if (match && Number.isFinite(match.lat) && Number.isFinite(match.lon)) {
        const matched = matchIndiaLocation(match.state, match.district);
        setForm((current) => ({
          ...current,
          locationLat: match.lat,
          locationLng: match.lon,
          locationState: matched.state || current.locationState || (match.state ?? ""),
          locationDistrict:
            match.city || match.district || matched.district || current.locationDistrict,
        }));
      }
    } catch {
      // The client can still place the map pin manually if lookup fails.
    }
  }
  return (
    <div className="max-w-3xl">
      <PageActionLoading
        active={saving}
        title={savingMode === "publish" ? "Posting your job…" : "Saving your draft…"}
        description={
          savingMode === "publish"
            ? "We’re publishing your job and preparing it for qualified professionals."
            : "We’re safely saving your progress so you can continue later."
        }
      />
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
                onClick={handleSelectHourlyTiming}
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
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hourly rate (INR)" error={errors.hourlyRate}>
                    <Input
                      type="number"
                      min="1"
                      value={form.hourlyRate}
                      onChange={(e) => update("hourlyRate", e.target.value)}
                      placeholder="₹ 0 / hour"
                    />
                  </Field>
                  <Field label="Total job hours" error={errors.totalJobHours}>
                    <Input
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      value={form.totalJobHours}
                      onChange={(e) => handleHoursChange(e.target.value)}
                      placeholder="e.g. 100"
                    />
                    {Number(form.totalJobHours) > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <Clock className="h-3.5 w-3.5" />
                          {Number(form.totalJobHours).toLocaleString("en-IN")} hours ={" "}
                          <strong className="text-foreground">
                            {calculatedDays} {calculatedDays === 1 ? "day" : "days"}
                          </strong>{" "}
                          (at {workPaceHours}h/day)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px]">Pace:</span>
                          <select
                            value={workPaceHours}
                            onChange={(e) => handleWorkPaceChange(Number(e.target.value))}
                            className="h-6 rounded border border-border bg-background px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value={8}>8 hrs/day (Full-time)</option>
                            <option value={6}>6 hrs/day (Standard)</option>
                            <option value={4}>4 hrs/day (Part-time)</option>
                            <option value={24}>24 hrs/day (Continuous)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </Field>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Project total amount</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {hourlyProjectTotal === null
                          ? "Enter hourly rate and total hours"
                          : `${money(hourlyProjectTotal)} (${money(Number(form.hourlyRate))} × ${Number(form.totalJobHours).toLocaleString("en-IN")} hours)`}
                      </p>
                    </div>
                    {Number(form.totalJobHours) > 0 && calculatedDays > 0 && (
                      <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-primary/10">
                        <p className="text-xs text-muted-foreground">Estimated duration</p>
                        <p className="mt-0.5 text-sm font-semibold text-primary">
                          {calculatedDays} {calculatedDays === 1 ? "working day" : "working days"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({Number(form.totalJobHours)}h ÷ {workPaceHours}h/day)
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                  onClick={handleSelectPostToday}
                  title="Post today"
                  text="Show this job to professionals today."
                />
                <Mode
                  checked={postingTiming === "SCHEDULED"}
                  onClick={handleSelectScheduleLater}
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
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </Field>
              <Field label="Project end date" error={errors.deadline}>
                <Input
                  type="date"
                  min={form.jobDate || new Date().toISOString().slice(0, 10)}
                  value={form.deadline}
                  onChange={(e) => update("deadline", e.target.value)}
                />
                {form.timingType === "HOURLY" &&
                  Number(form.totalJobHours) > 0 &&
                  calculatedDays > 0 &&
                  form.deadline && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      Auto-calculated: {calculatedDays} {calculatedDays === 1 ? "day" : "days"} (
                      {Number(form.totalJobHours)}h ÷ {workPaceHours}h/day) from{" "}
                      {postingTiming === "SCHEDULED" ? "scheduled start date" : "today"}
                    </p>
                  )}
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

            {form.milestones.length > 0 && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Milestone Rule: Minimum 1% per milestone (no 0% or empty space)
                  </p>
                  <p>
                    Every milestone must be set to at least <strong>1%</strong>. When you adjust one
                    milestone, the remaining percentage is automatically split evenly across the
                    other milestones without exceeding 100%.
                  </p>
                  {form.milestones.length === 3 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With 3 milestones, the maximum for any single milestone is{" "}
                      <strong>98%</strong> (so the other 2 each have at least 1%). If you want to
                      allocate <strong>99%</strong> to the first milestone, delete the 3rd milestone
                      so only 2 milestones remain (e.g. 99% and 1%).
                    </p>
                  )}
                  {form.milestones.length > 3 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With {form.milestones.length} milestones, the maximum for any single
                      milestone is <strong>{100 - (form.milestones.length - 1)}%</strong> so
                      remaining milestones each have at least 1%. To assign a higher percentage
                      (e.g. 99%), delete extra milestones.
                    </p>
                  )}
                  {form.milestones.length === 2 && (
                    <p className="text-foreground/90 font-medium">
                      💡 Tip: With 2 milestones, you can assign up to <strong>99%</strong> to the
                      first milestone, and the second milestone automatically becomes{" "}
                      <strong>1%</strong>.
                    </p>
                  )}
                </div>
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
                  const projectTotal =
                    form.timingType === "HOURLY"
                      ? hourlyProjectTotal
                      : Number(form.budgetMax || form.budgetMin) || null;
                  const estAmount = projectTotal
                    ? Math.round((projectTotal * (milestone.percentage || 0)) / 100)
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
                                max={getMaxPercentageForMilestone(form.milestones, index)}
                                value={milestone.percentage ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateMilestone(
                                    index,
                                    "percentage",
                                    val === "" ? "" : Number(val),
                                  );
                                }}
                                onBlur={() => {
                                  if (!milestone.percentage || Number(milestone.percentage) < 1) {
                                    updateMilestone(index, "percentage", 1);
                                  }
                                }}
                                placeholder="1"
                                className="pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">
                                %
                              </span>
                            </div>
                            {form.milestones.length > 1 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Min 1% · Max {getMaxPercentageForMilestone(form.milestones, index)}%
                              </p>
                            )}
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
                    <div className="space-y-1.5">
                      <label htmlFor="saved-job-location" className="text-sm font-medium">
                        Choose a saved location
                      </label>
                      <select
                        id="saved-job-location"
                        value={activeSavedKey}
                        onChange={(event) => void chooseLocation(event.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 font-medium"
                      >
                        <option value="">Select a saved address</option>
                        {locationOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label} — {option.address}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {locationOptions.map((option) => {
                        const isSelected =
                          activeSavedKey === option.key ||
                          form.locationAddress.trim().toLowerCase() ===
                            option.address.toLowerCase();
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => void chooseLocation(option.key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs sm:text-sm font-medium transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                                : "border-input bg-background hover:border-primary/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <MapPin className="size-3.5 shrink-0 text-primary" />
                            <span>{option.label}</span>
                            <span className="max-w-[200px] truncate text-xs opacity-75 sm:max-w-xs">
                              ({option.address})
                            </span>
                          </button>
                        );
                      })}
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
                    onChange={(value) => {
                      setSelectedSavedLocationKey("");
                      update("locationAddress", value);
                    }}
                    onCoordinatesChange={(lat, lng) => {
                      setSelectedSavedLocationKey("");
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
                    onChange={(e) => {
                      setSelectedSavedLocationKey("");
                      update("locationAddress", e.target.value);
                    }}
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
                  ? `${money(form.hourlyRate === "" ? null : Number(form.hourlyRate))} / hour × ${form.totalJobHours || "0"} hours = ${money(hourlyProjectTotal)}`
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
              value={
                form.deadline
                  ? form.timingType === "HOURLY" &&
                    Number(form.totalJobHours) > 0 &&
                    calculatedDays > 0
                    ? `${form.deadline} (${calculatedDays} ${calculatedDays === 1 ? "day" : "days"} at ${workPaceHours}h/day)`
                    : form.deadline
                  : "Not set"
              }
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
                      .map((m, idx) => {
                        const milestonePercent = Number(m.percentage) || 0;
                        return `${idx + 1}. ${m.title} (${m.percentage}%${
                          (
                            form.timingType === "HOURLY"
                              ? hourlyProjectTotal
                              : Number(form.budgetMax)
                          )
                            ? ` • ₹${Math.round(((form.timingType === "HOURLY" ? hourlyProjectTotal : Number(form.budgetMax))! * milestonePercent) / 100).toLocaleString("en-IN")}`
                            : ""
                        })${m.description ? `\n   ${m.description}` : ""}`;
                      })
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
