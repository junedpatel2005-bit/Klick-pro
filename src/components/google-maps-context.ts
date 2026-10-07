"use client";

import { createContext, useContext } from "react";

export const GOOGLE_MAPS_LIBRARIES: "places"[] = ["places"];

export type GoogleMapsContextValue = {
  isLoaded: boolean;
  isConfigured: boolean;
  hasError: boolean;
  loadError?: Error | string | null;
};

export const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  isConfigured: false,
  hasError: false,
  loadError: null,
});

export function isGoogleMapsConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_ENABLED !== "false"
  );
}

export function useGoogleMaps(): GoogleMapsContextValue {
  return useContext(GoogleMapsContext);
}
