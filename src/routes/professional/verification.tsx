"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileBadge,
  FileText,
  IdCard,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-xl font-semibold">Document Verification</h2>
            {persona?.enabled ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete your identity document verification securely with Persona.
                </p>
                <Button
                  className="mt-4"
                  disabled={startingPersona}
                  onClick={() => void startPersona()}
                >
                  {startingPersona ? "Starting…" : "Start Verification"}
                </Button>
                {persona.providerStatus && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Persona status: {persona.providerStatus}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Verification service is currently unavailable/configuration pending.
              </p>
            )}
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
