import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Empty delivery boxes are flagged, and deletable where they are seen
 * (owner, 2026-09-17). The rule for "empty" is unit-tested in
 * shared/emptyBox.test.ts; this pins the wiring that carries it to a screen
 * and the safety that goes with deleting.
 *
 * What would undo it: the flag dropping off the boxes page or out of the bell,
 * the button offered on a box that is not empty or to someone who may not
 * delete, or a delete that trusts the list instead of checking again.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

const alert = read("components/delivery/EmptyBoxes.tsx");
const table = read("components/delivery/BoxTable.tsx");
const page = read("pages/CustomerDeliveryScanner.tsx");
const router = readRoot("server/routers/scanning.router.ts");

describe("the boxes page flags empty boxes", () => {
  it("above the list, with every empty box behind it", () => {
    const flag = page.indexOf("<EmptyBoxesAlert canDelete={canDeleteBoxes} />");
    const list = page.indexOf("<BoxTable");
    expect(flag).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(flag);
    expect(alert).toContain("trpc.deliveryBox.emptyBoxes.useQuery(");
    expect(alert).toContain("if (boxes.length === 0) return null;");
  });

  it("opens the list by itself when the bell sent the reader", () => {
    expect(alert).toContain('new URLSearchParams(search).get("empty") === "1"');
  });

  it("each box in it can be copied and, by an admin, deleted", () => {
    expect(alert).toContain("<CopyButton\n                      value={b.boxCode}");
    expect(alert).toContain("{canDelete && (");
    expect(alert).toContain("setDeleting({ id: b.id, boxCode: b.boxCode })");
  });
});

describe("the delete button", () => {
  it("replaces the payment button on an empty box only, by the shared rule", () => {
    expect(table).toContain('import { isEmptyBox } from "@shared/emptyBox";');
    expect(table).toMatch(/\{onDeleteEmpty && isEmptyBox\(\{[\s\S]{0,220}\}\) \? \(/);
    expect(table).toContain("onClick={() => onDeleteEmpty({ id: box.id, boxCode: box.boxCode })}");
  });

  it("is handed only to someone who may delete a box", () => {
    expect(page).toContain('const canDeleteBoxes = user?.role === "admin" || user?.role === "super_admin";');
    expect(page).toContain("onDeleteEmpty={canDeleteBoxes ? setDeletingBox : undefined}");
    const del = router.slice(router.indexOf("  delete: adminProcedure"), router.indexOf("  // Profit report"));
    expect(del.length).toBeGreaterThan(200);
  });

  it("asks once, and deletes only if the box is still empty — into the recycle bin", () => {
    expect(alert).toContain("remove.mutate({ id: box.id, onlyIfEmpty: true, reason:");
    const start = router.indexOf("  delete: adminProcedure");
    expect(start).toBeGreaterThan(-1);
    const del = router.slice(start, router.indexOf("  // Profit report", start));
    expect(del).toContain("onlyIfEmpty: z.boolean().optional()");
    expect(del).toContain("if (input.onlyIfEmpty && !(await db.isBoxStillEmpty(box.id)))");
    // The check comes before anything is written or removed.
    expect(del.indexOf("isBoxStillEmpty")).toBeLessThan(del.indexOf("db.recordDeletion("));
    expect(del.indexOf("isBoxStillEmpty")).toBeLessThan(del.indexOf("db.deleteDeliveryBoxWithItems("));
  });
});

describe("the bell counts them by the same rule", () => {
  it("a notice that leads to the list", () => {
    const bell = readRoot("shared/riskBell.ts");
    expect(bell).toContain('"empty-boxes": "/customer-delivery-scanner?empty=1"');
    expect(bell).toContain('items.push({ id: "empty-boxes", level: "notice", count: facts.emptyBoxes });');
    const reports = readRoot("server/db/reports.db.ts");
    expect(reports).toContain("settle('empty boxes', countEmptyBoxes, 0)");
    const boxes = readRoot("server/db/deliveryBoxes.db.ts");
    for (const fn of ["export async function getEmptyBoxes", "export async function countEmptyBoxes", "export async function isBoxStillEmpty"]) {
      const start = boxes.indexOf(fn);
      expect(start, fn).toBeGreaterThan(-1);
      expect(boxes.slice(start, boxes.indexOf("\n}\n", start))).toContain("emptyBoxSql()");
    }
  });
});
