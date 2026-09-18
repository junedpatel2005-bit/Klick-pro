"use client";

import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import type { ProfessionalDiscoveryResult } from "@/lib/types/professional-discovery";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

export default function ProfessionalDiscoveryMap({
  professionals,
  selectedPoint,
}: {
  professionals: ProfessionalDiscoveryResult[];
  selectedPoint?: { lat: number; lng: number };
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const router = useRouter();
  const points = professionals
    .map((professional) => professional.displayPoint)
    .filter((point): point is { lat: number; lng: number } => Boolean(point));
  const initialPoint = points[0] ?? { lat: 37.7749, lng: -122.4194 };

  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | null>(
    selectedPoint ? findProAtPoint(professionals, selectedPoint) : null,
  );
  const activeProfessional =
    professionals.find((professional) => professional.id === activeProfessionalId) ?? null;

  const applyView = useCallback(
    (map: google.maps.Map) => {
      if (selectedPoint) {
        map.panTo(selectedPoint);
        map.setZoom(12);
        return;
      }
      if (points.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds);
      }
    },
    [selectedPoint, points],
  );

  useEffect(() => {
    if (mapRef.current) applyView(mapRef.current);
  }, [applyView]);

  if (!isConfigured || hasError) {
    return (
      <div className="flex h-[520px] w-full items-center justify-center overflow-hidden rounded-2xl border bg-muted text-sm text-muted-foreground">
        Map preview is unavailable.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="h-[520px] w-full animate-pulse rounded-2xl border bg-muted" />;
  }

  return (
    <div className="h-[520px] w-full overflow-hidden rounded-2xl border">
      <GoogleMap
        onLoad={(map) => {
          mapRef.current = map;
        }}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={initialPoint}
        zoom={points.length > 0 ? 6 : 3}
        options={{ mapTypeControl: false, streetViewControl: false }}
      >
        {professionals.map((professional) => {
          const point = professional.displayPoint;
          if (!point) return null;
          const goToProfile = () => router.push(`/pro/${professional.id}`);
          return (
            <Marker
              key={professional.id}
              position={point}
              onClick={() => {
                setActiveProfessionalId(professional.id);
                goToProfile();
              }}
            />
          );
        })}
        {activeProfessional?.displayPoint ? (
          <InfoWindow
            position={activeProfessional.displayPoint}
            onCloseClick={() => setActiveProfessionalId(null)}
          >
            <ProfessionalTooltipContent professional={activeProfessional} />
          </InfoWindow>
        ) : null}
      </GoogleMap>
    </div>
  );
}

function ProfessionalTooltipContent({
  professional,
}: {
  professional: ProfessionalDiscoveryResult;
}) {
  const router = useRouter();
  const goToProfile = () => router.push(`/pro/${professional.id}`);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToProfile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToProfile();
        }
      }}
      className="w-56 cursor-pointer space-y-1.5 whitespace-normal break-words p-0.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-foreground">{professional.name}</span>
        {professional.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" />}
      </div>
      <p className="text-xs text-muted-foreground">{professional.title}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <Star className="h-3 w-3 fill-warning text-warning" />
          {professional.rating.toFixed(1)}
          <span className="font-normal text-muted-foreground">({professional.reviewCount})</span>
        </span>
        {professional.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {professional.location}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground">
        {professional.hourlyRate === null ? "Contact for rate" : `₹${professional.hourlyRate}/hr`}
      </p>
    </div>
  );
}

function findProAtPoint(
  professionals: ProfessionalDiscoveryResult[],
  point: { lat: number; lng: number },
): string | null {
  const closest = professionals
    .map((professional) => ({ professional, point: professional.displayPoint }))
    .filter(
      (
        entry,
      ): entry is {
        professional: ProfessionalDiscoveryResult;
        point: { lat: number; lng: number };
      } => entry.point !== undefined,
    )
    .reduce<{ id: string; distance: number } | null>((acc, entry) => {
      const distance = haversine(entry.point, point);
      if (!acc || distance < acc.distance) return { id: entry.professional.id, distance };
      return acc;
    }, null);
  return closest?.id ?? null;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
