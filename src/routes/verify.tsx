"use client";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { Mail, Pencil, ArrowRight } from "lucide-react";

export default function Verify() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/v1/auth/me", { cache: "no-store" });
        if (!response.ok || !active) return;
        const result = await response.json();
        setUserEmail(result.user?.email ?? null);
        setEmailVerified(Boolean(result.user?.emailVerifiedAt));
      } catch {
        // Keep the verification page usable while the status check retries.
      }
    };
    void checkStatus();
    const interval = window.setInterval(() => void checkStatus(), 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (emailVerified) {
    return (
      <AuthLayout hideAside title="Email verified" subtitle="Your account is ready to use.">
        <p className="text-sm text-muted-foreground">
          Your verification was completed successfully. You can close this tab.
        </p>
      </AuthLayout>
    );
  }

  async function resend() {
    if (resending) return;
    setError(null);
    setMessage(null);
    setResending(true);
    try {
      const response = await fetch("/api/v1/auth/resend-verification", { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) setError(result.error ?? "Unable to resend the confirmation link.");
      else setMessage("A new confirmation link has been sent to your email.");
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
    setUserEmail(result.email ?? newEmail.trim());
    setEditingEmail(false);
    setEmailMessage(result.message ?? "Email updated. A new confirmation link has been sent.");
  }

  return (
    <AuthLayout
      hideAside
      title="Registration successful"
      subtitle="Your account was created, but your email is not verified yet."
      footer={<>Need help? Check your spam or promotions folder.</>}
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <Mail className="h-8 w-8" strokeWidth={1.8} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">One last step</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Open the confirmation link we sent to{" "}
                <span className="font-medium text-foreground">{userEmail || "your email"}.</span>
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Your Gmail/email is not verified yet. The link expires in 24 hours.
          </div>
          <Button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="mt-5 w-full"
          >
            {resending ? "Sending confirmation link…" : "Send confirmation link again"}
            {!resending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setEditingEmail((current) => !current);
                setNewEmail(userEmail ?? "");
                setEmailError(null);
                setEmailMessage(null);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Change email
            </Button>
          </div>
          {!editingEmail && emailMessage && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
              {emailMessage}
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
              {message}
            </p>
          )}
        </div>
        {editingEmail ? (
          <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
            <Label htmlFor="new-email">Edit email</Label>
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
            {emailMessage && <p className="text-sm text-success">{emailMessage}</p>}
            <div className="flex flex-wrap gap-2">
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </AuthLayout>
  );
}
