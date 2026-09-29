"use client";

import { Toaster } from "@/components/ui/sonner";
import { GoogleMapsProvider } from "@/components/GoogleMapsProvider";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";

// Safely patch Node.prototype.removeChild and Node.prototype.insertBefore on the client.
// This permanently prevents uncaught NotFoundError DOMExceptions from crashing React when
// browser extensions (Google Translate, Grammarly, password autofill, dark reader) or
// third-party scripts modify DOM nodes behind React's back.
if (typeof window !== "undefined" && typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    try {
      if (child && child.parentNode !== this) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        return child;
      }
      return originalRemoveChild.apply(this, [child]) as T;
    } catch {
      try {
        if (child && child.parentNode) {
          return child.parentNode.removeChild(child);
        }
      } catch {}
      return child;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    try {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (referenceNode.parentNode) {
          return referenceNode.parentNode.insertBefore(newNode, referenceNode);
        }
        return this.appendChild(newNode);
      }
      return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
    } catch {
      try {
        return this.appendChild(newNode);
      } catch {
        return newNode;
      }
    }
  };
}

// RealtimeNotifications is intentionally NOT mounted here: it belongs to the
// signed-in surfaces only (PortalShell, AdminPortal). Mounting it globally kept
// a socket open on marketing pages for anonymous visitors.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleMapsProvider>
      <NavigationProgressBar />
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
