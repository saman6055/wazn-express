import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The chips above the box list (owner, 2026-09-10): unpaid, new, old,
 * handed over unpaid, and paid. Each is a server-side slice with its count
 * from the same query, and "old" is the red badge's own five days.
 */

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

describe("the page", () => {
  const page = read("client/src/pages/CustomerDeliveryScanner.tsx");

  it("asks the server for the slice, so a page is a full page", () => {
    expect(page).toContain('params.archive = view === "paid" ? "only" : "exclude";');
    expect(page).toContain('if (view === "new" || view === "old" || view === "handed") params.segment = view;');
  });

  it("shows the chips and goes back to the first page on every switch", () => {
    expect(page).toContain("<BoxSegmentBar");
    expect(page).toContain("onChange={(v) => { setView(v); setCurrentPage(0); }}");
    expect(page).not.toContain("showArchivedBoxes");
  });
});

describe("the server", () => {
  it("takes the slice", () => {
    const router = read("server/routers/scanning.router.ts");
    expect(between(router, "list: staffProcedure", "settlementView:")).toContain('segment: z.enum(["new", "old", "handed"]).optional()');
  });

  it("slices only the unpaid list, by the shared five days", () => {
    const fn = between(read("server/db/deliveryBoxes.db.ts"), "export async function getAllDeliveryBoxes(", "\nexport async function");
    expect(fn).toContain('if (filters?.archive === "exclude" && filters.segment)');
    expect(fn).toContain("boxOldCutoff()");
    expect(fn).toContain('filters.segment === "handed"');
    expect(fn).toContain("segmentCounts = {");
    expect(fn).toContain("return { boxes: boxesWithType, total, archivedTotal, segmentCounts };");
  });
});

describe("one five days", () => {
  it("the badge and the chips read the shared rule", () => {
    const alert = read("client/src/lib/boxAlert.ts");
    expect(alert).toContain('from "@shared/boxAging"');
    expect(alert).not.toMatch(/BOX_UNPAID_ALERT_DAYS\s*=\s*\d/);
    expect(read("client/src/components/delivery/BoxSegmentBar.tsx")).toContain('import { BOX_UNPAID_ALERT_DAYS } from "@shared/boxAging";');
  });
});
