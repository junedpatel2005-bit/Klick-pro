"use client";

import { GoogleMap, InfoWindow, Marker, Circle } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import type { ProfessionalDiscoveryResult } from "@/lib/types/professional-discovery";
import { useGoogleMaps } from "@/components/GoogleMapsProvider";

export default function ProfessionalDiscoveryMap({
  professionals,
  selectedProfessionalId,
  selectedPoint,
  userLocation,
  userRadiusKm,
  onClearSelected,
}: {
  professionals: ProfessionalDiscoveryResult[];
  selectedProfessionalId?: string | null;
  selectedPoint?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
  userRadiusKm?: number | null;
  onClearSelected?: () => void;
}) {
  const { isLoaded, isConfigured, hasError } = useGoogleMaps();
  const router = useRouter();

  const selectedPro = selectedProfessionalId
    ? (professionals.find((p) => String(p.id) === String(selectedProfessionalId)) ?? null)
    : null;

  // When a professional is selected from their card, show only that professional's marker on the map.
  // Otherwise, show all professionals.
  const displayedProfessionals = selectedPro ? [selectedPro] : professionals;

  const points = displayedProfessionals
    .map((professional) => professional.displayPoint)
    .filter((point): point is { lat: number; lng: number } => Boolean(point));
  const initialPoint = selectedPro?.displayPoint ??
    selectedPoint ??
    points[0] ?? { lat: 37.7749, lng: -122.4194 };

  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | null>(
    selectedProfessionalId ?? (selectedPoint ? findProAtPoint(professionals, selectedPoint) : null),
  );

  // Synchronize active professional popup and center whenever selectedProfessionalId or selectedPoint changes
  useEffect(() => {
    if (selectedProfessionalId) {
      setActiveProfessionalId(selectedProfessionalId);
    } else if (selectedPoint) {
      const foundId = findProAtPoint(professionals, selectedPoint);
      setActiveProfessionalId(foundId);
    }
  }, [selectedProfessionalId, selectedPoint, professionals]);

  const activeProfessional =
    professionals.find(
      (professional) => String(professional.id) === String(activeProfessionalId),
    ) ??
    selectedPro ??
    null;

  const applyView = useCallback(
    (map: google.maps.Map) => {
      const targetPoint =
        selectedPro?.displayPoint ?? activeProfessional?.displayPoint ?? selectedPoint;

      if (targetPoint) {
        map.panTo(targetPoint);
        map.setZoom(14);
        return;
      }
      if (points.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds);
      }
    },
    [selectedPro, activeProfessional, selectedPoint, points],
  );

  useEffect(() => {
    if (mapRef.current) {
      applyView(mapRef.current);
    }
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
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border">
      {selectedPro && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 rounded-2xl bg-card/80 px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md border border-primary/20 ring-1 ring-primary/10">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">
              Isolated Professional
            </span>
            <span className="text-foreground text-sm font-bold">{selectedPro.name}</span>
          </div>
          {onClearSelected && (
            <button
              type="button"
              onClick={onClearSelected}
              className="ml-3 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              Show all on map
            </button>
          )}
        </div>
      )}
      <GoogleMap
        onLoad={(map) => {
          mapRef.current = map;
          applyView(map);
        }}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={initialPoint}
        zoom={selectedPro ? 14 : points.length > 0 ? 6 : 3}
        options={{ mapTypeControl: false, streetViewControl: false }}
      >
        {userLocation && (
          <>
            <Marker
              position={userLocation}
              title="Your location"
              icon={
                typeof google !== "undefined"
                  ? {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: "#2563eb",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    }
                  : undefined
              }
            />
            {userRadiusKm && userRadiusKm > 0 && (
              <Circle
                center={userLocation}
                radius={userRadiusKm * 1000}
                options={{
                  fillColor: "#3b82f6",
                  fillOpacity: 0.12,
                  strokeColor: "#3b82f6",
                  strokeOpacity: 0.75,
                  strokeWeight: 2,
                  clickable: false,
                  zIndex: 0,
                }}
              />
            )}
          </>
        )}
        {displayedProfessionals.map((professional) => {
          const point = professional.displayPoint;
          if (!point) return null;
          return (
            <Marker
              key={professional.id}
              position={point}
              onClick={() => {
                setActiveProfessionalId(professional.id);
              }}
            />
          );
        })}
        {activeProfessional?.displayPoint ? (
          <InfoWindow
            key={activeProfessional.id}
            position={activeProfessional.displayPoint}
            onCloseClick={() => {
              setActiveProfessionalId(null);
            }}
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
      className="w-56 cursor-pointer space-y-1.5 whitespace-normal break-words p-1 text-slate-900"
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-sm">{professional.name}</span>
        {professional.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />}
      </div>
      <p className="text-xs text-slate-600 font-medium">{professional.title}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          {professional.rating.toFixed(1)}
          <span className="font-normal text-slate-500">({professional.reviewCount})</span>
        </span>
        {professional.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-400" /> {professional.location}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <p className="text-sm font-bold text-slate-900">
          {professional.hourlyRate === null ? "Contact for rate" : `₹${professional.hourlyRate}/hr`}
        </p>
        <span className="text-[11px] font-semibold text-primary hover:underline">
          View profile &rarr;
        </span>
      </div>
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
