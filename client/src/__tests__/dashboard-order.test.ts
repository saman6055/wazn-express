import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The dashboard reads by urgency (owner, 2026-11-05: «پرایۆریتی لە گرنگترین
 * بۆ کەمترین گرنگی نیە»): set by flex `order`, so the blocks keep their place
 * in the file.
 */
const page = readFileSync(resolve(__dirname, "../pages/dashboard/Dashboard.tsx"), "utf8");

describe("dashboard order", () => {
  it("the brief, the problems and the late cards come first, then today's figures", () => {
    expect(page).toContain('<div className="order-[1]"><DailyBrief language={language} /></div>');
    expect(page).toContain('className="pro-section order-[2]"');
    expect(page).toContain('<div className="order-[3] empty:hidden"><AlertSummarySection /></div>');
    expect(page).toContain('className="order-[4]"');
  });

  it("long-run totals sit below the day's work, charts last", () => {
    expect(page).toContain('<DashboardSection className="pro-section order-[15]">');
    expect(page).toContain('<DashboardSection className="pro-section order-last"');
  });
});
