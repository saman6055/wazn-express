import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  STANDING_REASONS,
  STANDING_REASON_WORDS,
  mayOrderFor,
  standingOf,
  standingTextFault,
} from "./customerStanding";

/**
 * Cautions and the blacklist (owner, 2026-10-07): "if we forget and they come
 * back, the system knows them and warns us — and why. Nothing can be done for
 * them until we take them off, on a condition. A note first; if they do it
 * again, then blacklist."
 *
 * What would undo it: an order saving for a blacklisted customer through some
 * door, a block or a release with no reason written, anyone but the main
 * admin taking a customer off, history being edited, or the blacklist
 * stopping the office from taking that customer's money.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
const at = (day: number) => new Date(Date.UTC(2026, 9, day));

describe("the standing is what the last row says", () => {
  it("nothing written is fine", () => {
    expect(standingOf([])).toBe("ok");
  });
  it("a note is a caution; a second note is still a caution", () => {
    expect(standingOf([{ event: "caution", createdAt: at(1) }])).toBe("caution");
    expect(standingOf([{ event: "caution", createdAt: at(1) }, { event: "caution", createdAt: at(3) }])).toBe("caution");
  });
  it("blocked until released, whatever order the rows are read in", () => {
    const rows = [{ event: "blocked" as const, createdAt: at(5) }, { event: "caution" as const, createdAt: at(1) }];
    expect(standingOf(rows)).toBe("blocked");
    expect(standingOf([...rows, { event: "cleared", createdAt: at(9) }])).toBe("ok");
  });
  it("two rows written in the same second: the later row wins, in whatever order they arrive", () => {
    const note = { id: 4, event: "caution" as const, createdAt: at(5) };
    const block = { id: 5, event: "blocked" as const, createdAt: at(5) };
    expect(standingOf([note, block])).toBe("blocked");
    expect(standingOf([block, note])).toBe("blocked");
    const release = { id: 6, event: "cleared" as const, createdAt: at(5) };
    expect(standingOf([release, block, note])).toBe("ok");
  });

  it("a new note after a release is a caution again", () => {
    expect(standingOf([{ event: "blocked", createdAt: at(1) }, { event: "cleared", createdAt: at(2) }, { event: "caution", createdAt: at(3) }])).toBe("caution");
  });
});

describe("what each step needs written", () => {
  it("a caution and a block need a reason; 'other' needs words", () => {
    expect(standingTextFault("caution", null, "")).toBe("reason");
    expect(standingTextFault("blocked", "rude", "")).toBeNull();
    expect(standingTextFault("blocked", "other", "")).toBe("text");
    expect(standingTextFault("blocked", "other", "دزی کرد")).toBeNull();
  });
  it("a release needs the condition they come back on", () => {
    expect(standingTextFault("cleared", null, "")).toBe("text");
    expect(standingTextFault("cleared", null, "پێشەکی پارەی تەواو دەدات")).toBeNull();
  });
  it("every reason has words", () => {
    for (const r of STANDING_REASONS) expect(STANDING_REASON_WORDS[r].ku.length).toBeGreaterThan(3);
  });
});

describe("the blacklist stops buying, and only buying", () => {
  const order = root("server/db/fullPackage.db.ts");
  const standing = root("server/db/customerStanding.db.ts");

  it("only the blacklist says no", () => {
    expect(mayOrderFor("ok")).toBe(true);
    expect(mayOrderFor("caution")).toBe(true);
    expect(mayOrderFor("blocked")).toBe(false);
  });

  it("is checked in the one function every new order goes through, before anything is written", () => {
    const fn = order.slice(order.indexOf("export async function createFullPackageOrder"));
    const guard = fn.indexOf("assertMayOrderFor(data.customerId)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fn.indexOf("db.insert("));
  });

  it("the refusal says why and how to get out", () => {
    const fn = standing.slice(standing.indexOf("export async function assertMayOrderFor"));
    expect(fn).toContain("لە لیستی ڕەشدایە");
    expect(fn).toContain("withFix(");
  });

  it("taking money and registering an arrived parcel are never stopped by it", () => {
    for (const file of ["server/db/boxSettlement.db.ts", "server/db/finance.db.ts", "server/db/packages.db.ts"]) {
      expect(root(file), file).not.toContain("assertMayOrderFor");
    }
    expect(root("client/src/pages/QuickRegister.tsx")).toContain("<RefusalWarning customerId={customerId} buying={false} />");
  });
});

describe("written down, never rewritten", () => {
  const standing = root("server/db/customerStanding.db.ts");
  const router = root("server/routers/finance.router.ts");

  it("every note, block and release is a new row", () => {
    expect(standing).toContain("db.insert(customerStanding)");
    expect(standing).not.toContain("db.update(customerStanding)");
    expect(standing).not.toContain("db.delete(");
  });

  it("only the main admin takes a customer off", () => {
    const fn = router.slice(router.indexOf("setCustomerStanding: adminProcedure"), router.indexOf("// ── Refused goods"));
    expect(fn.length).toBeGreaterThan(300);
    expect(fn).toContain('input.event === "cleared" && ctx.user.role !== "super_admin"');
  });

  it("every member of staff can read it, where the next order is typed", () => {
    expect(router).toContain("customerStanding: staffProcedure");
    for (const form of ["client/src/pages/CommissionForm.tsx", "client/src/pages/FullPackageForm.tsx"]) {
      expect(root(form), form).toContain("<RefusalWarning customerId={Number(formData.customerId) || null} />");
    }
    expect(root("client/src/App.tsx")).toContain('path="/customers/standing"');
  });
});
