import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { quickRegisterDayKey, readQuickRegisterDay, saveQuickRegisterDay } from "@/lib/quickRegisterDay";

/** Warehouse, transport and batch hold for the day (owner, 2026-11-03). */
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};

describe("Quick Register keeps the day's choices", () => {
  afterEach(() => store.clear());
  const mon = new Date(2026, 10, 3, 9);
  const monEve = new Date(2026, 10, 3, 22);
  const tue = new Date(2026, 10, 4, 8);

  it("the same day reads back what was chosen", () => {
    saveQuickRegisterDay({ originWarehouseId: 2, shippingType: "air_irregular", batchId: "82" }, mon);
    expect(readQuickRegisterDay(monEve)).toEqual({ originWarehouseId: 2, shippingType: "air_irregular", batchId: "82" });
  });

  it("a new day starts empty, and yesterday is dropped", () => {
    saveQuickRegisterDay({ originWarehouseId: 2, shippingType: "sea", batchId: "82" }, mon);
    expect(readQuickRegisterDay(tue)).toBeNull();
    saveQuickRegisterDay({ originWarehouseId: 1, shippingType: "air_regular", batchId: "" }, tue);
    expect(store.has(quickRegisterDayKey(mon))).toBe(false);
  });

  it("two people on one computer each keep their own day", () => {
    saveQuickRegisterDay({ originWarehouseId: 2, shippingType: "sea", batchId: "82" }, mon, 5);
    saveQuickRegisterDay({ originWarehouseId: 1, shippingType: "air_regular", batchId: "90" }, mon, 7);
    expect(readQuickRegisterDay(monEve, 5)?.batchId).toBe("82");
    expect(readQuickRegisterDay(monEve, 7)?.batchId).toBe("90");
    saveQuickRegisterDay({ originWarehouseId: 1, shippingType: "air_regular", batchId: "" }, tue, 7);
    expect(store.has(quickRegisterDayKey(mon, 5))).toBe(false);
  });

  it("the clear button keeps them", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../pages/packages/QuickRegister.tsx"), "utf8");
    expect(src).toContain("saveQuickRegisterDay({ originWarehouseId, shippingType, batchId }, new Date(), user.id)");
    expect(src).not.toContain('setShippingType("air_regular");');
  });
});
