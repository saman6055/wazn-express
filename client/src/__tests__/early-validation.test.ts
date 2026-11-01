import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's note (Sep 2026): «ئەگەر هەر لە سەرتاوە بێت کاتێکێ زۆرت بۆ
 * دەگەرێنێتەوە» — say it at the start, not at the save.
 *
 * "This order number is already used" arrived after the customer, the photo,
 * the prices and the shipping method had all been entered, and every one of
 * them then had to be retyped because the very first field was wrong. The
 * same was true of the swapped order/tracking warnings.
 *
 * A warning is worth almost nothing at the end of the work and almost
 * everything at the beginning of it.
 */

const SRC = path.resolve(__dirname);
const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const readRoot = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const FORMS = ["pages/CommissionForm.tsx", "pages/FullPackageForm.tsx"];

describe("the duplicate is found while the number is typed", () => {
  it("both forms ask as the field changes", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain('import { useOrderNumberCheck } from "@/hooks/useOrderNumberCheck";');
      expect(src, rel).toContain("useOrderNumberCheck(formData.orderNumber");
    }
  });

  it("the answer is shown under the field, naming the order that holds it", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("orderNumberCheck.taken");
      expect(src, rel).toContain("orderNumberCheck.orderCode");
      expect(src, rel).toContain("ئەم ژمارەیە پێشتر بەکارهاتووە لە ئۆردەری");
      // And the field itself goes red.
      expect(src, rel).toContain('orderNumberCheck.taken ? "border-red-400');
    }
  });

  it("an order being edited does not flag its own number", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("excludeId: isEditMode ? (orderId as number) : undefined");
    }
  });

  it("a save that is already known to fail is stopped before it is sent", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("if (orderNumberCheck.taken) {");
    }
  });
});

describe("typing does not hammer the server", () => {
  const hook = read("hooks/useOrderNumberCheck.ts");

  it("the query is debounced", () => {
    expect(hook).toContain("const DEBOUNCE_MS = 450;");
    expect(hook).toContain("window.setTimeout(() => setSettled(value), DEBOUNCE_MS)");
    expect(hook).toContain("return () => window.clearTimeout(timer);");
  });

  it("a blank field asks nothing", () => {
    expect(hook).toContain("settled.length > 0");
  });

  it("an answer about an older value is not shown against a newer one", () => {
    expect(hook).toContain("const answerIsCurrent = settled === value;");
  });
});

describe("the check costs the caller nothing it should not have", () => {
  const router = readRoot("server/routers/fullPackage.router.ts");
  const endpoint = router.slice(
    router.indexOf("checkOrderNumber: staffProcedure"),
    router.indexOf("checkOrderNumber: staffProcedure") + 1400,
  );

  it("it is a staff-only read, not a mutation", () => {
    expect(endpoint).toContain("checkOrderNumber: staffProcedure");
    expect(endpoint).toContain(".query(");
    expect(endpoint).not.toContain(".mutation(");
  });

  it("it returns the two fields the warning needs, not the whole order", () => {
    // An order row carries prices and a customer; this answers anyone on
    // staff who is typing into a box.
    expect(endpoint).toContain("orderCode: dup.orderCode");
    expect(endpoint).toContain("orderId: dup.id");
    expect(endpoint).not.toContain("return dup;");
  });
});

describe("the swapped-number warnings moved to the field too", () => {
  it("they are computed from what is on screen, not at save", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      expect(src, rel).toContain("const idWarnings = useMemo(");
      expect(src, rel).toContain("orderTrackingWarnings(formData.orderNumber, formData.trackingNumber)");
    }
  });

  it("the save-time toast that repeated them is gone", () => {
    for (const rel of FORMS) {
      const src = read(rel);
      // Anchored on markers that are proven to exist — an indexOf that
      // misses returns -1 and silently checks the wrong slice.
      const from = src.indexOf("const handleSubmit");
      const to = src.indexOf("<DashboardLayout>");
      expect(from, rel).toBeGreaterThan(-1);
      expect(to, rel).toBeGreaterThan(from);
      const submit = src.slice(from, to);
      expect(submit.length, rel).toBeGreaterThan(500);
      // Only these moved. The loss warning is already live in the UI (the
      // flashing $), and "no photo" cannot be said before somebody tries to
      // save without one — both rightly stay at save time.
      expect(submit, rel).not.toContain("ORDER_TRACKING_WARNING_TEXT");
      expect(submit, rel).not.toContain("orderTrackingWarnings(");
    }
  });

  it("the shared rule and its wording are still the one home", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain('from "@shared/orderTrackingSanity"');
    }
    expect(readRoot("shared/orderTrackingSanity.ts")).toContain("ORDER_TRACKING_WARNING_TEXT");
  });
});
