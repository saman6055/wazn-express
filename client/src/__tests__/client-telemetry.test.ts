import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { __resetClientErrorReports, reportClientError } from "./lib/reportClientError";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("a crash reaches the team, quietly and briefly", () => {
  const beacon = vi.fn(() => true);
  beforeEach(() => {
    __resetClientErrorReports();
    beacon.mockClear();
    vi.stubGlobal("window", { location: { pathname: "/portal/search", search: "?q=07501234567" } });
    vi.stubGlobal("navigator", { sendBeacon: beacon });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the page's path, never its query string", async () => {
    reportClientError("render", new TypeError("Cannot read properties of undefined"));
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/client-errors");
    const body = JSON.parse(await blob.text());
    expect(body).toMatchObject({ kind: "render", page: "/portal/search", message: "Cannot read properties of undefined" });
    expect(JSON.stringify(body)).not.toContain("0750");
  });

  it("says the same thing once, and at most five things per visit", () => {
    reportClientError("render", new Error("same"));
    reportClientError("render", new Error("same"));
    expect(beacon).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 10; i++) reportClientError("unhandled", new Error(`e${i}`));
    expect(beacon).toHaveBeenCalledTimes(5);
  });

  it("never throws, whatever it is given", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(() => reportClientError("rejection", undefined)).not.toThrow();
    expect(() => reportClientError("rejection", { weird: true })).not.toThrow();
  });
});

describe("the wiring", () => {
  it("uncaught errors, rejected promises and both boundaries report", () => {
    const main = read("main.tsx");
    expect(main).toContain('addEventListener("error", (event) => reportClientError("unhandled"');
    expect(main).toContain('addEventListener("unhandledrejection", (event) => reportClientError("rejection"');
    expect(read("components/ErrorBoundary.tsx")).toContain('reportClientError("render", error)');
    expect(read("components/SectionBoundary.tsx")).toContain('reportClientError("section", error)');
  });

  it("a tab left open across a deploy reloads once onto the new build", () => {
    const main = read("main.tsx");
    expect(main).toMatch(/addEventListener\("vite:preloadError"[\s\S]{0,400}Date\.now\(\) - last < 60_000\) return;[\s\S]{0,300}window\.location\.reload\(\)/);
  });
});
