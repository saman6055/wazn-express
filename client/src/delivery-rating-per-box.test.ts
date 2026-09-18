import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A delivery is rated once per box, not once per tracking (owner,
 * 2026-09-17). Six parcels handed over in one box are one delivery; asking
 * about each of them was six questions about the same afternoon.
 *
 * What would undo it: the card going back to a parcel, the server offering a
 * box that was already rated (or somebody else's), a second rating stored for
 * the same box, or a new column quietly added to the ratings table — the
 * table stays as it is, and a box's rating is held against its first parcel.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

const card = read("components/portal/DeliveryRatingCard.tsx");
const center = read("pages/PortalCenter.tsx");
const router = readRoot("server/routers/portal.router.ts");
const store = readRoot("server/db/portalCenter.db.ts");

function slice(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

describe("the customer is asked about a box", () => {
  it("the card asks for a box and answers for that box", () => {
    expect(card).toContain("trpc.customerPortal.getRatableBox.useQuery()");
    expect(card).toContain("submit.mutate({ boxId: box.id, rating");
    expect(card).toContain("{box.boxCode}");
    expect(card).toContain("photos={box.photos}");
    expect(card).not.toMatch(/getRatablePackage|packageId:/);
  });

  it("says how many parcels the box held, in every language", () => {
    const words = slice(card, "{pickLang(language, {\n                ku: `${count} پاکەت", "})}");
    for (const lang of ["ku:", "en:", "ar:", "zh:"]) expect(words).toContain(lang);
  });

  it("remembers a dismissal per box", () => {
    expect(card).toContain("`rating-dismissed-box-${box.id}`");
  });
});

describe("the server", () => {
  it("offers the newest delivered box of the last 14 days that nobody has rated", () => {
    const fn = slice(store, "export async function getRatableBox", "export async function createBoxDeliveryRating");
    expect(store).toContain("const RATING_WINDOW_DAYS = 14;");
    expect(fn).toContain("eq(deliveryBoxes.customerId, customerId)");
    expect(fn).toContain('eq(deliveryBoxes.status, "delivered")');
    expect(fn).toContain("COALESCE(${deliveryBoxes.deliveredAt}, ${deliveryBoxes.customerConfirmedAt})");
    // Rated when any parcel in it is — the ones rated one by one before too.
    expect(fn).toContain("ids.some((id) => ratedIds.has(id))");
  });

  it("stores one rating for the box, on its first parcel, and never a second", () => {
    const fn = slice(store, "export async function createBoxDeliveryRating", "export async function createDeliveryRating");
    expect(fn).toContain("packageId: Math.min(...ids)");
    expect(fn).toContain("if (rated.length > 0) return false;");
  });

  it("takes a rating only for the customer's own delivered box", () => {
    const fn = slice(router, "submitDeliveryRating:", "trackActivity:");
    expect(fn).toContain("boxId: z.number().int().positive()");
    expect(fn).toContain('!box || box.customerId !== customerId || box.status !== "delivered"');
    expect(fn).toContain("db.createBoxDeliveryRating({");
    expect(fn).not.toContain("packageId: z.number()");
  });

  it("changes nothing in the ratings table", () => {
    const schema = readRoot("drizzle/schema/portalActivity.schema.ts");
    const table = slice(schema, "export const deliveryRatings = mysqlTable(", "export type DeliveryRating");
    expect(table).toContain('packageId: int("packageId").notNull().unique(),');
    expect(table).not.toMatch(/boxId/);
  });
});

describe("the office sees which box was rated", () => {
  it("the Portal Center list names the box, and the parcel for older ratings", () => {
    const fn = slice(store, "export async function listDeliveryRatings", "export async function updateCustomerLastSignedIn");
    expect(fn).toContain("boxCode: sql<string | null>`(");
    expect(fn).toContain("WHERE i.packageId = ${deliveryRatings.packageId} AND b.status = 'delivered'");
    expect(center).toContain("{r.boxCode ? (");
    // Both lead somewhere now (owner, 2026-09-18): the box opens, the parcel opens.
    expect(center).toContain("<BoxCodeLink id={r.boxId} code={r.boxCode}");
    expect(center).toContain("<TrackingButton tracking={r.trackingNumber}");
  });
});
