import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-05: «لیستی ڕەش ئیش ناکات... لە زۆر جێگا ئەو شتە بێتەوە...
 * ئاسان بێ». The blacklist is one click from wherever a customer is, opens
 * with that customer chosen, and finds a customer by code, name or phone.
 */
describe("the blacklist is easy to reach", () => {
  it("is on every row of the customers list and on the customer's page", () => {
    expect(read("client/src/pages/customers/Customers.tsx")).toContain(
      "<CustomerStandingButton customerId={customer.id} standing={standingById.get(customer.id)} />",
    );
    expect(read("client/src/pages/customers/CustomerDetail.tsx")).toContain(
      "<CustomerStandingButton customerId={customerId} standing={standingById.get(customerId)} withLabel />",
    );
  });

  it("opens with the customer already chosen", () => {
    const button = read("client/src/components/customers/CustomerStandingButton.tsx");
    expect(button).toContain("return `/customers/standing?customer=${customerId}`;");
  });

  it("names the customer it opened on, and finds one by name or phone", () => {
    const db = read("server/db/customerStanding.db.ts");
    expect(db).toContain("customerName,");
    expect(db).toContain("${customers.mobileNumber} LIKE");
    expect(db).toContain("${customers.fullName} LIKE");
    expect(read("client/src/pages/customers/CustomerStanding.tsx")).toContain("data?.customerName");
  });
});
