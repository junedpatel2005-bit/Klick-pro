"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardEvent, FormEvent, KeyboardEvent, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryCodes } from "@/lib/country-codes";
import { isValidPhoneNumber, phoneValidationMessage } from "@/lib/phone-validation";
import { cn } from "@/lib/utils";

const emptyOtp = ["", "", "", ""];

function EmailTab() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError("Email is required.");
      setError("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError("Enter a valid email.");
      setError("Enter a valid email.");
      return;
    }

    setFieldError("");
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Your email is not registered.");
        return;
      }

      setMessage(data?.message ?? "Reset link sent to your email.");
    } catch {
      setError("Unable to send the reset link. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          disabled={pending}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldError) setFieldError("");
            if (error) setError(null);
          }}
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldError || error)}
          className={cn("h-11", fieldError || error ? "border-destructive" : "")}
        />
        {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={cn(
          "relative h-11 w-full overflow-hidden transition-all duration-200",
          pending && "cursor-wait opacity-90",
        )}
      >
        {pending ? (
          <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
            Sending reset link…
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
            Send reset link <ArrowRight className="h-4 w-4" />
          </span>
        )}
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
    setMessage(null);
  }

  async function requestCode() {
    setError(null);
    setMessage(null);
    if (!isValidPhoneNumber(phone, countryCode)) {
      setError(phoneValidationMessage(countryCode));
      return;
    }
    setSendingCode(true);
    try {
      const response = await fetch("/api/v1/auth/forgot-password-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(result?.error ?? "Your phone number is not registered.");
        return;
      }
      setOtpOpen(true);
      setMessage(result?.message ?? "Verification code sent to your phone.");
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } catch {
      setError("Unable to send verification code. Please check your connection.");
    } finally {
      setSendingCode(false);
    }
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
    try {
      const response = await fetch("/api/v1/auth/verify-forgot-password-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        token?: string;
      } | null;
      if (!response.ok || !result?.token) {
        setError(result?.error ?? "Unable to verify this code.");
        return;
      }
      setResetToken(result.token);
      setMessage(null);
    } catch {
      setError("Unable to verify code. Please check your connection.");
    } finally {
      setVerifying(false);
    }
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
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Unable to reset your password.");
        return;
      }
      router.push("/login");
    } catch {
      setError("Unable to reset password. Please check your connection.");
    } finally {
      setResetting(false);
    }
  }

  if (resetToken) {
    return (
      <form onSubmit={submitNewPassword} className="space-y-5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          Phone verified. Choose a new password.
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            required
            className="h-11"
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
            className="h-11"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" className="h-11 w-full" disabled={resetting}>
          {resetting ? (
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
    );
  }

  return (
    <div className="space-y-5">
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
            disabled={otpOpen || sendingCode}
            className="h-11 w-[108px] rounded-lg border border-input bg-background px-2.5 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
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
            disabled={otpOpen || sendingCode}
            onChange={(event) => {
              setPhone(event.target.value.replace(/[^\d\s-]/g, ""));
              resetVerification();
            }}
            placeholder="98765 43210"
            className="h-11"
          />
        </div>
      </div>
      {otpOpen ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4">
          <Label>Verification code</Label>
          <div className="flex justify-center gap-2">
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
                className="h-12 w-12 text-center text-lg font-semibold"
              />
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={verifyCode}
              disabled={verifying || otp.join("").length !== 4}
            >
              {verifying ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Verifying…
                </span>
              ) : (
                "Verify code"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={requestCode}
              disabled={sendingCode}
            >
              {sendingCode ? "Sending…" : "Resend"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          className="h-11 w-full"
          onClick={requestCode}
          disabled={sendingCode}
        >
          {sendingCode ? (
            <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Sending code…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
              Send verification code <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

export default function Forgot() {
  const [tab, setTab] = useState<"email" | "phone">("email");
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose how you'd like to verify it's you."
      hideAside
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/70 p-1">
        <button
          type="button"
          onClick={() => setTab("email")}
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            tab === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            tab === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Phone OTP
        </button>
      </div>
      {tab === "email" ? <EmailTab /> : <PhoneTab />}
    </AuthLayout>
  );
}
