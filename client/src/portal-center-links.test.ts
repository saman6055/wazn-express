import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The Portal Center, joined to the rest of the system (owner, 2026-09-18,
 * phase 1): every figure at the top opens its tab filtered, every tab with
 * work waiting shows it in red, every customer code opens the customer, every
 * box code the box, every tracking the parcel — and each one copies. A low
 * rating (1 to 3 stars) gets a WhatsApp button.
 *
 * Where each click goes is unit-tested in shared/portalCenterNav.test.ts; this
 * pins the wiring.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const page = read("client/src/pages/PortalCenter.tsx");
const links = read("client/src/components/portal-center/PortalLinks.tsx");
const db = read("server/db/portalCenter.db.ts");

describe("the figures at the top", () => {
  it("each opens its own tab, filtered to what it counted", () => {
    expect(page).toContain("onOpen={(figure) => go(OVERVIEW_TARGET[figure])}");
    expect(page).toContain("onClick={() => onOpen(c.figure)}");
    expect(page).toContain('<Tabs value={link.tab} onValueChange={(value) => go({ tab: value as PortalCenterTab })} className="space-y-4">');
  });

  it("and the tab opens with that filter", () => {
    expect(page).toContain('initialStatus={link.tab === "declared" ? link.status : undefined}');
    expect(page).toContain('initialStatus={link.tab === "claims" ? link.status : undefined}');
    expect(page).toContain('initialSinceDays={link.tab === "activity" ? link.sinceDays : undefined}');
    expect(page).toContain('useState<string>(initialStatus ?? "all")');
  });

  it("a link from anywhere opens the page on its tab", () => {
    expect(page).toContain("readPortalCenterLink(window.location.search)");
  });
});

describe("the page", () => {
  it("uses the whole width, as the other pages do — no narrow column with empty sides", () => {
    expect(page).toContain('<div className="space-y-5" dir={isRTL ? "rtl" : "ltr"} data-portal-center>');
    expect(page).not.toContain("max-w-7xl mx-auto");
  });
});

describe("the tabs", () => {
  it("sit in one row, held under the top bar while the page scrolls", () => {
    expect(page).toContain('<TabsList className="sticky top-[100px] md:top-11 z-20 flex w-full flex-nowrap');
    expect(page).toContain("overflow-x-auto");
    expect(page).not.toContain("lg:grid-cols-11");
    expect(page).toContain('"shrink-0 gap-1.5 rounded-xl px-2 py-2');
  });

  it("the tab in use is brought into the row, sideways only", () => {
    expect(page).toContain('list?.querySelector<HTMLElement>(\'[role="tab"][data-state="active"]\')');
    expect(page).toContain("list.scrollLeft -= listBox.left - tabBox.left + 12;");
    expect(page).not.toMatch(/active\.scrollIntoView/);
  });
});

describe("the red number on each tab with work waiting", () => {
  it("messages, tracking, ownership, prohibited, ratings and yuan", () => {
    for (const tab of ["messages", "declared", "claims", "prohibited", "ratings", "yuan"]) {
      expect(page, tab).toContain(`{badge("${tab}")}`);
    }
  });

  it("counted by the server: unread messages, prohibited parcels waiting on staff, this week's low ratings", () => {
    expect(db).toContain('eq(customerMessages.senderType, "customer"), eq(customerMessages.isRead, false)');
    expect(db).toContain('eq(prohibitedPackages.status, "chosen")');
    expect(db).toContain("sql`${deliveryRatings.rating} <= 3`");
    expect(db).toContain("lowRatingsWeek: num(lowRatingsWeek?.c),");
  });
});

describe("every code leads where it lives, and copies", () => {
  it("a customer code opens the customer's profile", () => {
    expect(links).toContain("href={`/customers/${id}`}");
    expect(links).toContain("<CopyButton value={short}");
    // Customers, activity, tracking, prohibited, claims, messages, ratings, yuan, features ×2.
    expect(page.split("<CustomerCodeLink ").length - 1).toBeGreaterThanOrEqual(10);
    expect(page).not.toMatch(/font-mono">\{(c|d|a|r|g|row)\.customerCode\}</);
  });

  it("a box code opens that box", () => {
    expect(links).toContain("href={`/customer-delivery-scanner?box=${id}`}");
    expect(page).toContain("<BoxCodeLink id={r.boxId} code={r.boxCode}");
    expect(db).toContain("SELECT b.id FROM deliveryBoxItems i");
    const boxes = read("client/src/pages/CustomerDeliveryScanner.tsx");
    expect(boxes).toContain('const asked = Number(new URLSearchParams(search).get("box"));');
    expect(boxes).toContain("setActiveBoxId(asked);");
  });

  it("a tracking opens the parcel — weight, photos, history — in one drawer for the page", () => {
    expect(links).toContain("await utils.scanning.searchByTracking.fetch({ trackingNumber: wanted })");
    expect(links).toContain('<AlertParcelSheet parcel={parcel} kind="check" level="high" onClose={() => setParcel(null)} />');
    expect(page).toContain("<ParcelSheetProvider>");
    for (const who of ["d", "c", "r"]) {
      expect(page, who).toContain(`<TrackingButton tracking={${who}.trackingNumber}`);
    }
  });
});

describe("a low rating", () => {
  it("gets a WhatsApp button to the customer, with a message ready", () => {
    expect(page).toContain("{isLowRating(r.rating) && r.customerMobile && (");
    expect(page).toContain("href={waLink(");
    expect(db).toContain("customerMobile: customers.mobileNumber,");
  });
});
