import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A parcel already registered says so at the tracking box, with its figures.
 *
 * The owner, 2026-09-21: the warning must come the moment the number is
 * entered, not at the last step — and it must say which customer code it
 * sits on, what it weighed and what it was priced at. The warning existed,
 * but only a scan or the search button ran the lookup: a number typed by
 * hand and followed straight to the scales was refused at the save, after
 * the weighing, the photograph and the customer.
 */

const page = fs
  .readFileSync(path.join(__dirname, "pages", "QuickRegister.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

describe("the tracking box", () => {
  it("looks the number up when the typing stops, not only on Enter", () => {
    expect(page).toContain("const MIN_TRACKING_LOOKUP = 8;");
    expect(page).toContain("const TRACKING_LOOKUP_PAUSE_MS = 800;");
    const change = page.slice(page.indexOf("const handleTrackingChange = (value: string) => {"), page.indexOf("const selectCustomer"));
    expect(change).toContain("void handleTrackingSearch({ silent: true });");
    expect(change).toContain("if (value.trim().length < MIN_TRACKING_LOOKUP) return;");
  });

  it("a lookup that ran by itself takes no screen", () => {
    expect(page).toContain("const silent = opts?.silent === true;");
    // The cheerful toast and the loud alert belong to a run somebody asked
    // for. Nothing pops up while a number is still being typed.
    expect(page).toContain("if (!silent) toast.success(");
    expect(page).toContain("if (silent) {");
  });

  it("but it does hand the caret to the kilos", () => {
    /*
     * This used to say "neither the caret nor the screen", and the caret half
     * was right at the time: the weight box sat in the middle of the page, so
     * moving to it scrolled away the order that had just been found.
     *
     * The owner overruled it on 2026-09-29 — «پاش تراک ئەبێ ماوس خۆی یەکسەر
     * بێتە سەر کیلۆ، ئەوێ گلۆ بکات» — once the box was on the bottom bar,
     * where there is nothing to scroll. Typed by hand or scanned, the tracking
     * now ends in the same place.
     */
    expect(page).toContain("const focusWeight = useCallback(() => {");
    expect((page.match(/if \(!silent\) setTimeout\(\(\) => \{/g) ?? []).length).toBe(0);
    // One exception, and it is the one that matters: a duplicate. The next
    // thing to happen is the next parcel, not the weight of this one.
    const found = page.slice(page.indexOf("if (result.source === \"package\") {", page.indexOf("setTimeout(() => {")));
    expect(found.slice(0, 600)).toContain("if (silent) return;");
  });

  it("says the code it is registered on, and what it weighed and cost", () => {
    const alert = page.slice(page.indexOf("const already = result.package as {"), page.indexOf("} else if (!silent) {"));
    expect(alert.length).toBeGreaterThan(200);
    expect(alert).toContain("calculatedCostUsd?: string | number | null;");
    expect(alert).toContain("const facts = [");
    expect(alert).toContain("`${alreadyKg} kg`");
    expect(alert).toContain("`$${alreadyUsd.toFixed(2)}`");
    expect(alert).toContain("result.customer?.customerCode");
    // Still the loud warning, not a toast that fades behind the form.
    expect(alert).toContain('kind: "warning"');
  });
});

/**
 * "Already registered", said at the scan (owner, 2026-10-05).
 *
 * «کە تراک سکان کرا، ئەگەر داخڵ کرابوو یەکسەر بنووسێ داخڵ کراوە — نەک لە ئاخر
 * هەنگاو بڵێ دووبارەیە.» The warning above existed, and still a tracking that
 * belonged to a commission or full-package order was refused only at the
 * save: the lookup asked about orders first, and an order was an answer that
 * ended it — nothing ever looked at whether that order's carton was already
 * in.
 */
describe("the scan asks what the save asks, and asks it first", () => {
  const lookup = fs
    .readFileSync(path.join(__dirname, "..", "..", "server", "db", "fullPackage.db.ts"), "utf8")
    .replace(/\r\n/g, "\n");
  const start = lookup.indexOf("export async function searchTrackingInAllOrderTypes");
  const body = lookup.slice(start, lookup.indexOf("\nexport ", start + 20));

  it("looks for a parcel under the tracking before it looks for an order", () => {
    expect(start).toBeGreaterThan(-1);
    const parcel = body.indexOf(".from(packages)");
    const order = body.indexOf(".from(fullPackageOrders)");
    expect(parcel).toBeGreaterThan(-1);
    expect(order).toBeGreaterThan(-1);
    expect(parcel).toBeLessThan(order);
  });

  it("asks it once — a second, later copy is how the two answers drifted apart", () => {
    expect((body.match(/\.from\(packages\)/g) ?? []).length).toBe(1);
    expect(body).toContain('source: "package" as const');
  });

  it("is the same question the register refuses on", () => {
    const router = fs
      .readFileSync(path.join(__dirname, "..", "..", "server", "routers", "packages.router.ts"), "utf8");
    expect(router).toContain("const existing = await db.getPackageByTrackingNumber(input.trackingNumber.trim());");
    expect(body).toContain("eq(packages.trackingNumber, trackingNumber)");
  });
});
