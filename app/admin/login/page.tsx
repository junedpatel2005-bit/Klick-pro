"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Radio,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setPending(false);
        return setError(data.error ?? "Unable to sign in. Please verify your credentials.");
      }
      router.replace("/admin");
    } catch {
      setPending(false);
      setError("Network error. Please check your connection and try again.");
    }
  }

  const fillDemo = () => {
    setUsername("seed-admin");
    setPassword("ServioSeed#2026");
    setError("");
  };

  return (
    <main className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Subtle Background Glows (Zero black) */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-500/5 grid lg:grid-cols-[1.1fr_1fr]">
        {/* Left Brand Showcase (Luxury Indigo Gradient) */}
        <section className="relative hidden lg:flex lg:flex-col lg:justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 p-12 text-white overflow-hidden">
          {/* Decorative subtle ambient circles */}
          <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10">
            {/* Top Brand Tag */}
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-lg text-white tracking-tight">
                    Klick-Pro
                  </span>
                  <span className="rounded-md bg-white/20 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Console v2.4
                  </span>
                </div>
                <p className="text-xs text-indigo-100/80 font-medium">Enterprise Control Suite</p>
              </div>
            </div>

            {/* Main Heading */}
            <div className="mt-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/40 border border-indigo-400/30 px-3 py-1 text-xs font-semibold text-indigo-100">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                Real-Time Telemetry & Dispatch
              </span>
              <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white tracking-tight">
                Complete oversight of your service marketplace.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-indigo-100/80">
                Manage verifications, monitor active escrows, resolve client disputes, and oversee
                live marketplace operations.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="mt-10 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 transition hover:bg-white/15">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/20 text-white">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Trust & Compliance Engine</p>
                  <p className="text-[11px] text-indigo-100/80">
                    Automated Persona KYC check and manual document inspection.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-3.5 transition hover:bg-white/15">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/20 text-white">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Socket.IO Live Synchronization</p>
                  <p className="text-[11px] text-indigo-100/80">
                    Instant multi-channel push events and automatic data revalidation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Security Pill */}
          <div className="relative z-10 mt-12 flex items-center justify-between border-t border-white/15 pt-6 text-[11px] text-indigo-100/80">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Audited & TLS Encrypted
            </span>
            <span className="font-mono text-indigo-200/70">PRO-ADMIN-SESSION</span>
          </div>
        </section>

        {/* Right Form Card */}
        <section className="flex flex-col justify-between p-8 sm:p-12 lg:p-14 bg-white">
          <div>
            {/* Top Back Link */}
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition group"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
                <span>Return to Marketplace</span>
              </Link>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Restricted
              </span>
            </div>

            {/* Form Header */}
            <div className="mt-8">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Administrator Sign In
              </h2>
              <p className="mt-1.5 text-sm font-medium text-slate-500">
                Enter your administrative credentials to access the console.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={submit} className="mt-8 space-y-5">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Admin Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    autoFocus
                    type="text"
                    autoComplete="username"
                    value={username}
                    disabled={pending}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                    placeholder="Enter admin username"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    disabled={pending}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-11 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                    placeholder="Enter admin password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Demo Credentials Quick Fill */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={fillDemo}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50 shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  Auto-fill demo credentials
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-semibold text-rose-700 shadow-2xs">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={pending}
                className="group relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Verifying session…</span>
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-4 w-4 transition group-hover:scale-110" />
                    <span>Access Admin Portal</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Notice */}
          <p className="mt-8 text-center text-xs font-medium text-slate-400">
            For security, multiple failed login attempts will temporarily lock administrative
            access.
          </p>
        </section>
      </div>
    </main>
  );
}
