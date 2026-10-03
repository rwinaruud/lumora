const storageKey = "lumora-generation-job";
const jobIdPattern = /^[A-Za-z0-9_-]{43}$/;

export function createJobId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function readStoredJobId(): string | null {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    return value && jobIdPattern.test(value) ? value : null;
  } catch { return null; }
}

export function storeJobId(jobId: string): void {
  try { window.sessionStorage.setItem(storageKey, jobId); } catch { /* storage unavailable */ }
}

export function clearStoredJobId(): void {
  try { window.sessionStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
}

// Resolves after the delay, or immediately when the page becomes visible again.
export function waitForPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", finish);
      resolve();
    };
    const onVisible = () => { if (document.visibilityState === "visible") finish(); };
    const timer = window.setTimeout(finish, delayMs);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", finish);
  });
}
