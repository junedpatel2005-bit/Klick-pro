"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileBadge,
  FileText,
  Fingerprint,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSkeleton } from "@/components/LoadingSkeleton";

type Verification = {
  status: string;
  governmentIdUrl: string | null;
  licenseUrl: string | null;
  certificationsJson: string | null;
  insuranceUrl: string | null;
  selfieUrl: string | null;
};
type Review = { documentKey: Field; status: "APPROVED" | "REJECTED" };
type Field = "governmentIdUrl" | "licenseUrl" | "certificationsJson" | "insuranceUrl" | "selfieUrl";
type PersonaState = {
  enabled: boolean;
  message?: string;
  providerStatus?: string;
  inquiryId?: string;
};

const items: {
  field: Field;
  title: string;
  description: string;
  icon: typeof IdCard;
  required?: boolean;
}[] = [
  {
    field: "governmentIdUrl",
    title: "Government ID",
    description: "Passport, national ID, or driver’s licence.",
    icon: IdCard,
    required: true,
  },
  {
    field: "licenseUrl",
    title: "Trade licence",
    description: "Required for regulated professional services.",
    icon: FileBadge,
  },
  {
    field: "certificationsJson",
    title: "Certificates",
    description: "Add professional certificates to build trust.",
    icon: FileText,
  },
  {
    field: "insuranceUrl",
    title: "Insurance",
    description: "Recommended for in-home and on-site work.",
    icon: ShieldCheck,
  },
  {
    field: "selfieUrl",
    title: "Selfie verification",
    description: "Optional: helps speed up identity review.",
    icon: Camera,
  },
];

