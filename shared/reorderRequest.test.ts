import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { REORDER_WORDS, canReorder, reorderDetails, reorderPhotoUrl } from "./reorderRequest";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

const ORIGIN = "https://admin.waznexpress.com";

const SUNGLASSES = {
  orderCode: "FP-MRRV5259",
  orderNumber: "5127403322814014414",
  productName: "Accessories",
  trackingNumber: "79123431425593",
  quantity: 1,
  image: "/uploads/orders/sunglasses.jpg",
};

describe("asking for the same thing again", () => {
  it("carries the three facts the office needs to buy it", () => {
    // The owner, 2026-09-26: the picture, the tracking and the platform's
    // own order number, with the sentence already written.
    const lines = reorderDetails(SUNGLASSES, ORIGIN);
    const value = (label: string) => lines.find(([l]) => l.en === label)?.[1];
    expect(value("Platform order number")).toBe("5127403322814014414");
    expect(value("Tracking")).toBe("79123431425593");
    expect(value("Photo")).toBe(`${ORIGIN}/uploads/orders/sunglasses.jpg`);
    expect(value("Order")).toBe("FP-MRRV5259");
  });

  it("says the sentence he wrote, in his own words", () => {
    expect(REORDER_WORDS.button.ku).toBe("دووبارە داواکردنەوە");
    expect(REORDER_WORDS.intent.ku).toContain("دەتوانن");
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      expect(REORDER_WORDS.intent[lang].trim().length, lang).toBeGreaterThan(0);
      expect(REORDER_WORDS.button[lang].trim().length, lang).toBeGreaterThan(0);
    }
  });

  it("sends a picture only when there is one to open", () => {
    // A wa.me message is text: base64 has no address, and a broken link in
    // somebody's WhatsApp is worse than no picture at all.
    expect(reorderPhotoUrl("data:image/png;base64,AAAA", ORIGIN)).toBeNull();
    expect(reorderPhotoUrl("", ORIGIN)).toBeNull();
    expect(reorderPhotoUrl(null, ORIGIN)).toBeNull();
    expect(reorderPhotoUrl("/uploads/a.jpg", "")).toBeNull();
    expect(reorderPhotoUrl("https://cdn.example.com/a.jpg", ORIGIN)).toBe("https://cdn.example.com/a.jpg");
    // The first real one out of whatever the row carries.
    expect(reorderPhotoUrl([null, "data:image/png;base64,AA", "/uploads/b.jpg"], ORIGIN))
      .toBe(`${ORIGIN}/uploads/b.jpg`);
  });

  it("leaves out a line it cannot fill", () => {
    const lines = reorderDetails({ orderCode: "CM-1", quantity: 1 }, ORIGIN);
    expect(lines.filter(([, v]) => v !== null).map(([l]) => l.en)).toEqual(["Order"]);
  });

  it("does not offer the button on a row it cannot describe", () => {
    expect(canReorder({})).toBe(false);
    expect(canReorder({ trackingNumber: "79123431425593" })).toBe(false);
    expect(canReorder({ orderCode: "CM-1" })).toBe(true);
    expect(canReorder({ productName: "Accessories" })).toBe(true);
  });
});

describe("the button itself", () => {
  it("goes straight into Wazn's chat, like every other one", () => {
    // The owner's standing rule (lib/waznChat): never the phone's share
    // sheet, which made the customer hunt for Wazn among their chats.
    const button = read("client/src/components/portal/ReorderButton.tsx");
    expect(button).toContain("openWaznChat(");
    expect(button).toContain("waznChatMessage({");
    expect(button).not.toContain("navigator.share");
    // Built from the shared rule, not from a message typed into the screen.
    expect(button).toContain("reorderDetails(subject");
    expect(button).toContain("REORDER_WORDS.intent");
  });

  it("sits on the orders card, beside asking a question", () => {
    const page = read("client/src/pages/portal/PortalFullPackage.tsx");
    expect(page).toContain("<ReorderButton");
    expect(page.indexOf("<ReorderButton")).toBeLessThan(page.indexOf("<WhatsAppHelpButton"));
  });

  it("has the platform order number to send", () => {
    // It reaches the portal only because the visibility gate passes it.
    expect(read("server/lib/customerVisibleOrder.ts")).toContain("orderNumber: o.orderNumber ?? null");
  });
});
