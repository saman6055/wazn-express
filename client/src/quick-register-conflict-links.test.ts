import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Quick Register's warnings lead to the record they are about — and they tell
 * the truth about it (owner, 2026-09-23).
 *
 * "It says this tracking exists somewhere else. It is very important that
 * there is a link, so I can go to the very place that has it."
 *
 * And the bug underneath, in his own words: he searched the tracking, found
 * the record that held it, deleted it there — and Quick Register went on
 * showing the same warning. The app's queries are good for two minutes by
 * default and `.fetch()` honours that, so the screen was answering from a
 * copy of the world as it had been before he fixed it.
 *
 * What would undo it: a lookup allowed to answer from the cache again, or a
 * warning that names a record without a way to it.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

const page = read("pages/QuickRegister.tsx");
const alert = read("components/SystemAlert.tsx");

describe("the lookup asks the server", () => {
  it("both lookups are told not to answer from memory", () => {
    expect((page.match(/staleTime: 0 \}/g) ?? []).length).toBe(2);
    expect(page).toContain("await trpcUtils.scanning.searchTrackingAllTypes.fetch(\n        { trackingNumber: currentTracking.trim() },\n        { staleTime: 0 },\n      );");
    expect(page).toContain("await trpcUtils.packages.lookupTrackingExpanded.fetch(\n              { trackingNumber: currentTracking.trim() },\n              { staleTime: 0 },\n            );");
  });
});

describe("a warning leads to the record", () => {
  it("the alert can carry a way to it, beside its OK", () => {
    expect(alert).toContain("openHref?: string;");
    expect(alert).toContain("openLabel?: string;");
    expect(alert).toContain('data-testid="system-alert-open"');
    expect(alert).toContain("window.location.assign(href);");
  });

  it("the already-registered alert opens that parcel", () => {
    expect(page).toContain("openHref: parcelListHref(already?.packageCode || currentTracking.trim()),");
    expect(page).toContain('ku: "پاکەتەکە بکەرەوە"');
  });

  it("a shared tracking's orders are each a link to their order", () => {
    expect(page).toContain("function orderHref(order: { id: number; orderCode: string; orderType?: string | null }): string {");
    expect(page).toContain("parcelSourceTarget([");
    expect((page.match(/href=\{orderHref\(od\.order\)\}/g) ?? []).length).toBe(2);
  });

  it("the different-customer warning names the orders and the alerts page", () => {
    const panel = page.slice(page.indexOf("expandedLookup.flags?.customerMismatch"), page.indexOf("expandedLookup?.case === 'shared'"));
    expect(panel).toContain("href={orderHref(od.order)}");
    expect(panel).toContain('href="/tracking-alerts"');
    expect(panel).toContain("od.customer?.customerCode");
  });
});

describe("the warning can be acted on", () => {
  const db = fs
    .readFileSync(path.resolve(SRC, "../..", "server/db/fullPackage.db.ts"), "utf8")
    .replace(/\r\n/g, "\n");

  it("a tracking taken off an order is taken off the table too", () => {
    // The mirror only ever inserted, so an edited-away tracking stayed on the
    // order for ever — and the warning is computed from that very table.
    expect(db).toContain("const dropped = Array.from(before).filter((t) => !after.has(t));");
    expect(db).toContain("for (const row of stale) await removeOrderTracking(row.id);");
    // Only what the order itself used to carry: rows added through the
    // multi-tracking screen never appear in the JSON and must survive.
    expect(db).toContain("const before = clean([...(((existing as { trackingNumbers?: string[] | null }).trackingNumbers) ?? []), existing.trackingNumber]);");
    expect(db).toContain("const after = clean([...list, single]);");
  });

  it("and the rows already left behind can be cleared from the warning itself", () => {
    expect(page).toContain("const unlinkTracking = trpc.fullPackage.removeOrderTracking.useMutation({");
    expect(page).toContain("const row = od.trackings?.find((tr) => tr.trackingNumber === trackingNumber.trim());");
    expect(page).toContain("if (ok) unlinkTracking.mutate({ id: row.id });");
    // Nothing is unlinked without being asked, and the screen re-reads after.
    expect(page).toContain("const ok = await confirmAction(pickLang(language, {");
    expect(page).toContain("await handleTrackingSearch({ silent: true });");
  });
});
