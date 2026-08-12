import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { toCustomerVisibleOrder, toCustomerVisibleOrders } from "./lib/customerVisibleOrder";

/**
 * The portal's two standing promises: a customer sees their own data and
 * nobody else's, and never sees our side of the trade.
 *
 * Both are currently kept — this is written to keep them kept. Every
 * procedure added to the portal is another chance to read an id from the
 * request instead of the session, or to return a database row whole; neither
 * mistake looks wrong on the line where it is made.
 */

const ROOT = __dirname;
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const routerSrc = read("routers/portal.router.ts");

/** Split the router into one entry per procedure, in source order. */
function procedures(kind: string): Array<{ name: string; body: string }> {
  const marker = new RegExp(`^\\s{4}([a-zA-Z][a-zA-Z0-9_]*): (${kind})\\b`, "gm");
  const anyProc = /^\s{4}([a-zA-Z][a-zA-Z0-9_]*): [a-zA-Z]+Procedure\b/gm;
  const all = [...routerSrc.matchAll(anyProc)].map((m) => ({ name: m[1], at: m.index! }));
  const wanted = [...routerSrc.matchAll(marker)].map((m) => m.index!);
  return wanted.map((at) => {
    const i = all.findIndex((p) => p.at === at);
    const end = i + 1 < all.length ? all[i + 1].at : routerSrc.length;
    return { name: all[i].name, body: routerSrc.slice(at, end) };
  });
}

// Anyone may read these without logging in. Listed rather than pattern-matched
// so adding a public endpoint is a deliberate edit to this line.
const PUBLIC_BY_DESIGN = ["getPushPublicKey", "getAnnouncement", "getPriceList"];

