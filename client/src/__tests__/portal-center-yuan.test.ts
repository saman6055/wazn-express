import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The Portal Center's yuan tab, phase 4 of the owner's brief (2026-09-18): a
 * card of how much yuan customers have asked for, and a live profit figure
 * beside the sell rate, shown before it is saved. The arithmetic is
 * unit-tested in shared/yuanProfit.test.ts; this pins the wiring, and that
 * the buying rate never leaves the office's computer.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const page = read("client/src/pages/PortalCenter.tsx");

const slice = (start: string, end: string) => {
  const a = page.indexOf(start);
  expect(a, start).toBeGreaterThan(-1);
  const b = page.indexOf(end, a + start.length);
  expect(b, end).toBeGreaterThan(a);
  return page.slice(a, b);
};

describe("how much yuan customers have asked for", () => {
  it("counted and summed by the server, by status", () => {
    const db = read("server/db/yuanExchange.db.ts");
    expect(db).toContain("export async function yuanOrderTotals()");
    expect(db).toContain(".groupBy(yuanExchangeOrders.status)");
    expect(read("server/routers/portalCenter.router.ts")).toContain("yuanTotals: adminProcedure.query(");
  });

  it("open orders and completed ones, each in yuan and in dollars", () => {
    const card = slice("function YuanTotalsCard", "\n}\n");
    expect(card).toContain("trpc.portalCenter.yuanTotals.useQuery()");
    expect(card).toContain("const open = sum(OPEN_YUAN_STATUSES);");
    expect(card).toContain('const done = sum(["completed"]);');
    expect(card).toContain("const openProfit = yuanOrdersProfit(open, parseFloat(marketRate));");
  });
});

describe("what the typed rate earns, before it is saved", () => {
  it("the rate being typed, against today's buying rate", () => {
    const card = slice("function YuanSettingsCard", "\nfunction YuanOrdersCard");
    expect(card).toContain("yuanProfitPerUsd(parseFloat(form.rate), parseFloat(marketRate))");
  });

  it("the buying rate stays on this computer: it is never sent to the server", () => {
    expect(page).toContain('const YUAN_MARKET_RATE_KEY = "wazn-yuan-market-rate";');
    const save = slice("save.mutate({", "});");
    expect(save).not.toContain("marketRate");
    expect(read("server/routers/portalCenter.router.ts")).not.toContain("marketRate");
  });
});