export default function Verification() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [values, setValues] = useState<Record<Field, string | null>>({
    governmentIdUrl: null,
    licenseUrl: null,
    certificationsJson: null,
    insuranceUrl: null,
    selfieUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [persona, setPersona] = useState<PersonaState | null>(null);
  const [startingPersona, setStartingPersona] = useState(false);
  useEffect(() => {
    void fetch("/api/v1/professional/verification", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { verification: Verification | null; reviews?: Review[] }) => {
        setVerification(data.verification);
        setReviews(data.reviews ?? []);
        if (data.verification)
          setValues({
            governmentIdUrl: data.verification.governmentIdUrl,
            licenseUrl: data.verification.licenseUrl,
            certificationsJson: data.verification.certificationsJson,
            insuranceUrl: data.verification.insuranceUrl,
            selfieUrl: data.verification.selfieUrl,
          });
      })
      .catch(() => setMessage("Verification details could not be loaded."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void fetch("/api/verification/persona/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PersonaState | null) => setPersona(data));
  }, []);
  const uploaded = useMemo(
    () => items.filter((item) => Boolean(values[item.field])).length,
    [values],
  );
  const completion = Math.round((uploaded / items.length) * 100);
  const status = verification?.status ?? "NOT_STARTED";
  async function upload(field: Field, file: File) {
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/v1/professional/verification/upload", {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as { url?: string; name?: string; error?: string };
    if (!response.ok || !data.url) {
      setMessage(data.error ?? "Unable to upload document.");
      return;
    }
    setValues((current) => ({ ...current, [field]: data.url! }));
    setMessage(`${data.name ?? "Document"} uploaded. Submit for review when ready.`);
  }
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/professional/verification", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { verification?: Verification; error?: string };
      if (!response.ok) throw new Error(data.error);
      setVerification(data.verification ?? null);
      setMessage("Documents submitted for verification review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit verification.");
    } finally {
      setSaving(false);
    }
  }
  async function startPersona() {
    setStartingPersona(true);
    try {
      const response = await fetch("/api/verification/persona/start", { method: "POST" });
      const data = (await response.json()) as PersonaState & { hostedUrl?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to start verification.");
      setPersona(data);
      if (data.hostedUrl) window.location.assign(data.hostedUrl);
      else setMessage(data.message ?? "Persona flow is not currently available.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start verification.");
    } finally {
      setStartingPersona(false);
    }
  }

  const [panNumber, setPanNumber] = useState("");
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [panResult, setPanResult] = useState<{
    maskedPan?: string;
    registeredName?: string;
    status?: string;
    message?: string;
  } | null>(null);

  const [startingBgv, setStartingBgv] = useState(false);
  const [bgvResult, setBgvResult] = useState<{
    checkId?: string;
    status?: string;
    message?: string;
  } | null>(null);

  const [indianDocType, setIndianDocType] = useState<"PAN" | "AADHAAR">("PAN");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
  const [aadhaarResult, setAadhaarResult] = useState<{
    maskedAadhaar?: string;
    registeredName?: string;
    status?: string;
    message?: string;
  } | null>(null);

  async function submitPan() {
    if (!panNumber.trim()) return;
    setVerifyingPan(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/indian/pan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "PAN verification failed.");
      setPanResult(data);
      setMessage(data.message ?? "PAN submitted successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "PAN verification failed.");
    } finally {
      setVerifyingPan(false);
    }
  }

  async function submitAadhaar() {
    if (!aadhaarNumber.trim()) return;
    setVerifyingAadhaar(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/indian/aadhaar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaarNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Aadhaar verification failed.");
      setAadhaarResult(data);
      setMessage(data.message ?? "Aadhaar submitted successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Aadhaar verification failed.");
    } finally {
      setVerifyingAadhaar(false);
    }
  }

  async function startBgv() {
    setStartingBgv(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/springverify/start", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to start background check.");
      setBgvResult(data);
      setMessage(data.message ?? "SpringVerify background check initiated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to initiate background check.");
    } finally {
      setStartingBgv(false);
    }
  }
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8">
        <div className="absolute -right-8 -top-20 h-60 w-60 rounded-full bg-cta/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">
              Professional verification
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold">
              Build trust before the first job.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Submit your documents securely. Our team reviews your details and adds your verified
              badge when approved.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/65">
              Verification status
            </p>
            <p className="mt-1 text-lg font-bold">{status.replaceAll("_", " ")}</p>
          </div>
        </div>
      </section>
      {loading ? (
        <AppSkeleton>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-52 rounded-2xl bg-muted" />
            <div className="h-52 rounded-2xl bg-muted" />
          </div>
        </AppSkeleton>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Automated Identity & Background Verification
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Verify your identity instantly with Persona, validate your PAN with AuthBridge, or
                run a comprehensive background check with SpringVerify.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Card 1: Persona */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    <div>
                      <h3 className="font-semibold leading-tight">Photo ID & Selfie</h3>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Powered by Persona</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Global passport, national ID, or driver’s license scan with 3D facial biometrics.
                  </p>
                  {persona?.providerStatus && (
                    <span className="mt-3 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Status: {persona.providerStatus}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={startingPersona}
                    onClick={() => void startPersona()}
                  >
                    {startingPersona ? "Starting…" : "Start Photo ID"}
                  </Button>
                </div>
              </div>

              {/* Card 2: Government ID (PAN / Aadhaar) */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🇮🇳</span>
                      <div>
                        <h3 className="font-semibold leading-tight">Government ID</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Powered by AuthBridge</p>
                      </div>
                    </div>
                  </div>

                  {/* Toggle between PAN and Aadhaar */}
                  <div className="mt-3 flex rounded-lg bg-muted p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setIndianDocType("PAN")}
                      className={`flex-1 rounded-md py-1 transition ${
                        indianDocType === "PAN"
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      PAN Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndianDocType("AADHAAR")}
                      className={`flex-1 rounded-md py-1 transition ${
                        indianDocType === "AADHAAR"
                          ? "bg-white text-slate-900 shadow-2xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Aadhaar Card
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {indianDocType === "PAN"
                      ? "Instant PAN card validation via NSDL / Income Tax Department."
                      : "Direct Aadhaar verification with masked identity safeguard."}
                  </p>

                  {/* PAN Verification Result */}
                  {indianDocType === "PAN" && panResult && (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800 border border-emerald-200">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Verified: {panResult.maskedPan}
                      </p>
                      {panResult.registeredName && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">Name: {panResult.registeredName}</p>
                      )}
                    </div>
                  )}

                  {/* Aadhaar Verification Result */}
                  {indianDocType === "AADHAAR" && aadhaarResult && (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800 border border-emerald-200">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Verified: {aadhaarResult.maskedAadhaar}
                      </p>
                      {aadhaarResult.registeredName && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">Name: {aadhaarResult.registeredName}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {indianDocType === "PAN" ? (
                    <>
                      <Input
                        placeholder="Enter PAN (e.g. ABCDE1234F)"
                        value={panNumber}
                        maxLength={10}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        className="text-xs font-mono uppercase"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        disabled={verifyingPan || panNumber.trim().length !== 10}
                        onClick={() => void submitPan()}
                      >
                        {verifyingPan ? "Verifying PAN…" : "Verify PAN"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="Enter 12-digit Aadhaar (e.g. 1234 5678 9012)"
                        value={aadhaarNumber}
                        maxLength={14}
                        onChange={(e) => setAadhaarNumber(e.target.value)}
                        className="text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        disabled={verifyingAadhaar || aadhaarNumber.replace(/[\s-]+/g, "").length !== 12}
                        onClick={() => void submitAadhaar()}
                      >
                        {verifyingAadhaar ? "Verifying Aadhaar…" : "Verify Aadhaar"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Card 3: SpringVerify */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔍</span>
                    <div>
                      <h3 className="font-semibold leading-tight">Background & Police Check</h3>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Powered by SpringVerify</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Court record verification, criminal background check, and police registry scan.
                  </p>
                  {bgvResult && (
                    <span className="mt-3 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                      Check ID: {bgvResult.checkId}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-slate-300 text-slate-700 hover:bg-slate-50"
                    disabled={startingBgv}
                    onClick={() => void startBgv()}
                  >
                    {startingBgv ? "Initiating BGV…" : "Initiate BGV Check"}
                  </Button>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Verification progress</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {uploaded} of {items.length} verification items added. Government ID is required.
                </p>
              </div>
              <span className="text-2xl font-bold text-primary">{completion}%</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-cta))] transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const value = values[item.field];
              const Icon = item.icon;
              const review = reviews.find((entry) => entry.documentKey === item.field);
              return (
                <article
                  key={item.field}
                  className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{item.title}</h2>
                        {item.required && (
                          <span className="rounded-full bg-cta/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cta">
                            Required
                          </span>
                        )}
                        {review && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${review.status === "APPROVED" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                          >
                            {review.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`mt-5 rounded-xl border p-3 text-sm ${value ? "border-success/25 bg-success/5" : "border-dashed border-border bg-muted/30"}`}
                  >
                    {value ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex min-w-0 items-center gap-2 truncate text-success">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Document uploaded
                        </span>
                        <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                          Replace
                          <input
                            className="sr-only"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void upload(item.field, file);
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-muted-foreground hover:text-primary">
                        <Upload className="h-4 w-4" />
                        Choose document
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void upload(item.field, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              {message ? (
                <p
                  className={
                    message.includes("submitted")
                      ? "text-sm text-success"
                      : "text-sm text-destructive"
                  }
                >
                  {message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You can add or replace documents before submitting for review.
                </p>
              )}
            </div>
            <Button disabled={saving || !values.governmentIdUrl} onClick={() => void save()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                <>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Submit for review
                </>
              )}
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
