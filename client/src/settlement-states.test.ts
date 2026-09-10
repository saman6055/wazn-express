import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The payment window never says "nothing owed" when it simply failed.
 *
 * 2026-09-10, BOX-20260719-003: the list said 53 days unpaid, the payment
 * window said nothing was owed, and nobody could tell whether the box was
 * paid or the window was broken. Both payment windows now show a failure as
 * a failure (with the copyable report every error screen has), and say which
 * of "no parcels" or "all covered" it is.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), "utf8").replace(/\r\n/g, "\n");
const NOTHING_OWED_KU = "هیچ پارەیەکی ماوە نییە لەم بۆکسە";

describe("both payment windows", () => {
  for (const file of ["components/delivery/QuickSettleDialog.tsx", "components/delivery/BoxSettlementPanel.tsx"]) {
    const src = read(file);

    it(`${path.basename(file)} shows a load failure as a failure`, () => {
      expect(src).toContain("error, refetch } = trpc.deliveryBox.settlementView.useQuery(");
      expect(src).toContain("<SettlementLoadError error={error} onRetry={() => void refetch()} />");
    });

    it(`${path.basename(file)} says why there is nothing to take`, () => {
      expect(src).toContain("<NothingToTake view={data} />");
      expect(src, "the bare message is back; use NothingToTake").not.toContain(NOTHING_OWED_KU);
    });
  }

  it("the quick dialog does not treat a failed load as nothing to pay", () => {
    const src = read("components/delivery/QuickSettleDialog.tsx");
    expect(src).toContain("const nothingToPay = !isLoading && !error && parcels.length === 0;");
    expect(src).toContain("{!isLoading && !error && !nothingToPay && !showParcels && (");
  });

  it("the panel no longer goes blank when the box is missing", () => {
    expect(read("components/delivery/BoxSettlementPanel.tsx")).not.toContain("if (!data?.box) return null;");
  });

  it("the failure uses the one report format", () => {
    const states = read("components/delivery/SettlementStates.tsx");
    expect(states).toContain("buildErrorReport(");
    expect(states).toContain("getErrorBoundaryStrings()");
    expect(states).toContain(NOTHING_OWED_KU);
  });
});
