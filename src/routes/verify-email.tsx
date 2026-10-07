"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("This verification link is invalid or has expired.");
      return;
    }
    void fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = await response.text();
        let result: { error?: string; redirect?: string } = {};
        try {
          result = JSON.parse(body) as { error?: string; redirect?: string };
        } catch {
          result.error = `Verification request failed (${response.status}).`;
        }
        if (!response.ok) {
          setStatus("error");
          setError(result.error ?? "This verification link is invalid or has expired.");
          return;
        }
        setStatus("success");
        router.replace(result.redirect ?? "/login");
      })
      .catch(() => {
        setStatus("error");
        setError("Unable to verify your email. Please try again.");
      });
  }, [params, router]);

  if (status === "success") {
    return (
      <AuthLayout
        title="Email confirmed"
        subtitle="Your email address has been verified successfully."
        hideAside
        footer={
          <Link href="/login" className="text-primary hover:underline">
            Continue to log in
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">Redirecting you to your account…</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Confirm your email"
      subtitle={
        status === "verifying"
          ? "Confirming your email address…"
          : "We couldn't confirm your email."
      }
      hideAside
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      {status === "verifying" && (
        <p className="text-sm text-muted-foreground">Please wait a moment…</p>
      )}
      {status === "error" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <Button asChild className="h-11 w-full">
            <Link href="/verify">Resend confirmation link</Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
