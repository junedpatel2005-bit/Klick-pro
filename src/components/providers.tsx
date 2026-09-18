"use client";

import { Toaster } from "@/components/ui/sonner";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { GoogleMapsProvider } from "@/components/GoogleMapsProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleMapsProvider>
      {children}
      <RealtimeNotifications />
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
