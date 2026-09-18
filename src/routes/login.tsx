"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleMark } from "@/components/GoogleMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { countryCodes } from "@/lib/country-codes";
import { isValidPhoneNumber, phoneValidationMessage } from "@/lib/phone-validation";

const DEMO_ACCOUNTS = {
  client: {
    username: "seed_client",
    email: "seed.client@servio.example",
    password: "ServioSeed#2026",
  },
  professional: {
    username: "surat_pro",
    email: "surat.pro@servio.example",
    password: "ServioSeed#2026",
  },
} as const;

export default function Login() {
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [buttonScale, setButtonScale] = useState(1);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [profileSetupReminder, setProfileSetupReminder] = useState(false);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function quickFill(role: "" | keyof typeof DEMO_ACCOUNTS) {
    if (!role) return;
    const account = DEMO_ACCOUNTS[role];
    if (emailRef.current) emailRef.current.value = account.email;
    if (passwordRef.current) passwordRef.current.value = account.password;
    setFieldErrors({ email: "", password: "" });
    setError(null);
    passwordRef.current?.focus();
  }

  async function quickLogin(role: "" | keyof typeof DEMO_ACCOUNTS) {
    if (!role) return;
    quickFill(role);
    await submit();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get("oauthError"));
    const requestedPath = params.get("next");
    let reminderTimeout: number | undefined;
    if (
      params.get("profileSetup") === "1" ||
      requestedPath === "/professional/setup" ||
      requestedPath === "/client-profile"
    ) {
      setProfileSetupReminder(true);
      reminderTimeout = window.setTimeout(() => setProfileSetupReminder(false), 10_000);
    }
    if (requestedPath?.startsWith("/") && !requestedPath.startsWith("//")) {
      setNextPath(requestedPath);
    }
    return () => {
      if (reminderTimeout) window.clearTimeout(reminderTimeout);
    };
  }, []);

  function getPostLoginRedirect(resultRedirect?: string) {
    if (resultRedirect === "/verify") return resultRedirect;
    return nextPath ?? resultRedirect ?? "/dashboard";
  }

  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (pending) return;
    const email = (emailRef.current?.value ?? "").trim();
    const password = passwordRef.current?.value ?? "";
    const nextFieldErrors = {
      email: !email
        ? "Email is required."
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? "Enter a valid email."
          : "",
      password: !password ? "Password is required." : "",
    };

    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.email || nextFieldErrors.password) {
      setError("Please fix the highlighted fields before signing in.");
      return;
    }

    setButtonScale(0.97);
    setTimeout(() => setButtonScale(1), 150);
    setPending(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      const result = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to sign in.");
        if (result.redirect === "/verify")
          window.setTimeout(() => window.location.assign("/verify"), 900);
        return;
      }
      window.location.assign(getPostLoginRedirect(result.redirect));
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === "AbortError"
          ? "Sign-in is taking too long. Please try again."
          : "Unable to sign in. Please check your connection and try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  async function sendPhoneCode() {
    setError(null);
    if (!isValidPhoneNumber(phone, countryCode)) {
      setError(phoneValidationMessage(countryCode));
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/send-phone-login-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: `${countryCode}${phone.replace(/\D/g, "")}` }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to send the verification code.");
        return;
      }
      setPhoneCodeSent(true);
      setError("Verification code sent to your phone.");
    } catch {
      setError("Unable to send verification code. Please check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function submitPhone(event?: React.FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (pending) return;
    setError(null);
    if (!isValidPhoneNumber(phone, countryCode)) {
      setError(phoneValidationMessage(countryCode));
      return;
    }
    if (!phoneCodeSent) {
      await sendPhoneCode();
      return;
    }
    if (phoneCode.length !== 4) {
      setError("Enter the 4-digit verification code.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/login-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: `${countryCode}${phone.replace(/\D/g, "")}`,
          code: phoneCode,
        }),
      });
      const result = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to sign in with your phone.");
        if (result.redirect === "/verify")
          window.setTimeout(() => window.location.assign("/verify"), 900);
        return;
      }
      window.location.assign(getPostLoginRedirect(result.redirect));
    } catch {
      setError("Unable to sign in. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your dashboard."
      hideAside
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {profileSetupReminder ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Your profile setup is remaining.</p>
          <p className="mt-1 text-amber-800">Sign in to continue setting up your profile.</p>
        </div>
      ) : null}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/70 p-1">
        <button
          type="button"
          onClick={() => {
            setLoginMode("email");
            setError(null);
          }}
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            loginMode === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setLoginMode("phone");
            setError(null);
          }}
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            loginMode === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          Phone OTP
        </button>
      </div>
      {loginMode === "email" ? (
        <form onSubmit={submit} noValidate className="space-y-5">
          <Button
            type="button"
            variant="outline"
            disabled={pending || googleLoading}
            className="h-11 w-full transition-transform hover:-translate-y-0.5"
            onClick={() => {
              setGoogleLoading(true);
              const googleUrl = new URL("/api/v1/auth/google", window.location.origin);
              if (nextPath) googleUrl.searchParams.set("next", nextPath);
              window.location.href = googleUrl.toString();
            }}
          >
            {googleLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Connecting to Google…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <GoogleMark />
                Continue with Google
              </span>
            )}
          </Button>
          {oauthError === "google-not-configured" ? (
            <p className="text-sm text-destructive">Google sign-in has not been configured yet.</p>
          ) : null}
          {oauthError === "google-failed" ? (
            <p className="text-sm text-destructive">
              Google sign-in could not be completed. Please try again.
            </p>
          ) : null}
          <div className="relative py-2 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background px-3">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <div className="space-y-1.5 rounded-lg border border-dashed border-amber-400/60 bg-amber-400/10 p-3">
            <Label htmlFor="quickFill" className="text-amber-700">
              Quick fill — temporary, for testing only
            </Label>
            <select
              id="quickFill"
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                void quickLogin(event.target.value as "" | keyof typeof DEMO_ACCOUNTS);
                event.target.value = "";
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">Select a demo account…</option>
              <option value="client">Client</option>
              <option value="professional">Professional</option>
            </select>
            <div className="space-y-1 text-xs text-amber-800">
              <p>Selecting an account signs in immediately.</p>
              <p>
                Client: <code>seed_client</code> / <code>ServioSeed#2026</code>
              </p>
              <p>
                Professional: <code>surat_pro</code> / <code>ServioSeed#2026</code>
              </p>
            </div>
            <p className="text-xs text-amber-700">
              Fills the email and password below — just press Enter to log in.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              disabled={pending}
              ref={emailRef}
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              className={cn("h-11", fieldErrors.email ? "border-destructive" : "")}
            />
            {fieldErrors.email ? (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              disabled={pending}
              ref={passwordRef}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              className={cn("h-11", fieldErrors.password ? "border-destructive" : "")}
            />
            {fieldErrors.password ? (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className={cn(
              "relative h-11 w-full overflow-hidden transition-all duration-200",
              pending && "cursor-wait opacity-90",
            )}
            style={{ transform: `scale(${buttonScale})` }}
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Signing in…
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
                Log in <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitPhone} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="login-phone">Phone number</Label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                disabled={pending}
                onChange={(event) => {
                  setCountryCode(event.target.value);
                  setPhoneCodeSent(false);
                }}
                className="h-11 w-[108px] rounded-lg border border-input bg-background px-2.5 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {countryCodes.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <Input
                id="login-phone"
                value={phone}
                disabled={pending}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/[^\d\s-]/g, ""));
                  setPhoneCodeSent(false);
                }}
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                className="h-11"
                required
              />
            </div>
          </div>
          {phoneCodeSent && (
            <div className="space-y-1.5">
              <Label htmlFor="phone-code">Verification code</Label>
              <Input
                id="phone-code"
                value={phoneCode}
                disabled={pending}
                onChange={(event) =>
                  setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                inputMode="numeric"
                placeholder="Enter 4-digit OTP"
                className="h-11 tracking-[0.35em]"
                required
              />
            </div>
          )}
          {error ? (
            <p
              className={cn(
                "text-sm",
                error.includes("sent") ? "text-primary" : "text-destructive",
              )}
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full transition-all duration-200"
          >
            {pending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                {phoneCodeSent ? "Signing in…" : "Sending OTP…"}
              </span>
            ) : phoneCodeSent ? (
              "Log in with OTP"
            ) : (
              "Send OTP"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
