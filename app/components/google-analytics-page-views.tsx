"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

// The first page view is sent by the init script; this covers client-side navigations.
export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackEvent("page_view", { page_location: `${window.location.origin}${pathname}`, page_path: pathname });
  }, [pathname]);

  return null;
}
