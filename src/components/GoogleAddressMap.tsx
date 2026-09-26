"use client";

import { GoogleMap, Marker, Circle } from "@react-google-maps/api";
import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "18rem",
  borderRadius: "0.75rem",
};

export default function GoogleAddressMap({
  point,
  onPointChange,
  radiusKm,
}: {
  point: [number, number];
  onPointChange: (lat: number, lon: number) => void;
  radiusKm?: number | null;
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const pointChangeRef = useRef(onPointChange);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    pointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    if (!mapRef.current || !radiusKm || radiusKm <= 0) return;
    let targetZoom = 11;
    if (radiusKm <= 2) targetZoom = 14;
    else if (radiusKm <= 5) targetZoom = 13;
    else if (radiusKm <= 12) targetZoom = 12;
    else if (radiusKm <= 25) targetZoom = 11;
    else if (radiusKm <= 60) targetZoom = 10;
    else if (radiusKm <= 120) targetZoom = 9;
    else if (radiusKm <= 250) targetZoom = 8;
    else targetZoom = 7;

    mapRef.current.setZoom(targetZoom);
    mapRef.current.panTo({ lat: point[0], lng: point[1] });
  }, [radiusKm, point]);

  if (!isConfigured || hasError) {
    return (
      <div className="flex h-72 w-full flex-col items-center justify-center rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
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
    return <div className="h-72 w-full animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
      }}
      mapContainerStyle={containerStyle}
      center={{ lat: point[0], lng: point[1] }}
      zoom={point ? (radiusKm && radiusKm <= 12 ? 12 : radiusKm && radiusKm <= 35 ? 11 : 11) : 5}
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
      {radiusKm && radiusKm > 0 ? (
        <Circle
          center={{ lat: point[0], lng: point[1] }}
          radius={radiusKm * 1000}
          options={{
            fillColor: "#0284c7",
            fillOpacity: 0.16,
            strokeColor: "#0284c7",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            clickable: false,
            zIndex: 1,
          }}
        />
      ) : null}
    </GoogleMap>
  );
}
