"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";
type Details = {
  email: string;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};
export default function ClientVerification() {
  const [details, setDetails] = useState<Details | null>(null);
  useEffect(() => {
    void fetch("/api/v1/client/verification", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDetails(data?.user ?? null));
  }, []);
  const items = [
    {
      label: "Email address",
      value: details?.email ?? "Loading…",
      done: Boolean(details?.emailVerifiedAt),
      icon: Mail,
    },
    {
      label: "Phone number",
      value: details?.phone ?? "Not added",
      done: Boolean(details?.phoneVerifiedAt),
      icon: Phone,
    },
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] p-7 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">
          Client verification
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold">Your trusted account.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
          Verified contact details keep your account secure and help professionals work with
          confidence.
        </p>
      </section>
      <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-success/10 text-success">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Account verification</h2>
            <p className="text-sm text-muted-foreground">
              Your verified details are shown securely in your account.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-background p-5">
              <item.icon className="h-5 w-5 text-primary" />
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 font-semibold">{item.value}</p>
              <p
                className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${item.done ? "text-success" : "text-muted-foreground"}`}
              >
                {item.done ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Verified
                  </>
                ) : (
                  "Verification pending"
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-primary/5 p-4 text-sm text-muted-foreground">
          <BadgeCheck className="mr-2 inline h-4 w-4 text-primary" />
          Keeping these details verified helps protect your projects and payments.
        </div>
      </section>
    </div>
  );
}
