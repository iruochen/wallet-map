export const activeAnalysisJobStorageKey = "wallet-map:active-analysis-job";

export function readActiveAnalysisJobId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const fromSession = window.sessionStorage.getItem(activeAnalysisJobStorageKey);
    if (fromSession) {
      return fromSession;
    }

    const fromLocal = window.localStorage.getItem(activeAnalysisJobStorageKey);
    if (fromLocal) {
      return fromLocal;
    }

    return new URL(window.location.href).searchParams.get("job");
  } catch {
    return null;
  }
}

export function rememberActiveAnalysisJob(jobId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(activeAnalysisJobStorageKey, jobId);
    window.localStorage.setItem(activeAnalysisJobStorageKey, jobId);
    syncWorkbenchJobUrl(jobId);
  } catch {
    // Browsers can block storage; analysis still works without resumability.
  }
}

export function forgetActiveAnalysisJob(jobId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!jobId || window.sessionStorage.getItem(activeAnalysisJobStorageKey) === jobId) {
      window.sessionStorage.removeItem(activeAnalysisJobStorageKey);
    }

    if (!jobId || window.localStorage.getItem(activeAnalysisJobStorageKey) === jobId) {
      window.localStorage.removeItem(activeAnalysisJobStorageKey);
    }
  } catch {
    // Ignore blocked storage.
  }
}

export function syncWorkbenchJobUrl(jobId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("fresh") === "1") {
      return;
    }

    url.searchParams.delete("fresh");
    url.searchParams.set("job", jobId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore environments without history API.
  }
}

export function clearWorkbenchJobUrl(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("job")) {
      return;
    }

    url.searchParams.delete("job");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next || url.pathname);
  } catch {
    // Ignore environments without history API.
  }
}
