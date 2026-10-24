import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  countByTab,
  orderTab,
  parcelTab,
  parseSearch,
  searchItems,
  searchKey,
  searchTarget,
  shouldAskServer,
  ordersAwaitingQuote,
  SEARCH_TAB_UNIT,
  PARCEL_NEXT_STEP,
  SEARCH_TAB_LABEL,
  SEARCH_TAB_TONE,
  type ParcelRow,
} from "./portalSearch";
import { PACKAGE_STATUS_LABEL } from "./packageStatus";

const day = (d: number) => new Date(Date.UTC(2026, 8, d, 9, 0));

const parcel = (over: Partial<ParcelRow> & { id: number }): ParcelRow => ({
  packageCode: `PKG-${over.id}`,
  trackingNumber: null,
  description: null,
  status: "registered",
  batchId: null,
  fullPackageOrderId: null,
  registeredAt: day(1),
  createdAt: day(1),
  deliveredAt: null,
  ...over,
});

const SOURCES = {
  parcels: [
    parcel({ id: 1, trackingNumber: "YT7524601234567", status: "ready_for_delivery", batchId: 10, registeredAt: day(2) }),
    parcel({ id: 2, trackingNumber: "SF1400998877", status: "in_transit", batchId: 10, registeredAt: day(3) }),
    parcel({ id: 3, trackingNumber: "JT3000111222", status: "registered", registeredAt: day(4) }),
    parcel({ id: 4, trackingNumber: "ZTO-88-4567", status: "registered", batchId: 11, registeredAt: day(5) }),
    parcel({ id: 5, trackingNumber: "YD5550001111", status: "delivered", deliveredAt: day(9), registeredAt: day(1) }),
    parcel({ id: 6, trackingNumber: "RT0000000001", status: "returned", registeredAt: day(6) }),
    parcel({ id: 7, trackingNumber: "FPTRACK00077", status: "customs_processing", fullPackageOrderId: 70, batchId: 11 }),
  ],
  orders: [
    { id: 70, orderCode: "FP-00070", status: "in_transit", productName: "Leather handbag", trackingNumber: "FPTRACK00077", productImage: "/img/bag.jpg" },
    { id: 71, orderCode: "FP-00071", status: "ordered", productName: "جانتای چەرم", trackingNumber: null, createdAt: day(7) },
    { id: 72, orderCode: "FP-00072", status: "in_china_warehouse", productName: "Phone case", trackingNumber: "CN9999", createdAt: day(8) },
    { id: 73, orderCode: "FP-00073", status: "cancelled", productName: "Shoes" },
  ],
  batches: [
    // No waybill: whatever a parcel's own status says, it has not left.
    { id: 10, batchCode: "AIR-2026-041", shippingType: "air_regular", statusDates: { at_depot: day(8) } },
    // A container number, so the goods in it really are at sea.
    { id: 11, batchCode: "SEA-2026-007", shippingType: "sea", containerNumber: "MSKU7781234", estimatedArrival: day(30) },
  ],
  boxes: [{ id: 50, boxCode: "BOX-20260910-005", status: "delivered", deliveredAt: day(10), packageIds: [5] }],
  declared: [
    { id: 90, trackingNumber: "PRE-ALERT-123456", productName: "Headphones", status: "pending", createdAt: day(6) },
    { id: 91, trackingNumber: "JT3000111222", status: "pending", createdAt: day(3) },
    { id: 92, trackingNumber: "DONE0000001", status: "received", createdAt: day(2) },
  ],
};

const index = buildSearchIndex(SOURCES);
const find = (q: string) => searchItems(index, parseSearch(q));
const byKey = (key: string) => index.find((i) => i.key === key)!;

