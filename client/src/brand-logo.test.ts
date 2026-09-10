import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { BRAND_LOGO_URL } from "./lib/brand";

/**
 * The company logo is never a blank and never a generic box.
 *
 * September 2026: the logo uploaded in Settings lived in the uploads folder, a
 * redeploy took the folder, and every login page, receipt and home-screen icon
 * fell back to a placeholder. The mark now ships inside the build. These tests
 * keep it there, and keep every place that shows a logo falling back to it.
 */

const SRC = path.resolve(__dirname);
const PUBLIC = path.resolve(__dirname, "../public");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

function pngSize(file: string): [number, number] {
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(1, 4).toString("latin1"), file).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("the mark ships with the build", () => {
  it("as the wide wordmark, not a square placeholder", () => {
    const [w, h] = pngSize(path.join(PUBLIC, BRAND_LOGO_URL));
    expect(w).toBeGreaterThanOrEqual(400);
    expect(w / h).toBeGreaterThan(1.5);
  });

  it("and every app icon the manifest and index.html name is a PNG of its stated size", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
    const named: Array<[string, number]> = Array.from(
      html.matchAll(/href="\/icons\/(icon-(\d+)x\2\.png)"/g),
      (m) => [m[1], Number(m[2])],
    );
    for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) named.push([`icon-${size}x${size}.png`, size]);
    expect(named.length).toBeGreaterThan(8);
    for (const [file, size] of named) expect(pngSize(path.join(PUBLIC, "icons", file)), file).toEqual([size, size]);
    expect(pngSize(path.join(PUBLIC, "icons", "apple-touch-icon.png"))).toEqual([180, 180]);
  });
});

describe("every place that shows a logo falls back to the mark", () => {
  it("CompanyLogo: the upload first, then the mark, and only then an icon", () => {
    expect(read("components/CompanyLogo.tsx")).toContain("[logoUrl, BRAND_LOGO_URL]");
  });

  it("the customer login shows it, as the staff login always has", () => {
    expect(read("pages/CustomerLogin.tsx")).toContain("<CompanyLogo");
    expect(read("pages/StaffLogin.tsx")).toContain("<CompanyLogo");
  });

  it("every receipt prints it when no logo is uploaded", () => {
    for (const rel of ["components/delivery/BoxTable.tsx", "components/delivery/BoxDetailPanel.tsx"]) {
      const calls = read(rel).match(/absoluteLogoUrl\([^)]*\)/g) ?? [];
      expect(calls.length, rel).toBeGreaterThan(0);
      for (const call of calls) expect(call, rel).toContain("BRAND_LOGO_URL");
    }
  });

  it("the invoice page uses it when the template has none", () => {
    expect(read("pages/InvoiceView.tsx")).toContain("logoUrl: template?.logoUrl || BRAND_LOGO_URL");
  });
});
