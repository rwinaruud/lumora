"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return <button className="back-button" type="button" aria-label="Go back" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/"); }}>
    <svg className="lumora-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 12H4" /><path d="m11 5-7 7 7 7" /></svg><span>Back</span>
  </button>;
}