describe("the portal only ever shows a customer their own data", () => {
  const customerProcs = procedures("customerProcedure");

  it("finds the procedures at all", () => {
    // Guard the guard: a refactor that changes how procedures are declared
    // would otherwise make every test below pass against an empty list.
    expect(customerProcs.length).toBeGreaterThan(30);
  });

  it("every customer procedure scopes its work to the session's customer", () => {
    // ctx.customerId is derived from the session by customerProcedure. A
    // procedure that never mentions it is either reading unscoped data or
    // taking the customer from somewhere it should not.
    const unscoped = customerProcs.filter((p) => !/ctx\.customerId/.test(p.body)).map((p) => p.name);
    expect(unscoped, "these do not scope by the logged-in customer").toEqual([]);
  });

  it("no customer procedure accepts a customer identifier from the request", () => {
    // The whole isolation model rests on the id coming from the session. One
    // procedure taking it as input hands every customer's data to anyone who
    // can edit a request body.
    const offenders: string[] = [];
    for (const proc of customerProcs) {
      const input = proc.body.match(/\.input\(([\s\S]*?)\)\s*\.(query|mutation)/);
      if (!input) continue;
      if (/\b(customerId|customerCode|customer_id)\b/.test(input[1])) offenders.push(proc.name);
    }
    expect(offenders, "these take a customer id from the caller").toEqual([]);
  });

  it("only the reviewed endpoints are readable without logging in", () => {
    const publicNames = procedures("publicProcedure").map((p) => p.name).sort();
    expect(publicNames).toEqual([...PUBLIC_BY_DESIGN].sort());
  });

  it("every order that reaches the portal passes through the sanitiser", () => {
    // The raw row carries our purchase price, our profit, the supplier's
    // contact details and the customer's own passwordHash.
    const returnsOrders = routerSrc.match(/return\s+db\.getFullPackageOrder[A-Za-z]*\(/g) ?? [];
    expect(returnsOrders, "an order row is being returned straight from the database").toEqual([]);
    expect(routerSrc).toContain("toCustomerVisibleOrder");
  });
});

describe("what the sanitiser strips from an order", () => {
  // A row shaped like the real join, carrying everything that must not travel.
  const row = {
    id: 7,
    orderCode: "FP-2026-001",
    status: "in_transit",
    sellingPriceUsd: "250.00",
    quantity: 2,
    // our side of the trade
    purchasePriceUsd: "140.00",
    purchasePriceCny: "1000.00",
    grossProfitUsd: "110.00",
    netProfitUsd: "95.00",
    profitUsd: "110.00",
    // the supplier relationship
    supplier: { id: 3, name: "Shenzhen Co", contactPerson: "Wei", phone: "+8613800000000", wechatId: "wx-123", platformShopUrl: "https://1688.com/shop/x" },
    supplierId: 3,
    contactPerson: "Wei",
    phone: "+8613800000000",
    wechatId: "wx-123",
    platformShopUrl: "https://1688.com/shop/x",
    // the customer's own row, joined in whole
    customer: { id: 11, fullName: "Ako", passwordHash: "$2b$10$abcdef", passportUrl: "/u/passport.jpg", nationalIdUrl: "/u/id.jpg", notes: "staff only" },
    passwordHash: "$2b$10$abcdef",
    // legitimately visible
    productImage: "data:image/png;base64,AAA",
    productImages: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
    batch: { id: 2, batchCode: "AIR-2026-038", status: "delivered", shippingType: "air_regular", costPerKg: "7.00", pricePerKg: "11.00" },
  };

  const OUR_SIDE = ["purchasePriceUsd", "purchasePriceCny", "grossProfitUsd", "netProfitUsd", "profitUsd"];
  const SUPPLIER = ["contactPerson", "phone", "wechatId", "platformShopUrl", "supplier"];
  const PRIVATE = ["passwordHash", "passportUrl", "nationalIdUrl"];

  const detail = toCustomerVisibleOrder(row) as Record<string, unknown>;
  const [listed] = toCustomerVisibleOrders([row]) as Record<string, unknown>[];

  it("keeps what the customer is entitled to", () => {
    expect(detail.orderCode).toBe("FP-2026-001");
    expect(detail.sellingPriceUsd).toBe("250.00");
    expect(detail.status).toBe("in_transit");
  });

  for (const field of OUR_SIDE) {
    it(`never reveals ${field} — that is what we paid and made`, () => {
      expect(detail).not.toHaveProperty(field);
      expect(listed).not.toHaveProperty(field);
    });
  }

  for (const field of SUPPLIER) {
    it(`never reveals ${field} — that is the relationship itself`, () => {
      expect(detail).not.toHaveProperty(field);
      expect(listed).not.toHaveProperty(field);
    });
  }

  for (const field of PRIVATE) {
    it(`never echoes back ${field}`, () => {
      expect(detail).not.toHaveProperty(field);
      expect(listed).not.toHaveProperty(field);
      expect(JSON.stringify(detail), `${field} must not appear anywhere in the payload`)
        .not.toContain(row[field as keyof typeof row] as string);
    });
  }

  it("drops the joined customer row entirely", () => {
    // The caller already has their own profile from getMyAccount, so this
    // costs nothing and stops passwordHash travelling over the wire.
    expect(detail).not.toHaveProperty("customer");
    expect(JSON.stringify(detail)).not.toContain("staff only");
  });

  it("shows the batch without our cost or margin on it", () => {
    const batch = detail.batch as Record<string, unknown> | null;
    expect(batch?.batchCode).toBe("AIR-2026-038");
    expect(batch).not.toHaveProperty("costPerKg");
    expect(batch).not.toHaveProperty("pricePerKg");
  });

  it("keeps the gallery out of the list form", () => {
    // One photo is 200-330 KB base64, and this list feeds five screens. A
    // customer with twenty two-photo orders was pulling megabytes to render
    // 48-pixel thumbnails.
    expect(listed).not.toHaveProperty("productImages");
    expect(listed.productImage).toBe("data:image/png;base64,AAA");
    expect(detail).toHaveProperty("productImages");
  });

  it("survives a row that is missing the joins", () => {
    const bare = toCustomerVisibleOrder({ id: 1, orderCode: "X" }) as Record<string, unknown>;
    expect(bare.batch).toBeNull();
    expect(bare.orderCode).toBe("X");
    expect(toCustomerVisibleOrders(null)).toEqual([]);
    expect(toCustomerVisibleOrders(undefined)).toEqual([]);
  });
});
