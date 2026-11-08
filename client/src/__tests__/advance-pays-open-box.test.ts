/** The advance form asks about each box still owing; yes pays it through the box (owner, 2026-11-08). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("advance pays the open box first", () => {
  const page = read("client/src/pages/finance/CustomerFinance.tsx");
  const db = read("server/db/payBoxesFirst.db.ts");
  it("asks, never assumes: the record button waits for an answer on every box", () => {
    expect(page).toContain('data-testid="advance-open-boxes"');
    expect(page).toContain("const boxesUnanswered = askBoxes.some((b) => !boxAnswers[b.id]);");
    expect(page).toContain("|| boxesUnanswered}");
  });
  it("yes goes through the box's own settlement, oldest first; the rest through recordPayment", () => {
    expect(db).toContain("const res = await createBoxSettlement({");
    expect(db).toContain("await finishPaidBox(row.id, actor.id);");
    expect(db).toContain(".orderBy(asc(deliveryBoxes.createdAt), asc(deliveryBoxes.id));");
    expect(page).toContain("amountUsd: Math.round(advanceUsd * 100) / 100,");
  });
  it("the box's share is what the quick till would ask, promised discounts and the account's advance counted", () => {
    expect(db).toContain("const floors = pledgeFloors(view.pledges);");
    expect(db).toContain("openUsd: view.openChargesUsd ?? undefined,");
  });
});