describe("the four tabs", () => {
  it("puts a parcel where the owner said: in Erbil, on the way, in China", () => {
    expect(parcelTab({ status: "ready_for_delivery" })).toBe("arrived");
    expect(parcelTab({ status: "out_for_delivery" })).toBe("arrived");
    expect(parcelTab({ status: "in_transit" })).toBe("onTheWay");
    // Customs stays on the way (owner, 2026-09-19).
    expect(parcelTab({ status: "customs_processing" })).toBe("onTheWay");
    expect(parcelTab({ status: "registered", batchId: null })).toBe("registered");
  });

  it("a parcel packed into a shipment that has not left is still in China — grey until the plane or ship leaves", () => {
    expect(parcelTab({ status: "in_batch" })).toBe("registered");
    expect(parcelTab({ status: "in_batch", batchId: 11 })).toBe("registered");
    expect(parcelTab({ status: "registered", batchId: 11 })).toBe("registered");
  });

  it("a delivered parcel has left the green tab — it was collected, not waiting — and is still found by its number", () => {
    expect(parcelTab({ status: "delivered" })).toBeNull();
    expect(find("").map((i) => i.key)).not.toContain("parcel:5");
    expect(find("YD5550001111").map((i) => i.key)).toContain("parcel:5");
  });

  it("returned and cancelled parcels sit under no tab", () => {
    expect(parcelTab({ status: "returned" })).toBeNull();
    expect(parcelTab({ status: "cancelled" })).toBeNull();
  });

  it("an order that reached Iraq is on the way, not arrived", () => {
    expect(orderTab("arrived")).toBe("onTheWay");
    expect(orderTab("ready_for_delivery")).toBe("arrived");
    expect(orderTab("in_china_warehouse")).toBe("registered");
    expect(orderTab("in_batch")).toBe("registered");
    expect(orderTab("delivered")).toBeNull();
  });

  it("an order recorded has been bought, whatever it is waiting for", () => {
    // The owner's rule, 2026-10-24. A full-package or commission order is
    // created as `ordered` when its order number is known and `pending`
    // when it is not; both are money already spent on the customer's goods.
    for (const status of ["pending", "approved", "ordered", "tracking_added"]) {
      expect(orderTab(status), status).toBe("bought");
    }
  });

  it("a purchase request waiting for our price is not bought, and is counted apart", () => {
    expect(orderTab("pending_quote")).toBeNull();
    expect(orderTab("quoted")).toBeNull();
    expect(ordersAwaitingQuote([
      { id: 1, status: "pending_quote" },
      { id: 2, status: "quoted" },
      { id: 3, status: "ordered" },
      { id: 4, status: "cancelled" },
    ] as any)).toBe(2);
    expect(ordersAwaitingQuote(undefined)).toBe(0);
  });

  it("the shipment's own number decides what is on the way, not the parcel's status", () => {
    // The owner's rule, 2026-10-24. Batch 10 has no waybill, so parcel 2 is
    // in China however it was stamped; batch 11 has a container number, so
    // parcel 7 is at sea however it was stamped.
    const air = { id: 10, shippingType: "air_regular" };
    const sea = { id: 11, shippingType: "sea", containerNumber: "MSKU7781234" };
    expect(parcelTab({ status: "in_transit" }, air)).toBe("registered");
    expect(parcelTab({ status: "customs_processing" }, air)).toBe("registered");
    expect(parcelTab({ status: "registered" }, sea)).toBe("onTheWay");
    expect(parcelTab({ status: "in_transit" }, { ...air, awbNumber: "176-55512345" })).toBe("onTheWay");
    // A blank number is no number.
    expect(parcelTab({ status: "in_transit" }, { ...air, awbNumber: "   " })).toBe("registered");
    // The parcel's own stamp still wins once the goods are here, and so
    // does a container that has reached us.
    expect(parcelTab({ status: "ready_for_delivery" }, sea)).toBe("arrived");
    expect(parcelTab({ status: "in_batch" }, { id: 10, status: "at_depot" })).toBe("arrived");
    // With no shipment to ask, the parcel's own status answers, as before.
    expect(parcelTab({ status: "in_transit" })).toBe("onTheWay");
  });

  it("counts live over what the search found", () => {
    expect(countByTab(find(""))).toEqual({ arrived: 1, onTheWay: 2, registered: 3, bought: 1 });
    // SF14 is parcel 2, in the batch with no waybill: still in China.
    expect(countByTab(find("SF14"))).toEqual({ arrived: 0, onTheWay: 0, registered: 1, bought: 0 });
  });

  it("says what each number counts, because a bare figure does not", () => {
    // Goods not yet shipped have no parcel to count, so that card counts
    // orders; the other three count parcels.
    expect(SEARCH_TAB_UNIT.bought.ku).toBe("ئۆردەر");
    for (const tab of ["arrived", "onTheWay", "registered"] as const) {
      expect(SEARCH_TAB_UNIT[tab].ku, tab).toBe("پاکەت");
    }
    for (const unit of Object.values(SEARCH_TAB_UNIT)) {
      expect(unit.ku && unit.en && unit.ar && unit.zh).toBeTruthy();
    }
  });

  it("only Arabic names the country, and names the city with it", () => {
    // An Arabic-speaking customer may be outside Erbil, so the country is
    // the news; the city in brackets keeps it clear of "on the way", which
    // is where a parcel in customs still sits (owner, 2026-10-24).
    expect(SEARCH_TAB_LABEL.arrived.ar).toBe("العراق (أربيل)");
    expect(SEARCH_TAB_LABEL.arrived.ku).not.toContain("عێراق");
    expect(SEARCH_TAB_LABEL.arrived.en).not.toMatch(/Iraq/i);
  });

  it("names and colours each tab — green, blue, grey, pink — in four languages", () => {
    expect(SEARCH_TAB_TONE.arrived).toContain("emerald");
    expect(SEARCH_TAB_TONE.onTheWay).toContain("sky");
    expect(SEARCH_TAB_TONE.registered).toContain("slate");
    // Not violet: `.portal-theme` folds that family into its navy scale, so
    // a violet card would come out as a second blue one.
    expect(SEARCH_TAB_TONE.bought).toContain("pink");
    for (const tone of Object.values(SEARCH_TAB_TONE)) {
      expect(tone).not.toMatch(/violet|indigo|purple|fuchsia/);
    }
    for (const tone of Object.values(SEARCH_TAB_TONE)) {
      expect(tone).toMatch(/dark:bg-/);
      expect(tone).toMatch(/dark:text-/);
    }
    for (const label of Object.values(SEARCH_TAB_LABEL)) {
      expect(label.ku && label.en && label.ar && label.zh).toBeTruthy();
      expect(label.ku).not.toContain("باچ");
    }
  });
});

