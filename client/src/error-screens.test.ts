import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { copyText } from "./lib/copyText";
import {
  currentSurface,
  errorRef,
  homePath,
  isServerMessage,
  showsTechnicalDetail,
} from "./lib/errorSurface";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("which screen an error is on", () => {
  it("knows the portal, the public site and the office apart", () => {
    expect(currentSurface("/portal")).toBe("portal");
    expect(currentSurface("/portal/shipments/12")).toBe("portal");
    expect(currentSurface("/")).toBe("public");
    expect(currentSurface("/store/some-item")).toBe("public");
    expect(currentSurface("/t/abc123")).toBe("public");
    expect(currentSurface("/customer-login")).toBe("public");
    expect(currentSurface("/packages")).toBe("staff");
    expect(currentSurface("/portalish")).toBe("staff");
  });

  it("'go home' is each reader's own home", () => {
    expect(homePath("portal")).toBe("/portal");
    expect(homePath("public")).toBe("/");
    expect(homePath("staff")).toBe("/dashboard");
  });

  it("raw technical text is for the office only", () => {
    expect(showsTechnicalDetail("staff")).toBe(true);
    expect(showsTechnicalDetail("portal")).toBe(false);
    expect(showsTechnicalDetail("public")).toBe(false);
  });

  it("reads the server's reference, and nothing that only looks like one", () => {
    expect(errorRef({ data: { ref: "7F3A9C21" } })).toBe("7F3A9C21");
    expect(errorRef({ data: { ref: "<img>" } })).toBeNull();
    expect(errorRef(new Error("x"))).toBeNull();
    expect(errorRef(null)).toBeNull();
  });

  it("tells a sentence the server wrote from a crash in the page", () => {
    expect(isServerMessage({ data: { code: "NOT_FOUND" } })).toBe(true);
    expect(isServerMessage(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });
});

describe("copy details for support", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the clipboard when it can", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyText("report", "Copy")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("report");
  });

  it("falls back to the old copy command where there is no clipboard", async () => {
    vi.stubGlobal("navigator", {});
    const area = { value: "", style: {}, setAttribute: vi.fn(), select: vi.fn() };
    vi.stubGlobal("document", {
      createElement: () => area,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn(() => true),
    });
    await expect(copyText("report", "Copy")).resolves.toBe(true);
    expect(area.value).toBe("report");
  });

  it("and last, hands the text to a prompt the reader can copy from", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    vi.stubGlobal("document", {
      createElement: () => ({ value: "", style: {}, setAttribute: vi.fn(), select: vi.fn() }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn(() => false),
    });
    const prompt = vi.fn();
    vi.stubGlobal("window", { prompt });
    await expect(copyText("report", "Copy")).resolves.toBe(false);
    expect(prompt).toHaveBeenCalledWith("Copy", "report");
  });
});

describe("the wiring", () => {
  it("every layout keeps its shell when the page inside it crashes, and clears on a new address", () => {
    for (const file of [
      "components/DashboardLayout.tsx",
      "components/CustomerPortalLayout.tsx",
      "components/ModernPortalLayout.tsx",
      "components/Skin3PortalLayout.tsx",
    ]) {
      expect(read(file), file).toContain("<SectionBoundary resetKey={location}>{children}</SectionBoundary>");
    }
  });

  it("the router's error screen clears on a new address", () => {
    const app = read("App.tsx");
    expect(app).toContain("<QueryErrorBoundary resetKey={location}>{children}</QueryErrorBoundary>");
    expect(app).toContain("<RouteErrorBoundary>");
    expect(read("components/QueryErrorBoundary.tsx")).toContain("prevProps.resetKey !== this.props.resetKey");
  });

  it("the fallback reads in the reader's direction and goes to the reader's home", () => {
    const src = read("components/QueryErrorFallback.tsx");
    expect(src).not.toContain('dir="rtl"');
    expect(src).toContain("dir={direction}");
    expect(src).toContain("<Link href={homePath()}>");
    expect(src).toMatch(/technical && \(\s*<div className="w-full max-h-32/);
  });

  it("the top-level screen shows raw text to staff only, and its home is the reader's", () => {
    const src = read("components/ErrorBoundary.tsx");
    expect(src).toMatch(/showsTechnicalDetail\(\) && \(\s*<div className="w-full max-h-32/);
    expect(src).toContain("window.location.href = homePath();");
    expect(src).toContain("copyText(buildErrorReport(error)");
  });

  it("a server that cannot be reached is not 'please sign in'", () => {
    const src = read("components/DashboardLayout.tsx");
    const unreachable = src.indexOf("!isAuthError(authError as unknown as Error)");
    const signIn = src.indexOf('t("auth.accessRequired")');
    expect(unreachable).toBeGreaterThan(-1);
    expect(unreachable).toBeLessThan(signIn);
  });

  it("the loading screen matches the surface it is loading", () => {
    expect(read("components/LoadingSkeleton.tsx")).toContain('currentSurface() !== "staff"');
  });
});
