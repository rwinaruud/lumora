type AnalyticsValue = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    gtag?: (command: "event" | "set", name: string | AnalyticsParams, params?: AnalyticsParams) => void;
  }
}

const firedEvents = new Set<string>();

// Origin + path only: query strings (for example a Stripe session_id) and fragments never reach GA.
export function sanitizedLocation(): string {
  return `${window.location.origin}${analyticsPath(window.location.pathname)}`;
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, { transport_type: "beacon", page_location: sanitizedLocation(), ...params });
}

// Fires an event once per key, surviving re-renders, effect re-runs and reloads within the tab.
export function trackEventOnce(key: string, name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || firedEvents.has(key)) return;
  firedEvents.add(key);
  const storageKey = `lumora-ga:${key}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    // Storage unavailable: the in-memory guard still applies.
  }
  trackEvent(name, params);
}

// Result IDs are bearer tokens, so the tutorial and share routes are reported without their ID.
export function analyticsPath(pathname: string): string {
  return pathname
    .replace(/^\/tutorial\/[^/]+/, "/tutorial/:id")
    .replace(/^\/share\/[^/]+/, "/share/:id");
}
