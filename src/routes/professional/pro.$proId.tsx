"use client";

import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { BadgeCheck, MapPin, Star, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PublicProfessionalProfile } from "@/lib/types/marketplace";
import { MAX_HIRE_REQUEST_BUDGET } from "@/lib/constants/hiring";

type ClientJob = {
  id: number;
  title: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
};

const ProfessionalLocationMap = dynamic(() => import("@/components/ProfessionalLocationMap"), {
  ssr: false,
});

const formatCurrency = (value: number | null) =>
  value == null ? "Not set" : `₹${value.toLocaleString("en-US")}`;

const jobLabel = (job: ClientJob) =>
  `${job.title ?? `Job #${job.id}`} · ${job.timingType === "HOURLY" ? `${formatCurrency(job.hourlyRate)}/hr` : `${formatCurrency(job.budgetMin)} – ${formatCurrency(job.budgetMax)}`} ${job.status !== "OPEN" ? `(${job.status.toLowerCase()})` : ""}`;

function ProProfileContent() {
  const { proId } = useParams<{ proId: string }>();
  const searchParams = useSearchParams();
  const requestedJobId = Number(searchParams.get("jobId"));
  const [professional, setProfessional] = useState<PublicProfessionalProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [jobsStatus, setJobsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [duration, setDuration] = useState("1 week");
  const [coverLetter, setCoverLetter] = useState("");
  const [hireStep, setHireStep] = useState<1 | 2 | 3>(1);
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/v1/marketplace/professional-detail?id=${encodeURIComponent(proId)}`)
      .then(async (response) => {
        if (response.status === 404) return setStatus("missing");
        if (!response.ok) throw new Error("Unable to load professional");
        setProfessional((await response.json()) as PublicProfessionalProfile);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [proId]);

  useEffect(() => {
    async function loadJobs() {
      setJobsStatus("loading");
      try {
        const response = await fetch("/api/v1/client/jobs");
        if (!response.ok) throw new Error("Unable to load jobs");
        const data = (await response.json()) as { jobs: ClientJob[] };
        setJobs(data.jobs);
        if (Number.isSafeInteger(requestedJobId) && requestedJobId > 0) {
          const requestedJob = data.jobs.find((job) => job.id === requestedJobId);
          if (requestedJob?.status === "OPEN") setSelectedJobId(requestedJob.id);
        }
        setJobsStatus("ready");
      } catch {
        setJobsStatus("error");
      }
    }
    void loadJobs();
  }, [requestedJobId]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const isHourlyJob = selectedJob?.timingType === "HOURLY";
  const jobBudgetMin = selectedJob && !isHourlyJob ? selectedJob.budgetMin : null;
  const jobBudgetMax = selectedJob && !isHourlyJob ? selectedJob.budgetMax : null;
  // Fixed-price jobs default to the midpoint of the posted range; hourly jobs use the posted rate.
  const defaultBid = isHourlyJob
    ? (selectedJob?.hourlyRate ?? null)
    : jobBudgetMin !== null && jobBudgetMax !== null
      ? Math.round((jobBudgetMin + jobBudgetMax) / 2)
      : null;
  const bidMin = !isHourlyJob && jobBudgetMin !== null ? jobBudgetMin : 1;
  const bidMax = !isHourlyJob && jobBudgetMax !== null ? jobBudgetMax : MAX_HIRE_REQUEST_BUDGET;

  useEffect(() => {
    setBidAmount(defaultBid !== null ? String(defaultBid) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  const canSubmitRequest =
    selectedJob !== null &&
    selectedJob.status === "OPEN" &&
    Number.isFinite(Number(bidAmount)) &&
    Number(bidAmount) >= bidMin &&
    Number(bidAmount) <= bidMax &&
    requestStatus !== "loading";

  async function submitRequest() {
    if (!selectedJob) {
      setRequestMessage("Choose a job to request this professional.");
      setRequestStatus("error");
      return;
    }
    const parsedBid = Number(bidAmount);
    if (!Number.isFinite(parsedBid) || parsedBid < bidMin || parsedBid > bidMax) {
      setRequestMessage(
        `Enter a bid amount between ₹${bidMin.toLocaleString()} and ₹${bidMax.toLocaleString()}.`,
      );
      setRequestStatus("error");
      return;
    }
    setRequestStatus("loading");
    setRequestMessage(null);
    try {
      const response = await fetch("/api/v1/client/project-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJob.id,
          professionalId: Number(proId),
          bidAmount: Math.round(parsedBid),
          duration,
          coverLetter,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRequestStatus("error");
        setRequestMessage(data.error || "Unable to send the hire request.");
        return;
      }
      setRequestStatus("success");
      setRequestMessage("Your hire request was sent successfully.");
      setTimeout(() => {
        setDialogOpen(false);
        setHireStep(1);
        setSelectedJobId(null);
        setBidAmount("");
        setDuration("1 week");
        setCoverLetter("");
        setRequestStatus("idle");
        setRequestMessage(null);
      }, 1500);
    } catch {
      setRequestStatus("error");
      setRequestMessage("Unable to send the hire request right now.");
    }
  }

  if (status === "loading")
    return (
      <AppShell>
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </AppShell>
    );
  if (status === "missing")
    return (
      <AppShell>
        <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          This professional is unavailable.
        </p>
      </AppShell>
    );
  if (status === "error" || !professional)
    return (
      <AppShell>
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          The profile could not be loaded. Please try again.
        </p>
      </AppShell>
    );
  return (
    <AppShell>
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all">
        {/* Cover Canvas Banner */}
        <div className="relative h-44 sm:h-52 md:h-56 w-full overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.22),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.2),transparent_45%)]" />
          <div className="absolute -top-24 -right-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-52 w-52 rounded-full bg-cyan-400/15 blur-2xl" />

          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "28px 28px",
            }}
          />

          {/* Top Glass Badge */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Verified Pro Partner</span>
          </div>
        </div>

        {/* Profile Content Section */}
        <div className="px-6 pb-7 sm:px-8 sm:pb-8">
          {/* Top Profile Row: Avatar & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
            {/* Avatar with ring, shadow, and live indicator */}
            <div className="relative inline-block shrink-0">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-3xl p-1 bg-card ring-4 ring-card shadow-2xl overflow-hidden">
                {professional.avatar ? (
                  <img
                    src={professional.avatar}
                    alt={professional.name}
                    className="h-full w-full rounded-[22px] object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-primary/15 via-primary/5 to-accent/30 text-3xl sm:text-4xl font-bold font-display text-primary shadow-inner">
                    {professional.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Presence status dot */}
              <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card ring-2 ring-card shadow-md">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:mb-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-md">
                    <Sparkles className="h-4 w-4" />
                    Hire {professional.name.split(" ")[0]}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Hire {professional.name}</DialogTitle>
                    <DialogDescription>
                      Confirm the job, agree on budget and timeline, then review your request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                    {["Job details", "Budget & timeline", "Review"].map((label, index) => (
                      <div
                        key={label}
                        className={`rounded-lg px-3 py-2 text-center ${hireStep === index + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {index + 1}. {label}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 pt-2">
                    {jobsStatus === "loading" && (
                      <p className="text-sm text-muted-foreground">Loading your jobs...</p>
                    )}
                    {jobsStatus === "error" && (
                      <p className="text-sm text-destructive">
                        Your jobs could not be loaded. Sign in and reload the page.
                      </p>
                    )}
                    {jobsStatus === "ready" && (
                      <div className="space-y-4">
                        {hireStep === 1 && (
                          <div>
                            <Label htmlFor="selectedJob">Select your job</Label>
                            <Select
                              value={selectedJobId?.toString() ?? ""}
                              onValueChange={(value) => setSelectedJobId(Number(value))}
                            >
                              <SelectTrigger id="selectedJob" className="mt-2">
                                <SelectValue placeholder="Choose a job" />
                              </SelectTrigger>
                              <SelectContent>
                                {jobs.map((job) => (
                                  <SelectItem
                                    key={job.id}
                                    value={job.id.toString()}
                                    disabled={job.status !== "OPEN"}
                                  >
                                    {jobLabel(job)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {hireStep === 1 && selectedJob && (
                          <div className="rounded-2xl border border-border bg-muted p-4">
                            <p className="text-sm font-medium text-foreground">Selected job</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedJob.title ?? `Job #${selectedJob.id}`}
                            </p>
                            <p className="mt-2 text-sm">
                              {selectedJob.timingType === "HOURLY"
                                ? `${formatCurrency(selectedJob.hourlyRate)}/hr`
                                : `${formatCurrency(selectedJob.budgetMin)} – ${formatCurrency(selectedJob.budgetMax)}`}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Status: {selectedJob.status}
                            </p>
                          </div>
                        )}
                        {hireStep === 2 && (
                          <div>
                            <Label htmlFor="bidAmount">
                              {isHourlyJob ? "Your hourly rate" : "Your budget"}
                            </Label>
                            <Input
                              id="bidAmount"
                              type="number"
                              min={bidMin}
                              max={bidMax}
                              step="1"
                              value={bidAmount}
                              onChange={(event) => setBidAmount(event.target.value)}
                              placeholder={
                                isHourlyJob
                                  ? "Enter your proposed hourly rate"
                                  : "Enter your proposed bid"
                              }
                              className="mt-2"
                            />
                            <p className="mt-2 text-xs text-muted-foreground">
                              {isHourlyJob && selectedJob?.hourlyRate !== null
                                ? `This job's rate: ₹${selectedJob?.hourlyRate?.toLocaleString()}/hr. We've pre-filled it for you.`
                                : jobBudgetMin !== null && jobBudgetMax !== null
                                  ? `This job's budget: ₹${jobBudgetMin.toLocaleString()} – ₹${jobBudgetMax.toLocaleString()}. We've pre-filled the average.`
                                  : `Enter a bid amount up to ₹${bidMax.toLocaleString()}.`}
                            </p>
                          </div>
                        )}
                        {hireStep === 2 && (
                          <div>
                            <Label htmlFor="duration">Estimated duration</Label>
                            <Select value={duration} onValueChange={setDuration}>
                              <SelectTrigger id="duration" className="mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["1 week", "2 weeks", "1 month", "2 months", "3+ months"].map(
                                  (option) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {hireStep === 2 && (
                          <div>
                            <Label htmlFor="coverLetter">Message to professional</Label>
                            <Textarea
                              id="coverLetter"
                              value={coverLetter}
                              onChange={(event) => setCoverLetter(event.target.value)}
                              placeholder="Briefly describe the work or requirements"
                              className="mt-2"
                              rows={4}
                            />
                          </div>
                        )}
                        {hireStep === 3 && selectedJob && (
                          <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                            <p className="font-semibold">Confirm hire request</p>
                            <p>
                              <span className="text-muted-foreground">Job:</span>{" "}
                              {selectedJob.title ?? `Job #${selectedJob.id}`}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Professional:</span>{" "}
                              {professional.name}
                            </p>
                            <p>
                              <span className="text-muted-foreground">
                                {isHourlyJob ? "Hourly rate:" : "Budget:"}
                              </span>{" "}
                              ₹{Number(bidAmount || 0).toLocaleString()}
                              {isHourlyJob ? "/hr" : ""}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Timeline:</span> {duration}
                            </p>
                            {coverLetter && <p className="text-muted-foreground">{coverLetter}</p>}
                          </div>
                        )}
                        {requestMessage && (
                          <p
                            className={`text-sm ${
                              requestStatus === "success" ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {requestMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    {hireStep > 1 && (
                      <Button
                        variant="outline"
                        onClick={() => setHireStep((step) => (step - 1) as 1 | 2)}
                      >
                        Back
                      </Button>
                    )}
                    {hireStep < 3 ? (
                      <Button
                        onClick={() => setHireStep((step) => (step + 1) as 2 | 3)}
                        disabled={
                          hireStep === 1
                            ? !selectedJob || selectedJob.status !== "OPEN"
                            : !bidAmount.trim() ||
                              Number(bidAmount) < bidMin ||
                              Number(bidAmount) > bidMax
                        }
                        className="w-full sm:w-auto"
                      >
                        Continue
                      </Button>
                    ) : (
                      <Button
                        onClick={submitRequest}
                        disabled={!canSubmitRequest}
                        className="w-full sm:w-auto"
                      >
                        {requestStatus === "loading" ? "Sending..." : "Send hire request"}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Profile Identity Details (Guaranteed clean position below banner) */}
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {professional.name}
                </h1>
                {professional.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    Verified Pro
                  </span>
                )}
                {(professional.companyName || professional.industry) && (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border">
                    {professional.companyName || professional.industry}
                  </span>
                )}
              </div>
              <p className="mt-1 text-base font-medium text-muted-foreground">
                {professional.title}
              </p>
            </div>

            {/* Structured Metadata & Trust Badges Strip */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Rating */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{professional.rating.toFixed(1)}</span>
                <span className="font-normal opacity-80">({professional.reviews} reviews)</span>
              </div>

              {/* Location */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{professional.location ?? "Remote"}</span>
              </div>

              {/* Availability */}
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {professional.availability.replace("_", " ")}
              </span>

              {/* Rate */}
              {professional.hourlyRate ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  ₹{professional.hourlyRate.toLocaleString()}/hr
                </span>
              ) : null}

              {/* Work Mode */}
              {professional.workMode ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground capitalize">
                  {professional.workMode.replace("_", " ")}
                </span>
              ) : null}
            </div>
          </div>
          <section className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold">About</h2>
              <p className="mt-3 text-muted-foreground">
                {professional.bio ?? "This professional has not added an introduction yet."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <h2 className="text-lg font-semibold">Profile details</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Industry</p>
                  <p>{professional.industry ?? "Not specified"}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Work mode</p>
                  <p>{professional.workMode.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Experience</p>
                  <p>
                    {professional.experienceYears != null
                      ? `${professional.experienceYears} years`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Service area</p>
                  <p>{professional.serviceArea ?? "Not specified"}</p>
                </div>
              </div>
            </div>
          </section>
          {professional.displayPoint && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Location</h2>
              <div className="mt-3">
                <ProfessionalLocationMap point={professional.displayPoint} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Approximate location — shown for privacy
                </p>
              </div>
            </section>
          )}
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {professional.skills.length ? (
                professional.skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-border px-3 py-1 text-sm">
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No skills published yet.</p>
              )}
            </div>
          </section>
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Hourly rate</p>
              <p className="mt-1 text-2xl font-semibold">
                {professional.hourlyRate === null
                  ? "Contact for pricing"
                  : `₹${professional.hourlyRate}/hr`}
              </p>
            </div>
            <div className="rounded-2xl border border-border p-5">
              <p className="text-sm text-muted-foreground">Fixed rate</p>
              <p className="mt-1 text-2xl font-semibold">
                {professional.fixedRate === null ? "Not set" : `₹${professional.fixedRate}`}
              </p>
            </div>
          </section>
        </div>
      </article>
    </AppShell>
  );
}

export default function ProProfile() {
  return (
    <Suspense fallback={null}>
      <ProProfileContent />
    </Suspense>
  );
}
