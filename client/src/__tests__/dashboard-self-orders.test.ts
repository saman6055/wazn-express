import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Self orders on the dashboard carry the split by transport and the busiest customers (owner, 2026-11-05). */
const page = readFileSync(resolve(__dirname, "../pages/dashboard/Dashboard.tsx"), "utf8");

describe("dashboard self orders", () => {
  it("shows the split by transport and the busiest customers, each a link", () => {
    expect(page).toContain('data-testid="self-by-type"');
    expect(page).toContain('data-testid="self-top-customers"');
    expect(page).toContain("href={`/customers/${c.customerId}`}");
  });

  it("calls the amount billed, not revenue", () => {
    expect(page).toContain('ku: "حیسابکراو", en: "Billed"');
  });
});
