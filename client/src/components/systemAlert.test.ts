import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A toast in the corner is right for "saved". It is wrong for "that tracking
 * number does not exist": on a warehouse screen at arm's length, with a
 * compressor running and a box in both hands, a small notice in the corner
 * with a quiet tone is neither read nor heard — and the parcel goes on the
 * shelf unregistered until the customer asks.
 *
 * The other half of the rule matters just as much. Two hundred parcels is
 * two hundred dismissals, so a success must never come through here.
 */

const HERE = __dirname;
const read = (p: string) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const alert = read(path.join(HERE, "SystemAlert.tsx"));
const app = read(path.join(HERE, "..", "App.tsx"));
const quickRegister = read(path.join(HERE, "..", "pages", "QuickRegister.tsx"));
const sound = read(path.join(HERE, "..", "lib", "soundManager.ts"));

describe("a failure has to be acknowledged", () => {
  it("takes the middle of the screen and dims what is behind it", () => {
    expect(alert).toContain("fixed inset-0");
    expect(alert).toContain("items-center justify-center");
    expect(alert).toContain("bg-black/60");
  });

  it("stays until somebody dismisses it", () => {
    // No timer anywhere: a dialog that closes itself is a toast with extra
    // steps, and the operator was looking at the parcel.
    expect(alert, "an alert that closes itself was not acknowledged")
      .not.toMatch(/setTimeout\([^)]*dismiss/);
  });

  it("can be dismissed without finding the mouse", () => {
    expect(alert).toContain('e.key === "Enter" || e.key === "Escape"');
  });

  it("makes a noise loud enough to carry", () => {
    expect(alert).toContain("soundManager.playAlert()");
    const body = sound.slice(sound.indexOf("playAlert()"), sound.indexOf("playAlert()") + 200);
    // playError is a third of full volume — a hint beside a toast, inaudible
    // beside a strapping table.
    expect(body).toMatch(/0\.9\)/);
  });

  it("is mounted where every screen can reach it", () => {
    expect(app).toContain("<SystemAlertProvider>");
  });

  it("does not throw when used outside the provider", () => {
    // A component in a test or a stray corner must not crash for want of a
    // dialog.
    expect(alert).toContain("ctx ?? (() => {})");
  });
});

/**
 * Which failures. The rule the owner set: anything that can lose goods, or
 * put a big error into the accounts.
 *
 * Every one of these ends with somebody's parcel in the wrong place or the
 * wrong customer's invoice, and every one of them used to be a small notice
 * in the corner of a warehouse screen.
 */
describe("the failures that lose goods all stop the operator", () => {
  const boxPanel = read(path.join(HERE, "delivery", "BoxDetailPanel.tsx"));
  const arrival = read(path.join(HERE, "..", "pages", "ArrivalVerificationScanner.tsx"));
  const batchAssign = read(path.join(HERE, "..", "pages", "BatchAssignmentScanner.tsx"));

  it("a parcel that belongs to another customer, or is already in a box", () => {
    // The server refuses it. What was missing was making the refusal
    // impossible to walk past.
    expect(boxPanel).toContain("systemAlert({");
    expect(boxPanel).toContain("delivery.cannotAddToBox");
  });

  it("a parcel the system has never heard of, in a container on the floor", () => {
    expect(arrival).toContain("scan.packageNotFoundExcl");
    expect(batchAssign).toContain("scan.packageNotFound");
    for (const src of [arrival, batchAssign]) {
      expect(src).toContain("systemAlert({");
    }
  });

  it("a parcel scanned twice, so the count and the list have parted", () => {
    expect(arrival).toContain("scan.alreadyVerified");
    expect(batchAssign).toContain("scan.alreadyInBatch");
  });

  it("an arrival that never reached the database", () => {
    // On screen it looks verified. Tomorrow it is still "in China".
    expect(arrival).toContain("scan.arrivalNotSaved");
  });

  it("none of them left on a toast", () => {
    // The whole point. A toast beside these is a notice nobody reads.
    for (const [name, src] of [
      ["BoxDetailPanel", boxPanel],
      ["ArrivalVerificationScanner", arrival],
      ["BatchAssignmentScanner", batchAssign],
    ] as const) {
      const hasAlert = src.includes("useSystemAlert()");
      expect(hasAlert, `${name} does not raise blocking alerts at all`).toBe(true);
    }
  });
});

describe("a batch that cannot be charged for stops the operator", () => {
  const batchAssign = read(path.join(HERE, "..", "pages", "BatchAssignmentScanner.tsx"));

  it("warns when the batch has no selling price", () => {
    expect(batchAssign).toContain("batchMissingSellingPrice");
    expect(batchAssign).toContain("scan.batchHasNoPrice");
  });

  it("uses the shared rule rather than its own opinion", () => {
    // The scanner's warning and any server check must be the same rule, or
    // they drift and one of them is wrong about money.
    expect(batchAssign).toContain('from "@shared/batchPricing"');
  });

  it("says it once per batch, not once per parcel", () => {
    // Two hundred parcels cannot be two hundred dialogs.
    expect(batchAssign).toContain("pricelessBatchWarned.current.has");
    expect(batchAssign).toContain("pricelessBatchWarned.current.add");
  });
});

describe("only failures come through it", () => {
  it("offers no success kind at all", () => {
    expect(alert).toContain('export type SystemAlertKind = "error" | "warning"');
    expect(alert).not.toContain('"success"');
  });

  it("is what the not-found tracking uses", () => {
    // The case that prompted it.
    expect(quickRegister).toContain("systemAlert({");
    expect(quickRegister).toContain("quickRegister.trackingNotFound");
  });

  it("leaves the success path on a toast", () => {
    // Continuous scanning survives only if a good scan needs no dismissal.
    const successes = quickRegister.split("toast.success(").length - 1;
    expect(successes, "successes moved into the blocking dialog").toBeGreaterThan(0);
  });
});
