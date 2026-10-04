import Script from "next/script";
import { GoogleAnalyticsPageViews } from "./google-analytics-page-views";

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return null;

  // Page views are sent manually with a sanitized page_location (origin + pathname only).
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
    <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};var l=window.location,p=l.pathname.replace(/^\\/tutorial\\/[^\\/]+/,'/tutorial/:id').replace(/^\\/share\\/[^\\/]+/,'/share/:id'),r='';window.gtag('js',new Date());window.gtag('set',{page_location:l.origin+p,page_path:p});window.gtag('config','${measurementId}',{send_page_view:false});try{r=document.referrer?new URL(document.referrer).origin+'/':'';}catch(e){}window.gtag('event','page_view',{page_location:l.origin+p,page_path:p,page_referrer:r});`}</Script>
    <GoogleAnalyticsPageViews />
  </>;
}
