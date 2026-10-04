"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsPath, trackEvent } from "@/lib/analytics";

// The first page view is sent by the init script; this covers client-side navigations.
export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const path = analyticsPath(pathname);
    window.gtag?.("set", { page_location: `${window.location.origin}${path}`, page_path: path });
    trackEvent("page_view", { page_location: `${window.location.origin}${path}`, page_path: path });
  }, [pathname]);

  return null;
}
