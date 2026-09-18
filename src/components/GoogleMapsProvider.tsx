"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

export const GOOGLE_MAPS_LIBRARIES: "places"[] = ["places"];

type GoogleMapsContextValue = {
  isLoaded: boolean;
  isConfigured: boolean;
  hasError: boolean;
  loadError?: Error | string | null;
};

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
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

function GoogleMapsScriptLoader({ children }: { children: React.ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalAuthFailure = (window as unknown as { gm_authFailure?: () => void })
      .gm_authFailure;
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      console.warn(
        "Google Maps authentication/billing error detected (BillingNotEnabledMapError or key restriction).",
      );
      setAuthError("Google Maps billing or authentication error.");
      if (typeof originalAuthFailure === "function") {
        originalAuthFailure();
      }
    };
    return () => {
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = originalAuthFailure;
    };
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-maps-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const value = useMemo<GoogleMapsContextValue>(
    () => ({
      isLoaded: isLoaded && !authError,
      isConfigured: true,
      hasError: Boolean(loadError || authError),
      loadError: authError || (loadError ? loadError.message : null),
    }),
    [isLoaded, loadError, authError],
  );

  return <GoogleMapsContext.Provider value={value}>{children}</GoogleMapsContext.Provider>;
}

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  if (!isGoogleMapsConfigured()) {
    return (
      <GoogleMapsContext.Provider
        value={{ isLoaded: false, isConfigured: false, hasError: false, loadError: null }}
      >
        {children}
      </GoogleMapsContext.Provider>
    );
  }
  return <GoogleMapsScriptLoader>{children}</GoogleMapsScriptLoader>;
}

export function useGoogleMaps(): GoogleMapsContextValue {
  return useContext(GoogleMapsContext);
}
