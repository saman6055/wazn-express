import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Two owner rules for the order entry desk (Sep 2026):
 *
 *  1. A product image is expected. The first save without one stops and asks
 *     for it; a second press offers to save anyway, because the photo often
 *     is not to hand and refusing outright would only produce junk uploads.
 *  2. A run of orders ships the same way, so the shipping method carries over
 *     to the next order the way the customer and platform already do.
 *
 * Both forms must behave identically — they sit side by side at the same
 * desk, and a rule that reached only one of them is worse than no rule.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const FORMS = ["pages/CommissionForm.tsx", "pages/FullPackageForm.tsx"];

describe("the picture is asked for before it is waived", () => {
  it("the first empty save stops instead of warning and carrying on", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("if (!askedForImage.current) {");
      expect(src, rel).toContain("askedForImage.current = true;");
      // It must actually stop — a toast with no return is the old behaviour.
      const gate = src.slice(src.indexOf("if (productImages.length === 0) {"));
      expect(gate.slice(0, 900), rel).toContain("return;");
    }
  });

  it("the second press asks in the app's own dialog, not the browser's", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("await confirmAction(");
      expect(src, rel).not.toContain("window.confirm(");
      // A no keeps the operator on the form.
      expect(src, rel).toContain("if (!saveAnyway) {");
    }
  });

  it("it takes the operator to the field rather than only naming it", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("productImageRef");
      expect(src, rel).toContain('ref={productImageRef}');
    }
  });

  it("adding a picture, or saving, starts the asking over", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("if (next.length > 0) askedForImage.current = false;");
      expect(src, rel).toContain("setProductImages([]);\n      askedForImage.current = false;");
    }
  });

  it("the submit handler can actually await the question", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("const handleSubmit = async (e: React.FormEvent) => {");
    }
  });
});

describe("the shipping method carries to the next order", () => {
  it("both forms remember it on save and restore it on arrival", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("LAST_SHIPPING_TYPE_KEY");
      expect(src, rel).toContain("localStorage.setItem(LAST_SHIPPING_TYPE_KEY, keepShipping)");
      expect(src, rel).toContain("localStorage.getItem(LAST_SHIPPING_TYPE_KEY)");
    }
  });

  it("the reset keeps it instead of blanking it", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("shippingType: keepShipping,");
      // The old line cleared it on every save.
      expect(src, rel).not.toContain('        shippingType: "",');
    }
  });

  it("a stored value is checked before it is trusted", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain('["air_regular", "air_irregular", "sea"].includes(lastShipping)');
    }
  });

  it("it never overwrites a method the operator already picked", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("prev.shippingType ? prev :");
    }
  });

  it("the key lives once, beside the platform key it mirrors", () => {
    const select = read("components/PlatformSelect.tsx");
    expect(select).toContain('export const LAST_SHIPPING_TYPE_KEY = "wazn-last-order-shipping-type";');
  });
});
