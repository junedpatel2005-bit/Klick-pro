"use client";

import Link from "next/link";
import { invalidateCurrentUser } from "@/lib/current-user";
import { useRef, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  MapPin,
  Lock,
  ClipboardList,
  LogOut,
  Camera,
  Edit3,
  Plus,
  Trash2,
  Heart,
  Building2,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react";
import type { ClientAccountSummaryResponse } from "@/lib/types/client-account";
import { toast } from "sonner";
import { PhoneVerification } from "@/components/PhoneVerification";
import { AddressMapPicker } from "@/components/AddressMapPicker";

function formatName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function getCompletion(data: {
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  address: string | null;
}) {
  const steps = [
    Boolean(data.firstName && data.lastName),
    Boolean(data.emailVerifiedAt),
    Boolean(data.phoneVerifiedAt),
    Boolean(data.address),
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core account state
  const [firstName, setFirstName] = useState(data.account.firstName);
  const [lastName, setLastName] = useState(data.account.lastName);
  const [companyName, setCompanyName] = useState(data.profile?.companyName || "");
  const [avatarUrl, setAvatarUrl] = useState(data.account.avatarUrl);
  const [phone, setPhone] = useState(data.account.phone);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState(data.account.phoneVerifiedAt);
  const [primaryAddress, setPrimaryAddress] = useState(data.profile?.address || null);

  // Saved locations state
  const [savedLocations, setSavedLocations] = useState(data.savedLocations);
  const [primaryLocationId, setPrimaryLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<number | null>(null);

  // Dialog & Form states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(false);

  // Form draft states
  const [draftFirstName, setDraftFirstName] = useState(firstName);
  const [draftLastName, setDraftLastName] = useState(lastName);
  const [draftCompanyName, setDraftCompanyName] = useState(companyName);
  const [draftAddress, setDraftAddress] = useState(primaryAddress || "");

  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");

  // Loading states (local to buttons, NO whole-page blocker)
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const completion = getCompletion({
    firstName,
    lastName,
    emailVerifiedAt: data.account.emailVerifiedAt,
    phoneVerifiedAt,
    address: primaryAddress,
  });

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "C";
  const profileName = formatName(firstName, lastName);

  function openEditModal() {
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
    setDraftCompanyName(companyName);
    setDraftAddress(primaryAddress || "");
    setEditProfileOpen(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!draftFirstName.trim() || !draftLastName.trim()) {
      toast.error("First name and last name are required.");
      return;
    }
    setSavingProfile(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: draftFirstName.trim(),
          lastName: draftLastName.trim(),
          companyName: draftCompanyName.trim() || null,
          address: draftAddress.trim() || primaryAddress || "Default location",
          profilePhotoUrl: avatarUrl || null,
          phone: phone || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save profile details.");
      }

      setFirstName(draftFirstName.trim());
      setLastName(draftLastName.trim());
      setCompanyName(draftCompanyName.trim());
      if (draftAddress.trim()) {
        setPrimaryAddress(draftAddress.trim());
      }
      setEditProfileOpen(false);
      toast.success("Profile details updated successfully!");
      window.dispatchEvent(new Event("servio:profile-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const result = (await response.json()) as { avatarUrl?: string; error?: string };
      if (!response.ok || !result.avatarUrl) {
        throw new Error(result.error ?? "Unable to upload photo.");
      }
      setAvatarUrl(result.avatarUrl);
      toast.success("Profile photo updated successfully!");
      window.dispatchEvent(new Event("servio:profile-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function setPrimaryLocation(location: (typeof savedLocations)[number]) {
    setPrimaryLocationId(location.id);
    setLocationError(null);

    try {
      const response = await fetch(`/api/profile/locations/${location.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: location.label,
          address: location.address,
          isPrimary: true,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to set primary location.");

      setSavedLocations((current) =>
        current.map((item) => ({ ...item, isPrimary: item.id === location.id })),
      );
      setPrimaryAddress(location.address);
      toast.success(`"${location.label}" set as primary address.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to set primary location.";
      setLocationError(msg);
      toast.error(msg);
    } finally {
      setPrimaryLocationId(null);
    }
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLocationLabel.trim() || !newLocationAddress.trim()) {
      toast.error("Please provide both label and address.");
      return;
    }
    setSavingLocation(true);
    try {
      const response = await fetch("/api/profile/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: newLocationLabel.trim(),
          address: newLocationAddress.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to save location.");
      if (result.location) {
        setSavedLocations((prev) => [result.location, ...prev]);
        if (result.location.isPrimary) {
          setPrimaryAddress(result.location.address);
        }
      }
      setNewLocationLabel("");
      setNewLocationAddress("");
      setAddLocationOpen(false);
      toast.success("Location saved successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location.");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleDeleteLocation(id: number, label: string) {
    setDeletingLocationId(id);
    try {
      const response = await fetch(`/api/profile/locations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const res = await response.json().catch(() => ({}));
        throw new Error(res.error ?? "Failed to remove location.");
      }
      setSavedLocations((prev) => prev.filter((loc) => loc.id !== id));
      toast.success(`Removed "${label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove location.");
    } finally {
      setDeletingLocationId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    invalidateCurrentUser();
    router.replace("/login");
  }

  const userForShell = {
    firstName: firstName || data.account.firstName,
    lastName: lastName || data.account.lastName,
    email: data.account.email,
    role: "CLIENT",
    avatarUrl: avatarUrl || data.account.avatarUrl,
  };

  return (
    <AppShell title="My Info & Profile" initialUser={userForShell} backHref="/dashboard">
      <div className="grid gap-6">
        {/* Hidden photo file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAvatar(file);
          }}
        />

        {/* Header Hero Card */}
        <Card className="overflow-hidden border-border/80 shadow-soft">
          <CardContent className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative group">
                <Avatar className="h-28 w-28 ring-4 ring-primary/10 shadow-md">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={profileName} />
                  ) : (
                    <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label="Upload profile photo"
                  className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:scale-105 active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs text-muted-foreground hover:text-foreground h-7"
              >
                {avatarUploading ? "Uploading…" : "Change photo"}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">Client Workspace</p>
                    <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[11px] font-semibold">
                      Verified Client
                    </span>
                  </div>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {profileName}
                  </h2>
                  {companyName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>{companyName}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={openEditModal} size="sm" className="gap-2">
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                </div>
              </div>

              {/* Profile Completion Bar */}
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Profile completeness
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {completion.percentage}% complete
                      </p>
                    </div>
                    <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                      {data.account.isActive ? "Active Account" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${completion.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {completion.steps.map((step) => (
                    <div
                      key={step.label}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={
                          step.done ? "text-foreground font-medium" : "text-muted-foreground"
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Columns */}
        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="grid gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
                  <CardDescription>Your legal identity and business information.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={openEditModal} className="gap-1.5 h-8">
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <KeyValue label="First name" value={firstName} />
                  <KeyValue label="Last name" value={lastName} />
                </div>
                <KeyValue label="Company name" value={companyName} fallback="Not provided" />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Contact Information</CardTitle>
                <CardDescription>
                  Verified account contact details for communications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <ContactRow
                  label="Email address"
                  value={data.account.email}
                  state={data.account.emailVerifiedAt ? "verified" : "unverified"}
                  action={
                    data.account.emailVerifiedAt ? null : (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/verify">Verify Email</Link>
                      </Button>
                    )
                  }
                />
                <ContactRow
                  label="Phone number"
                  value={phone ?? "Not added"}
                  state={phoneVerifiedAt ? "verified" : "unverified"}
                  action={
                    phoneVerifiedAt ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPhoneVerificationOpen(true)}
                      >
                        {phone ? "Verify Phone" : "Add Phone"}
                      </Button>
                    )
                  }
                />
              </CardContent>
            </Card>

            {/* Primary Address */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Primary Address</CardTitle>
                  <CardDescription>Default job location for project matching.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={openEditModal} className="gap-1.5 h-8">
                  <MapPin className="h-3.5 w-3.5" />
                  Change
                </Button>
              </CardHeader>
              <CardContent className="pt-2">
                {primaryAddress ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {primaryAddress}
                      </p>
                      <span className="inline-block mt-2 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        Default Primary
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">No primary address added yet.</p>
                    <Button variant="outline" size="sm" onClick={openEditModal} className="mt-3">
                      Add Primary Address
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Professionals Section */}
            <Card className="border-rose-100 dark:border-rose-950/40">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/40">
                    <Heart className="h-4 w-4 fill-rose-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Saved Professionals</CardTitle>
                    <CardDescription>
                      Your favorite bookmarked experts on Klick-Pro.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50"
                >
                  <Link href="/discover?saved=true">
                    <span>View Saved Pros</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Quickly hire or send project proposals to professionals you have bookmarked.
                  Filter by your saved list on the discovery page anytime.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            {/* Saved Locations */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Saved Locations</CardTitle>
                  <CardDescription>Addresses saved for quick job dispatching.</CardDescription>
                </div>
                {savedLocations.length < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddLocationOpen(true)}
                    className="gap-1.5 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {savedLocations.length > 0 ? (
                  savedLocations.map((location) => (
                    <div key={location.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground">
                              {location.label}
                            </p>
                            {location.isPrimary ? (
                              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                                Primary
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {location.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!location.isPrimary && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2.5"
                              onClick={() => void setPrimaryLocation(location)}
                              disabled={primaryLocationId !== null}
                            >
                              {primaryLocationId === location.id ? "Setting…" : "Set Primary"}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => void handleDeleteLocation(location.id, location.label)}
                            disabled={deletingLocationId === location.id}
                            aria-label={`Delete ${location.label}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No saved locations yet.</p>
                )}
                {locationError ? <p className="text-sm text-destructive">{locationError}</p> : null}
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Project Activity</CardTitle>
                <CardDescription>Live stats across all your client jobs.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2.5 pt-2">
                <StatRow label="Active / Open jobs" value={data.jobCounts.open} />
                <StatRow label="Draft jobs" value={data.jobCounts.draft} />
                <StatRow label="Completed / Closed jobs" value={data.jobCounts.closed} />
              </CardContent>
              <CardFooter className="pt-2">
                <Button asChild size="sm" className="w-full">
                  <Link href="/my-jobs">View All Projects</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Security &amp; Credentials</CardTitle>
                <CardDescription>Manage password and authentication settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">••••••••••••••</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/forgot-password">Reset password</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Account Status</p>
            <p className="text-sm font-semibold">
              {data.account.isActive ? "Active and Verified" : "Inactive"}
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile Information</DialogTitle>
            <DialogDescription>
              Update your personal name, company, and primary address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="draftFirstName">First Name</Label>
                <Input
                  id="draftFirstName"
                  value={draftFirstName}
                  onChange={(e) => setDraftFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="draftLastName">Last Name</Label>
                <Input
                  id="draftLastName"
                  value={draftLastName}
                  onChange={(e) => setDraftLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="draftCompanyName">Company Name (Optional)</Label>
              <Input
                id="draftCompanyName"
                value={draftCompanyName}
                onChange={(e) => setDraftCompanyName(e.target.value)}
                placeholder="e.g. Acme Innovations Ltd."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="draftAddress">Primary Address</Label>
              <Input
                id="draftAddress"
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
                placeholder="Street address, city, state, postal code"
                required
              />
              <p className="text-xs text-muted-foreground">
                This is the default location used when calculating distance to local professionals.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditProfileOpen(false)}
                disabled={savingProfile}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving Details…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add New Location Modal Dialog */}
      <Dialog open={addLocationOpen} onOpenChange={setAddLocationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Saved Location</DialogTitle>
            <DialogDescription>
              Save an address you frequently dispatch jobs to (e.g. Home, Branch Office).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLocation} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="newLocLabel">Location Label</Label>
              <Input
                id="newLocLabel"
                value={newLocationLabel}
                onChange={(e) => setNewLocationLabel(e.target.value)}
                placeholder="e.g. Main Office, Warehouse, Home"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newLocAddress">Complete Address</Label>
              <Input
                id="newLocAddress"
                value={newLocationAddress}
                onChange={(e) => setNewLocationAddress(e.target.value)}
                placeholder="Street, area, city, state, PIN"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddLocationOpen(false)}
                disabled={savingLocation}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingLocation}>
                {savingLocation ? "Adding Location…" : "Save Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Dialog */}
      <Dialog open={phoneVerificationOpen} onOpenChange={setPhoneVerificationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription>
              Enter and verify your mobile number for secure transaction alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <PhoneVerification
              role="CLIENT"
              initialPhone={phone}
              onVerified={() => {
                setPhoneVerifiedAt(new Date().toISOString());
                setPhoneVerificationOpen(false);
                toast.success("Phone verified successfully!");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
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
      <p className="mt-1 text-sm font-medium text-foreground">{value || fallback || "—"}</p>
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
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
        <p
          className={`mt-1.5 text-xs font-semibold ${
            state === "verified" ? "text-success" : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {state === "verified" ? "✓ Verified" : "Action Required: Not Verified"}
        </p>
      </div>
      {action ? <div className="flex items-center">{action}</div> : null}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-base font-bold text-foreground">{value}</span>
    </div>
  );
}
