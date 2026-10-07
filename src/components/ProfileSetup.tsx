"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneVerification } from "@/components/PhoneVerification";

type SavedLocation = { id: number; label: string; address: string; isPrimary: boolean };
type ClientProfile = {
  fullName: string;
  phone: string;
  companyName: string | null;
  address: string;
  companyWebsite: string | null;
  industry: string | null;
  profilePhotoUrl: string | null;
  savedLocations: SavedLocation[];
};

export function ProfileSetup({ role }: { role: "client" | "professional" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const isClient = role === "client";

  async function loadClientProfile() {
    const response = await fetch("/api/v1/profile");
    if (!response.ok) return;
    const result = (await response.json()) as { profile: ClientProfile | null };
    setProfile(result.profile);
  }

  useEffect(() => {
    if (isClient) void loadClientProfile();
  }, [isClient]);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setNotice(null);
    const response = await fetch("/api/v1/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) setError(result.error ?? "Unable to save your profile.");
    else if (isClient) {
      setNotice("Profile saved.");
      await loadClientProfile();
    } else router.push("/discover");
  }

  return (
    <AuthLayout
      title={isClient ? "Your client profile" : "Set up your professional profile"}
      subtitle={
        isClient
          ? "Keep your contact and business details up to date."
          : "Help clients find the work you do."
      }
    >
      <form
        key={isClient ? (profile?.phone ?? "new-client") : "professional"}
        action={submit}
        className="space-y-4"
      >
        {isClient ? <ClientFields profile={profile} /> : <ProfessionalFields />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-primary">{notice}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : isClient ? "Save profile" : "Save and continue"}
        </Button>
      </form>
      {isClient && profile && <SavedLocations initialLocations={profile.savedLocations} />}
    </AuthLayout>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}

function ClientFields({ profile }: { profile: ClientProfile | null }) {
  return (
    <>
      <Field
        name="fullName"
        label="Full name"
        required
        placeholder="Jane Doe"
        defaultValue={profile?.fullName}
      />
      <PhoneVerification role="CLIENT" initialPhone={profile?.phone} />
      <Field
        name="companyName"
        label="Company name (optional)"
        placeholder="Acme Inc."
        defaultValue={profile?.companyName}
      />
      <Field
        name="address"
        label="Address"
        required
        placeholder="123 Main Street"
        defaultValue={profile?.address}
      />
      <Field
        name="companyWebsite"
        label="Website (optional)"
        type="url"
        placeholder="https://example.com"
        defaultValue={profile?.companyWebsite}
      />
      <Field
        name="industry"
        label="Industry (optional)"
        placeholder="Construction, retail…"
        defaultValue={profile?.industry}
      />
      <Field
        name="profilePhotoUrl"
        label="Profile photo URL (optional)"
        type="url"
        placeholder="Available when image storage is connected"
        defaultValue={profile?.profilePhotoUrl}
      />
      <p className="text-xs text-muted-foreground">
        Image uploads are not enabled in Phase 1; this keeps the existing URL field ready for future
        storage.
      </p>
    </>
  );
}

function SavedLocations({ initialLocations }: { initialLocations: SavedLocation[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveLocation() {
    setError(null);
    const target = editing ? `/api/v1/profile/locations/${editing}` : "/api/v1/profile/locations";
    const response = await fetch(target, {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label, address }),
    });
    const result = (await response.json()) as { error?: string; location?: SavedLocation };
    if (!response.ok || !result.location) {
      setError(result.error ?? "Unable to save the location.");
      return;
    }
    setLocations((current) =>
      editing
        ? current.map((item) => (item.id === editing ? result.location! : item))
        : [result.location!, ...current],
    );
    setEditing(null);
    setLabel("");
    setAddress("");
  }

  async function removeLocation(id: number) {
    const response = await fetch(`/api/v1/profile/locations/${id}`, { method: "DELETE" });
    if (response.ok) setLocations((current) => current.filter((item) => item.id !== id));
    else setError("Unable to delete the location.");
  }

  async function makePrimary(id: number) {
    setError(null);
    const location = locations.find((item) => item.id === id);
    if (!location || location.isPrimary) return;
    const response = await fetch(`/api/v1/profile/locations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: location.label, address: location.address, isPrimary: true }),
    });
    const result = (await response.json()) as { error?: string; location?: SavedLocation };
    if (!response.ok || !result.location) {
      setError(result.error ?? "Unable to select the primary location.");
      return;
    }
    setLocations((current) => current.map((item) => ({ ...item, isPrimary: item.id === id })));
  }

  return (
    <section className="mt-8 space-y-4 border-t pt-6">
      <div>
        <h2 className="font-semibold">Saved locations</h2>
        <p className="text-sm text-muted-foreground">
          Save up to 3 addresses for future jobs and choose one as your primary location.
        </p>
      </div>
      <div className="space-y-3 rounded-xl border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="location-label">Label</Label>
          <Input
            id="location-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Home, office, job site"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location-address">Address</Label>
          <Input
            id="location-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="123 Main Street"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" onClick={saveLocation}>
          {editing ? "Update location" : "Add location"}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(null);
              setLabel("");
              setAddress("");
            }}
          >
            Cancel
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {locations.map((location) => (
          <div
            key={location.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">
                {location.label}{" "}
                {location.isPrimary && <span className="text-primary">(Primary)</span>}
              </p>
              <p className="text-sm text-muted-foreground">{location.address}</p>
            </div>
            <div className="flex gap-2">
              {!location.isPrimary && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void makePrimary(location.id)}
                >
                  Make primary
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(location.id);
                  setLabel(location.label);
                  setAddress(location.address);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void removeLocation(location.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
        {!locations.length && (
          <p className="text-sm text-muted-foreground">No saved locations yet.</p>
        )}
      </div>
    </section>
  );
}

function ProfessionalFields() {
  return (
    <>
      <Field
        name="category"
        label="Service category"
        required
        placeholder="Electrician, designer…"
      />
      <Field name="city" label="Your city" required placeholder="New York" />
      <Field name="experienceYears" label="Years of experience" type="number" placeholder="5" />
      <Field name="hourlyRate" label="Hourly rate" type="number" placeholder="50" />
      <Field
        name="serviceArea"
        label="Service area (optional)"
        placeholder="Brooklyn and Manhattan"
      />
    </>
  );
}