describe("what one box finds", () => {
  it("the whole tracking number comes first", () => {
    expect(find("YT7524601234567")[0].key).toBe("parcel:1");
  });

  it("the last four digits are enough", () => {
    expect(find("4567").map((i) => i.key)).toEqual(expect.arrayContaining(["parcel:1", "parcel:4"]));
  });

  it("a paste from a chat — spaces, a label, Eastern digits, lower case — still finds it", () => {
    expect(find("运单号： yt 7524 6012 34567")[0].key).toBe("parcel:1");
    expect(find("sf\u0661\u0664\u0660\u0660\u0669\u0669\u0668\u0668\u0667\u0667")[0].key).toBe("parcel:2");
  });

  it("dashes do not matter on either side", () => {
    expect(find("ZTO884567")[0].key).toBe("parcel:4");
    expect(find("zto-88-4567")[0].key).toBe("parcel:4");
  });

  it("an order number finds the parcel that carries the order, not the order twice", () => {
    const hits = find("FP-00070");
    expect(hits[0].key).toBe("parcel:7");
    expect(hits.some((i) => i.key === "order:70")).toBe(false);
  });

  it("an order with no parcel yet is found on its own", () => {
    expect(find("FP-00071")[0].key).toBe("order:71");
    expect(find("جانتا")[0].key).toBe("order:71");
  });

  it("the product's name finds its parcel, and ranks below any number", () => {
    expect(find("handbag")[0].key).toBe("parcel:7");
  });

  it("a box code, or its last digits, finds the box and the parcel inside it", () => {
    const hits = find("BOX-20260910-005").map((i) => i.key);
    expect(hits[0]).toBe("box:50");
    expect(hits).toContain("parcel:5");
    expect(find("005").map((i) => i.key)).toContain("box:50");
  });

  it("a shipment code finds the parcels in that shipment", () => {
    expect(find("AIR-2026-041").map((i) => i.key).sort()).toEqual(["parcel:1", "parcel:2"]);
  });

  it("a registration waiting for its parcel is found; one whose parcel came is not listed twice", () => {
    expect(find("PRE-ALERT-123456")[0].key).toBe("declared:90");
    expect(find("JT3000111222").map((i) => i.key)).toEqual(["parcel:3"]);
    expect(index.some((i) => i.key === "declared:92")).toBe(false);
  });

  it("a cancelled order is not found at all", () => {
    expect(find("FP-00073")).toEqual([]);
  });

  it("with nothing typed, shows the goods under a tab, newest first", () => {
    const keys = find("").map((i) => i.key);
    expect(keys).not.toContain("parcel:6");
    expect(keys).not.toContain("box:50");
    expect(keys).not.toContain("declared:90");
    // An order bought but not yet at the depot now has a tab of its own, so
    // it is listed: that stretch used to show nowhere at all.
    expect(keys).toContain("order:71");
    const at = find("").map((i) => i.sortAt);
    expect(at).toEqual([...at].sort((a, b) => b - a));
  });

  it("one character is not a search", () => {
    expect(parseSearch("Y").active).toBe(false);
    expect(parseSearch("YT").active).toBe(true);
  });

  it("the key is capitals and digits only", () => {
    expect(searchKey(" zto-88\u200F-4567 ")).toBe("ZTO884567");
  });
});

