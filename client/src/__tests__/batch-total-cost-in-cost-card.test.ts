import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Owner, 2026-11-10 (said twice): «کۆی تێچووی لەسەر ئێمە هەندێ جار لە باچ هەیە
 * هەندێ جار نیە». The new-batch form kept the carrier's total on its first tab,
 * out of sight of the cost card; the edit form had it in the card. Both forms
 * now carry it in the «تێچوو» card, under the per-unit rate.
 */
describe("the batch's total cost lives in the cost card, on both forms", () => {
  const page = readFileSync(resolve(__dirname, "..", "pages", "batches", "Batches.tsx"), "utf8");

  it("one total-cost box per form, no stray copy on the first tab", () => {
    expect(page.match(/name="shippingCost"/g)?.length).toBe(2);
    expect(page).not.toContain("{/* Shipping Cost */}");
  });

  it("on the new-batch form it sits after the per-unit cost, inside the cost card", () => {
    const card = page.indexOf('<Input name="costPerCbm" type="number" step="0.01" className="pl-7" placeholder="e.g., 110.00" />');
    const total = page.indexOf('data-testid="batch-create-total-cost"');
    const pricingTab = page.indexOf('<TabsContent value="pricing"');
    expect(card).toBeGreaterThan(-1);
    expect(total).toBeGreaterThan(card);
    expect(total).toBeLessThan(pricingTab);
  });

  it("on the edit form it is still in the cost card", () => {
    expect(page).toContain('data-testid="batch-total-cost"');
  });
});
