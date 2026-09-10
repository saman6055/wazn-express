import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { matchesRoute } from "./chinaDepotFilter";
import {
  stageOf,
  matchesStage,
  countByStage,
  STATUS_LABEL,
  SHIPPING_TYPE_LABEL,
  orderStageOf,
  orderStatusLabel,
  isInIraqNotDelivered,
  IN_IRAQ_STATUSES,
  BATCH_STATUS_TONE,
  batchStatusTone,
  type BatchStatus,
} from "./shipmentFilters";

const ALL_STATUSES: BatchStatus[] = [
  "preparing",
  "in_transit",
  "arrived",
  "customs",
  "at_depot",
  "delivered",
  "closed",
];

describe("stageOf", () => {
  it("puts a batch still being prepared in China", () => {
    expect(stageOf("preparing")).toBe("in_china");
  });

  it("counts goods already in Iraq as still on the way", () => {
    // The bug this file exists for: "arrived" and "customs" used to be grouped
    // with "preparing", so a shipment sitting at Erbil customs would have been
    // listed under "in the China warehouse".
    expect(stageOf("arrived")).toBe("in_transit");
    expect(stageOf("customs")).toBe("in_transit");
    expect(stageOf("in_transit")).toBe("in_transit");
    // Sitting in the Erbil depot still counts as coming: it is in the city,
    // but not in the customer's hands.
    expect(stageOf("at_depot")).toBe("in_transit");
  });

  it("only calls it arrived once the customer has it", () => {
    expect(stageOf("delivered")).toBe("delivered");
    expect(stageOf("closed")).toBe("delivered");
  });

  it("never puts anything in China except preparing", () => {
    const inChina = ALL_STATUSES.filter((s) => stageOf(s) === "in_china");
    expect(inChina).toEqual(["preparing"]);
  });

  it("gives every database status a stage, so none can vanish from the list", () => {
    for (const status of ALL_STATUSES) {
      expect(stageOf(status), status).not.toBeNull();
    }
  });

  it("returns null for a status it does not know rather than guessing", () => {
    expect(stageOf("cancelled")).toBeNull();
    expect(stageOf("")).toBeNull();
  });
});

describe("matchesStage", () => {
  it("shows everything when no stage is chosen — the old All chip", () => {
    for (const status of ALL_STATUSES) {
      expect(matchesStage(status, ""), status).toBe(true);
    }
  });

  it("keeps the three stages disjoint, so nothing is listed twice", () => {
    for (const status of ALL_STATUSES) {
      const matched = (["in_china", "in_transit", "delivered"] as const).filter((stage) =>
        matchesStage(status, stage),
      );
      expect(matched, status).toHaveLength(1);
    }
  });

  it("hides an unknown status from every stage but still shows it unfiltered", () => {
    expect(matchesStage("cancelled", "in_china")).toBe(false);
    expect(matchesStage("cancelled", "in_transit")).toBe(false);
    expect(matchesStage("cancelled", "delivered")).toBe(false);
    expect(matchesStage("cancelled", "")).toBe(true);
  });
});

describe("countByStage", () => {
  it("counts each batch exactly once", () => {
    const counts = countByStage(ALL_STATUSES);
    expect(counts).toEqual({ in_china: 1, in_transit: 4, delivered: 2 });
    const total = counts.in_china + counts.in_transit + counts.delivered;
    expect(total).toBe(ALL_STATUSES.length);
  });

  it("returns zeros rather than an empty object when there is nothing to count", () => {
    expect(countByStage([])).toEqual({ in_china: 0, in_transit: 0, delivered: 0 });
  });

  it("ignores a status it does not recognise instead of miscounting it", () => {
    const counts = countByStage(["preparing", "cancelled"]);
    expect(counts).toEqual({ in_china: 1, in_transit: 0, delivered: 0 });
  });
});

/**
 * Two screens used to name these six statuses independently, and both landed
 * on "گەیشتووە" for `arrived` and again for `delivered` — the same word for
 * "it reached Iraq" and "you have it in your hands", which is exactly the
 * distinction a customer is looking for on that page.
 */
