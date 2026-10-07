"use client";

import { Circle, GoogleMap, Marker } from "@react-google-maps/api";
import { useMemo } from "react";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

export default function ProfessionalLocationMap({
  point,
}: {
  point: { lat: number; lng: number };
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const center = useMemo(() => ({ lat: point.lat, lng: point.lng }), [point.lat, point.lng]);

  if (!isConfigured || hasError) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        Map preview is unavailable.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-64 w-full animate-pulse rounded-xl border border-border bg-muted" />;
  }

  return (
    <div className="isolate h-64 w-full overflow-hidden rounded-xl border border-border">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={12}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          scrollwheel: false,
          zoomControl: false,
        }}
      >
        <Circle
          center={center}
          radius={1200}
          options={{ strokeColor: "#2563eb", fillOpacity: 0.12 }}
        />
        <Marker position={center} />
      </GoogleMap>
    </div>
  );
}
