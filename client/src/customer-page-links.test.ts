import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * On a customer's page, a figure that stands for records opens them.
 *
 * The owner, 2026-09-22, looking at his own customer page: "each of these
 * data items, if it has detail or a relation somewhere else — clicking should
 * give me the information, or take me to the thing itself. Connect the links."
 *
 * The trap is the destination, not the link: a count of 14 parcels that opens
 * all twelve hundred is a lie told politely. So every address comes from the
 * shared link vocabulary and carries this customer's code.
 *
 * What would undo it: a card linking to an unfiltered list, a row that only
 * looks clickable, or a figure that stands for nothing being given a link.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

const page = read("pages/customers/CustomerDetail.tsx");
const tab = read("components/customers/CustomerPackagesTab.tsx");
const info = read("components/customers/CustomerInfoCard.tsx");

describe("the figures at the top", () => {
  it("open this customer's records, never the whole list", () => {
    expect(page).toContain("const code = customerCodeOnly(customer?.customerCode);");
    expect(page).toContain("code ? packagesHref({ search: code, ...link }) : undefined;");
    // Without a code there is no honest filter, so there is no link either.
    expect(page).toContain("if (href) {");
  });

  it("each to the records it counted", () => {
    expect(page).toContain("<Drill href={parcelsHref()}>");
    expect(page).toContain('<Drill href={parcelsHref({ tab: "pending_delivery" })}>');
    expect(page).toContain('<Drill href={parcelsHref({ tab: "delivered" })}>');
    expect(page).toContain("<Drill href={preferredShippingHref}>");
  });

  it("the money opens the account it was counted from, on this same page", () => {
    expect((page.match(/<Drill onClick=\{\(\) => setTab\("finance"\)\}>/g) ?? []).length).toBe(2);
    expect(page).toContain("<Tabs value={tab} onValueChange={setTab}");
  });

  it("a figure that stands for nothing is left alone", () => {
    // Total weight and average weight are facts, not lists of anything.
    const weight = page.slice(page.indexOf('t("customers.totalWeight")') - 400, page.indexOf('t("customers.avgWeight")'));
    expect(weight).not.toContain("<Drill");
  });

  it("the shipping type opens the parcels that carry it", () => {
    const links = readRoot("shared/listLinks.ts");
    expect(links).toContain('shippingType?: "air_regular" | "air_irregular" | "sea";');
    expect(links).toContain('shippingType: oneOf(p.get("shippingType"), ["air_regular", "air_irregular", "sea"] as const),');
    expect(readRoot("client/src/pages/Packages.tsx")).toContain(
      "if (linkFilters.shippingType) setShippingTypeFilter(linkFilters.shippingType);",
    );
  });
});

describe("the parcels table", () => {
  it("every row opens that parcel, by its own tracking", () => {
    expect(tab).toContain("const href = packagesHref({ search: pkg.trackingNumber || pkg.packageCode });");
    // Every cell, so the whole row is the target — not one word of it.
    expect((tab.match(/<Link href=\{href\}/g) ?? []).length).toBe(7);
  });

  it("the count at the foot opens all of them, filtered to this customer", () => {
    expect(tab).toContain("<Link href={packagesHref({ search: code })}>");
    expect(tab).toContain("packages.length > shown.length && code");
  });

  it("speaks the page's language, as the rest of it does", () => {
    for (const english of ["<TableHead>Package Code<", "<TableHead>Tracking<", "No packages found", "All packages for this customer"]) {
      expect(tab, english).not.toContain(english);
    }
    expect(tab).toContain('ku: "کۆدی پاکەت"');
    expect(tab).toContain('ku: "هیچ پاکەتێک نییە"');
  });
});

describe("the contact panel", () => {
  it("a mobile number opens that customer's WhatsApp", () => {
    expect(info).toContain('import { whatsappNumber } from "@shared/receiptWhatsApp";');
    expect(info).toContain("const number = whatsappNumber(text);");
    expect(info).toContain("`https://wa.me/${number}`");
  });

  it("an email opens the mail app", () => {
    expect(info).toContain("href={`mailto:${customer.email}`}");
  });

  it("something that is not a number stays plain text", () => {
    expect(info).toContain('if (!target) return <div className="flex items-center gap-3">{body}</div>;');
  });
});
