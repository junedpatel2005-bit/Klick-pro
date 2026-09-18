"use client";

import { GoogleMap, Marker } from "@react-google-maps/api";
import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "16rem",
};

export default function GoogleAddressMap({
  point,
  onPointChange,
}: {
  point: [number, number];
  onPointChange: (lat: number, lon: number) => void;
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const pointChangeRef = useRef(onPointChange);

  useEffect(() => {
    pointChangeRef.current = onPointChange;
  }, [onPointChange]);

  if (!isConfigured || hasError) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Interactive map preview is unavailable</p>
        <p className="mt-1 text-xs">
          {hasError
            ? "Google Maps billing or project activation required."
            : "Google Maps is not configured."}{" "}
          You can still enter your address manually.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={{ lat: point[0], lng: point[1] }}
      zoom={point ? 12 : 5}
      options={{
        gestureHandling: "greedy",
        clickableIcons: false,
      }}
      onClick={(event) => {
        if (event.latLng) {
          pointChangeRef.current(event.latLng.lat(), event.latLng.lng());
        }
      }}
    >
      <Marker
        position={{ lat: point[0], lng: point[1] }}
        draggable
        onDragEnd={(event) => {
          if (event.latLng) {
            pointChangeRef.current(event.latLng.lat(), event.latLng.lng());
          }
        }}
      />
    </GoogleMap>
  );
}
