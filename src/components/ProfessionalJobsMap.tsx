"use client";

import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Star } from "lucide-react";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

type MapJob = {
  id: number;
  title: string;
  category?: string | null;
  status?: string;
  locationAddress: string | null;
  locationLat: number;
  locationLng: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  hourlyRate?: number | null;
  timingType?: string | null;
  clientName?: string | null;
  clientRating?: number;
  distanceKm?: number | null;
};

function budgetLabel(job: MapJob): string {
  if (job.timingType === "HOURLY") {
    return job.hourlyRate == null ? "Rate not set" : `₹${job.hourlyRate.toLocaleString()}/hr`;
  }
  if (job.budgetMin == null && job.budgetMax == null) return "Budget on request";
  return `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`;
}

export default function ProfessionalJobsMap({
  center,
  jobs,
  onSelectJob,
}: {
  center: [number, number];
  jobs: MapJob[];
  onSelectJob: (id: number) => void;
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const [centerLat, centerLng] = center;
  const mapCenter = useMemo(() => ({ lat: centerLat, lng: centerLng }), [centerLat, centerLng]);
  const [activeJobId, setActiveJobId] = useState<number | null>(() =>
    jobs.length === 1 ? (jobs[0]?.id ?? null) : null,
  );
  const mapRef = useRef<google.maps.Map | null>(null);
  const activeJob =
    jobs.find((job) => job.id === activeJobId) ?? (jobs.length === 1 ? jobs[0] : null);

  useEffect(() => {
    if (jobs.length === 1 && jobs[0]) {
      setActiveJobId(jobs[0].id);
    }
  }, [jobs]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(mapCenter);
      mapRef.current.setZoom(jobs.length === 1 ? 13 : 6);
    }
  }, [mapCenter, jobs.length]);

  if (!isConfigured || hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
        Map preview is unavailable.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-full w-full animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
        map.setZoom(jobs.length === 1 ? 13 : 6);
      }}
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={mapCenter}
      zoom={jobs.length === 1 ? 13 : 6}
      options={{ mapTypeControl: false, streetViewControl: false }}
    >
      {jobs.map((job) => (
        <Marker
          key={job.id}
          position={{ lat: job.locationLat, lng: job.locationLng }}
          onClick={() => {
            setActiveJobId(job.id);
            onSelectJob(job.id);
          }}
        />
      ))}
      {activeJob ? (
        <InfoWindow
          position={{ lat: activeJob.locationLat, lng: activeJob.locationLng }}
          onCloseClick={() => setActiveJobId(null)}
        >
          <div className="w-60 space-y-1.5 whitespace-normal break-words p-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {activeJob.category ?? "General"}
              </span>
              {activeJob.status ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {activeJob.status}
                </span>
              ) : null}
            </div>
            <p className="font-semibold text-foreground">{activeJob.title}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {activeJob.locationAddress ?? "Remote"}
              {activeJob.distanceKm != null && ` · ${activeJob.distanceKm.toFixed(1)} km away`}
            </div>
            {activeJob.clientName ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{activeJob.clientName}</span>
                {activeJob.clientRating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {activeJob.clientRating.toFixed(1)}
                  </span>
                )}
              </div>
            ) : null}
            <p className="text-sm font-semibold text-foreground">{budgetLabel(activeJob)}</p>
          </div>
        </InfoWindow>
      ) : null}
    </GoogleMap>
  );
}
