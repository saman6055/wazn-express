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
    { id: 10, batchCode: "AIR-2026-041", statusDates: { at_depot: day(8) } },
    { id: 11, batchCode: "SEA-2026-007", estimatedArrival: day(30) },
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

describe("the three tabs", () => {
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
    expect(orderTab("ordered")).toBeNull();
  });

  it("counts live over what the search found", () => {
    expect(countByTab(find(""))).toEqual({ arrived: 1, onTheWay: 2, registered: 3 });
    expect(countByTab(find("SF14"))).toEqual({ arrived: 0, onTheWay: 1, registered: 0 });
  });

  it("names and colours each tab — green, blue, grey — in four languages", () => {
    expect(SEARCH_TAB_TONE.arrived).toContain("emerald");
    expect(SEARCH_TAB_TONE.onTheWay).toContain("sky");
    expect(SEARCH_TAB_TONE.registered).toContain("slate");
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
    expect(keys).not.toContain("order:71");
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
