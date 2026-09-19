"use client";

import { Toaster } from "@/components/ui/sonner";
import { GoogleMapsProvider } from "@/components/GoogleMapsProvider";

// RealtimeNotifications is intentionally NOT mounted here: it belongs to the
// signed-in surfaces only (PortalShell, AdminPortal). Mounting it globally kept
// a socket open on marketing pages for anonymous visitors.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleMapsProvider>
      {children}
      <Toaster
        position="top-right"
        offset="76px"
        duration={4500}
        closeButton
        richColors
        toastOptions={{
          classNames: {
            toast: "w-[min(380px,calc(100vw-2rem))]",
          },
        }}
      />
    </GoogleMapsProvider>
  );
}