describe("STATUS_LABEL", () => {
  const LANGS = ["ku", "en", "ar", "zh"] as const;

  it("names every status in all four languages", () => {
    for (const status of ALL_STATUSES) {
      for (const lang of LANGS) {
        expect(STATUS_LABEL[status]?.[lang], `${status}.${lang}`).toBeTruthy();
      }
    }
  });

  it("never gives two statuses the same name in any language", () => {
    for (const lang of LANGS) {
      const names = ALL_STATUSES.map((s) => STATUS_LABEL[s][lang]);
      expect(new Set(names).size, `${lang}: ${names.join(" / ")}`).toBe(names.length);
    }
  });

  it("keeps 'reached Iraq' and 'delivered' apart — the pair that used to collide", () => {
    for (const lang of LANGS) {
      expect(STATUS_LABEL.arrived[lang], lang).not.toBe(STATUS_LABEL.delivered[lang]);
    }
  });

  it("uses the same wording as the stage filters, so both screens agree", () => {
    expect(STATUS_LABEL.preparing.ku).toBe("لە کۆگای چین");
    expect(STATUS_LABEL.in_transit.ku).toBe("لە ڕێگادا");
  });
});

describe("SHIPPING_TYPE_LABEL", () => {
  it("covers the three types the database stores", () => {
    expect(Object.keys(SHIPPING_TYPE_LABEL).sort()).toEqual([
      "air_irregular",
      "air_regular",
      "sea",
    ]);
  });

  it("names each in all four languages, so none falls back to a raw column value", () => {
    for (const type of Object.keys(SHIPPING_TYPE_LABEL)) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(SHIPPING_TYPE_LABEL[type][lang], `${type}.${lang}`).toBeTruthy();
        // "air regular" leaked to the page as an English column name before.
        expect(SHIPPING_TYPE_LABEL[type][lang]).not.toMatch(/^air_|_/);
      }
    }
  });
});

/**
 * Full-package and commission orders live in their own table with their own
 * status names. Two ladders and two pages is how the portal came to
 * contradict itself: an order sitting in the China depot said so on "My
 * goods" and was missing from "Shipments" entirely.
 */
describe("orderStageOf", () => {
  it("puts an order in the China depot when it is in the China depot", () => {
    expect(orderStageOf("in_china_warehouse")).toBe("in_china");
    // Under inspection is still sitting on our shelf in China.
    expect(orderStageOf("quality_check")).toBe("in_china");
  });

  it("agrees with the package ladder about what counts as on the way", () => {
    for (const status of ["in_batch", "in_transit", "arrived", "ready_for_delivery"]) {
      expect(orderStageOf(status), status).toBe("in_transit");
    }
  });

  it("only calls it delivered once the customer has it", () => {
    expect(orderStageOf("delivered")).toBe("delivered");
  });

  it("shows nothing for an order that has not shipped yet", () => {
    // Quoted, approved, even ordered — the goods do not exist in our hands,
    // so they have no business on a shipments page.
    for (const status of ["pending_quote", "quoted", "pending", "approved", "ordered", "tracking_added"]) {
      expect(orderStageOf(status), status).toBeNull();
    }
  });

  it("shows nothing for an order that ended badly", () => {
    for (const status of ["cancelled", "rejected", "refunded", "returned"]) {
      expect(orderStageOf(status), status).toBeNull();
    }
  });
});

describe("orderStatusLabel", () => {
  it("uses the very same words as the package journey", () => {
    // If these ever diverge, the two pages start telling different stories.
    expect(orderStatusLabel("in_china_warehouse")).toBe(STATUS_LABEL.preparing);
    expect(orderStatusLabel("in_transit")).toBe(STATUS_LABEL.in_transit);
    expect(orderStatusLabel("arrived")).toBe(STATUS_LABEL.arrived);
    expect(orderStatusLabel("ready_for_delivery")).toBe(STATUS_LABEL.at_depot);
    expect(orderStatusLabel("delivered")).toBe(STATUS_LABEL.delivered);
  });

  it("gives every on-the-road status a name", () => {
    for (const status of [
      "in_china_warehouse", "quality_check", "in_batch",
      "in_transit", "arrived", "ready_for_delivery", "delivered",
    ]) {
      expect(orderStatusLabel(status), status).not.toBeNull();
    }
  });

  it("names nothing that has no stage, and gives a stage to everything it names", () => {
    const statuses = [
      "pending_quote", "quoted", "pending", "approved", "rejected", "ordered",
      "tracking_added", "in_china_warehouse", "quality_check", "in_batch",
      "in_transit", "arrived", "ready_for_delivery", "delivered", "cancelled",
      "refunded", "returned",
    ];
    for (const status of statuses) {
      const hasStage = orderStageOf(status) !== null;
      const hasLabel = orderStatusLabel(status) !== null;
      expect(hasLabel, `${status}: stage=${hasStage} label=${hasLabel}`).toBe(hasStage);
    }
  });
});

