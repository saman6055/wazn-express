import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "components/portal/BatchJourneyTimeline.tsx"), "utf8");

/**
 * The journey stepper is the first thing a customer looks at, on every card
 * on the shipments page, in all three skins.
 *
 * Its dates come from two different places. `createdAt` is stamped by the
 * system when the batch row is made; `departureDate` and `actualArrival` are
 * typed in by staff afterwards. Nothing reconciles them, and on the live site
 * every card read "in China warehouse — 28 July" followed by "in transit —
 * 1 February": a shipment that left six months before it was packed.
 */
describe("a journey cannot run backwards", () => {
  it("withholds a date that precedes the step before it", () => {
    expect(SRC).toContain("function dropBackwardsDates");
    // Every stage list must go through it — not just the one that was wrong.
    expect(SRC).toMatch(/dropBackwardsDates\(\[/);
  });

  /**
   * Only the date is withheld. The step keeps its label and its tick, so the
   * customer still sees where the goods are — a missing date reads as "not
   * recorded yet", which is honest, while a backwards one reads as a company
   * that has lost track of the shipment.
   */
  it("keeps the step and drops only the impossible date", () => {
    const fn = SRC.slice(SRC.indexOf("function dropBackwardsDates"));
    expect(fn.slice(0, 500)).toContain("{ ...s, date: null }");
    expect(fn.slice(0, 500), "the step itself must survive").not.toMatch(/\.filter\(/);
  });

  it("compares real timestamps, not formatted strings", () => {
    // "1 شوبات 2026" and "28 تەممووز 2026" do not compare; the epoch values do.
    expect(SRC).toContain("function toTime");
    const fn = SRC.slice(SRC.indexOf("function dropBackwardsDates"));
    expect(fn.slice(0, 500)).toMatch(/s\.at\s*<\s*last/);
  });

  it("is the one timeline all three skins render", () => {
    const skins = [
      "pages/portal/PortalShipments.tsx",
      "pages/portal/modern/ModernPortalShipments.tsx",
      "pages/portal/skin3/Skin3PortalShipments.tsx",
    ];
    for (const s of skins) {
      const src = fs.readFileSync(path.resolve(__dirname, s), "utf8");
      expect(src, `${s} must use the shared stepper`).toContain("<BatchJourneyTimeline");
    }
  });
});

describe("the route marker means something", () => {
  const SHIPMENTS = fs.readFileSync(
    path.resolve(__dirname, "pages/portal/PortalShipments.tsx"), "utf8");

  /**
   * The China → Iraq line under every batch card had its marker pinned to the
   * midpoint. Only the colour and the icon changed with the status, so a
   * delivered shipment showed a green tick stranded halfway between the two
   * flags — directly beneath a stepper whose every step was ticked. Two things
   * on one card, contradicting each other, and position is the loudest.
   */
  it("moves with the batch rather than sitting at the midpoint", () => {
    expect(SHIPMENTS).toContain("ROUTE_PROGRESS");
    expect(SHIPMENTS).toMatch(/insetInlineStart: `\$\{ROUTE_PROGRESS\[batch\.status\]/);
  });

  it("covers every stage the stepper knows", () => {
    const map = SHIPMENTS.slice(
      SHIPMENTS.indexOf("const ROUTE_PROGRESS"),
      SHIPMENTS.indexOf("};", SHIPMENTS.indexOf("const ROUTE_PROGRESS")),
    );
    for (const stage of ["preparing", "in_transit", "arrived", "customs", "at_depot", "delivered", "closed"]) {
      expect(map, `${stage} has no position`).toContain(`${stage}:`);
    }
    // Monotonic: a later stage must never sit further back than an earlier one.
    const values = [...map.matchAll(/:\s*(\d+),/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThanOrEqual(7);
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `stage ${i} goes backwards`).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  /**
   * In Kurdish and Arabic, China is the right-hand flag. A `left`/translateX
   * pair would have marched the dot the wrong way down the line; the logical
   * properties flip on their own.
   */
  it("travels the right way in both directions", () => {
    expect(SHIPMENTS).toContain("insetInlineStart");
    expect(SHIPMENTS).toContain('marginInlineStart: "-12px"');
  });
});

describe("the stepper can date every step it shows", () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, "components/portal/BatchJourneyTimeline.tsx"), "utf8");

  /**
   * A batch carries three timestamps of its own — created, departed, arrived.
   * Customs, the Erbil depot and delivery were hard-coded to null, so a
   * shipment already in the customer's hands showed six green steps and one
   * date, the oldest of them. On a sea batch that is two months of silence.
   */
  it("no step is hard-coded to have no date", () => {
    const stages = SRC.slice(SRC.indexOf("dropBackwardsDates(["), SRC.indexOf("const eta ="));
    expect(stages, "customs, at_depot and delivered used to be date: null")
      .not.toMatch(/date: null,\s*\n\s*at: null,/);
    for (const stage of ["preparing", "in_transit", "arrived", "customs", "at_depot", "delivered"]) {
      expect(stages, `${stage} must ask for a date`).toContain(`dateFor("${stage}"`);
    }
  });

  /**
   * The recorded move wins, the batch's own column is the fallback. That way
   * a batch from before the history existed looks exactly as it did — no
   * better, no worse — rather than losing the three dates it did have.
   */
  it("falls back to the batch's own columns", () => {
    expect(SRC).toMatch(/statusDates\?\.\[statusKey\] \?\? fallback \?\? null/);
    expect(SRC).toContain('dateFor("preparing", createdAt)');
    expect(SRC).toContain('dateFor("in_transit", departureDate)');
    expect(SRC).toContain('dateFor("arrived", actualArrival)');
  });

  it("treats closed as the same end of the road as delivered", () => {
    expect(SRC).toContain('dateFor("delivered", statusDates?.closed)');
  });

  it("all three skins pass the recorded dates through", () => {
    for (const skin of [
      "pages/portal/PortalShipments.tsx",
      "pages/portal/modern/ModernPortalShipments.tsx",
      "pages/portal/skin3/Skin3PortalShipments.tsx",
    ]) {
      const src = fs.readFileSync(path.resolve(__dirname, skin), "utf8");
      expect(src, `${skin} must pass statusDates`).toContain("statusDates=");
    }
  });

  /**
   * The list draws a stepper per card, so the dates have to arrive with the
   * batches rather than being fetched per row.
   */
  it("the server sends them with the batch list, in one query", () => {
    const db = fs.readFileSync(
      path.resolve(__dirname, "../../server/db/portal.db.ts"), "utf8");
    const fn = db.slice(db.indexOf("export async function getCustomerBatches"));
    expect(fn.slice(0, 4000)).toContain("getBatchStatusTimestamps(batchIds)");
    expect(fn.slice(0, 4000)).toContain("statusDates:");
  });
});
