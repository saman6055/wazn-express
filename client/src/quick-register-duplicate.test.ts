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

  it("a lookup that ran by itself takes neither the caret nor the screen", () => {
    expect(page).toContain("const silent = opts?.silent === true;");
    // Not found is the ordinary case while a number is half typed.
    expect(page).toContain("if (silent) return;");
    // The focus moves and the cheerful toasts belong to a run somebody asked for.
    expect((page.match(/if \(!silent\) setTimeout\(\(\) => \{/g) ?? []).length).toBe(2);
    expect(page).toContain("if (!silent) toast.success(");
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