describe("the pills and the list agree", () => {
  /**
   * The list filtered with `batch.shippingType === shippingType`; the pills
   * counted with `matchesRoute`, which deliberately lets a batch with no route
   * recorded appear under every route so it is never unreachable.
   *
   * The two disagreed, and the disagreement was visible: the pills read
   * 13 · 0 · 1 directly above the words "13 results found". Fourteen counted,
   * thirteen shown.
   */
  it("an unrouted batch is treated the same by both", () => {
    // This is the case that differed: no route on the batch, a route chosen.
    expect(matchesRoute(null, "air_regular")).toBe(true);
    expect(matchesRoute(undefined, "sea")).toBe(true);
    // And the ordinary cases still behave.
    expect(matchesRoute("air_regular", "air_regular")).toBe(true);
    expect(matchesRoute("sea", "air_regular")).toBe(false);
    expect(matchesRoute("sea", "")).toBe(true);
  });

  it("the list filters through the same rule the counts use", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../pages/portal/PortalShipments.tsx"), "utf8");
    expect(src).toContain("matchesRoute(batch.shippingType, shippingType)");
    expect(src, "a strict equality here is how the two drifted apart")
      .not.toContain("batch.shippingType === shippingType");
  });
});

describe("the Iraq-side tail of the road", () => {
  it("is exactly arrived, customs and at_depot", () => {
    for (const s of ["arrived", "customs", "at_depot"]) {
      expect(isInIraqNotDelivered(s), `${s} is in Iraq`).toBe(true);
    }
    for (const s of ["preparing", "in_transit", "delivered", "closed", "nonsense"]) {
      expect(isInIraqNotDelivered(s), `${s} is not`).toBe(false);
    }
  });

  it("stays inside the in_transit stage, so the shipments page still agrees", () => {
    // The home pipeline splits in_transit into road / Iraq. Every Iraq status
    // must still answer in_transit to stageOf, or a tap on the card and the
    // shipments filter would count different worlds.
    for (const s of IN_IRAQ_STATUSES) {
      expect(stageOf(s)).toBe("in_transit");
    }
  });

  it("the home pipeline counts and filters through this one rule", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../pages/portal/PortalHome.tsx"), "utf8");
    expect(src).toContain("isInIraqNotDelivered(b.status)");
    expect(src, "no private list of Iraq statuses on the screen")
      .not.toMatch(/"arrived"\s*,\s*"customs"\s*,\s*"at_depot"/);
  });
});

describe("BATCH_STATUS_TONE", () => {
  it("colours every status STATUS_LABEL names, so no chip falls back to grey by accident", () => {
    for (const status of Object.keys(STATUS_LABEL)) {
      expect(BATCH_STATUS_TONE[status as BatchStatus], `${status} has no tone`).toBeTruthy();
    }
  });

  it("carries both themes in every entry, so a screen never branches on the theme", () => {
    for (const [status, tone] of Object.entries(BATCH_STATUS_TONE)) {
      expect(tone, `${status} lacks a light background`).toMatch(/(^|\s)bg-/);
      expect(tone, `${status} lacks a dark background`).toMatch(/dark:bg-/);
      expect(tone, `${status} lacks a dark text colour`).toMatch(/dark:text-/);
    }
  });

  it("keeps the owner's palette: sky on the road, emerald once in Iraq or handed over", () => {
    expect(BATCH_STATUS_TONE.in_transit).toContain("sky");
    expect(BATCH_STATUS_TONE.at_depot).toContain("emerald");
    expect(BATCH_STATUS_TONE.delivered).toContain("emerald");
    expect(batchStatusTone("not-a-status")).toBe(BATCH_STATUS_TONE.preparing);
  });

  it("is what the screens use — no private colour switch on a batch status", () => {
    // The chip colour used to be a switch in each screen, and they disagreed.
    for (const file of ["PortalHome.tsx", "PortalShipments.tsx"]) {
      const src = fs.readFileSync(path.resolve(__dirname, "../pages/portal", file), "utf8");
      expect(src, `${file} should use the shared tone`).toMatch(/batchStatusTone|BatchStatusChip/);
      expect(src, `${file} still colours a batch status by hand`)
        .not.toMatch(/case "in_transit":\s*\n\s*return (isDark|\{)/);
    }
  });
});
