import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { crossedLine, THRESHOLDS, WATCH_WINDOW_MS, type SuspiciousEvent, type SuspiciousKind } from "@shared/securityWatch";
import {
  approveDevice,
  deviceAllowed,
  emptyOfficeDevices,
  noteSeen,
  parseOfficeDevices,
  pendingLive,
  requestApproval,
} from "@shared/officeDevices";
import { namesRunnableFile } from "@shared/uploadRule";
import { riskVisibleTo } from "@shared/riskBell";

/**
 * The owner, 2026-11-05: hold a customer whose session tries what the portal
 * never does, and tell the main admin; open the office system only on the
 * devices he has approved.
 *
 * Proved against the local app the same day over real HTTP: eight made-up
 * procedure names held a customer, five office doors held one again, the
 * held customer's sessions ended and sign-in said why; the device rule
 * approved the owner's own device when he switched it on, ended a session
 * already open elsewhere, refused an unknown device with a code that waited
 * on his page and in his bell, and let it in once he approved it.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");
const ev = (kind: SuspiciousKind, p: string, at = 0): SuspiciousEvent => ({ at, kind, path: p, ip: "", agent: "" });

describe("what counts as an attack", () => {
  it("one screen repeating one office door is never enough - five different doors are", () => {
    const same = Array.from({ length: 20 }, () => ev("staff_door", "auth.getStaffList"));
    expect(crossedLine(same, 0)).toBeNull();
    const five = ["a.x", "b.x", "c.x", "d.x", "e.x"].map((p) => ev("staff_door", p));
    expect(crossedLine(five.slice(0, 4), 0)).toBeNull();
    expect(crossedLine(five, 0)).toBe("staff_door");
  });

  it("guessing names takes eight; bad input takes thirty across three places", () => {
    const names = Array.from({ length: 8 }, (_, i) => ev("unknown_procedure", `x.y${i}`));
    expect(crossedLine(names.slice(0, 7), 0)).toBeNull();
    expect(crossedLine(names, 0)).toBe("unknown_procedure");
    const oneForm = Array.from({ length: 60 }, () => ev("malformed_input", "portal.declare"));
    expect(crossedLine(oneForm, 0)).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => ev("malformed_input", `p${i % 3}`));
    expect(crossedLine(many, 0)).toBe("malformed_input");
  });

  it("only what happened in the last ten minutes counts", () => {
    const old = ["a", "b", "c", "d", "e"].map((p, i) => ev("staff_door", p, i < 2 ? 0 : WATCH_WINDOW_MS + 5));
    expect(crossedLine(old, WATCH_WINDOW_MS + 10)).toBeNull();
  });

  it("the lines are what was agreed", () => {
    expect(THRESHOLDS.staff_door).toEqual({ events: 5, distinctPaths: 5 });
    expect(THRESHOLDS.runnable_upload.events).toBe(2);
  });

  it("a page or a script offered as a file is noticed", () => {
    expect(namesRunnableFile("x.html")).toBe(true);
    expect(namesRunnableFile("photo.jpg", "image/svg+xml")).toBe(true);
    expect(namesRunnableFile("photo.jpg", "image/jpeg")).toBe(false);
  });
});

describe("where the watching and the holding happen", () => {
  const trpc = read("server/_core/trpc.ts");
  const sdk = read("server/_core/sdk.ts");
  const auth = read("server/routers/auth.router.ts");

  it("every refusal passes the watcher, and an admin looking at a portal is never counted", () => {
    expect(trpc).toContain("watchCustomerSession(ctx, error, path, validation);");
    expect(trpc).toContain("if (!user?.isCustomer || ctx?.viewAs) return;");
  });

  it("a held customer's every session ends, and sign-in says why", () => {
    expect(sdk).toContain("if (customer.securityBlockedAt) {");
    expect(auth).toContain("if (customer.securityBlockedAt) {");
    expect(auth).toContain("هەژمارەکەت بۆ پاراستن ڕاگیراوە.");
  });

  it("the report is never sent to the customer's own browser", () => {
    expect(read("server/lib/accountSecrets.ts")).toContain('"securityBlockReport"');
  });

  it("the column exists on a fresh database and an old one", () => {
    const m = read("server/_core/migrations.ts");
    expect(m).toContain('{ name: "customers.securityBlockedAt"');
    expect(m).toContain('{ name: "customers.securityBlockReport"');
    expect(m).toContain("securityBlockedAt TIMESTAMP NULL,\n      securityBlockReport TEXT NULL\n    ) ENGINE");
  });
});

describe("the office opens on known devices", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const A = "a".repeat(64);
  const B = "b".repeat(64);

  it("starts off, and off lets every device in", () => {
    const s = parseOfficeDevices(null);
    expect(s.enforced).toBe(false);
    expect(deviceAllowed(s, null, false)).toBe(true);
  });

  it("on, only an approved device goes on; the deployment's switch overrides", () => {
    const s = { ...approveDevice(emptyOfficeDevices(), A, "لاپتۆپی من", 1, now), enforced: true };
    expect(deviceAllowed(s, A, false)).toBe(true);
    expect(deviceAllowed(s, B, false)).toBe(false);
    expect(deviceAllowed(s, null, false)).toBe(false);
    expect(deviceAllowed(s, B, true)).toBe(true);
  });

  it("an unknown device waits with a code for half an hour", () => {
    let s = noteSeen(emptyOfficeDevices(), { id: B, user: "x", userId: 2, ip: "1.2.3.4", agent: "Chrome" }, now);
    s = requestApproval(s, B, "123456", now);
    const d = s.seen.find((x) => x.id === B)!;
    expect(d.code).toBe("123456");
    expect(pendingLive(d, new Date(now.getTime() + 29 * 60_000))).toBe(true);
    expect(pendingLive(d, new Date(now.getTime() + 31 * 60_000))).toBe(false);
    // Asking again within the half hour keeps the same code.
    expect(requestApproval(s, B, "999999", now).seen.find((x) => x.id === B)!.code).toBe("123456");
  });

  it("switching the rule on approves the device it is done from, in the same write", () => {
    const r = read("server/routers/officeSecurity.router.ts");
    const set = r.slice(r.indexOf("setEnforced: superAdminProcedure"), r.indexOf("approve: superAdminProcedure"));
    expect(set).toContain("const id = ensureDeviceMark(ctx.req, ctx.res);");
    expect(set.indexOf("approveDevice(")).toBeLessThan(set.indexOf("saveOfficeDevices("));
  });

  it("the owner cannot remove the device he is on while the rule is on", () => {
    expect(read("server/routers/officeSecurity.router.ts")).toContain("if (state.enforced && input.id === deviceIdFrom(ctx.req)) {");
  });

  it("checked at sign-in and on every staff request; customers never", () => {
    const sdk = read("server/_core/sdk.ts");
    const staff = sdk.slice(sdk.indexOf("Handle staff login sessions"));
    expect(staff).toContain("deviceAllowed(await loadOfficeDevices(), deviceIdFrom(req), officeDevicesKillSwitch())");
    const customer = sdk.slice(sdk.indexOf("session.customerId && session.isCustomer"), sdk.indexOf("Handle staff login sessions"));
    expect(customer).not.toContain("deviceAllowed");
    expect(read("server/routers/auth.router.ts")).toContain("requestApproval(devices, deviceId, newPairCode(), now2)");
  });

  it("the page and its procedures are the main admin's alone", () => {
    const r = read("server/routers/officeSecurity.router.ts");
    const procs = r.match(/^  [a-zA-Z]+: [a-zA-Z]+Procedure/gm) ?? [];
    expect(procs.length).toBeGreaterThanOrEqual(6);
    for (const p of procs) expect(p).toMatch(/superAdminProcedure$/);
  });
});

describe("the bell tells the main admin, and only him", () => {
  it("the two items are invisible to everyone else, whatever their permissions", () => {
    const all = new Set(["/office-security"]);
    expect(riskVisibleTo("admin", all, "security-holds")).toBe(false);
    expect(riskVisibleTo("admin", all, "device-requests")).toBe(false);
    expect(riskVisibleTo("super_admin", new Set(), "security-holds")).toBe(true);
  });

  it("they are counted fresh, outside the minute-long cache", () => {
    const router = read("server/routers/admin.router.ts");
    expect(router).toContain("...(await db.getSecurityRiskItems())");
    const reports = read("server/db/reports.db.ts");
    const cached = reports.slice(reports.indexOf("export async function getRiskItems"), reports.indexOf("export async function getSecurityRiskItems"));
    expect(cached).not.toContain("countSecurityHolds");
  });
});
