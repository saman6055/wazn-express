import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * «Box them all» puts on-the-road cartons in the box (owner, 2026-11-02);
 * paying the box must not call them delivered before they come. They are
 * delivered on their arrival scan instead (audit 2026-11-05).
 */
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("a paid box does not deliver cartons still on the road", () => {
  it("the box's delivery step skips them", () => {
    const src = read("lib/boxLifecycle.ts");
    expect(src).toContain("const onRoad = await db.parcelsStillOnTheRoad(");
    expect(src).toContain("if (item.packageId && onRoad.has(Number(item.packageId)))");
  });

  it("on the road = China batch, China-registered, not checked in, status not arrived", () => {
    const src = read("db/parcelOnRoad.db.ts");
    expect(src).toContain('const NOT_HERE = ["registered", "in_batch", "in_transit"];');
    expect(src).toContain('eq(packageScans.scanType, "received_local")');
  });

  it("the arrival scan delivers a parcel whose box is already finished", () => {
    const src = read("routers/scanning.router.ts");
    expect(src).toContain("if (await db.parcelInFinishedBox(input.packageId))");
  });
});
