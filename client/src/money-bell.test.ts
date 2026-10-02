import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { moneyLineHref } from "@shared/moneyFeed";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/**
 * The money side of the bell (owner, 2026-10-02): every movement, with a
 * click to the thing itself, and extras waiting for the main admin's yes.
 * Looked at in the real app on a local database before it shipped.
 */
describe("the money bell", () => {
  const bell = read("components/MoneyBell.tsx");
  const risk = read("components/RiskBell.tsx");

  it("asks the server only for the main admin", () => {
    expect(bell).toContain('const enabled = userId > 0 && role === "super_admin";');
    expect(bell.match(/enabled,\n/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("a click opens the record: the box for a receipt, the customer's money page otherwise", () => {
    expect(moneyLineHref({ kind: "payment", boxId: 5, customerId: 1 })).toBe("/customer-delivery-scanner?box=5");
    expect(moneyLineHref({ kind: "payment", boxId: null, customerId: 1 })).toBe("/finance/customer/1");
    expect(moneyLineHref({ kind: "charge", boxId: 5, customerId: 7 })).toBe("/finance/customer/7");
    expect(bell).toContain("onNavigate(moneyLineHref(line))");
  });

  it("approving or refusing an extra is confirmed first", () => {
    expect(bell.indexOf("await confirmAction(")).toBeLessThan(bell.indexOf("decide.mutate({ id, approve })"));
  });

  it("declares its hooks before the early return", () => {
    const section = bell.slice(bell.indexOf("export function MoneyBellSection"));
    expect(section.indexOf("useMutation(")).toBeLessThan(section.indexOf("if (!money.enabled) return null;"));
  });

  it("the bell counts and flashes for it, and lists it first", () => {
    expect(risk).toContain("const money = useMoneyBell(userId, role);");
    expect(risk).toContain("shouldFlash(items, seen, today) || money.urgent");
    expect(risk).toContain("const total = items.length + money.count;");
    expect(risk.indexOf("<MoneyBellSection")).toBeLessThan(risk.indexOf('(["risks", "incomplete"] as const).map'));
  });

  it("every code it names can be copied", () => {
    expect(bell).toContain("<CopyButton value={code} />");
  });
});
