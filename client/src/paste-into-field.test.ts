import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { pastedIdKind } from "@shared/orderNumberPlatform";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-22: Ctrl+V with no field chosen - an order number goes to
 * the order-number field, a tracking to the tracking field. Quick Register
 * takes the tracking only.
 */
describe("what a pasted number is", () => {
  it("his three examples", () => {
    expect(pastedIdKind("261007-310105894421958")).toEqual({ kind: "order", value: "261007-310105894421958" });
    expect(pastedIdKind("5127804612019232826")).toEqual({ kind: "order", value: "5127804612019232826" });
    expect(pastedIdKind("465742793571896")).toEqual({ kind: "tracking", value: "465742793571896" });
  });

  it("courier codes with letters, spaces trimmed; anything else left alone", () => {
    expect(pastedIdKind("  JT3178904457880 \n")).toEqual({ kind: "tracking", value: "JT3178904457880" });
    expect(pastedIdKind("hello world")).toBeNull();
    expect(pastedIdKind("ABCDEFGHIJ")).toBeNull();
    expect(pastedIdKind("1234")).toBeNull();
    expect(pastedIdKind("")).toBeNull();
  });
});

describe("the screens", () => {
  const hook = read("client/src/hooks/usePasteIntoField.ts");

  it("never takes the paste from a field the caret is in, never puts an order number in a tracking box", () => {
    expect(hook).toContain("if (typingSomewhere()) return;");
    expect(hook).toContain('const target = found.kind === "order" ? order : tracking;');
  });

  it("both order forms route both numbers; Quick Register the tracking only", () => {
    for (const f of ["client/src/pages/CommissionForm.tsx", "client/src/pages/FullPackageForm.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("ref={orderNumberRef}");
      expect(src, f).toContain("ref={trackingNumberRef}");
      expect(src, f).toContain("tracking: { ref: trackingNumberRef, set: (trackingNumber) => setFormData((p) => ({ ...p, trackingNumber })) },");
    }
    expect(read("client/src/pages/QuickRegister.tsx")).toContain("usePasteIntoField({ tracking: { ref: trackingRef, set: handleTrackingChange } });");
  });
});
