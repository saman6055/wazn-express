import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * One payment window, not two.
 *
 * The owner, 2026-09-24, on the screen as it was: "this is very small, very
 * tangled, the information is all over the place and I cannot make sense of
 * it at all. Why is a part this important and this consequential in an ugly
 * cramped box?"
 *
 * Three faults at once. Opening "the parcels" left the quick dialog's own
 * card and inputs where they were and added the full panel's heading,
 * customer line and inputs underneath — two payment forms, one above the
 * other. And all of it inside a 448px window, which squeezed the three money
 * columns down to one word per line.
 */

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

const quick = read("client/src/components/delivery/QuickSettleDialog.tsx");
const panel = read("client/src/components/delivery/BoxSettlementPanel.tsx");

describe("the window", () => {
  it("is narrow for the ordinary day and wide when the detail is open", () => {
    expect(quick).toContain('showParcels ? "max-w-5xl" : "max-w-md",');
  });

  it("shows one summary and one set of inputs, never two", () => {
    // The quick answer steps aside; the panel below carries the same figure,
    // the same inputs and the same button.
    expect(quick).toContain("{!showParcels && (");
    const guard = quick.indexOf("{!showParcels && (");
    const card = quick.indexOf('data-testid="quick-due"');
    const inputs = quick.indexOf('data-testid="quick-iqd"');
    const footer = quick.indexOf('data-testid="quick-settle"');
    expect(card).toBeGreaterThan(guard);
    expect(inputs).toBeGreaterThan(guard);
    // The footer button was already hidden while the parcels are open.
    expect(quick.slice(0, footer)).toContain("!showParcels && (");
  });

  it("does not let the panel draw a second heading inside it", () => {
    expect(quick).toContain("embedded");
    expect(panel).toContain("const Frame = embedded ? EmbeddedFrame : CardFrame;");
    expect(panel).toContain("{!embedded && (");
  });
});

describe("what is inside it, once it is wide", () => {
  it("puts the work on one side and the money on the other", () => {
    expect(panel).toContain('<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">');
    // The money stays in view while the parcels are scrolled.
    expect(panel).toContain('className="min-w-0 space-y-3 lg:sticky lg:top-2 lg:self-start"');
  });

  it("stacks the money cards in that column instead of squeezing three across", () => {
    expect(panel).toContain('<div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">');
  });

  it("keeps the parcels, their exceptions and the history together on the left", () => {
    const left = panel.slice(
      panel.indexOf('<div className="min-w-0 space-y-4">'),
      panel.indexOf('className="min-w-0 space-y-3 lg:sticky'),
    );
    expect(left.length).toBeGreaterThan(200);
    for (const mark of ["── the parcels", "── the discount, given on the box", "── what has already been taken", "settle-pledged"]) {
      expect(left, mark).toContain(mark);
    }
    // And the money is not among them.
    expect(left).not.toContain("settle-open-confirm");
  });

  it("every column can still shrink — a grid track grows to its widest child", () => {
    expect(panel).toContain('<div className="min-w-0 space-y-4">');
    expect(panel).toContain('className="min-w-0 space-y-3');
  });
});
