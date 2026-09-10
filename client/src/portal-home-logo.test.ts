import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { BRAND_LOGO_ON_DARK_URL, BRAND_LOGO_URL } from "./lib/brand";

/**
 * The mark in the centre of the portal home's top row — the owner's choice
 * (September 2026), between the language picker and the clock. Black ink on
 * the light theme; on the dark one the white-ink twin, where black vanishes.
 */

const PUBLIC = path.resolve(__dirname, "../public");
const HOME = fs
  .readFileSync(path.resolve(__dirname, "pages/portal/PortalHome.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

function pngSize(file: string): [number, number] {
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(1, 4).toString("latin1"), file).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("the mark on the portal home", () => {
  it("has a white-ink twin for the dark theme, the same shape as the mark", () => {
    expect(pngSize(path.join(PUBLIC, BRAND_LOGO_ON_DARK_URL))).toEqual(pngSize(path.join(PUBLIC, BRAND_LOGO_URL)));
  });

  it("sits in the top row, between the language picker and the clock", () => {
    const from = HOME.indexOf("<PortalLanguagePicker glass={glassPill} />");
    const to = HOME.indexOf("<PortalClock onLight={!isDark} compact />");
    expect(from, "the language picker moved").toBeGreaterThan(-1);
    expect(to, "the clock moved").toBeGreaterThan(from);
    const row = HOME.slice(from, to);
    expect(row).toContain("isDark ? BRAND_LOGO_ON_DARK_URL : BRAND_LOGO_URL");
    expect(row).toContain("onError={onImageError}");
  });

  it("is centred on two equal outer columns, so a wide clock pushes it rather than covers it", () => {
    expect(HOME).toContain("grid-cols-[1fr_auto_1fr]");
  });
});
