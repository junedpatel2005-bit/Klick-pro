"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryCodes } from "@/lib/country-codes";

const emptyOtp = ["", "", "", ""];

function EmailTab() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    try {
      await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      setMessage("If an account exists for that email, we sent a reset link.");
    } catch {
      setMessage("Unable to send the reset link. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      {message && <p className="text-sm text-success">{message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

function PhoneTab() {
  const router = useRouter();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(emptyOtp);
  const [otpOpen, setOtpOpen] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fullPhone = `${countryCode}${phone.trim().replace(/\D/g, "")}`;

  function resetVerification() {
    setOtp(emptyOtp);
    setOtpOpen(false);
    setResetToken(null);
    setError(null);
  }

  async function requestCode() {
    setError(null);
    if (phone.trim().length < 7) {
      setError("Enter a valid phone number first.");
      return;
    }
    setSendingCode(true);
    const response = await fetch("/api/v1/auth/forgot-password-phone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: fullPhone }),
    });
    setSendingCode(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(result?.error ?? "Unable to send a verification code.");
      return;
    }
    setOtpOpen(true);
    setMessage("If that number is registered, a verification code has been sent.");
    requestAnimationFrame(() => otpRefs.current[0]?.focus());
  }

  function updateOtp(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    if (digit && index < otpRefs.current.length - 1) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!digits) return;
    event.preventDefault();
    setOtp(Array.from({ length: 4 }, (_, index) => digits[index] ?? ""));
    otpRefs.current[Math.min(digits.length, 4) - 1]?.focus();
  }

  async function verifyCode() {
    const code = otp.join("");
    if (code.length !== 4) {
      setError("Enter the 4-digit verification code.");
      return;
    }
    setError(null);
    setVerifying(true);
    const response = await fetch("/api/v1/auth/verify-forgot-password-phone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: fullPhone, code }),
    });
    const result = (await response.json()) as { error?: string; token?: string };
    setVerifying(false);
    if (!response.ok || !result.token) {
      setError(result.error ?? "Unable to verify this code.");
      return;
    }
    setResetToken(result.token);
    setMessage(null);
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetToken) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setResetting(true);
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: resetToken, password }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setResetting(false);
    if (!response.ok) {
      setError(result?.error ?? "Unable to reset your password.");
      return;
    }
    router.push("/login");
  }

  if (resetToken) {
    return (
      <form onSubmit={submitNewPassword} className="space-y-4">
        <p className="text-sm text-success">Phone verified. Choose a new password.</p>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-new-password">Confirm password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={resetting}>
          {resetting ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-phone">Phone number</Label>
        <div className="flex gap-2">
          <select
            aria-label="Country code"
            value={countryCode}
            onChange={(event) => {
              setCountryCode(event.target.value);
              resetVerification();
            }}
            disabled={otpOpen}
            className="h-10 w-[104px] shrink-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
          >
            {countryCodes.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.code}
              </option>
            ))}
          </select>
          <Input
            id="reset-phone"
            type="tel"
            required
            value={phone}
            disabled={otpOpen}
            onChange={(event) => {
              setPhone(event.target.value.replace(/[^\d\s-]/g, ""));
              resetVerification();
            }}
            placeholder="98765 43210"
          />
        </div>
      </div>
      {otpOpen ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <Label>Verification code</Label>
          <div className="flex gap-2">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(element) => {
                  otpRefs.current[index] = element;
                }}
                value={digit}
                onChange={(event) => updateOtp(index, event.target.value)}
                onKeyDown={(event) => handleOtpKeyDown(index, event)}
                onPaste={handleOtpPaste}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                aria-label={`Verification digit ${index + 1}`}
                className="h-11 w-11 text-center text-lg"
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={verifyCode}
              disabled={verifying || otp.join("").length !== 4}
            >
              {verifying ? "Verifying…" : "Verify code"}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={requestCode}
              disabled={sendingCode}
            >
              {sendingCode ? "Sending…" : "Resend code"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" className="w-full" onClick={requestCode} disabled={sendingCode}>
          {sendingCode ? "Sending…" : "Send verification code"}
        </Button>
      )}
      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function Forgot() {
  const [tab, setTab] = useState<"email" | "phone">("email");
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose how you'd like to verify it's you."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        {(["email", "phone"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => setTab(choice)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === choice ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
          >
            {choice === "email" ? "Email" : "Phone OTP"}
          </button>
        ))}
      </div>
      {tab === "email" ? <EmailTab /> : <PhoneTab />}
    </AuthLayout>
  );
}
