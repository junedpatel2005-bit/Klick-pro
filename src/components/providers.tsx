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
          className: "group font-sans",
          classNames: {
            toast:
              "w-[min(400px,calc(100vw-2rem))] rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-xl text-foreground font-sans font-medium text-sm ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200",
            title: "font-semibold text-sm leading-snug",
            description: "text-xs text-muted-foreground mt-0.5 leading-relaxed",
            actionButton:
              "!bg-primary !text-primary-foreground text-xs font-semibold rounded-xl px-3 py-1.5 shadow-xs transition-transform active:scale-95",
            cancelButton:
              "!bg-muted !text-muted-foreground text-xs font-medium rounded-xl px-3 py-1.5 transition-colors hover:!bg-muted/80",
            closeButton:
              "!bg-background/80 !border-border/60 !text-muted-foreground hover:!text-foreground !rounded-lg !transition-colors",
            success:
              "!border-emerald-500/30 !bg-emerald-50/95 dark:!bg-emerald-950/40 !text-emerald-900 dark:!text-emerald-200",
            error:
              "!border-rose-500/30 !bg-rose-50/95 dark:!bg-rose-950/40 !text-rose-900 dark:!text-rose-200",
            info:
              "!border-indigo-500/30 !bg-indigo-50/95 dark:!bg-indigo-950/40 !text-indigo-900 dark:!text-indigo-200",
            warning:
              "!border-amber-500/30 !bg-amber-50/95 dark:!bg-amber-950/40 !text-amber-900 dark:!text-amber-200",
          },
        }}
      />
    </GoogleMapsProvider>
  );
}
