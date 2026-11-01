import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { statusTone, statusChip, statusDot, statusBgText, TONE_CHIP, TONE_BG, TONE_TEXT } from "./lib/statusTone";
import { BATCH_STATUS_TONE } from "./lib/shipmentFilters";
import { PACKAGE_STATUS_TONE } from "./lib/packageStatus";

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

describe("one colour per kind of status", () => {
  it("green is done, red is a problem, amber is a wait", () => {
    expect(statusTone("delivered")).toBe("success");
    expect(statusTone("paid")).toBe("success");
    expect(statusTone("cancelled")).toBe("problem");
    expect(statusTone("returned")).toBe("problem");
    expect(statusTone("rejected")).toBe("problem");
    expect(statusTone("pending")).toBe("waiting");
    expect(statusTone("customs_processing")).toBe("waiting");
    expect(statusTone("in_transit")).toBe("progress");
    expect(statusTone("registered")).toBe("neutral");
  });

  it("an unknown or empty status is neutral, never an error colour", () => {
    expect(statusTone("something_new")).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
    expect(statusTone(undefined)).toBe("neutral");
    expect(statusTone("  Delivered ")).toBe("success");
  });

  it("an approved order is still in progress; an approved claim is settled", () => {
    expect(statusTone("approved", "order")).toBe("progress");
    expect(statusTone("approved", "claim")).toBe("success");
    expect(statusTone("approved")).toBe("success");
  });

  it("the staff side matches the portal's palette exactly", () => {
    // The customer and the office must read a shipment in the same colour.
    for (const [status, chip] of Object.entries(BATCH_STATUS_TONE)) {
      expect(statusChip(status, "batch"), status).toBe(chip);
    }
    for (const [status, chip] of Object.entries(PACKAGE_STATUS_TONE)) {
      expect(statusChip(status, "package"), status).toBe(chip);
    }
  });

  it("the two halves put together are the chip", () => {
    for (const tone of Object.keys(TONE_CHIP) as (keyof typeof TONE_CHIP)[]) {
      const joined = `${TONE_BG[tone]} ${TONE_TEXT[tone]}`.split(" ").sort();
      expect(joined, tone).toEqual(TONE_CHIP[tone].split(" ").sort());
    }
    expect(statusBgText("delivered")).toEqual({ bg: TONE_BG.success, text: TONE_TEXT.success });
  });

  it("dots are solid, so they show on a white menu", () => {
    for (const status of ["delivered", "cancelled", "pending", "in_transit", "registered"]) {
      expect(statusDot(status)).toMatch(/^bg-\w+-(400|500)$/);
    }
  });
});

describe("the pages use the one palette", () => {
  const PAGES = [
    "pages/Packages.tsx",
    "pages/CommissionDashboard.tsx",
    "pages/CommissionOrders.tsx",
    "pages/FullPackageDashboard.tsx",
    "pages/UnifiedOrdersDashboard.tsx",
    "pages/PackagesDashboard.tsx",
    "pages/BatchReports.tsx",
    "pages/Dashboard.tsx",
  ];

  it("every converted page reads its colours from lib/statusTone", () => {
    for (const page of PAGES) {
      expect(read(page), page).toContain('from "@/lib/statusTone"');
    }
  });

  it("no dropdown dot is the pale half of a chip any more", () => {
    // `.split(" ")[0]` took the -100 background of the chip, which barely
    // showed on a white menu, and drifted from the pill beside it.
    for (const page of PAGES) {
      expect(read(page), page).not.toContain('?.split(" ")[0]');
    }
  });

  it("StatusBadge takes its colour from the shared palette and honours kind", () => {
    const badge = read("components/ui/status-badge.tsx");
    expect(badge).toContain('from "@/lib/statusTone"');
    expect(badge).toContain("statusTone(value, kind)");
    expect(badge).not.toMatch(/bg-(green|blue|amber|red)-100/);
  });

  it("translucent white panels have a dark twin", () => {
    for (const page of ["pages/ScanDashboard.tsx", "pages/CommissionDashboard.tsx", "pages/FullPackageDashboard.tsx"]) {
      const src = read(page);
      const white = src.match(/bg-white\/80/g)?.length ?? 0;
      const dark = src.match(/bg-white\/80 dark:bg-card\/80/g)?.length ?? 0;
      expect(dark, page).toBe(white);
    }
  });
});

describe("KPI cards are calm", () => {
  for (const file of ["components/dashboard/StatsCard.tsx", "components/dashboard/FinancialCard.tsx"]) {
    it(`${file} has a tinted tile, no gradient and no hover zoom`, () => {
      const src = read(file);
      expect(src).not.toContain("bg-gradient-to-br");
      expect(src).not.toMatch(/scale-10\d/);
      expect(src).not.toMatch(/shadow-(lg|xl)/);
      expect(src).toContain("text-2xl font-semibold tracking-tight tabular-nums");
    });
  }
});
