import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", "..", "client", "src", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-27: «لێرەش بە دوو کلیک لە شوێنی تراک بتوانی تراک زیاد
 * بکەی زۆر باشە.» The commission list already shows which orders are
 * waiting for a tracking; leaving the page to type it is what made it a
 * chore.
 */
describe("a tracking typed into the row it belongs to", () => {
  /*
   * Both commission lists, named here on purpose.
   *
   * The owner, 2026-09-27, after the first attempt: «گۆڕانکارییەکەش جێبەجێ
   * نەبوو، تراک زیاد نابێ لەوێدا». He was right — there are two of these
   * screens, /commission and /commission-orders, and the one in the top bar
   * is the one he uses. A third would now be noticed here.
   */
  const LISTS = ["pages/CommissionDashboard.tsx", "pages/CommissionOrders.tsx"];
  const box = read("components/orders/InlineTracking.tsx");

  it("opens on a double-click, and says so before it is tried", () => {
    for (const list of LISTS) {
      const page = read(list);
      expect(page, list).toContain("onDoubleClick={() => { setTypingFor(order.id); setTyped(\"\"); }}");
      expect(page, list).toContain('ku: "دوو جار کلیک بکە بۆ زیادکردنی تراکینگ"');
    }
  });

  it("saves through the door the tracking-alerts screen uses", () => {
    // A second door onto one flow, not a second flow: an order gets
    // whatever else the system does when its tracking arrives.
    for (const list of LISTS) {
      const page = read(list);
      expect(page, list).toContain("trpc.fullPackage.addOrderTrackings.useMutation");
      expect(page, list).toContain("addTracking.mutate({ fullPackageOrderId: order.id, trackingNumbers: [one] })");
    }
  });

  it("takes Enter, gives up on Escape", () => {
    expect(box).toContain('if (e.key === "Enter")');
    expect(box).toContain('if (e.key === "Escape")');
  });

  it("warns when an order number was pasted into it, and still saves", () => {
    // The same length check the order forms run — a warning, never a
    // refusal, because a strange but real number must stay savable.
    expect(box).toContain('orderTrackingWarnings(orderNumber ?? null, value)');
    expect(box).toContain('"trackingLooksLikeOrder"');
    expect(box).not.toContain("disabled={suspect");
  });
});
