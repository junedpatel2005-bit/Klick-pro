"use client";

import { toast } from "sonner";

/**
 * Animate and dismiss all active notification toasts by flying them into
 * the header's notification bell symbol, then marks all notifications read.
 */
export async function dismissAllNotificationsWithAnimation() {
  if (typeof window === "undefined") {
    toast.dismiss();
    return;
  }

  // Find all active notification toast DOM elements on screen
  const toastElements = Array.from(
    document.querySelectorAll<HTMLElement>('[data-notification-toast="true"], [data-sonner-toast]'),
  );

  // Locate the header notification bell icon or fallback to top-right corner
  const bell =
    document.getElementById("header-notification-bell") ||
    document.querySelector<HTMLElement>('[aria-label="Notifications"]') ||
    document.querySelector<HTMLElement>('a[href="/notifications"]') ||
    document.querySelector<HTMLElement>('a[href="/admin/notifications"]');

  let targetX = window.innerWidth - 60;
  let targetY = 32;

  if (bell) {
    const rect = bell.getBoundingClientRect();
    targetX = rect.left + rect.width / 2;
    targetY = rect.top + rect.height / 2;
  }

  if (toastElements.length > 0) {
    toastElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const deltaX = targetX - (rect.left + rect.width / 2);
      const deltaY = targetY - (rect.top + rect.height / 2);

      el.style.willChange = "transform, opacity, filter";
      el.style.transition = `transform 440ms cubic-bezier(0.2, 0.85, 0.35, 1) ${index * 35}ms, opacity 380ms ease-in ${index * 35}ms, filter 400ms ease-in ${index * 35}ms`;
      el.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.08)`;
      el.style.opacity = "0";
      el.style.filter = "blur(1.5px)";
      el.style.pointerEvents = "none";
    });

    // Ring the bell right as the first toast arrives
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("servio:bell-ring"));
    }, 280);

    // Wait for the flight animation to complete before removing the toast nodes
    await new Promise((resolve) => setTimeout(resolve, 440));
  } else {
    window.dispatchEvent(new CustomEvent("servio:bell-ring"));
  }

  // Clear all Sonner toasts
  toast.dismiss();

  // Mark all notifications read in database
  try {
    await fetch("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, unread: false }),
    });
  } catch {
    // Silently continue
  }

  // Notify header, navigation, and sidebar to update badge count to 0
  window.dispatchEvent(new CustomEvent("servio:notifications-read"));
}

/**
 * Animate and dismiss a single notification toast by flying it into
 * the header's notification bell symbol.
 */
export async function dismissSingleNotificationWithAnimation(
  toastId: string | number,
  notificationId?: number,
  href?: string,
  navigate?: (target: string) => void,
) {
  if (typeof window === "undefined") {
    toast.dismiss(toastId);
    return;
  }

  // Find the specific toast DOM element
  const toastElement =
    document.querySelector<HTMLElement>(`[data-notification-id="${toastId}"]`) ||
    document.querySelector<HTMLElement>('[data-notification-toast="true"]') ||
    document.querySelector<HTMLElement>("[data-sonner-toast]");

  const bell =
    document.getElementById("header-notification-bell") ||
    document.querySelector<HTMLElement>('[aria-label="Notifications"]') ||
    document.querySelector<HTMLElement>('a[href="/notifications"]') ||
    document.querySelector<HTMLElement>('a[href="/admin/notifications"]');

  let targetX = window.innerWidth - 60;
  let targetY = 32;

  if (bell) {
    const rect = bell.getBoundingClientRect();
    targetX = rect.left + rect.width / 2;
    targetY = rect.top + rect.height / 2;
  }

  if (toastElement) {
    const rect = toastElement.getBoundingClientRect();
    const deltaX = targetX - (rect.left + rect.width / 2);
    const deltaY = targetY - (rect.top + rect.height / 2);

    toastElement.style.willChange = "transform, opacity, filter";
    toastElement.style.transition =
      "transform 420ms cubic-bezier(0.2, 0.85, 0.35, 1), opacity 380ms ease-in, filter 400ms ease-in";
    toastElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.08)`;
    toastElement.style.opacity = "0";
    toastElement.style.filter = "blur(1.5px)";
    toastElement.style.pointerEvents = "none";

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("servio:bell-ring"));
    }, 280);

    await new Promise((resolve) => setTimeout(resolve, 420));
  } else {
    window.dispatchEvent(new CustomEvent("servio:bell-ring"));
  }

  toast.dismiss(toastId);

  if (notificationId != null) {
    try {
      await fetch("/api/portal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
      });
      window.dispatchEvent(new CustomEvent("servio:notifications-read"));
    } catch {
      // Silently continue
    }
  }

  if (href) {
    // A client-side route change keeps the shell mounted, so the sidebar and
    // header survive. Anything leaving the app (external hosts, file downloads,
    // API exports) still needs a real document load.
    if (navigate && href.startsWith("/") && !href.startsWith("//")) navigate(href);
    else window.location.assign(href);
  }
}
