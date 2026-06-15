import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeAnalysisJobStorageKey,
  clearWorkbenchJobUrl,
  forgetActiveAnalysisJob,
  readActiveAnalysisJobId,
  rememberActiveAnalysisJob,
  syncWorkbenchJobUrl,
} from "./active-job-restore";

function createStorage() {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

describe("active-job-restore", () => {
  let currentUrl: URL;

  beforeEach(() => {
    currentUrl = new URL("http://localhost/");

    vi.stubGlobal("window", {
      sessionStorage: createStorage(),
      localStorage: createStorage(),
      history: {
        state: {},
        replaceState: (_state: unknown, _title: string, url?: string | URL | null) => {
          if (typeof url === "string" && url.length > 0) {
            currentUrl = new URL(url, currentUrl.origin);
          }
        },
      },
      get location() {
        return { href: currentUrl.href };
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads job id from sessionStorage, then localStorage, then URL", () => {
    window.sessionStorage.setItem(activeAnalysisJobStorageKey, "job-session");
    expect(readActiveAnalysisJobId()).toBe("job-session");

    window.sessionStorage.clear();
    window.localStorage.setItem(activeAnalysisJobStorageKey, "job-local");
    expect(readActiveAnalysisJobId()).toBe("job-local");

    window.localStorage.clear();
    currentUrl = new URL("http://localhost/?job=job-url");
    expect(readActiveAnalysisJobId()).toBe("job-url");
  });

  it("mirrors active job id across storage and URL", () => {
    rememberActiveAnalysisJob("job-123");

    expect(window.sessionStorage.getItem(activeAnalysisJobStorageKey)).toBe("job-123");
    expect(window.localStorage.getItem(activeAnalysisJobStorageKey)).toBe("job-123");
    expect(currentUrl.searchParams.get("job")).toBe("job-123");
  });

  it("clears mirrored job id and URL param", () => {
    rememberActiveAnalysisJob("job-123");
    forgetActiveAnalysisJob("job-123");
    clearWorkbenchJobUrl();

    expect(readActiveAnalysisJobId()).toBeNull();
    expect(currentUrl.searchParams.get("job")).toBeNull();
  });

  it("does not overwrite fresh-start URLs", () => {
    currentUrl = new URL("http://localhost/?fresh=1");
    syncWorkbenchJobUrl("job-123");

    expect(currentUrl.searchParams.get("job")).toBeNull();
    expect(currentUrl.searchParams.get("fresh")).toBe("1");
  });
});
