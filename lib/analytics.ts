type AnalyticsValue = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsValue>;

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: AnalyticsParams) => void;
  }
}

const firedEvents = new Set<string>();

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, { transport_type: "beacon", ...params });
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
