"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password !== confirmation) return setError("Passwords do not match.");
    setPending(true);
    setError(null);
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: params.get("token"), password }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) setError(result.error ?? "Unable to reset your password.");
    else router.push("/login");
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use at least 8 characters, including upper- and lowercase letters and a number."
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      }
    >
      <form action={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmation">Confirm password</Label>
          <Input id="confirmation" name="confirmation" type="password" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Resetting…" : "Reset password"}
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
