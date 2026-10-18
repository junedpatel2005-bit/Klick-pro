"use client";

import { GoogleMap, InfoWindow, Marker, Circle } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  radiusKm,
  userLocation,
  onSelectJob,
}: {
  center: [number, number];
  jobs: MapJob[];
  radiusKm?: number | null;
  userLocation?: [number, number] | null;
  onSelectJob: (id: number) => void;
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const [centerLat, centerLng] = center;
  const mapCenter = useMemo(() => ({ lat: centerLat, lng: centerLng }), [centerLat, centerLng]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;

  const applyView = useCallback(
    (map: google.maps.Map) => {
      if (activeJob) {
        map.panTo({ lat: activeJob.locationLat, lng: activeJob.locationLng });
        map.setZoom(14);
        return;
      }

      if (userLocation && radiusKm && radiusKm > 0) {
        const [uLat, uLng] = userLocation;
        const latDelta = radiusKm / 111.32;
        const latRad = (uLat * Math.PI) / 180;
        const cosLat = Math.cos(latRad);
        const lngDelta = cosLat !== 0 ? radiusKm / (111.32 * Math.abs(cosLat)) : latDelta;

        const bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(uLat - latDelta, uLng - lngDelta),
          new google.maps.LatLng(uLat + latDelta, uLng + lngDelta),
        );
        jobs.forEach((j) => bounds.extend({ lat: j.locationLat, lng: j.locationLng }));
        map.fitBounds(bounds);
        return;
      }

      if (jobs.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        jobs.forEach((j) => bounds.extend({ lat: j.locationLat, lng: j.locationLng }));
        map.fitBounds(bounds);
        return;
      }

      if (userLocation) {
        map.setCenter({ lat: userLocation[0], lng: userLocation[1] });
        map.setZoom(11);
        return;
      }

      map.setCenter(mapCenter);
      map.setZoom(10);
    },
    [activeJob, userLocation, radiusKm, jobs, mapCenter],
  );

  useEffect(() => {
    if (jobs.length === 1 && jobs[0] && !userLocation) {
      setActiveJobId(jobs[0].id);
    }
  }, [jobs, userLocation]);

  useEffect(() => {
    if (mapRef.current) {
      applyView(mapRef.current);
    }
  }, [applyView]);

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
    <div className="relative h-full w-full">
      {radiusKm && radiusKm > 0 && userLocation && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-lg bg-card/90 px-2.5 py-1 text-xs font-semibold shadow-md backdrop-blur-md border border-primary/20 text-foreground">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Radius: {radiusKm} km</span>
        </div>
      )}
      <GoogleMap
        onLoad={(map) => {
          mapRef.current = map;
          applyView(map);
        }}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={mapCenter}
        zoom={jobs.length === 1 ? 14 : 10}
        options={{ mapTypeControl: false, streetViewControl: false }}
      >
        {userLocation && (
          <>
            <Marker
              position={{ lat: userLocation[0], lng: userLocation[1] }}
              title="Your location / Search center"
              icon={
                typeof google !== "undefined"
                  ? {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: "#2563eb",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 2.5,
                    }
                  : undefined
              }
            />
            {radiusKm && radiusKm > 0 && (
              <Circle
                center={{ lat: userLocation[0], lng: userLocation[1] }}
                radius={radiusKm * 1000}
                options={{
                  fillColor: "#3b82f6",
                  fillOpacity: 0.15,
                  strokeColor: "#2563eb",
                  strokeOpacity: 0.8,
                  strokeWeight: 2,
                  clickable: false,
                  zIndex: 0,
                }}
              />
            )}
          </>
        )}
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
    </div>
  );
}
