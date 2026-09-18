"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  MapPin,
  Lock,
  ClipboardList,
  LogOut,
} from "lucide-react";
import type { ClientAccountSummaryResponse } from "@/lib/types/client-account";

function formatName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function getCompletion(data: ClientAccountSummaryResponse) {
  const steps = [
    Boolean(data.account.firstName && data.account.lastName),
    Boolean(data.account.emailVerifiedAt),
    Boolean(data.account.phoneVerifiedAt),
    Boolean(data.profile?.address),
  ];
  const completed = steps.filter(Boolean).length;
  return {
    completed,
    total: steps.length,
    percentage: Math.round((completed / steps.length) * 100),
    steps: [
      { label: "Name added", done: steps[0] },
      { label: "Email verified", done: steps[1] },
      { label: "Phone verified", done: steps[2] },
      { label: "Primary address added", done: steps[3] },
    ],
  };
}

export function ClientMyInfoPage({ data }: { data: ClientAccountSummaryResponse }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [savedLocations, setSavedLocations] = useState(data.savedLocations);
  const [primaryLocationId, setPrimaryLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [primaryAddress, setPrimaryAddress] = useState(data.profile?.address || null);

  const completion = getCompletion(data);
  const initials =
    `${data.account.firstName[0] ?? ""}${data.account.lastName[0] ?? ""}`.toUpperCase();
  const profileName = formatName(data.account.firstName, data.account.lastName);
  const companyName = data.profile?.companyName || "Not added";

  async function setPrimaryLocation(location: (typeof savedLocations)[number]) {
    setPrimaryLocationId(location.id);
    setLocationError(null);

    try {
      const response = await fetch(`/api/v1/profile/locations/${location.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: location.label,
          address: location.address,
          isPrimary: true,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to set the primary location.");

      setSavedLocations((current) =>
        current.map((item) => ({ ...item, isPrimary: item.id === location.id })),
      );
      setPrimaryAddress(location.address);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "Unable to set the primary location.",
      );
    } finally {
      setPrimaryLocationId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <AppShell title="My Info">
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="flex items-center justify-center">
              <Avatar className="h-24 w-24">
                {data.account.avatarUrl ? (
                  <AvatarImage src={data.account.avatarUrl} alt={profileName} />
                ) : (
                  <AvatarFallback className="text-2xl">{initials || "U"}</AvatarFallback>
                )}
              </Avatar>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Account overview</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">{profileName}</h2>
                  <p className="text-sm text-muted-foreground">Client</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/client-profile?from=dashboard">Edit profile</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Profile completion
                      </p>
                      <p className="text-lg font-semibold">{completion.percentage}% complete</p>
                    </div>
                    <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      {data.account.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${completion.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {completion.steps.map((step) => (
                    <div
                      key={step.label}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm"
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Client identity and company details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <KeyValue label="First name" value={data.account.firstName} />
                  <KeyValue label="Last name" value={data.account.lastName} />
                </div>
                <KeyValue label="Company name" value={companyName} fallback="Not added" />
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                  <Link href="/client-profile?from=dashboard">Edit profile</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Verified account contact details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ContactRow
                  label="Email"
                  value={data.account.email}
                  state={data.account.emailVerifiedAt ? "verified" : "unverified"}
                  action={
                    data.account.emailVerifiedAt ? null : (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/verify">Verify</Link>
                      </Button>
                    )
                  }
                />
                <ContactRow
                  label="Phone"
                  value={data.account.phone ?? "Not added"}
                  state={data.account.phoneVerifiedAt ? "verified" : "unverified"}
                  action={null}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primary Address</CardTitle>
                <CardDescription>Where you want work to be arranged or managed.</CardDescription>
              </CardHeader>
              <CardContent>
                {primaryAddress ? (
                  <p className="text-sm leading-relaxed text-foreground">{primaryAddress}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No primary address added.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Locations</CardTitle>
                <CardDescription>Preview of your saved addresses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedLocations.length > 0 ? (
                  savedLocations.map((location) => (
                    <div key={location.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">
                            {location.label}
                            {location.isPrimary ? (
                              <span className="ml-2 text-xs font-semibold text-primary">
                                Primary
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted-foreground">{location.address}</p>
                        </div>
                        {!location.isPrimary ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void setPrimaryLocation(location)}
                            disabled={primaryLocationId !== null}
                          >
                            {primaryLocationId === location.id ? "Setting…" : "Set as primary"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No saved locations yet.</p>
                )}
                {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Activity</CardTitle>
                <CardDescription>Quick counts from your client jobs.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <StatRow label="Open jobs" value={data.jobCounts.open} />
                <StatRow label="Draft jobs" value={data.jobCounts.draft} />
                <StatRow label="Closed jobs" value={data.jobCounts.closed} />
              </CardContent>
              <CardFooter>
                <Button asChild size="sm">
                  <Link href="/my-jobs">View Projects</Link>
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your account security settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">••••••••••••••</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/forgot-password">Forgot password</Link>
                  </Button>
                </div>
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  Password changes use the existing reset flow; no password hash is shown.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Account status</p>
            <p className="font-semibold">{data.account.isActive ? "Active" : "Inactive"}</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function KeyValue({
  label,
  value,
  fallback,
}: {
  label: string;
  value: string | null;
  fallback?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || fallback || "—"}</p>
    </div>
  );
}

function ContactRow({
  label,
  value,
  state,
  action,
}: {
  label: string;
  value: string;
  state: "verified" | "unverified";
  action: React.ReactNode | null;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-foreground">{value}</p>
        <p
          className={`mt-2 text-sm ${state === "verified" ? "text-success" : "text-muted-foreground"}`}
        >
          {state === "verified" ? "✓ Verified" : "Not verified"}
        </p>
      </div>
      {action ? <div className="flex items-center">{action}</div> : null}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
