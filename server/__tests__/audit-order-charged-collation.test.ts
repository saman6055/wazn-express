import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * order_charged_to_other failed every run in production with
 * ER_CANT_AGGREGATE_2COLLATIONS (ledger vs order tables), and the brief said
 * «پشکنین نەیتوانی کاربکات» every morning (2026-11-05). The LIKE names one collation.
 */
const src = readFileSync(resolve(__dirname, "../services/auditSweep.service.ts"), "utf8");

describe("order_charged_to_other compares under one collation", () => {
  it("the LIKE across tables names the collation on both sides", () => {
    const start = src.indexOf("order_charged_to_other: `");
    const body = src.slice(start, src.indexOf("`,", start));
    expect(body).toContain("t.description COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', o.orderCode COLLATE utf8mb4_unicode_ci, '%')");
    expect(body).not.toContain("t.description LIKE CONCAT('%', o.orderCode, '%')");
  });
});
