"use client";
declare global { interface Window { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] } }
export function trackStoreEvent(event: string, parameters: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || localStorage.getItem("belaciclo-analytics-consent") !== "accepted") return;
  window.gtag?.("event", event, parameters);
}
