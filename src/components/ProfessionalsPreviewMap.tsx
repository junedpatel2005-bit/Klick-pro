"use client";

import { GoogleMap, Marker } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ProfessionalDiscoveryResult } from "@/lib/types/professional-discovery";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

export default function ProfessionalsPreviewMap({
  professionals,
}: {
  professionals: ProfessionalDiscoveryResult[];
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const pinned = useMemo(
    () =>
      professionals
        .map((professional) => ({ id: professional.id, point: professional.displayPoint }))
        .filter(
          (entry): entry is { id: string; point: { lat: number; lng: number } } =>
            entry.point !== undefined,
        ),
    [professionals],
  );
  const points = useMemo(() => pinned.map((entry) => entry.point), [pinned]);
  const mapRef = useRef<google.maps.Map | null>(null);

  const applyView = useCallback(
    (map: google.maps.Map) => {
      if (points.length === 0) return;
      if (points.length === 1) {
        const first = points[0];
        if (first) {
          map.setCenter(first);
          map.setZoom(10);
        }
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);
    },
    [points],
  );

  useEffect(() => {
    if (mapRef.current) applyView(mapRef.current);
  }, [applyView]);

  if (!isConfigured || hasError) {
    return (
      <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-muted text-sm text-muted-foreground">
        Map preview is unavailable.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-full w-full animate-pulse rounded-xl bg-muted" />;
  }

  if (points.length === 0) {
    return (
      <div className="pointer-events-none flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-muted text-sm text-muted-foreground">
        No mapped locations for these professionals.
      </div>
    );
  }

  return (
    <div className="pointer-events-none h-full w-full overflow-hidden rounded-xl">
      <GoogleMap
        onLoad={(map) => {
          mapRef.current = map;
          applyView(map);
        }}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={points[0]}
        zoom={9}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "none",
          zoomControl: false,
          scrollwheel: false,
          disableDoubleClickZoom: true,
          keyboardShortcuts: false,
        }}
      >
        {pinned.map((entry) => (
          <Marker key={entry.id} position={entry.point} />
        ))}
      </GoogleMap>
    </div>
  );
}
