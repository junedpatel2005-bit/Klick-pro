"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { AddressMapPicker } from "@/components/AddressMapPicker";
import { PhoneVerification } from "@/components/PhoneVerification";

type Location = { id: number; label: string; address: string };
type Data = {
  account: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    phoneVerifiedAt: string | null;
    avatarUrl: string | null;
    address: string | null;
  };
  profile: {
    companyName: string | null;
    address: string;
    profilePhotoUrl: string | null;
    savedLocations: Location[];
  } | null;
};
const emptyLocation = { label: "", address: "" };

export function ClientProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    address: "",
    profilePhotoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | typeof emptyLocation | null>(null);
  const [deleting, setDeleting] = useState<Location | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [saveCurrentLocation, setSaveCurrentLocation] = useState(false);
  const [showSetupReminder, setShowSetupReminder] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get("profileSetup") !== "1") return;
    setShowSetupReminder(true);
    const timeout = window.setTimeout(() => setShowSetupReminder(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  const initials = useMemo(
    () => `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase() || "C",
    [form.firstName, form.lastName],
  );
  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/profile");
      const result = (await response.json()) as Data & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load your profile.");
      setData(result);
      setForm({
        firstName: result.account.firstName,
        lastName: result.account.lastName,
        companyName: result.profile?.companyName ?? "",
        address: result.profile?.address ?? result.account.address ?? "",
        profilePhotoUrl: result.profile?.profilePhotoUrl ?? result.account.avatarUrl ?? "",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save profile.");
      setMessage("Profile updated successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }
  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const result = (await response.json()) as { avatarUrl?: string; error?: string };
      if (!response.ok || !result.avatarUrl)
        throw new Error(result.error ?? "Unable to upload photo.");
      setForm((current) => ({ ...current, profilePhotoUrl: result.avatarUrl ?? "" }));
      setMessage("Profile photo updated successfully.");
      window.dispatchEvent(new Event("servio:profile-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setAvatarUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }
  async function saveDetectedAddress(address: string) {
    setForm((current) => ({ ...current, address }));
    if (!saveCurrentLocation) return;
    setSaveCurrentLocation(false);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, address }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save your location.");
      setMessage("Your current location was saved automatically.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save your location.");
    }
  }
  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) return;
    setLocationSaving(true);
    setMessage(null);
    const isEditing = "id" in location;
    try {
      const response = await fetch(
        isEditing ? `/api/v1/profile/locations/${location.id}` : "/api/v1/profile/locations",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: location.label, address: location.address }),
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save location.");
      setLocation(null);
      setMessage(isEditing ? "Location updated successfully." : "Location added successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save location.");
    } finally {
      setLocationSaving(false);
    }
  }
  async function deleteLocation() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    setMessage(null);
    const response = await fetch(`/api/v1/profile/locations/${id}`, { method: "DELETE" });
    if (response.ok) {
      setMessage("Location deleted successfully.");
      await load();
    } else {
      const result = (await response.json()) as { error?: string };
      setMessage(result.error ?? "Unable to delete location.");
    }
  }
  if (loading)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-muted-foreground">Loading your profile…</p>
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="text-destructive">{message ?? "Profile unavailable."}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {showSetupReminder ? (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg"
        >
          <p className="font-semibold">Your profile setup is remaining.</p>
          <p className="mt-1 text-amber-800">Complete your profile to continue.</p>
        </div>
      ) : null}
      <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all">
        {/* Cover Canvas Banner */}
        <div className="relative h-40 sm:h-48 md:h-52 w-full overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.22),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.2),transparent_45%)]" />
          <div className="absolute -top-24 -right-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-52 w-52 rounded-full bg-cyan-400/15 blur-2xl" />

          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "28px 28px",
            }}
          />

          {/* Top Glass Badge */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Client Workspace</span>
          </div>
        </div>

        <div className="px-6 pb-7 sm:px-8 sm:pb-8">
          {/* Top Row: Avatar overlapping the banner */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
            <div className="relative inline-block shrink-0">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-3xl p-1 bg-card ring-4 ring-card shadow-2xl overflow-hidden">
                <Avatar className="h-full w-full rounded-[22px]">
                  <AvatarImage
                    src={form.profilePhotoUrl || undefined}
                    alt={`${form.firstName} ${form.lastName}`}
                    className="rounded-[22px] object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary/15 via-primary/5 to-accent/30 text-2xl sm:text-3xl font-bold font-display text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card ring-2 ring-card shadow-md">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </span>
            </div>
          </div>

          {/* Client Identity Info (100% cleanly below banner) */}
          <div className="mt-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {form.firstName || form.lastName
                  ? `${form.firstName} ${form.lastName}`.trim()
                  : "My Profile"}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                Client account
              </span>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Keep your details and service locations up to date so professionals can help you
              faster.
            </p>
          </div>
        </div>
      </header>
      {message && (
        <p role="status" className="rounded-md border px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <form onSubmit={saveProfile} className="space-y-6">
        <Section
          title="Personal Information"
          description="Details displayed with your client account."
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={form.profilePhotoUrl || undefined}
                alt={`${form.firstName} ${form.lastName}`}
              />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={avatarUploading}
                onClick={() => photoInputRef.current?.click()}
              >
                {avatarUploading ? "Uploading…" : "Upload photo"}
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP · Max 5 MB</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              value={form.firstName}
              onChange={(value) => setForm({ ...form, firstName: value })}
              required
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(value) => setForm({ ...form, lastName: value })}
              required
            />
            <Field
              label="Company name (optional)"
              value={form.companyName}
              onChange={(value) => setForm({ ...form, companyName: value })}
            />
          </div>
        </Section>
        <Section
          title="Contact Information"
          description="Contact details come from your authenticated account."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnly label="Email" value={data.account.email} />
            <PhoneVerification
              role="CLIENT"
              initialPhone={data.account.phone}
              onVerified={() => void load()}
            />
          </div>
        </Section>
        <Section
          title="Primary Address"
          description="Enter your complete service address. You can always type it manually."
        >
          <AddressMapPicker
            id="primary-address"
            value={form.address}
            onChange={(address) => void saveDetectedAddress(address)}
            onCurrentLocation={() => setSaveCurrentLocation(true)}
          />
        </Section>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save & Continue"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
            Skip for now
          </Button>
        </div>
      </form>
      <Section
        title="Saved Locations"
        description="Save addresses you frequently use when requesting services."
      >
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={() => setLocation(emptyLocation)}>
            Add new location
          </Button>
        </div>
        {data.profile?.savedLocations.length ? (
          <div className="space-y-3">
            {data.profile.savedLocations.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.address}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(item)}
                  >
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(item)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">No saved locations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Save an address to make future service requests faster.
            </p>
            <Button type="button" className="mt-4" onClick={() => setLocation(emptyLocation)}>
              Add location
            </Button>
          </div>
        )}
      </Section>
      <Dialog open={location !== null} onOpenChange={(open) => !open && setLocation(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {location && "id" in location ? "Edit saved location" : "Add saved location"}
            </DialogTitle>
            <DialogDescription>
              Give this address a label to find it quickly later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveLocation} className="space-y-4">
            {location && (
              <>
                <Field
                  label="Label"
                  value={location.label}
                  onChange={(value) => setLocation({ ...location, label: value })}
                  required
                />
                <AddressMapPicker
                  id="saved-location-address"
                  value={location.address}
                  onChange={(address) => setLocation({ ...location, address })}
                  onCurrentLocation={() =>
                    setLocation((current) =>
                      current && !current.label.trim()
                        ? { ...current, label: "Current location" }
                        : current,
                    )
                  }
                />
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLocation(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={locationSaving}>
                {locationSaving ? "Saving…" : "Save location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this location?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteLocation()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-soft sm:p-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        maxLength={type === "url" ? 2048 : 300}
      />
    </div>
  );
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="rounded-md bg-muted px-3 py-2 text-sm">{value}</p>
    </div>
  );
}
