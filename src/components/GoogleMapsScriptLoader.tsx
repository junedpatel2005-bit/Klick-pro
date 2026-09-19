"use client";

import { useEffect, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LIBRARIES,
  type GoogleMapsContextValue,
} from "@/components/google-maps-context";

/**
 * Renders nothing: it loads the Maps script and reports its status upward.
 * Split out of GoogleMapsProvider so @react-google-maps/api is fetched only
 * when Maps is configured, instead of shipping in every route's client entry.
 */
export default function GoogleMapsScriptLoader({
  onStatusChange,
}: {
  onStatusChange: (status: GoogleMapsContextValue) => void;
}) {
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

  useEffect(() => {
    onStatusChange({
      isLoaded: isLoaded && !authError,
      isConfigured: true,
      hasError: Boolean(loadError || authError),
      loadError: authError || (loadError ? loadError.message : null),
    });
  }, [isLoaded, loadError, authError, onStatusChange]);

  return null;
}
