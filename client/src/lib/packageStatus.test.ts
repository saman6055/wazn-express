import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PACKAGE_STATUS_LABEL, PACKAGE_STATUS_TONE, packageStatusTone } from "./packageStatus";

describe("PACKAGE_STATUS_TONE", () => {
  it("colours every status the label map names", () => {
    for (const status of Object.keys(PACKAGE_STATUS_LABEL)) {
      expect(PACKAGE_STATUS_TONE[status], `${status} has no tone`).toBeTruthy();
    }
  });

  it("carries both themes in every entry", () => {
    for (const [status, tone] of Object.entries(PACKAGE_STATUS_TONE)) {
      expect(tone, `${status} lacks a dark background`).toMatch(/dark:bg-/);
      expect(tone, `${status} lacks a dark text colour`).toMatch(/dark:text-/);
    }
  });

  it("does not paint a returned or cancelled parcel the colour of nothing-to-see", () => {
    expect(PACKAGE_STATUS_TONE.returned).toContain("red");
    expect(PACKAGE_STATUS_TONE.cancelled).toContain("red");
    expect(PACKAGE_STATUS_TONE.ready_for_delivery).toContain("emerald");
    expect(packageStatusTone(undefined)).toBe(PACKAGE_STATUS_TONE.registered);
  });

  it("is what the screens use — no private colour switch on a package status", () => {
    for (const file of ["PortalBatchDetail.tsx", "PortalSearch.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "../pages/portal", file), "utf8");
      expect(src, `${file} should use the shared tone`).toMatch(/packageStatusTone|PackageStatusChip/);
      expect(src, `${file} still colours a package status by hand`)
        .not.toMatch(/case "customs_processing":\s*\n\s*return ["'(]?(isDark|"bg-)/);
    }
  });
});
