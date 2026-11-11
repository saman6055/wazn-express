import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8").replace(/^﻿/, "");

/**
 * Owner, 2026-11-11: the orders list printed «status.in_china_warehouse».
 * t() returns the key for a missing word, so the badge's fallback never ran,
 * and order statuses live under fullPackage.status, where it never looked.
 */
describe("every order status has a word on its badge", () => {
  it("the badge looks under status and fullPackage.status, and never shows a key", () => {
    const badge = read("client/src/components/ui/status-badge.tsx");
    expect(badge).toContain("return v && v !== key ? v : null;");
    expect(badge).toContain("word(`status.${meta.value}`) ?? word(`fullPackage.status.${meta.value}`) ?? meta.fallbackLabel");
  });

  it("each order status in the schema has a word in all four languages", () => {
    const schema = read("drizzle/schema/fullPackage.schema.ts");
    const m = schema.match(/status:\s*mysqlEnum\("status",\s*\[([^\]]*)\]/);
    const statuses = Array.from((m?.[1] ?? "").matchAll(/"([a-z_]+)"/g), (x) => x[1]);
    expect(statuses.length).toBeGreaterThan(10);
    for (const lang of ["ku", "en", "ar", "zh"]) {
      const d = JSON.parse(read(`client/src/locales/${lang}.json`));
      const missing = statuses.filter((s) => !(d.status?.[s]) && !(d.fullPackage?.status?.[s]));
      expect(missing, lang).toEqual([]);
    }
  });
});