describe("the dates on the cards", () => {
  it("a delivered parcel shows the day it was delivered", () => {
    expect(byKey("parcel:5").dateKind).toBe("delivered");
    expect(byKey("parcel:5").date).toEqual(day(9));
  });

  it("a parcel ready in Erbil shows the day its shipment reached the depot", () => {
    expect(byKey("parcel:1").dateKind).toBe("reachedErbil");
    expect(byKey("parcel:1").date).toEqual(day(8));
  });

  it("anything else shows the day it was registered", () => {
    expect(byKey("parcel:3").dateKind).toBe("registered");
    expect(byKey("parcel:3").date).toEqual(day(4));
  });
});

describe("where a tap goes", () => {
  it("goods bought through an order open that order", () => {
    expect(searchTarget(byKey("parcel:7"), { boxReceipts: true })).toBe("/portal/full-package?order=70");
    expect(searchTarget(byKey("order:71"), { boxReceipts: false })).toBe("/portal/full-package?order=71");
  });

  it("a parcel in a box opens the box's receipt when the money page shows boxes", () => {
    expect(searchTarget(byKey("parcel:5"), { boxReceipts: true })).toBe("/portal/financial?tab=boxes&box=50");
    expect(searchTarget(byKey("box:50"), { boxReceipts: true })).toBe("/portal/financial?tab=boxes&box=50");
  });

  it("otherwise the detail sheet opens in place", () => {
    expect(searchTarget(byKey("parcel:5"), { boxReceipts: false })).toBeNull();
    expect(searchTarget(byKey("parcel:1"), { boxReceipts: true })).toBeNull();
    expect(searchTarget(byKey("box:50"), { boxReceipts: false })).toBeNull();
  });

  it("a registration opens the registrations page", () => {
    expect(searchTarget(byKey("declared:90"), { boxReceipts: true })).toBe("/portal/declare");
  });
});

describe("the server is asked only when it has to be", () => {
  it("not while anything loaded matches", () => {
    expect(shouldAskServer(parseSearch("YT7524601234567"), 1)).toBe(false);
  });

  it("not for a fragment too short to be a number", () => {
    expect(shouldAskServer(parseSearch("4567"), 0)).toBe(false);
  });

  it("for a number nothing loaded holds", () => {
    expect(shouldAskServer(parseSearch("OLD123456789"), 0)).toBe(true);
  });
});

describe("the next-step line", () => {
  it("covers every parcel status in four languages", () => {
    for (const status of Object.keys(PACKAGE_STATUS_LABEL)) {
      const line = PARCEL_NEXT_STEP[status];
      expect(line, `${status} has no next step`).toBeTruthy();
      expect(line.ku && line.en && line.ar && line.zh).toBeTruthy();
    }
  });

  it("never tells a parcel it is in China — one registered in Erbil never went there", () => {
    for (const line of Object.values(PARCEL_NEXT_STEP)) {
      expect(line.ku).not.toContain("چین");
      expect(line.en).not.toContain("China");
    }
  });
});
