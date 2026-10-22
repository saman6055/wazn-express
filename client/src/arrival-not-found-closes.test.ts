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
