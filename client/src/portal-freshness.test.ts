import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PORTAL_LIVE_QUERY, PORTAL_SETTINGS_QUERY } from "./lib/portalQuery";

/**
 * The portal shows data somebody else changes.
 *
 * Phase-two audit (2026-09-10): the one live event that ever fires refreshed
 * two badge counters and nothing on screen; the modern and skin3 chrome had
 * no live channel at all; and with refetch-on-focus off, a tab left open on
 * the balance showed yesterday's debt after the cashier recorded the payment.
 * These pin the fixes.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

describe("every skin has the live channel", () => {
  for (const layout of ["components/CustomerPortalLayout.tsx", "components/ModernPortalLayout.tsx", "components/Skin3PortalLayout.tsx"]) {
    it(`${layout} calls usePortalRealtime`, () => {
      const src = read(layout);
      expect(src).toContain("usePortalRealtime();");
      // One place owns the connection; a second direct subscription would
      // open a second stream per tab.
      expect(src).not.toContain("usePortalSSE(");
    });
  }
});

describe("a live event refreshes what is on screen, not just the badges", () => {
  const hook = read("hooks/usePortalRealtime.ts");

  it("invalidates the whole customer portal on every event", () => {
    const body = hook.slice(hook.indexOf("const refreshEverything"), hook.indexOf("usePortalSSE({"));
    expect(body.length, "refreshEverything has moved or gone").toBeGreaterThan(20);
    expect(body).toContain("utils.customerPortal.invalidate()");
    expect(body).toContain("utils.prohibited.getMine.invalidate()");
    expect(hook.match(/refreshEverything\(\);/g)?.length, "every event handler must refresh").toBeGreaterThanOrEqual(4);
  });

  it("refreshes when the customer comes back to the tab, throttled", () => {
    expect(hook).toContain('addEventListener("visibilitychange"');
    expect(hook).toContain("PORTAL_FOCUS_REFRESH_MS");
  });

  it("names a package status in the customer's words, never the column value", () => {
    expect(hook).toContain("PACKAGE_STATUS_LABEL[d.status]");
  });
});

describe("the office's changes reach an open tab", () => {
  it("polls slowly, and never in a background tab", () => {
    expect(PORTAL_LIVE_QUERY.refetchIntervalInBackground).toBe(false);
    expect(PORTAL_LIVE_QUERY.refetchInterval).toBeGreaterThanOrEqual(60_000);
    expect(PORTAL_LIVE_QUERY.staleTime).toBeLessThan(PORTAL_LIVE_QUERY.refetchInterval);
    expect(PORTAL_SETTINGS_QUERY.staleTime).toBeLessThanOrEqual(60_000);
  });

  const MUST_BE_LIVE: Array<[string, string[]]> = [
    ["pages/portal/PortalHome.tsx", ["getMyFinancialSummary", "getMyBatches", "getMyPendingOrders"]],
    ["pages/portal/PortalFinancial.tsx", ["getMyFinancialSummary", "getMyTransactions", "getMyDeliveryBoxes"]],
    ["pages/portal/PortalShipments.tsx", ["getMyBatches", "getMyUnbatchedPackages", "getMyFullPackageOrders"]],
    ["pages/portal/PortalFullPackage.tsx", ["getMyFullPackageOrders"]],
    ["components/portal/MyDeliveryBoxes.tsx", ["getMyDeliveryBoxes"]],
  ];
  for (const [file, procs] of MUST_BE_LIVE) {
    for (const proc of procs) {
      it(`${path.basename(file)} keeps ${proc} live`, () => {
        const src = read(file);
        const at = src.indexOf(`.${proc}.useQuery(`);
        expect(at, `${proc} is not queried in ${file}`).toBeGreaterThan(-1);
        const call = src.slice(at, src.indexOf(")", at) + 1);
        expect(call, `${proc} in ${file} has no live options`).toContain("PORTAL_LIVE_QUERY");
      });
    }
  }
});

describe("the customer's own actions refresh what they affect", () => {
  it("confirming a box refreshes the money and shipments, not only the box", () => {
    const src = read("components/portal/MyDeliveryBoxes.tsx");
    const start = src.indexOf("confirmBoxReceived.useMutation");
    expect(start, "the confirm mutation has moved or gone").toBeGreaterThan(-1);
    // "onError" also appears earlier in the file (an image handler), so the
    // end is searched for after the start.
    const body = src.slice(start, src.indexOf("onError", start));
    expect(body).toContain("utils.customerPortal.invalidate()");
  });

  it("reading support messages clears the unread badges", () => {
    const src = read("pages/portal/PortalMessages.tsx");
    const body = src.slice(src.indexOf("supportChat.markAsRead.useMutation"), src.indexOf("uploadMutation"));
    expect(body).toContain("getUnreadCount.invalidate()");
  });

  it("pull-to-refresh on shipments refreshes every list drawn there", () => {
    const src = read("pages/portal/PortalShipments.tsx");
    expect(src).toContain("await Promise.all([refetch(), refetchUnbatched(), refetchOrders()]);");
  });
});
