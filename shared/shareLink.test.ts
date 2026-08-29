import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { toShareableParcel, shareLinkUsable, SHARE_LINK_DAYS } from "./shareLink";

/**
 * The only view in this system a stranger may read. A customer sends the link
 * to their brother, and it may end up forwarded, in a group chat, or
 * screenshotted — so what it does not contain matters more than what it does.
 */

describe("a shared parcel shows the parcel and nothing about the customer", () => {
  const full = {
    trackingNumber: "SF123", packageCode: "P-7", description: "مۆبایل",
    status: "in_transit", weightKg: "3.5", createdAt: new Date("2026-08-01"),
    deliveredAt: null, batchStatus: "in_transit",
    estimatedArrival: new Date("2026-09-15"), photoUrl: "https://x/1.jpg",
    // Everything below is on the real row and must not survive the reduction.
    customerId: 2, customerCode: "AZ002(Lubna)", customerName: "Lubna",
    mobileNumber: "0750", calculatedCostUsd: "42.00", batchCode: "B-5",
    shipmentTrackings: "internal-1,internal-2", notes: "staff note",
  } as any;

  it("keeps what the recipient came for", () => {
    const view = toShareableParcel(full);
    expect(view.trackingNumber).toBe("SF123");
    expect(view.description).toBe("مۆبایل");
    expect(view.status).toBe("in_transit");
    expect(view.weightKg).toBe(3.5);
    expect(view.estimatedArrival).toEqual(new Date("2026-09-15"));
  });

  it("carries nothing that identifies the customer or their money", () => {
    const json = JSON.stringify(toShareableParcel(full));
    for (const secret of [
      "AZ002", "Lubna", "0750", "42.00", "B-5", "internal-1", "staff note", "customerId",
    ]) {
      expect(json, `${secret} reached a public page`).not.toContain(secret);
    }
  });

  it("leaves out the package code, which is the staff handle", () => {
    // Harmless alone, but a public page printing it invites somebody to try
    // it somewhere it means more.
    expect(JSON.stringify(toShareableParcel(full))).not.toContain("P-7");
  });

  it("is an allow-list, so a new column is invisible by default", () => {
    // Everywhere else strips the sensitive fields and spreads the rest, which
    // is safe until somebody adds a column. This one names what may leave.
    const src = fs.readFileSync(path.join(__dirname, "shareLink.ts"), "utf8");
    const fn = src.slice(src.indexOf("export function toShareableParcel"));
    expect(fn, "a spread here would leak every future column").not.toContain("...source");
    const view = toShareableParcel({ ...full, somethingNew: "secret" } as any);
    expect(JSON.stringify(view)).not.toContain("secret");
  });

  it("normalises a weight that is missing or nonsense", () => {
    expect(toShareableParcel({ weightKg: null }).weightKg).toBeNull();
    expect(toShareableParcel({ weightKg: "not a number" }).weightKg).toBeNull();
    expect(toShareableParcel({ weightKg: 0 }).weightKg).toBeNull();
  });

  it("does not pass a broken date through as one", () => {
    expect(toShareableParcel({ estimatedArrival: "not a date" }).estimatedArrival).toBeNull();
  });
});

describe("a link stops working when it should", () => {
  const now = new Date("2026-08-30T12:00:00Z");
  const inDays = (n: number) => new Date(now.getTime() + n * 86400000);

  it("works while it is live", () => {
    expect(shareLinkUsable({ expiresAt: inDays(30) }, now)).toBe(true);
  });

  it("stops at its expiry", () => {
    expect(shareLinkUsable({ expiresAt: inDays(-1) }, now)).toBe(false);
  });

  it("stops the moment it is revoked, whatever the date says", () => {
    // Somebody who turned a link off wants it off now.
    expect(shareLinkUsable({ expiresAt: inDays(30), revokedAt: now }, now)).toBe(false);
  });

  it("treats a row with no expiry as closed, not as forever", () => {
    expect(shareLinkUsable({ expiresAt: null }, now)).toBe(false);
    expect(shareLinkUsable({}, now)).toBe(false);
    expect(shareLinkUsable(null, now)).toBe(false);
  });

  it("expires on its own without anybody remembering to", () => {
    expect(SHARE_LINK_DAYS).toBeGreaterThan(0);
    expect(SHARE_LINK_DAYS).toBeLessThanOrEqual(180);
  });
});

/**
 * The rules that live on the server, checked where they are written.
 */
describe("the server side cannot be talked out of its checks", () => {
  const ROOT = path.join(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
  const dbFile = read("server/db/shareLinks.db.ts");
  const routers = read("server/routers/index.ts");

  it("only ever shares a parcel its own customer owns", () => {
    // The whole feature is one query away from handing somebody a link to a
    // stranger's goods.
    const create = dbFile.slice(dbFile.indexOf("export async function createShareLink"));
    expect(create).toContain("eq(packages.customerId, customerId)");
  });

  it("makes a token nobody can guess, and never from the tracking number", () => {
    // A courier already knows the tracking number, and so does anybody who
    // has seen the parcel.
    expect(dbFile).toContain("randomBytes(32).toString(\"base64url\")");
    const token = dbFile.slice(dbFile.indexOf("function newToken"), dbFile.indexOf("Make a link"));
    expect(token).not.toContain("trackingNumber");
  });

  it("hands back the live link rather than making a second one", () => {
    expect(dbFile).toContain("if (existing && shareLinkUsable(existing))");
  });

  it("lets only the customer who made a link revoke it", () => {
    const revoke = dbFile.slice(dbFile.indexOf("export async function revokeShareLink"));
    expect(revoke.slice(0, 600)).toContain("eq(packageShareLinks.customerId, customerId)");
  });

  it("gives one answer for every failure", () => {
    // Distinguishing "no such link" from "that one expired" confirms which
    // tokens exist, which is the only useful thing to learn from outside.
    const resolve = dbFile.slice(dbFile.indexOf("export async function resolveShareLink"));
    expect(resolve).toContain("if (!shareLinkUsable(link)) return null;");
    expect(resolve).toContain("return null;");
  });

  it("is the only public procedure that reads a customer's data", () => {
    expect(routers).toContain("publicTracking: router({");
    expect(routers).toContain("db.resolveShareLink(input.token)");
  });
});
