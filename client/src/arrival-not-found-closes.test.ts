import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-22: the arrival check's «پاکێج نەدۆزرایەوە!» stopped the scanning. */
describe("a parcel not found on the arrival check does not stop the work", () => {
  const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
  const alert = read("client/src/components/SystemAlert.tsx");

  it("closes itself after 2 seconds, 3 when the same code is scanned again", () => {
    expect(page).toContain("const again = lastNotFound.current === code;");
    expect(page).toContain("closeAfterMs: again ? 3000 : 2000,");
  });

  it("the window closes on its own and the caret goes back where it was", () => {
    expect(alert).toContain("const id = window.setTimeout(dismiss, current.closeAfterMs);");
    expect(alert).toContain("if (closes && document.activeElement instanceof HTMLElement) returnTo.current = document.activeElement;");
    expect(alert).toContain("if (back?.isConnected) back.focus();");
  });
});

/**
 * Owner, 2026-10-24: a parcel the system knows, scanned in another batch's
 * check, is not "extra" - it arrived, and counts as arrived on its own batch.
 * The window says whose it is and which batch it belongs to.
 */
describe("a parcel from another batch, on the arrival check", () => {
  const page = read("client/src/pages/ArrivalVerificationScanner.tsx");

  it("says its batch and its customer", () => {
    expect(page).toContain('data-testid="extra-package-whose"');
    expect(page).toContain("package: { ...pkg, orderNumbers: result.orderNumbers, customer: result.customer ?? null },");
  });

  it("records the arrival, on the parcel's own batch", () => {
    const fn = page.slice(page.indexOf("const handleAddExtraPackage = async () => {"), page.indexOf("// Get status color"));
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).toContain('recordArrival.mutate(\n      { trackingNumber: verifiedPkg.trackingNumber, packageId: pkg.id, scanType: "received_local" },');
    expect(fn).toContain("const batch = pkg.batchId ? batches?.find((b: any) => b.id === pkg.batchId) : null;");
  });

  it("can take its batch into the check", () => {
    expect(page).toContain('data-testid="extra-package-open-batch"');
  });
});
