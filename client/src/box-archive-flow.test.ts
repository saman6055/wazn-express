import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * On the delivery-box screen, a box paid for leaves at once and the next one
 * moves up into its place; the archive keeps it one tap away.
 *
 * It used to stay: the payment dialogs refreshed the payment panel and never
 * the list, and the list hid archived boxes after fetching a page of twenty,
 * so a paid box left a hole instead of letting the next one up.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

describe("the list follows the money", () => {
  const page = read("pages/CustomerDeliveryScanner.tsx");

  it("asks the server to leave the archive out, or to show only it", () => {
    expect(page).toContain('params.archive = view === "paid" ? "only" : "exclude";');
    expect(page).not.toContain("partitionBoxes(");
  });

  it("returns to the first page when switching between list and archive", () => {
    expect(page).toContain("onChange={(v) => { setView(v); setCurrentPage(0); }}");
  });

  for (const file of ["components/delivery/QuickSettleDialog.tsx", "components/delivery/BoxSettlementPanel.tsx"]) {
    it(`${path.basename(file)} refreshes the list after a payment and says what happened`, () => {
      const src = read(file);
      const at = src.indexOf("deliveryBox.settle.useMutation");
      expect(at, "the settle mutation has moved or gone").toBeGreaterThan(-1);
      const body = src.slice(at, src.indexOf("onError", at));
      expect(body).toContain("utils.deliveryBox.invalidate()");
      expect(body).toContain("res.boxFinished");
      expect(body).toContain("res.finishError");
    });
  }

  it("a reversed payment brings the box back into the list", () => {
    const src = read("components/delivery/BoxSettlementPanel.tsx");
    const at = src.indexOf("deliveryBox.reverseSettlement.useMutation");
    const body = src.slice(at, src.indexOf("onError", at));
    expect(body).toContain("utils.deliveryBox.invalidate()");
  });
});
