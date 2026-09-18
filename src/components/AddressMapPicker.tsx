"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchIndiaLocation } from "@/lib/india-locations";
const GoogleMapView = dynamic(() => import("@/components/GoogleAddressMap"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
});
type Result = {
  address: string;
  lat: number;
  lon: number;
  state?: string | null;
  city?: string | null;
  district?: string | null;
};
export function AddressMapPicker({
  id,
  value,
  onChange,
  onCoordinatesChange,
  coordinates,
  onLocationChange,
  onCurrentLocation,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onCoordinatesChange?: (latitude: number, longitude: number) => void;
  coordinates?: [number, number] | null;
  onLocationChange?: (state: string, district: string) => void;
  onCurrentLocation?: () => void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [point, setPoint] = useState<[number, number]>([20.5937, 78.9629]);
  const [searchStatus, setSearchStatus] = useState("");
  const [pinStatus, setPinStatus] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    if (coordinates && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
      setPoint(coordinates);
    }
  }, [coordinates]);
  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      setSearchStatus("");
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        const d = (await r.json()) as { results?: Result[]; error?: string };
        setResults(
          (d.results ?? []).filter(
            (item) => Number.isFinite(item.lat) && Number.isFinite(item.lon),
          ),
        );
        setSearchStatus(d.error ?? "");
      } catch (error) {
        setResults([]);
        setSearchStatus(
          error instanceof Error && error.name === "AbortError"
            ? "Address search timed out. You can still enter an address manually."
            : "Address search is unavailable. You can still enter an address manually.",
        );
      } finally {
        clearTimeout(timeout);
        setSearching(false);
        setSearched(true);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [value]);
  async function resolve(lat: number, lon: number) {
    setPoint([lat, lon]);
    onCoordinatesChange?.(lat, lon);
    setPinStatus("Finding address…");
    try {
      const r = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
      const d = (await r.json()) as { results?: Result[]; error?: string };
      if (d.results?.[0]) {
        onChange(d.results[0].address);
        const matched = matchIndiaLocation(d.results[0].state, d.results[0].district);
        onLocationChange?.(
          matched.state,
          d.results[0].city || d.results[0].district || matched.district,
        );
        setPinStatus("");
      } else setPinStatus(d.error ?? "Address not found for that point.");
    } catch {
      setPinStatus("Could not look up that location. You can still enter an address manually.");
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="order-2">
        <GoogleMapView point={point} onPointChange={resolve} />
      </div>
      <p className="order-2 text-sm text-muted-foreground">
        Click or drag the pin on the map to set the exact job location.
      </p>
      <div className="order-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onCurrentLocation?.();
            navigator.geolocation?.getCurrentPosition(
              (p) => void resolve(p.coords.latitude, p.coords.longitude),
              () => setPinStatus("Location permission was not granted."),
            );
          }}
        >
          Use my current location
        </Button>
        {pinStatus && <span className="text-sm text-muted-foreground">{pinStatus}</span>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id}>Search or enter address</Label>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !results[0]) return;
            e.preventDefault();
            const item = results[0];
            onChange(item.address);
            setPoint([item.lat, item.lon]);
            onCoordinatesChange?.(item.lat, item.lon);
            const matched = matchIndiaLocation(item.state, item.district);
            onLocationChange?.(matched.state, item.city || item.district || matched.district);
            setResults([]);
            setSearched(false);
            setSearchStatus("");
          }}
          placeholder="Enter complete address: house no., street, area, city, state and PIN code"
          maxLength={300}
        />
      </div>
      {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
      {!searching && results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto rounded-lg border bg-card shadow-md">
          {results.map((item) => (
            <li key={`${item.lat}-${item.lon}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => {
                  onChange(item.address);
                  setPoint([item.lat, item.lon]);
                  onCoordinatesChange?.(item.lat, item.lon);
                  const matched = matchIndiaLocation(item.state, item.district);
                  onLocationChange?.(matched.state, item.city || item.district || matched.district);
                  setResults([]);
                  setSearched(false);
                  setSearchStatus("");
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium">Select this location</span>
                  <span className="block truncate text-muted-foreground">{item.address}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!searching && searched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {searchStatus ||
            "No matches found. You can drop a pin on the map or enter the address manually."}
        </p>
      )}
      <p className="order-3 text-xs text-muted-foreground">Map data © Google</p>
    </div>
  );
}
