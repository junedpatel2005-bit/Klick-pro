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
  Copy,
  Check,
  Globe,
  X,
  Sparkles,
  ArrowRight,
  Clock,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import type { ClientAccountSummaryResponse } from "@/lib/types/client-account";
import { toast } from "sonner";
import { PhoneVerification } from "@/components/PhoneVerification";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import { getAllStates, inferLocationFromAddress } from "@/lib/india-locations";

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

  const initialInferred = inferLocationFromAddress(data.profile?.address);
  const [primaryState, setPrimaryState] = useState<string>(initialInferred.state || "");
  const [primaryCity, setPrimaryCity] = useState<string>(initialInferred.district || "");
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Saved locations state
  const [savedLocations, setSavedLocations] = useState(data.savedLocations);
  const [primaryLocationId, setPrimaryLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<number | null>(null);

  // Per-Box Editing States (Clean inline modes)
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);

  // Phone verification modal
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(false);

  // Form draft states for Personal Info
  const [draftFirstName, setDraftFirstName] = useState(firstName);
  const [draftLastName, setDraftLastName] = useState(lastName);
  const [draftCompanyName, setDraftCompanyName] = useState(companyName);

  // Form draft states for Primary Address
  const [draftAddress, setDraftAddress] = useState(primaryAddress || "");
  const [draftManualAddress, setDraftManualAddress] = useState(primaryAddress || "");
  const [draftState, setDraftState] = useState(primaryState);
  const [draftCity, setDraftCity] = useState(primaryCity);

  // Form draft states for Saved Location
  const [locLabel, setLocLabel] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locManualAddress, setLocManualAddress] = useState("");
  const [locState, setLocState] = useState("");
  const [locCity, setLocCity] = useState("");

  // Loading states
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
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

  // Start editing personal details
  function startEditPersonal() {
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
    setDraftCompanyName(companyName);
    setEditingPersonal(true);
  }

  // Start editing primary address
  function startEditAddress() {
    const inf = inferLocationFromAddress(primaryAddress);
    setDraftAddress(primaryAddress || "");
    setDraftManualAddress(primaryAddress || "");
    setDraftState(primaryState || inf.state || "");
    setDraftCity(primaryCity || inf.district || "");
    setEditingAddress(true);
  }

  // Start adding a new saved location
  function startAddLocation() {
    setLocLabel("");
    setLocAddress("");
    setLocManualAddress("");
    setLocState("");
    setLocCity("");
    setEditingLocationId(null);
    setAddingLocation(true);
  }

  // Start editing an existing saved location
  function startEditSavedLocation(loc: (typeof savedLocations)[number]) {
    const inf = inferLocationFromAddress(loc.address);
    setLocLabel(loc.label);
    setLocAddress(loc.address);
    setLocManualAddress(loc.address);
    setLocState(inf.state || "");
    setLocCity(inf.district || "");
    setAddingLocation(false);
    setEditingLocationId(loc.id);
  }

  // Save personal information
  async function handleSavePersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!draftFirstName.trim() || !draftLastName.trim()) {
      toast.error("First name and last name are required.");
      return;
    }
    setSavingPersonal(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: draftFirstName.trim(),
          lastName: draftLastName.trim(),
          companyName: draftCompanyName.trim() || null,
          address: primaryAddress || "Default location",
          profilePhotoUrl: avatarUrl || null,
          phone: phone || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save personal details.");
      }

      setFirstName(draftFirstName.trim());
      setLastName(draftLastName.trim());
      setCompanyName(draftCompanyName.trim());
      setEditingPersonal(false);
      toast.success("Personal details updated successfully!");
      window.dispatchEvent(new Event("servio:profile-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSavingPersonal(false);
    }
  }

  // Save primary address & location
  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    const finalAddress = (draftManualAddress.trim() || draftAddress.trim()).trim();
    if (!finalAddress) {
      toast.error("Please provide a valid address.");
      return;
    }
    setSavingAddress(true);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim() || null,
          address: finalAddress,
          profilePhotoUrl: avatarUrl || null,
          phone: phone || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save address.");
      }

      setPrimaryAddress(finalAddress);
      setPrimaryState(draftState);
      setPrimaryCity(draftCity);
      if (result.primaryLocation) {
        setSavedLocations((current) => {
          const exists = current.some((item) => item.id === result.primaryLocation.id);
          if (exists) {
            return current.map((item) =>
              item.id === result.primaryLocation.id
                ? { ...item, ...result.primaryLocation }
                : { ...item, isPrimary: false },
            );
          }
          return [
            result.primaryLocation,
            ...current.map((item) => ({ ...item, isPrimary: false })),
          ];
        });
      }
      setEditingAddress(false);
      toast.success("Primary location updated successfully!");
      window.dispatchEvent(new Event("servio:profile-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update address.");
    } finally {
      setSavingAddress(false);
    }
  }

  // Save or Update saved location
  async function handleSaveSavedLocation(e: React.FormEvent) {
    e.preventDefault();
    const finalAddress = (locManualAddress.trim() || locAddress.trim()).trim();
    if (!locLabel.trim() || !finalAddress) {
      toast.error("Please provide both label and address.");
      return;
    }
    setSavingLocation(true);

    try {
      if (editingLocationId) {
        // PATCH existing location
        const target = savedLocations.find((l) => l.id === editingLocationId);
        const response = await fetch(`/api/profile/locations/${editingLocationId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: locLabel.trim(),
            address: finalAddress,
            isPrimary: target?.isPrimary ?? false,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Failed to update location.");
        setSavedLocations((prev) =>
          prev.map((loc) => (loc.id === editingLocationId ? result.location : loc)),
        );
        if (result.location.isPrimary) {
          setPrimaryAddress(result.location.address);
          const inf = inferLocationFromAddress(result.location.address);
          setPrimaryState(inf.state || "");
          setPrimaryCity(inf.district || "");
        }
        setEditingLocationId(null);
        toast.success("Location updated successfully!");
      } else {
        // POST new location
        const response = await fetch("/api/profile/locations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: locLabel.trim(),
            address: finalAddress,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Failed to save location.");
        if (result.location) {
          setSavedLocations((prev) => [result.location, ...prev]);
          if (result.location.isPrimary) {
            setPrimaryAddress(result.location.address);
            const inf = inferLocationFromAddress(result.location.address);
            setPrimaryState(inf.state || "");
            setPrimaryCity(inf.district || "");
          }
        }
        setAddingLocation(false);
        toast.success("Location saved successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location.");
    } finally {
      setSavingLocation(false);
    }
  }

  // Upload Avatar
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

  // Set primary location
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
      const inf = inferLocationFromAddress(location.address);
      setPrimaryState(inf.state || "");
      setPrimaryCity(inf.district || "");
      toast.success(`"${location.label}" set as primary address.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to set primary location.";
      setLocationError(msg);
      toast.error(msg);
    } finally {
      setPrimaryLocationId(null);
    }
  }

  // Delete saved location
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

  // Sign out
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      invalidateCurrentUser();
      router.push("/login");
    } catch {
      toast.error("Failed to sign out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <AppShell title="My Information">
      <div className="mx-auto max-w-6xl space-y-6 pb-12 pt-4">
        {/* Hidden Photo Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAvatar(file);
          }}
        />

        {/* Profile Header Banner Card */}
        <Card className="overflow-hidden border border-border/70 shadow-sm">
          <div className="h-28 sm:h-32 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_50%)]" />
            <div className="absolute top-3 right-4 flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/15">
                {data.account.isActive ? "Active Account" : "Pending Verification"}
              </span>
            </div>
          </div>

          <CardContent className="relative px-6 pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="relative group shrink-0 -mt-12 sm:-mt-14">
                  <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background bg-card shadow-md">
                    <AvatarImage
                      src={avatarUrl ?? undefined}
                      alt={profileName}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold rounded-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute bottom-1 right-1 rounded-xl bg-primary text-primary-foreground p-2 shadow-md hover:bg-primary/90 transition-transform active:scale-95"
                    title="Change profile photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>

                <div className="pt-2 sm:pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                      {profileName}
                    </h1>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Verified Client
                    </span>
                  </div>
                  {companyName && (
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{companyName}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{data.account.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-3">
                <Button asChild variant="outline" size="sm" className="h-9">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="h-9 gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </div>

            {/* Profile Completion Bar */}
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Profile Completeness
                </span>
                <span className="font-bold text-primary">{completion.percentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completion.percentage}%` }}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                {completion.steps.map((st) => (
                  <div key={st.label} className="flex items-center gap-1.5 text-muted-foreground">
                    {st.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className={st.done ? "text-foreground font-medium" : ""}>{st.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid: 2 Balanced Columns */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column (Primary Details & Maps) */}
          <div className="space-y-6 lg:col-span-7">
            {/* BOX 1: Personal Information */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
                  <CardDescription>Your name and optional business affiliation.</CardDescription>
                </div>
                {!editingPersonal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditPersonal}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-2">
                {editingPersonal ? (
                  <form onSubmit={handleSavePersonal} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="draftFirst" className="text-xs font-semibold">
                          First Name
                        </Label>
                        <Input
                          id="draftFirst"
                          value={draftFirstName}
                          onChange={(e) => setDraftFirstName(e.target.value)}
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="draftLast" className="text-xs font-semibold">
                          Last Name
                        </Label>
                        <Input
                          id="draftLast"
                          value={draftLastName}
                          onChange={(e) => setDraftLastName(e.target.value)}
                          placeholder="Last name"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="draftCompany" className="text-xs font-semibold">
                        Company Name (Optional)
                      </Label>
                      <Input
                        id="draftCompany"
                        value={draftCompanyName}
                        onChange={(e) => setDraftCompanyName(e.target.value)}
                        placeholder="e.g. Acme Industries Ltd."
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPersonal(false)}
                        disabled={savingPersonal}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={savingPersonal}>
                        {savingPersonal ? "Saving…" : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          First Name
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{firstName}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Last Name
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{lastName}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Company Name
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {companyName || "Not specified"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BOX 2: Primary Address & Location (HERO LOCATION BOX) */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Primary Address &amp; Location
                  </CardTitle>
                  <CardDescription>
                    Your primary service dispatch area and project matching location.
                  </CardDescription>
                </div>
                {!editingAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditAddress}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Change Location
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-2">
                {editingAddress ? (
                  <form onSubmit={handleSaveAddress} className="space-y-4">
                    {/* Notice for user */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                      Drag the pin on the map or use your current location. City and State are
                      automatically detected and you can refine the complete manual address below.
                    </div>

                    {/* 1. MAP FIRST! */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground">
                        Interactive Map Location (Drag Pin)
                      </Label>
                      <AddressMapPicker
                        id="primary-location-picker"
                        value={draftAddress}
                        onChange={(addr) => {
                          setDraftAddress(addr);
                          setDraftManualAddress(addr);
                        }}
                        onLocationChange={(newState, newCity) => {
                          if (newState) setDraftState(newState);
                          if (newCity) setDraftCity(newCity);
                        }}
                        mapFirst={true}
                        showManualAddress={false}
                      />
                    </div>

                    {/* 2. State & City Inputs */}
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="primaryState" className="text-xs font-semibold">
                          State
                        </Label>
                        <select
                          id="primaryState"
                          value={draftState}
                          onChange={(e) => setDraftState(e.target.value)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Select state...</option>
                          {getAllStates().map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="primaryCity" className="text-xs font-semibold">
                          City / District
                        </Label>
                        <Input
                          id="primaryCity"
                          value={draftCity}
                          onChange={(e) => setDraftCity(e.target.value)}
                          placeholder="Auto-detected from map"
                        />
                      </div>
                    </div>

                    {/* 3. Manual Address Entry */}
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="primaryManualAddress" className="text-xs font-semibold">
                        Complete Address (Manual entry / edit)
                      </Label>
                      <Input
                        id="primaryManualAddress"
                        value={draftManualAddress}
                        onChange={(e) => setDraftManualAddress(e.target.value)}
                        placeholder="Flat / House no., building name, street, area, PIN code"
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Type your precise door, flat, or building number to accompany the map
                        coordinates.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAddress(false)}
                        disabled={savingAddress}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={savingAddress}>
                        {savingAddress ? "Saving Location…" : "Save Address & Location"}
                      </Button>
                    </div>
                  </form>
                ) : primaryAddress ? (
                  <div className="space-y-3">
                    {/* City and State Badges */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          <span>City / District</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-foreground truncate">
                          {primaryCity || initialInferred.district || "Detected from address"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Globe className="h-3.5 w-3.5 text-primary" />
                          <span>State</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-foreground truncate">
                          {primaryState || initialInferred.state || "Detected from address"}
                        </p>
                      </div>
                    </div>

                    {/* Complete Address & Actions */}
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-relaxed text-foreground">
                            {primaryAddress}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              Default Primary
                            </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open in Google Maps
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(primaryAddress);
                                setCopiedAddress(true);
                                setTimeout(() => setCopiedAddress(false), 2000);
                                toast.success("Address copied to clipboard!");
                              }}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedAddress ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Embedded Map Preview */}
                    <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
                      <iframe
                        title="Primary address location map"
                        className="h-[200px] w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(primaryAddress)}&z=15&output=embed`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">No primary address added yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditAddress}
                      className="mt-3 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Primary Address
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BOX 3: Saved Locations */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">Saved Locations</CardTitle>
                  <CardDescription>
                    Up to 3 saved addresses for rapid job dispatching.
                  </CardDescription>
                </div>
                {!addingLocation && editingLocationId === null && savedLocations.length < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startAddLocation}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Location
                  </Button>
                )}
              </CardHeader>

              <CardContent className="pt-2 space-y-4">
                {/* Form to Add or Edit Saved Location */}
                {(addingLocation || editingLocationId !== null) && (
                  <form
                    onSubmit={handleSaveSavedLocation}
                    className="rounded-xl border border-primary/30 bg-card p-4 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h4 className="text-sm font-semibold text-foreground">
                        {editingLocationId ? "Edit Saved Location" : "Add New Saved Location"}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setAddingLocation(false);
                          setEditingLocationId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="locLabel" className="text-xs font-semibold">
                        Location Label
                      </Label>
                      <Input
                        id="locLabel"
                        value={locLabel}
                        onChange={(e) => setLocLabel(e.target.value)}
                        placeholder="e.g. Home, Branch Office, Warehouse"
                        required
                      />
                    </div>

                    {/* 1. MAP FIRST */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Map Location (Drag Pin)</Label>
                      <AddressMapPicker
                        id="saved-loc-picker"
                        value={locAddress}
                        onChange={(addr) => {
                          setLocAddress(addr);
                          setLocManualAddress(addr);
                        }}
                        onLocationChange={(newState, newCity) => {
                          if (newState) setLocState(newState);
                          if (newCity) setLocCity(newCity);
                        }}
                        mapFirst={true}
                        showManualAddress={false}
                      />
                    </div>

                    {/* 2. State & City */}
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="locState" className="text-xs font-semibold">
                          State
                        </Label>
                        <select
                          id="locState"
                          value={locState}
                          onChange={(e) => setLocState(e.target.value)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Select state...</option>
                          {getAllStates().map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="locCity" className="text-xs font-semibold">
                          City / District
                        </Label>
                        <Input
                          id="locCity"
                          value={locCity}
                          onChange={(e) => setLocCity(e.target.value)}
                          placeholder="Auto-detected from map"
                        />
                      </div>
                    </div>

                    {/* 3. Manual Address Entry */}
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="locManualAddress" className="text-xs font-semibold">
                        Complete Address (Manual entry / edit)
                      </Label>
                      <Input
                        id="locManualAddress"
                        value={locManualAddress}
                        onChange={(e) => setLocManualAddress(e.target.value)}
                        placeholder="Flat / House no., street, area, PIN code"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddingLocation(false);
                          setEditingLocationId(null);
                        }}
                        disabled={savingLocation}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={savingLocation}>
                        {savingLocation ? "Saving…" : "Save Location"}
                      </Button>
                    </div>
                  </form>
                )}

                {/* List of Saved Locations */}
                {savedLocations.length > 0 ? (
                  <div className="space-y-3">
                    {savedLocations.map((loc) => {
                      const inf = inferLocationFromAddress(loc.address);
                      const locParts = [inf.district, inf.state].filter(Boolean);
                      return (
                        <div
                          key={loc.id}
                          className="rounded-xl border border-border/80 bg-card p-3.5 transition-colors hover:border-primary/40"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm text-foreground">{loc.label}</p>
                                {loc.isPrimary ? (
                                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                                    Primary
                                  </span>
                                ) : null}
                              </div>

                              {locParts.length > 0 && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs text-primary font-medium">
                                  <MapPin className="h-3 w-3" />
                                  <span>{locParts.join(", ")}</span>
                                </div>
                              )}

                              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                {loc.address}
                              </p>

                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View on Google Maps
                              </a>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                              {!loc.isPrimary && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  onClick={() => void setPrimaryLocation(loc)}
                                  disabled={primaryLocationId !== null}
                                >
                                  {primaryLocationId === loc.id ? "Setting…" : "Set Primary"}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() => startEditSavedLocation(loc)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => void handleDeleteLocation(loc.id, loc.label)}
                                disabled={deletingLocationId === loc.id}
                                aria-label={`Delete ${loc.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No additional saved locations yet. You can add up to 3 dispatch addresses.
                  </p>
                )}

                {locationError && <p className="text-xs text-destructive">{locationError}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Contact, Projects & Security) */}
          <div className="space-y-6 lg:col-span-5">
            {/* BOX 4: Contact Information */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Contact &amp; Verification
                </CardTitle>
                <CardDescription>Verified credentials for account security.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {/* Email Row */}
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email Address</p>
                      <p className="text-sm font-semibold text-foreground truncate max-w-[170px] sm:max-w-xs">
                        {data.account.email}
                      </p>
                    </div>
                  </div>
                  {data.account.emailVerifiedAt ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href="/verify">Verify</Link>
                    </Button>
                  )}
                </div>

                {/* Phone Row */}
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone Number</p>
                      <p className="text-sm font-semibold text-foreground">
                        {phone ?? "Not added"}
                      </p>
                    </div>
                  </div>
                  {phoneVerifiedAt ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Verified
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPhoneVerificationOpen(true)}
                      className="h-7 text-xs"
                    >
                      {phone ? "Verify Phone" : "Add Phone"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* BOX 5: Project Activity */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Project Activity</CardTitle>
                <CardDescription>Live overview across all your client jobs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground font-medium">Active / Open Jobs</span>
                  <span className="font-bold text-foreground">{data.jobCounts.open}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground font-medium">Draft Jobs</span>
                  <span className="font-bold text-foreground">{data.jobCounts.draft}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground font-medium">Completed Jobs</span>
                  <span className="font-bold text-foreground">{data.jobCounts.closed}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button asChild size="sm" className="w-full h-8 text-xs">
                  <Link href="/my-jobs">View All Projects</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* BOX 6: Saved Professionals */}
            <Card className="border border-rose-200/60 dark:border-rose-950/40 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/40">
                    <Heart className="h-4 w-4 fill-rose-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Saved Professionals</CardTitle>
                    <CardDescription className="text-xs">Bookmarked experts</CardDescription>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 h-7 text-xs"
                >
                  <Link href="/discover?saved=true">
                    <span>View All</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Quickly hire or send proposals to professionals you have previously bookmarked on
                  Klick-Pro.
                </p>
              </CardContent>
            </Card>

            {/* BOX 7: Security & Password */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Security</CardTitle>
                <CardDescription>Password and authentication settings.</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground mt-0.5">••••••••••••••</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                    <Link href="/forgot-password">Change password</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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
      </div>
    </AppShell>
  );
}
