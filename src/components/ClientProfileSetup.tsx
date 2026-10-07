"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AddressMapPicker } from "@/components/AddressMapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneVerification } from "@/components/PhoneVerification";
import { getAllStates, getDistrictsByState } from "@/lib/india-locations";
import { toast } from "sonner";

type AccountData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  avatarUrl: string | null;
  address: string | null;
};

type ProfileData = {
  companyName: string | null;
  address: string;
  profilePhotoUrl: string | null;
} | null;

export function ClientProfileSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<AccountData | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [location, setLocation] = useState<[number, number]>([20.5937, 78.9629]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetupReminder, setShowSetupReminder] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get("profileSetup") !== "1") return;
    setShowSetupReminder(true);
    const timeout = window.setTimeout(() => setShowSetupReminder(false), 10_000);
    return () => window.clearTimeout(timeout);
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/v1/profile");
        if (!response.ok) return;
        const result = (await response.json()) as {
          account: AccountData;
          profile: ProfileData;
        };
        const acc = result.account;
        const prof = result.profile;
        setAccount(acc);
        setFirstName(acc.firstName || "");
        setLastName(acc.lastName || "");
        setCompanyName(prof?.companyName || "");
        const currentAddr = prof?.address || acc.address || "";
        setAddress(currentAddr);
        setAvatarUrl(prof?.profilePhotoUrl || acc.avatarUrl || null);
        setIsEdit(Boolean(prof?.address || acc.address));
      } catch {
        // Silently proceed with blank fields
      }
    }
    void loadData();
  }, []);

  const initials = useMemo(() => {
    const first = firstName[0] ?? account?.firstName[0] ?? "";
    const last = lastName[0] ?? account?.lastName[0] ?? "";
    return `${first}${last}`.toUpperCase() || "C";
  }, [firstName, lastName, account]);

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const result = (await response.json()) as { avatarUrl?: string; error?: string };
      if (!response.ok || !result.avatarUrl) {
        throw new Error(result.error ?? "Unable to upload photo.");
      }
      setAvatarUrl(result.avatarUrl);
      window.dispatchEvent(new Event("servio:profile-updated"));
      toast.success("Profile photo updated!");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload photo.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function fillAreaFromLocation(latitude: number, longitude: number) {
    try {
      const response = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        results?: Array<{ state?: string | null; district?: string | null }>;
      };
      const result = data.results?.[0];
      const matchedState = result?.state?.trim();
      const matchedDistrict = result?.district?.trim();
      if (!matchedState || !getAllStates().includes(matchedState)) return;
      setState(matchedState);
      const normalizedDistrict = matchedDistrict
        ?.replace(/\s+district$/i, "")
        .trim()
        .toLowerCase();
      const districtMatch = getDistrictsByState(matchedState).find(
        (item) => item.toLowerCase() === normalizedDistrict,
      );
      setDistrict(districtMatch ?? "");
    } catch {
      // The map location is still saved even when reverse geocoding is unavailable.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }
    const finalAddress = address.trim() || [district, state].filter(Boolean).join(", ");
    if (!finalAddress) {
      setError("Please select your address on the map or enter it manually.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/v1/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim() || undefined,
          address: finalAddress,
          profilePhotoUrl: avatarUrl,
          phone: account?.phone || undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setPending(false);
      if (!response.ok) {
        setError(result?.error ?? "Unable to save your client profile.");
        return;
      }
      toast.success(isEdit ? "Profile updated successfully!" : "Profile saved successfully!");
      router.push("/dashboard");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Unable to save your profile.");
    }
  }

  return (
    <div className="min-h-screen bg-muted/35">
      {showSetupReminder ? (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 w-[min(360px,calc(100vw-2.5rem))] rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg"
        >
          <p className="font-semibold">Your profile setup is remaining.</p>
          <p className="mt-1 text-amber-800">Complete your profile to continue.</p>
        </div>
      ) : null}

      <header className="border-b border-border/70 bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Client workspace
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isEdit ? "Edit your client profile" : "Set up your client profile"}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {isEdit
              ? "Update your contact details and default address for seamless job postings."
              : "Add your contact details and default address so professionals can connect with you."}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-border bg-muted font-semibold text-primary">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <input
              ref={avatarInputRef}
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
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUploading ? "Uploading…" : "Upload profile photo"}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl border border-border/80 bg-card p-5 shadow-soft sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="First name"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Last name"
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={account?.email ?? ""}
                  readOnly
                  disabled
                  className="h-11 bg-muted/40 pr-24"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Verified
                </span>
              </div>
            </div>

            <PhoneVerification role="CLIENT" initialPhone={account?.phone} />

            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company name (optional)</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc. or Business name"
                className="h-11"
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-base font-semibold">Service location & address</Label>
                <p className="text-sm text-muted-foreground">
                  Search your address or drag the pin on the map to set your location.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border p-3 bg-muted/20">
                <AddressMapPicker
                  id="client-location"
                  value={address}
                  coordinates={
                    location[0] !== null && location[1] !== null ? [location[0], location[1]] : null
                  }
                  onChange={(value) => setAddress(value)}
                  onCoordinatesChange={(lat, lng) => {
                    setLocation([lat, lng]);
                    void fillAreaFromLocation(lat, lng);
                  }}
                  onLocationChange={(newState, newCity) => {
                    if (newState) setState(newState);
                    if (newCity) setDistrict(newCity);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <select
                    id="state"
                    value={state}
                    onChange={(event) => {
                      setState(event.target.value);
                      setDistrict("");
                    }}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select state</option>
                    {getAllStates().map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="district">City / District</Label>
                  <Input
                    id="district"
                    value={district}
                    onChange={(event) => setDistrict(event.target.value)}
                    placeholder="City will be detected from address"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="manual-address">Enter address manually</Label>
                <Input
                  id="manual-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter complete address: house/flat no., street, area, city, state and PIN code"
                  className="h-11"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Save profile and open dashboard"}
            </Button>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Build trust</p>
                  <p className="text-xs text-muted-foreground">Complete profiles hire faster.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  Verify your phone number.
                </p>
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  Add your primary location.
                </p>
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  Connect with top-rated pros.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-sm leading-6 text-muted-foreground">
              Your address helps match local professionals for on-site projects and is only shared
              with professionals you choose to hire.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
