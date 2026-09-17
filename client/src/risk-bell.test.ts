import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The system's bell (owner, 2026-09-16): today's risks by size, there every
 * day, flashing until looked at — and nobody told about a page they may not
 * open. The rules are unit-tested in shared/riskBell.test.ts; this pins the
 * wiring that makes them reach a screen.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readServer = (p: string) => fs.readFileSync(path.resolve(SRC, "../../server", p), "utf8").replace(/\r\n/g, "\n");
const readShared = (p: string) => fs.readFileSync(path.resolve(SRC, "../../shared", p), "utf8").replace(/\r\n/g, "\n");

const bell = read("components/RiskBell.tsx");
const layout = read("components/DashboardLayout.tsx");

describe("the bell is on every staff page", () => {
  it("in the desktop bar's tray and in the phone's header", () => {
    expect(layout).toContain('import { RiskBell } from "./RiskBell";');
    const mobileStart = layout.indexOf("{/* Mobile Header */}");
    const mobileEnd = layout.indexOf("{/* Mobile Sidebar Overlay */}");
    expect(mobileStart).toBeGreaterThan(-1);
    expect(mobileEnd).toBeGreaterThan(mobileStart);
    expect(layout.slice(mobileStart, mobileEnd)).toContain("<RiskBell");
    const trayStart = layout.indexOf("{/* Tray (RTL: the far left)");
    const trayEnd = layout.indexOf("{/* User profile */}", trayStart);
    expect(trayStart).toBeGreaterThan(-1);
    expect(trayEnd).toBeGreaterThan(trayStart);
    expect(layout.slice(trayStart, trayEnd)).toContain("<RiskBell />");
  });
});

describe("what the bell shows", () => {
  it("today's risks from the server, refreshed every few minutes, only while in front", () => {
    expect(bell).toContain("trpc.dashboard.risks.useQuery(");
    expect(bell).toContain("refetchInterval: 5 * 60_000");
    expect(bell).toContain("refetchIntervalInBackground: false");
  });

  it("only the risks of pages this person may open", () => {
    expect(bell).toContain("canViewPath(RISK_GATE[item.id])");
  });

  it("each one leads to its list", () => {
    expect(bell).toContain("navigate(RISK_PATH[item.id])");
    expect(bell).toContain("describeRisk(item)");
    expect(bell).toContain("RISK_LEVEL_LABEL[item.level]");
  });

  it("says so when there is nothing — and when it could not tell", () => {
    expect(bell).toContain('ku: "هیچ مەترسییەک نییە"');
    expect(bell).toContain("risksQ.isError");
  });
});

describe("the flashing", () => {
  it("follows the shared rule, per person", () => {
    expect(bell).toContain("shouldFlash(items, seen, today)");
    expect(bell).toContain("const seenKey = (userId: number) => `wazn-risk-bell-seen:${userId}`");
  });

  it("stops when the bell is opened, by recording what was seen today", () => {
    const handler = bell.slice(bell.indexOf("const onOpenChange"), bell.indexOf("const bellLabel"));
    expect(handler).toContain("markSeen(items, today)");
    expect(handler).toContain("localStorage.setItem(seenKey(userId)");
  });

  it("flashes visibly, and respects a reader who asked for less motion", () => {
    expect(bell).toContain("animate-ping");
    expect(bell).toContain("motion-reduce:animate-none");
    expect(bell).toContain('data-flashing={flashing ? "true" : undefined}');
  });
});

describe("each item opens exactly what it counted", () => {
  // Owner, 2026-09-17: a click goes to the problem itself. A whole list that
  // merely contains the problem looks like an answer and is not one.
  const riskBell = readShared("riskBell.ts");
  const reports = readServer("db/reports.db.ts");

  it("debts: the debtors past their own limit, by the rule that counted them", () => {
    expect(riskBell).toContain('"debt-over-limit": debtorsHref({ over: "limit" })');
    const page = read("pages/DebtorsReport.tsx");
    expect(page).toContain("readDebtorsLink(urlSearch).over === \"limit\"");
    expect(page).toContain("isOverCreditLimit(acc.currentBalanceUsd, acc.creditLimitUsd)");
    expect(page).toContain("filters={overLimitOnly ? [FILTER_LABEL.over_limit] : []}");
    const start = reports.indexOf("export async function countDebtorsOverLimit");
    const end = reports.indexOf("export async function countOrdersWithoutTracking");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(reports.slice(start, end)).toContain("isOverCreditLimit(r.balance, r.limit)");
  });

  it("orders: the tracking-alerts page at 7+ days, where the tracking is added", () => {
    expect(riskBell).toContain('"orders-no-tracking": trackingAlertsHref({ days: "7+" })');
    expect(riskBell).toContain('"orders-no-tracking": "/tracking-alerts"');
    const page = read("pages/TrackingAlerts.tsx");
    expect(page).toContain("readTrackingAlertsLink(urlSearch).days");
    expect(page).toContain("useState<string>(linkDays ?? \"all\")");
    expect(page).toMatch(/value: "7\+",[^\n]*min: 7,/);
    const start = reports.indexOf("export async function countOrdersWithoutTracking");
    const end = reports.indexOf("export async function countUnclaimedPackages");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fn = reports.slice(start, end);
    expect(fn).toContain("await getOrdersPendingTracking()");
    expect(fn).toContain("isTrackingOverdue(daysWaitingForTracking(o.orderDate, now))");
    expect(readServer("routers/fullPackage.router.ts")).toContain("daysWaitingForTracking(order.orderDate, now)");
  });

  it("the dashboard's own alerts open the same lists", () => {
    const alerts = reports.slice(reports.indexOf("export async function getDashboardAlerts"));
    expect(alerts).toContain("link: debtorsHref({ over: 'limit' })");
    expect(alerts).toContain("link: trackingAlertsHref(),");
    expect(alerts).not.toContain("link: '/finance/debtors'");
  });
});

describe("the server's side", () => {
  const router = readServer("routers/admin.router.ts");
  const reports = readServer("db/reports.db.ts");

  it("tells each person only about the pages they may open", () => {
    const risks = router.slice(router.indexOf("risks: staffProcedure"), router.indexOf("risks: staffProcedure") + 900);
    expect(risks).toContain('if (ctx.user.role === "super_admin") return items;');
    expect(risks).toContain("db.getUserPermissions(ctx.user.id)");
    expect(risks).toContain("pathVisibleTo(ctx.user.role, viewable, RISK_GATE[item.id])");
  });

  it("counts debts, orders and unclaimed parcels exactly as the dashboard's alerts do", () => {
    const alerts = reports.slice(reports.indexOf("export async function getDashboardAlerts"));
    expect(alerts).toContain("await countDebtorsOverLimit()");
    expect(alerts).toContain("await countOrdersWithoutTracking()");
    expect(alerts).toContain("await countUnclaimedPackages()");
  });

  it("gathers the parcels with the same queries as the cards", () => {
    const fn = reports.slice(reports.indexOf("export async function getRiskItems"), reports.indexOf("export async function getDashboardAlerts"));
    expect(fn).toContain("getStaleDepotPackages()");
    expect(fn).toContain("getVolumetricParcels({ pendingOnly: true })");
    expect(fn).toContain("buildRiskItems({");
  });

  it("only reads", () => {
    const start = reports.indexOf("export async function countDebtorsOverLimit");
    const block = reports.slice(start, reports.indexOf("export async function getDashboardAlerts"));
    expect(block.length).toBeGreaterThan(500);
    expect(block).not.toMatch(/\.(insert|update|delete)\(|INSERT |UPDATE |DELETE /);
  });
});
