import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { boxMayBeHeld } from "./boxHold";
import { boxSentUnpaid } from "./parcelStage";
import { selectStaleBoxes } from "../server/services/openBoxAlert.service";

/** Owner, 2026-10-28: no three-day clock - a held box waits, a sent box is "sent to you" until paid. */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("a box held at the customer's request", () => {
  it("only while it is still with us", () => {
    expect(boxMayBeHeld("open")).toBe(true);
    expect(boxMayBeHeld("ready")).toBe(true);
    for (const s of ["in_transit", "delivered", "cancelled", null]) expect(boxMayBeHeld(s)).toBe(false);
  });

  it("is never chased by the open-box reminder", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const old = new Date("2026-10-20T12:00:00Z");
    const boxes = [
      { status: "ready", sealedAt: old, heldForCustomerAt: null },
      { status: "ready", sealedAt: old, heldForCustomerAt: old },
    ];
    expect(selectStaleBoxes(boxes, now).map((s) => s.box)).toEqual([boxes[0]]);
  });

  it("sending it lets the hold go; the server checks before holding", () => {
    const send = read("server/db/deliveryBoxes.db.ts");
    expect(send.slice(send.indexOf("export async function markBoxInTransit"))).toContain("heldForCustomerAt: null,");
    expect(read("server/routers/scanning.router.ts")).toContain("if (input.held && !boxMayBeHeld(box.status)) {");
    expect(read("server/_core/migrations.ts")).toContain('"deliveryBoxes.heldForCustomerAt"');
  });

  it("the box screen has the button, the chip and the release", () => {
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    for (const id of ["box-hold-button", "box-held-chip", "box-hold-release"]) expect(panel).toContain(`data-testid="${id}"`);
  });
});

describe("sent and not paid", () => {
  it("reads «نێردرا بۆت» until the box is paid", () => {
    expect(boxSentUnpaid({ status: "in_transit", paidInFull: false })).toBe(true);
    expect(boxSentUnpaid({ status: "delivered", paidInFull: false })).toBe(true);
    expect(boxSentUnpaid({ status: "delivered", paidInFull: true })).toBe(false);
    expect(boxSentUnpaid({ status: "ready", paidInFull: false })).toBe(false);
    expect(read("client/src/components/portal/PackageTrackingTimeline.tsx")).toContain("boxSentUnpaid(facts?.box) ? SENT_TO_YOU_LABEL");
  });
});
