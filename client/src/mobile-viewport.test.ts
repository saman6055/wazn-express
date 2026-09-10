import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("the page on a phone", () => {
  it("can be pinch-zoomed, and reports the iPhone's safe areas", () => {
    const html = read("../index.html");
    const viewport = html.match(/name="viewport"\s+content="([^"]+)"/)?.[1] ?? "";
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
  });

  it("the installed app turns with the phone", () => {
    expect(read("../public/manifest.json")).not.toContain('"orientation"');
    expect(read("../../server/services/appIcons.service.ts")).not.toMatch(/orientation:\s*"portrait/);
  });

  it("the status-bar spacer stays put and the bars stick below it", () => {
    for (const file of [
      "components/CustomerPortalLayout.tsx",
      "components/ModernPortalLayout.tsx",
      "components/Skin3PortalLayout.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("sticky top-0 z-50 h-safe-area-top");
      expect(src, file).toContain("supports-[height:100dvh]:min-h-dvh");
    }
    expect(read("components/CustomerPortalLayout.tsx")).toContain("sticky top-[env(safe-area-inset-top)] z-40");
    expect(read("components/PortalTopBar.tsx")).toContain("sticky top-[env(safe-area-inset-top)]");
  });
});

describe("typing on a phone", () => {
  // A field under 16px makes iOS zoom the whole page in on focus, and leave it
  // zoomed after — now that zoom is allowed, every field must be 16px there.
  const FIELDS: [string, number][] = [
    ["components/CustomerPortalLayout.tsx", 1],
    ["pages/portal/PortalSecurity.tsx", 1],
    ["pages/portal/PortalShipments.tsx", 1],
    ["pages/portal/modern/ModernPortalShipments.tsx", 1],
    ["pages/portal/skin3/Skin3PortalShipments.tsx", 1],
    ["pages/portal/PortalFAQ.tsx", 1],
    ["pages/portal/PortalProhibitedPackages.tsx", 1],
    ["pages/portal/PortalInvoiceReports.tsx", 1],
    ["pages/store/StoreProduct.tsx", 5],
  ];
  for (const [file, count] of FIELDS) {
    it(`${file} keeps its fields at 16px on phones`, () => {
      expect(read(file).match(/text-base md:text-sm/g)?.length ?? 0).toBeGreaterThanOrEqual(count);
    });
  }
});

describe("things that float", () => {
  it("the chat panel fits a 360px screen", () => {
    const src = read("components/LiveChatSupport.tsx");
    expect(src).toContain("inset-x-2 sm:inset-x-auto sm:w-[380px]");
    expect(src).toContain('"bottom-[calc(6rem+env(safe-area-inset-bottom))]"');
    expect(src).toContain('CSS.supports?.("height", "100dvh")');
  });

  it("toasts sit above the bottom navigation and the home indicator", () => {
    expect(read("components/ui/sonner.tsx")).toContain('mobileOffset={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}');
  });

  it("the prompts sit above the bottom navigation, not inside it", () => {
    expect(read("components/PushNotificationPrompt.tsx")).toContain("bottom-[calc(6.5rem+env(safe-area-inset-bottom))]");
    expect(read("components/PWAInstallPrompt.tsx")).toContain("bottom-[calc(6.5rem+env(safe-area-inset-bottom))]");
  });

  it("the message screens measure the screen that is actually visible", () => {
    for (const file of ["pages/CustomerMessages.tsx", "pages/portal/PortalMessages.tsx", "pages/PermissionsManagement.tsx"]) {
      expect(read(file), file).toMatch(/supports-\[height:100dvh\]:h-\[calc\(100dvh-\d+px\)\]/);
    }
  });
});
