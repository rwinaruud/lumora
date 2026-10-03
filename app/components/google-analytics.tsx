import Script from "next/script";
import { GoogleAnalyticsPageViews } from "./google-analytics-page-views";

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return null;

  // Page views are sent manually with a sanitized page_location (origin + pathname only).
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
    <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag('js',new Date());window.gtag('config','${measurementId}',{send_page_view:false});var l=window.location,r='';try{r=document.referrer?new URL(document.referrer).origin+'/':'';}catch(e){}window.gtag('event','page_view',{page_location:l.origin+l.pathname,page_path:l.pathname,page_referrer:r});`}</Script>
    <GoogleAnalyticsPageViews />
  </>;
}
