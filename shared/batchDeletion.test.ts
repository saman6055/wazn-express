import { describe, expect, it } from "vitest";
import {
  DELETE_GRACE_HOURS,
  canDeleteBatch,
  financialTieCount,
  hoursSince,
  isAdmin,
  isSuperAdmin,
} from "./batchDeletion";

const NOW = new Date("2026-08-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const NO_TIES = { invoices: 0, deliveryBoxes: 0, fullPackageOrders: 0 };

const ask = (over: Partial<Parameters<typeof canDeleteBatch>[0]> = {}) =>
  canDeleteBatch({
    role: "admin",
    status: "preparing",
    createdAt: hoursAgo(1),
    ties: NO_TIES,
    now: NOW,
    ...over,
  });

describe("money outranks everything", () => {
  it("refuses when anything financial points at the batch", () => {
    for (const tie of ["invoices", "deliveryBoxes", "fullPackageOrders"] as const) {
      const verdict = ask({ ties: { ...NO_TIES, [tie]: 1 } });
      expect(verdict.allowed, tie).toBe(false);
      expect(verdict.refusal, tie).toBe("has_financial_records");
    }
  });

  it("refuses a super admin too, on the first day", () => {
    // This is not a permission problem. A bigger role does not make deleting
    // an invoiced batch safe, so there is no point sending anyone to find one.
    const verdict = ask({ role: "super_admin", createdAt: hoursAgo(0), ties: { ...NO_TIES, invoices: 1 } });
    expect(verdict.allowed).toBe(false);
    expect(verdict.refusal).toBe("has_financial_records");
    expect(verdict.wouldSuperAdminHelp).toBe(false);
  });

  it("counts every kind of tie", () => {
    expect(financialTieCount({ invoices: 2, deliveryBoxes: 1, fullPackageOrders: 3 })).toBe(6);
    expect(financialTieCount(NO_TIES)).toBe(0);
  });
});

describe("the first day", () => {
  it("lets an admin undo a fresh mistake", () => {
    const verdict = ask({ createdAt: hoursAgo(1) });
    expect(verdict.allowed).toBe(true);
    expect(verdict.withinGrace).toBe(true);
  });

  it("holds right up to the boundary", () => {
    expect(ask({ createdAt: hoursAgo(DELETE_GRACE_HOURS - 0.1) }).allowed).toBe(true);
    expect(ask({ createdAt: hoursAgo(DELETE_GRACE_HOURS) }).allowed).toBe(false);
  });

  it("sends an admin to a super admin once the day is up", () => {
    const verdict = ask({ createdAt: hoursAgo(30) });
    expect(verdict.allowed).toBe(false);
    expect(verdict.refusal).toBe("needs_super_admin");
    // The one case where telling somebody to go and ask is useful.
    expect(verdict.wouldSuperAdminHelp).toBe(true);
  });

  it("lets a super admin delete an old batch", () => {
    expect(ask({ role: "super_admin", createdAt: hoursAgo(30) }).allowed).toBe(true);
    expect(ask({ role: "super_admin", createdAt: hoursAgo(5000) }).allowed).toBe(true);
  });
});

describe("who is allowed at all", () => {
  it("refuses everyone below admin, however fresh the batch", () => {
    for (const role of ["employee", "accountant", "customer", "", null, undefined]) {
      const verdict = ask({ role: role as string, createdAt: hoursAgo(0) });
      expect(verdict.allowed, String(role)).toBe(false);
      expect(verdict.refusal, String(role)).toBe("not_permitted");
    }
  });

  it("knows the two roles apart", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("super_admin")).toBe(true);
    expect(isAdmin("employee")).toBe(false);
    expect(isSuperAdmin("admin")).toBe(false);
    expect(isSuperAdmin("super_admin")).toBe(true);
  });
});

describe("a finished shipment is not a mistake", () => {
  it("refuses a delivered or closed batch even inside the first day", () => {
    // Customers were told about this shipment. Archiving hides it; deleting
    // would remove it.
    for (const status of ["delivered", "closed"]) {
      const verdict = ask({ status, createdAt: hoursAgo(1), role: "super_admin" });
      expect(verdict.allowed, status).toBe(false);
      expect(verdict.refusal, status).toBe("already_finished");
    }
  });

  it("allows every stage the shipment is still moving through", () => {
    for (const status of ["preparing", "in_transit", "arrived", "customs", "at_depot"]) {
      expect(ask({ status, createdAt: hoursAgo(1) }).allowed, status).toBe(true);
    }
  });
});

describe("working out how old a batch is", () => {
  it("measures from when it was created", () => {
    expect(hoursSince(hoursAgo(5), NOW)).toBeCloseTo(5, 5);
    expect(hoursSince(hoursAgo(5).toISOString(), NOW)).toBeCloseTo(5, 5);
  });

  it("treats a missing or unreadable date as ancient", () => {
    // Erring towards needing a super admin: a batch whose age we cannot
    // establish should not fall into the easy path.
    expect(hoursSince(null, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(hoursSince("not a date", NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(ask({ createdAt: null }).refusal).toBe("needs_super_admin");
  });

  it("never reports a negative age for a clock that is ahead", () => {
    expect(hoursSince(new Date(NOW.getTime() + 60_000), NOW)).toBe(0);
  });
});
