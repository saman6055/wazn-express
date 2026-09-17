import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { EMPTY_BOX_STATUSES, isEmptyBox } from "./emptyBox";

describe("an empty box", () => {
  it("has nothing in it and has not gone anywhere", () => {
    expect(isEmptyBox({ status: "open", itemCount: 0 })).toBe(true);
    expect(isEmptyBox({ status: "ready", itemCount: 0, isCharged: false, hasPayment: false })).toBe(true);
  });

  it("is never one with something in it", () => {
    expect(isEmptyBox({ status: "open", itemCount: 1 })).toBe(false);
  });

  it("is never one whose own record counts parcels — that box lost them, it is not empty", () => {
    // BOX-20260719-003: the list said 4 parcels, the alert said empty.
    expect(isEmptyBox({ status: "open", itemCount: 0, recordedPackages: 4 })).toBe(false);
    expect(isEmptyBox({ status: "open", itemCount: 0, recordedPackages: 0 })).toBe(true);
  });

  it("is never one that was sent, handed over or cancelled", () => {
    for (const status of ["in_transit", "delivered", "cancelled"]) {
      expect(isEmptyBox({ status, itemCount: 0 }), status).toBe(false);
    }
  });

  it("is never one with money against it", () => {
    expect(isEmptyBox({ status: "open", itemCount: 0, isCharged: true })).toBe(false);
    expect(isEmptyBox({ status: "ready", itemCount: 0, hasPayment: true })).toBe(false);
  });

  it("means the same thing on the server", () => {
    expect([...EMPTY_BOX_STATUSES]).toEqual(["open", "ready"]);
    const server = fs.readFileSync(path.resolve(__dirname, "../server/db/deliveryBoxes.db.ts"), "utf8").replace(/\r\n/g, "\n");
    const start = server.indexOf("function emptyBoxSql()");
    expect(start).toBeGreaterThan(-1);
    const fn = server.slice(start, server.indexOf("\n}\n", start));
    expect(fn).toContain("${deliveryBoxes.status} IN ('open', 'ready')");
    expect(fn).toContain("${deliveryBoxes.isCharged} = 0");
    expect(fn).toContain("${deliveryBoxes.totalPackages} = 0");
    expect(fn).toContain("NOT EXISTS (SELECT 1 FROM ${deliveryBoxItems} WHERE ${deliveryBoxItems.boxId} = ${deliveryBoxes.id})");
    expect(fn).toContain("NOT EXISTS (SELECT 1 FROM ${boxSettlements} WHERE ${boxSettlements.boxId} = ${deliveryBoxes.id})");
  });
});
