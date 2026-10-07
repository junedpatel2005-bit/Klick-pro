"use client";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Pencil, ArrowRight, ExternalLink, Clock, CheckCircle2 } from "lucide-react";

function getEmailProviderInfo(email: string | null) {
  if (!email) {
    return { name: "Gmail", url: "https://mail.google.com" };
  }
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.includes("gmail") || domain.includes("googlemail")) {
    return { name: "Gmail", url: "https://mail.google.com" };
  }
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
    return { name: "Outlook", url: "https://outlook.live.com" };
  }
  if (domain.includes("yahoo") || domain.includes("ymail")) {
    return { name: "Yahoo Mail", url: "https://mail.yahoo.com" };
  }
  if (domain.includes("icloud")) {
    return { name: "iCloud Mail", url: "https://www.icloud.com/mail" };
  }
  return { name: "Gmail / Mailbox", url: "https://mail.google.com" };
}

export default function Verify() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(queryEmail);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(5);

  const provider = getEmailProviderInfo(userEmail);

  // 5-second countdown timer for the resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Status check polling & visibility handler
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", { cache: "no-store" });
        if (!response.ok || !active) return;
        const result = (await response.json()) as {
          user?: { email?: string; emailVerifiedAt?: string | null; role?: string };
        };
        if (result.user?.email && !userEmail) {
          setUserEmail(result.user.email);
        }
        if (result.user?.role) {
          setUserRole(result.user.role);
        }
        if (result.user?.emailVerifiedAt) {
          setEmailVerified(true);
        }
      } catch {
        // Keep the verification page usable while the status check retries.
      }
    };
    void checkStatus();

    const BACKOFF_MS = [2000, 5000, 15000, 30000];
    let step = 0;
    let timer = 0;
    const scheduleNext = () => {
      timer = window.setTimeout(async () => {
        if (!active) return;
        if (document.visibilityState === "visible") {
          await checkStatus();
          if (step < BACKOFF_MS.length - 1) step += 1;
        }
        if (active) scheduleNext();
      }, BACKOFF_MS[step]);
    };
    scheduleNext();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      step = 0;
      void checkStatus();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userEmail]);

  // When email becomes verified, automatically navigate to profile setup
  useEffect(() => {
    if (!emailVerified) return;
    const target =
      userRole === "CLIENT" ? "/client/setup?profileSetup=1" : "/professional/setup?profileSetup=1";
    const timer = window.setTimeout(() => {
      router.push(target);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [emailVerified, userRole, router]);

  if (emailVerified) {
    return (
      <AuthLayout hideAside title="Email confirmed!" subtitle="Your account is verified.">
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Verification successful!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Redirecting you to your account setup…
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  async function resend() {
    if (resending || resendCooldown > 0) return;
    setError(null);
    setMessage(null);
    setResending(true);
    try {
      const response = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to resend the confirmation link.");
      } else {
        setMessage("A new confirmation link has been sent to your email.");
        setResendCooldown(30);
      }
    } catch {
      setError("Unable to resend the confirmation link. Please check your connection.");
    } finally {
      setResending(false);
    }
  }

  async function updateEmail() {
    setEmailError(null);
    setEmailMessage(null);
    const response = await fetch("/api/v1/auth/update-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim() }),
    });
    const result = (await response.json()) as {
      error?: string;
      fields?: Record<string, string>;
      message?: string;
      email?: string;
    };
    if (!response.ok) {
      setEmailError(result.fields?.email ?? result.error ?? "Unable to update email.");
      return;
    }
    const updated = result.email ?? newEmail.trim();
    setUserEmail(updated);
    setEditingEmail(false);
    setEmailMessage(result.message ?? "Email updated. A new confirmation link has been sent.");
    setResendCooldown(5);
  }

  return (
    <AuthLayout
      hideAside
      title="Verify your email"
      subtitle="Registration successful! Please confirm your email address."
      footer={<>Need help? Check your spam or promotions folder. The link expires in 24 hours.</>}
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <Mail className="h-8 w-8" strokeWidth={1.8} />
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          {/* Prominent Email Pill */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Verification link sent to
            </p>
            <p className="mt-1 break-all text-base font-bold text-foreground">
              {userEmail || "your email address"}
            </p>
          </div>

          {/* Clean 2-Step Instructions */}
          <div className="space-y-2.5 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm">
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <p className="text-foreground">
                Open your <strong>{provider.name}</strong> or email inbox.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              <p className="text-foreground">
                Click the confirmation link from <strong>Klick-Pro</strong> to activate your
                account.
              </p>
            </div>
            <p className="pt-1 pl-7 text-xs text-muted-foreground">
              Can&apos;t find it? Check your <strong>Spam</strong> or <strong>Promotions</strong>{" "}
              folder.
            </p>
          </div>

          {/* Primary Action Button: Open Gmail / Email Inbox */}
          <Button asChild className="h-11 w-full gap-2 text-sm font-semibold">
            <a href={provider.url} target="_blank" rel="noopener noreferrer">
              Open {provider.name}
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>

          {/* Resend Confirmation Link Button (Available after 5s) */}
          {resendCooldown > 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-center text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0 animate-pulse text-muted-foreground" />
              <span>
                Didn&apos;t receive the email? Resend link available in{" "}
                <span className="font-semibold text-foreground">{resendCooldown}s</span>
              </span>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void resend()}
              disabled={resending}
              className="h-11 w-full transition-all"
            >
              {resending ? "Sending confirmation link…" : "Send confirmation link again"}
              {!resending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}

          {/* Toggle Change Email Option */}
          <div className="pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingEmail((current) => !current);
                setNewEmail(userEmail ?? "");
                setEmailError(null);
                setEmailMessage(null);
              }}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {editingEmail ? "Cancel changing email" : "Wrong email address? Change email"}
            </Button>
          </div>

          {!editingEmail && emailMessage && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700">
              {emailMessage}
            </p>
          )}
          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700">
              {message}
            </p>
          )}
        </div>

        {editingEmail ? (
          <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
            <Label htmlFor="new-email">Enter new email address</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(event) => {
                setNewEmail(event.target.value);
                setEmailError(null);
              }}
              placeholder="you@company.com"
              className="w-full"
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            {emailMessage && <p className="text-sm text-emerald-600">{emailMessage}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={() => void updateEmail()} className="grow">
                Update email
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingEmail(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
    </AuthLayout>
  );
}
