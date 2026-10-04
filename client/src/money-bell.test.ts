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

/*
 * Owner, 2026-10-04: "the money notifications are many — put them in a tab of
 * their own inside the bell, so my focus on the others is not lost."
 */
describe("money has its own tab in the bell", () => {
  const bell = read("components/RiskBell.tsx");

  it("two tabs for the main admin, each with its own count", () => {
    expect(bell).toContain('data-testid={`bell-tab-${key}`}');
    expect(bell).toContain('["alerts", L({ ku: "ئاگادارییەکان"');
    expect(bell).toContain('["money", L({ ku: "جووڵەکانی پارە"');
    expect(bell).toContain("const showTabs = money.enabled;");
  });

  it("money lines are not shown in the alerts tab", () => {
    const alerts = bell.slice(bell.indexOf(') : items.length === 0 ? ('));
    expect(alerts).not.toContain("<MoneyBellSection");
  });

  it("money counts as looked at only when its tab is in front", () => {
    expect(bell).toContain('if (open && shownTab === "money") {\n      money.onOpen();');
    expect(bell).not.toContain("if (next) money.onOpen();");
  });
});
