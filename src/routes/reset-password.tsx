"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: params.get("token"), password }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to reset your password.");
        return;
      }
      router.push("/login");
    } catch {
      setError("Unable to reset your password. Please check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use at least 8 characters, including upper- and lowercase letters and a number."
      hideAside
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmation">Confirm password</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            required
            className="h-11"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? (
            <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Resetting…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
              Reset password <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
