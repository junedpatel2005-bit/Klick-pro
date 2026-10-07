"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  GoogleMapsContext,
  isGoogleMapsConfigured,
  type GoogleMapsContextValue,
} from "@/components/google-maps-context";

export {
  GOOGLE_MAPS_LIBRARIES,
  isGoogleMapsConfigured,
  useGoogleMaps,
  type GoogleMapsContextValue,
} from "@/components/google-maps-context";

// Loaded only when Maps is configured. It renders nothing, so children are
// server-rendered and visible immediately regardless of the script's state.
const GoogleMapsScriptLoader = dynamic(() => import("@/components/GoogleMapsScriptLoader"), {
  ssr: false,
});

const UNCONFIGURED: GoogleMapsContextValue = {
  isLoaded: false,
  isConfigured: false,
  hasError: false,
  loadError: null,
};

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const configured = isGoogleMapsConfigured();
  const [status, setStatus] = useState<GoogleMapsContextValue>({
    isLoaded: false,
    isConfigured: true,
    hasError: false,
    loadError: null,
  });

  return (
    <GoogleMapsContext.Provider value={configured ? status : UNCONFIGURED}>
      {configured ? <GoogleMapsScriptLoader onStatusChange={setStatus} /> : null}
      {children}
    </GoogleMapsContext.Provider>
  );
}
