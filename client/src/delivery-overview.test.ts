import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

function slice(src: string, start: string, end: string, label: string): string {
  const a = src.indexOf(start);
  expect(a, `${label}: start marker not found`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${label}: end marker not found after start`).toBeGreaterThan(a);
  return src.slice(a, b);
}

/**
 * The figures on top of the delivery page (owner, 2026-10-06 and 2026-10-07).
 *
 * The four that stood there counted only the twenty boxes on the screen and
 * could not be pressed. He asked for the money not paid yet and the box that
 * owes most - «بەڵام کاتێ کلیک ئەکەی بتبات بۆ شوێنی مەبەست» - and, of the cold
 * total, for the boxes whose money was taken: today, this week, ever.
 *
 * Proved on a real MySQL through the till's own procedures, nine boxes:
 *
 *   not paid yet     5 boxes (the chip says 5), 3 customers, $252.50 - the
 *                    payment screens of those boxes added up one by one;
 *                    the most is BOX 2 at $142.50, the oldest 12 days
 *   one parcel paid, one held back      still on the list, owing the held $20
 *   paid short, the rest kept as debt   off the list; the $20 is on the account
 *   received today   3 boxes, $110 - and the list it opens has those 3
 *   this week        4 boxes, $148, $2 forgiven - and its list has those 4
 *   ever             5 boxes, $218 - and its list has those 5
 *   a receipt undone counts nowhere
 *   an employee      every count and every list, and no dollars
 *   reading it       writes nothing
 */
describe("each figure is counted the way its list is filtered", () => {
  const overview = read("server/db/boxOverview.db.ts");
  const boxes = read("server/db/deliveryBoxes.db.ts");

  it("not paid yet: the unpaid chip's own list is asked, not written out again", () => {
    expect(overview).toContain('await getAllDeliveryBoxes({ archive: "exclude", limit: UNPAID_LIST_CAP })');
    // No second copy of what "archived" means.
    expect(overview).not.toContain("archivedSql");
    expect(overview).not.toContain("boxSettlementClearedSql");
  });

  it("received: one condition for the card's count and the list's filter", () => {
    expect(boxes).toContain("export function receiptSinceSql(start: Date) {");
    const rule = slice(boxes, "export function receiptSinceSql(start: Date) {", "\n}\n", "receiptSinceSql");
    expect(rule).toContain("${boxSettlements.status} = 'confirmed'");
    expect(rule).toContain("${boxSettlements.createdAt} >= ${start}");
    // The list filters on it ...
    expect(boxes).toContain("if (filters?.paidSince) conditions.push(receiptSinceSql(filters.paidSince));");
    // ... and the card counts with it.
    expect(overview).toContain(".where(receiptSinceSql(start));");
  });

  it("the money on a card is the money on standing receipts in the same window", () => {
    const fn = slice(overview, "async function receivedSince(start: Date)", "\n}\n", "receivedSince");
    expect(fn).toContain('eq(boxSettlements.status, "confirmed"), gte(boxSettlements.createdAt, start)');
    expect(fn).toContain("SUM(${boxSettlements.paidUsd})");
    expect(fn).toContain("SUM(${boxSettlements.discountUsd})");
  });

  it("the windows are named, and the server's clock decides them", () => {
    const router = read("server/routers/scanning.router.ts");
    expect(router).toContain("paidWindow: z.enum(PAID_WINDOWS).optional(),");
    expect(router).toContain("paidSince: paidWindow ? paidWindowStart(paidWindow) : undefined,");
    // A named window is not passed on as a filter the list does not know.
    expect(router).toContain("const { paidWindow, ...filters } = input ?? ({} as NonNullable<typeof input>);");
  });

  it("reads only", () => {
    expect(overview).not.toMatch(/\.(insert|update|delete)\(/);
  });
});

describe("the amounts are the payment screen's own", () => {
  const till = read("server/db/boxSettlement.db.ts");
  const boxes = read("server/db/deliveryBoxes.db.ts");

  it("what a box owes is added up from the screen's per-parcel sums", () => {
    const fn = slice(till, "export async function getBoxesOutstanding(", "\n}\n", "getBoxesOutstanding");
    expect(fn).toContain("const parcels = await parcelsForItems(db, items);");
    expect(fn).toContain("Math.max(0, Math.round((Number(parcels[i].outstandingUsd) || 0) * 100))");
    // The courier's fee is not ours and is not on the parcels (shared/deliveryFee).
    expect(fn).not.toContain("deliveryChargeUsd");
    expect(fn).not.toContain("totalValueUsd");
  });

  it("every row of the list carries it, so the rows add up to the card", () => {
    expect(boxes).toContain("const owedByBox = await getBoxesOutstanding(boxes.map(b => b.id));");
    expect(boxes).toContain("outstandingUsd: owedByBox.get(b.id) ?? 0,");
    const table = read("client/src/components/delivery/BoxTable.tsx");
    expect(table).toContain('data-testid="box-row-owed"');
    expect(table).toContain("{fmtUsd(Number(box.outstandingUsd))}");
    expect(table).toContain('data-testid="box-row-taken"');
    // Said only when it differs from the value on the line above it - and
    // where it is not said, the value IS what is owed, so the rows still add up.
    expect(table).toContain("Math.abs(Number(box.outstandingUsd) - Number(box.totalValueUsd || 0)) > 0.005");
    // Never wider than the column it sits in.
    expect(table.split("block w-0 min-w-full whitespace-normal").length - 1).toBe(2);
  });

  it("the card adds the rows, it does not price anything itself", () => {
    const overview = read("server/db/boxOverview.db.ts");
    expect(overview).toContain("outstandingUsd: Number(box.outstandingUsd ?? 0),");
    expect(overview).not.toContain("totalValueUsd");
    const cards = read("client/src/components/delivery/DeliveryStats.tsx");
    expect(cards).not.toContain("totalValueUsd");
    expect(cards).not.toContain("deliveryChargeUsd");
    expect(cards).not.toContain(".reduce(");
  });
});

describe("who is shown the money", () => {
  it("every account's money is for the people who answer for the books", () => {
    const router = read("server/routers/scanning.router.ts");
    const proc = slice(router, "  overview: staffProcedure.query(async ({ ctx }) => {", "\n  }),", "overview procedure");
    expect(proc).toContain("return canSeeAllAccounts(ctx.user.role) ? overview : withoutMoney(overview);");
  });

  it("the cards show a count where the dollars were left out", () => {
    const cards = read("client/src/components/delivery/DeliveryStats.tsx");
    expect(cards).toContain("unpaid.usd === null ?");
    expect(cards).toContain("r.usd === null ?");
    expect(cards).toContain("top.usd === null ?");
  });
});

describe("a press opens the list the figure counted", () => {
  const page = read("client/src/pages/CustomerDeliveryScanner.tsx");
  const cards = read("client/src/components/delivery/DeliveryStats.tsx");

  it("the cards are given the three ways out", () => {
    const use = slice(page, "<DeliveryStats", "/>", "the cards on the page");
    expect(use).toContain("overview={overviewQuery.data}");
    expect(use).toContain("onShowUnpaid={handleShowUnpaid}");
    expect(use).toContain("onOpenBox={handleBoxSelect}");
    expect(use).toContain("onShowPaid={handleShowPaid}");
    // Not the page of twenty any more.
    expect(page).not.toContain("<DeliveryStats boxes={boxes}");
  });

  it("not paid yet: the unpaid chip, from its first page, with nothing else narrowing it", () => {
    const fn = slice(page, "const handleShowUnpaid = useCallback(() => {", "}, [showList]);", "handleShowUnpaid");
    expect(fn).toContain("setPaidWindow(null);");
    expect(fn).toContain("setDrilledCustomerId(null);");
    expect(fn).toContain('setView("unpaid");');
    expect(fn).toContain("showList();");
  });

  it("received: the list is narrowed to that window and sees past the chips", () => {
    expect(page).toContain("if (paidWindow) params.paidWindow = paidWindow;");
    // A box with one parcel paid today is still unpaid - and is one of the boxes counted.
    expect(page).toContain("if (!drilledCustomerId && !paidWindow) {");
    expect(page).toContain("{!drilledCustomerId && !paidWindow && (");
  });

  it("a narrowed list says so, with the way out beside it", () => {
    const banner = slice(page, "{paidWindow && (", "{/* The chips: unpaid, new, old", "the banner");
    expect(banner).toContain('data-testid="paid-window-banner"');
    expect(banner).toContain("{L(paidWindowTitle(paidWindow))}");
    expect(banner).toContain('data-testid="clear-paid-window"');
    expect(banner).toContain("setPaidWindow(null);");
  });

  it("the box that owes the most opens that box, and its codes can be copied", () => {
    expect(cards).toContain("onPress={top ? () => onOpenBox(top.boxId) : undefined}");
    expect(cards).toContain("<CopyButton value={top.boxCode} />");
    expect(cards).toContain("<CopyButton value={topCode} />");
  });

  it("a card with nothing behind it is not a link", () => {
    expect(cards).toContain("onPress={unpaid.boxes > 0 ? onShowUnpaid : undefined}");
    expect(cards).toContain("onPress={r.boxes > 0 ? () => onShowPaid(window) : undefined}");
  });

  it("whatever changes the list changes the figures above it", () => {
    const fn = slice(page, "const refetchBoxes = useCallback(() => {", "}, [refetchListOnly, refetchOverview]);", "refetchBoxes");
    expect(fn).toContain("void refetchOverview();");
    expect(fn).toContain("return refetchListOnly();");
    expect(page).toContain("onSettled={() => refetchBoxes()}");
  });

  it("folds to a phone: two across, the first card two wide so no row is left with a gap", () => {
    expect(cards).toContain('const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5";');
    expect(cards).toContain('const FIRST = "col-span-2 xl:col-span-1";');
  });
});
