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
    if (!mapRef.current) return;
    if (radiusKm && radiusKm > 0 && point[0] && point[1]) {
      const lat = point[0];
      const lng = point[1];
      const latDelta = (radiusKm * 1.1) / 111.32;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const lngDelta = (radiusKm * 1.1) / (111.32 * (Math.abs(cosLat) > 0.001 ? cosLat : 1));
      const bounds = new google.maps.LatLngBounds(
        { lat: lat - latDelta, lng: lng - lngDelta },
        { lat: lat + latDelta, lng: lng + lngDelta },
      );
      mapRef.current.fitBounds(bounds);
    } else if (point[0] && point[1]) {
      mapRef.current.panTo({ lat: point[0], lng: point[1] });
      mapRef.current.setZoom(13);
    }
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
        if (radiusKm && radiusKm > 0 && point[0] && point[1]) {
          const lat = point[0];
          const lng = point[1];
          const latDelta = (radiusKm * 1.1) / 111.32;
          const cosLat = Math.cos((lat * Math.PI) / 180);
          const lngDelta = (radiusKm * 1.1) / (111.32 * (Math.abs(cosLat) > 0.001 ? cosLat : 1));
          const bounds = new google.maps.LatLngBounds(
            { lat: lat - latDelta, lng: lng - lngDelta },
            { lat: lat + latDelta, lng: lng + lngDelta },
          );
          map.fitBounds(bounds);
        }
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
