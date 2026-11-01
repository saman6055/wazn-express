import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's rule (2026-09-12): the portal must not ask a customer to
 * install the app by hand. The browser's own offer arrives once, early — so
 * it is caught before the first paint and spent by one button.
 */
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("the browser's install offer", () => {
  it("is caught before React draws anything", () => {
    const main = read("main.tsx");
    expect(main).toContain("captureInstallOffer()");
    expect(main.indexOf("captureInstallOffer()")).toBeLessThan(main.indexOf("createRoot("));
  });

  it("is what the portal dialog spends — it no longer waits for its own", () => {
    const dialog = read("components/PWAInstallPrompt.tsx");
    expect(dialog).toContain("useInstallOffer()");
    expect(dialog).toContain("installApp()");
    expect(dialog).not.toContain("addEventListener('beforeinstallprompt'");
  });

  it("has a way out of the in-app browsers, which never make it", () => {
    const dialog = read("components/PWAInstallPrompt.tsx");
    expect(dialog).toContain("package=com.android.chrome");
    expect(dialog).toContain("S.browser_fallback_url=");
  });
});

describe("keeping and spending the offer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("is kept for the button, spent once, and gone once the app is installed", async () => {
    const handlers: Record<string, ((event: unknown) => void)[]> = {};
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        (handlers[type] ??= []).push(fn);
      },
      removeEventListener: () => {},
    });
    vi.resetModules();
    const { captureInstallOffer, getInstallOffer, installApp } = await import("./lib/installPrompt");
    captureInstallOffer();

    const preventDefault = vi.fn();
    const prompt = vi.fn(async () => {});
    handlers["beforeinstallprompt"].forEach((fn) =>
      fn({ preventDefault, prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }),
    );

    // Without preventDefault the browser spends the offer on its own bar.
    expect(preventDefault).toHaveBeenCalled();
    expect(getInstallOffer()).not.toBeNull();

    await expect(installApp()).resolves.toBe("accepted");
    expect(prompt).toHaveBeenCalled();
    expect(getInstallOffer()).toBeNull();

    // Nothing left to spend: the screen shows another way in instead.
    await expect(installApp()).resolves.toBe("unavailable");
  });
});
