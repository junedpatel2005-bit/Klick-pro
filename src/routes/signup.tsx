"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleMark } from "@/components/GoogleMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"client" | "pro">("client");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const rawRole = searchParams.get("role")?.toLowerCase();
    if (rawRole === "pro" || rawRole === "professional") {
      setRole("pro");
    } else if (rawRole === "client") {
      setRole("client");
    }
  }, [searchParams]);

  function chooseRole(nextRole: "client" | "pro") {
    if (pending) return;
    setRole(nextRole);
    setError(null);
  }

  async function checkAvailability(field: "email", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const response = await fetch("/api/v1/auth/check-availability", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: trimmed }),
    });
    if (!response.ok) return;
    const result =
      response.status === 204
        ? { fields: {} }
        : ((await response.json()) as { fields?: Record<string, string> });
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.fields?.[field]) next[field] = result.fields[field];
      else delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  async function submit() {
    if (pending) return;
    setError(null);
    const nextErrors: Record<string, string> = {};
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const email = draft.email.trim();
    const password = draft.password;
    if (!firstName) nextErrors.firstName = "First name is required.";
    if (!lastName) nextErrors.lastName = "Last name is required.";
    if (!email) nextErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Password is required.";
    else if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    else if (!/[A-Z]/.test(password))
      nextErrors.password = "Password must include an uppercase letter.";
    else if (!/[a-z]/.test(password))
      nextErrors.password = "Password must include a lowercase letter.";
    else if (!/\d/.test(password)) nextErrors.password = "Password must include a number.";
    if (!draft.confirmPassword) nextErrors.confirmPassword = "Please confirm your password.";
    else if (password !== draft.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (!draft.terms) nextErrors.terms = "Please accept the Terms and Privacy Policy.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role: role === "pro" ? "PROFESSIONAL" : "CLIENT",
          terms: draft.terms,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirect?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        setError(result.error ?? "Unable to create your account.");
      } else router.push(result.redirect ?? "/client-profile");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join 50,000+ clients and pros on Klick-Pro."
      hideAside
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/70 p-1">
        {(["client", "pro"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={pending}
            onClick={() => chooseRole(choice)}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${role === choice ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"} ${pending ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            I&apos;m a {choice === "client" ? "client" : "professional"}
          </button>
        ))}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {role === "client"
          ? "Create an account to post jobs and hire trusted professionals."
          : "Create a professional account to showcase your services and find work."}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending || googleLoading}
        className="mb-5 h-11 w-full transition-transform hover:-translate-y-0.5"
        onClick={() => {
          setGoogleLoading(true);
          window.location.href = `/api/v1/auth/google?role=${role === "pro" ? "PROFESSIONAL" : "CLIENT"}`;
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

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="first"
            name="firstName"
            label="First name"
            placeholder="First name"
            required
            disabled={pending}
            error={fieldErrors.firstName}
            value={draft.firstName}
            onValueChange={(value) => setDraft({ ...draft, firstName: value })}
          />
          <Field
            id="last"
            name="lastName"
            label="Last name"
            placeholder="Last name"
            required
            disabled={pending}
            error={fieldErrors.lastName}
            value={draft.lastName}
            onValueChange={(value) => setDraft({ ...draft, lastName: value })}
          />
        </div>
        <Field
          id="email"
          name="email"
          label="Work email"
          placeholder="you@company.com"
          type="email"
          required
          disabled={pending}
          error={fieldErrors.email}
          value={draft.email}
          onValueChange={(value) => {
            setDraft({ ...draft, email: value });
            setFieldErrors((current) => {
              const next = { ...current };
              delete next.email;
              return next;
            });
          }}
          onBlur={() => checkAvailability("email", draft.email)}
        />
        <Field
          id="password"
          name="password"
          label="Password"
          placeholder="At least 8 characters"
          type={showPassword ? "text" : "password"}
          required
          disabled={pending}
          error={fieldErrors.password}
          value={draft.password}
          onValueChange={(value) => setDraft({ ...draft, password: value })}
          trailingAction={{
            label: showPassword ? "Hide password" : "Show password",
            onClick: () => setShowPassword((current) => !current),
          }}
        />
        <Field
          id="confirm-password"
          name="confirmPassword"
          label="Confirm password"
          placeholder="Repeat your password"
          type={showConfirmPassword ? "text" : "password"}
          required
          disabled={pending}
          error={fieldErrors.confirmPassword}
          value={draft.confirmPassword}
          onValueChange={(value) => setDraft({ ...draft, confirmPassword: value })}
          trailingAction={{
            label: showConfirmPassword ? "Hide password" : "Show password",
            onClick: () => setShowConfirmPassword((current) => !current),
          }}
        />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            name="terms"
            type="checkbox"
            required
            disabled={pending}
            checked={draft.terms}
            onChange={(event) => setDraft({ ...draft, terms: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          I agree to the Terms and Privacy Policy.
        </label>
        {fieldErrors.terms && <p className="text-sm text-destructive">{fieldErrors.terms}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="h-11 w-full transition-all duration-200"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2 font-semibold">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Creating account…
            </span>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}

function Field({
  id,
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
  error,
  value,
  onValueChange,
  onBlur,
  trailingAction,
}: {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
  trailingAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={type}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`h-11 ${trailingAction ? "pr-16" : ""} ${error ? "border-destructive placeholder:text-destructive focus-visible:ring-destructive" : ""}`}
        />
        {trailingAction && (
          <button
            type="button"
            onClick={trailingAction.onClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary transition-all duration-200 hover:scale-105 hover:underline active:scale-95"
            aria-label={trailingAction.label}
          >
            {trailingAction.label.startsWith("Show") ? "Show" : "Hide"}
          </button>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
