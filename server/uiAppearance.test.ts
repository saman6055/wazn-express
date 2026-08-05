import { describe, it, expect } from "vitest";
import {
  DEFAULT_APPEARANCE,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  fontFormatFor,
  normalizeAppearance,
  parseAppearance,
} from "./lib/uiAppearance";

/**
 * The appearance row is the one setting that paints every screen in the app.
 * A bad value here does not fail loudly — it renders, wrongly, for everyone,
 * so the normaliser is the thing that has to be right.
 */

describe("font files", () => {
  it("accepts the four web font containers", () => {
    expect(fontFormatFor("Rudaw.ttf")).toBe("truetype");
    expect(fontFormatFor("Rudaw.otf")).toBe("opentype");
    expect(fontFormatFor("Rudaw.woff")).toBe("woff");
    expect(fontFormatFor("Rudaw.WOFF2")).toBe("woff2");
  });

  it("refuses anything else", () => {
    // A font upload runs on every page load of every user. Letting an .exe or
    // an .svg through would put it there.
    expect(fontFormatFor("payload.exe")).toBeNull();
    expect(fontFormatFor("logo.svg")).toBeNull();
    expect(fontFormatFor("noextension")).toBeNull();
  });
});

describe("appearance defaults", () => {
  it("falls back to the built-ins for an empty or broken row", () => {
    expect(parseAppearance(null).defaults).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("{not json").defaults).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps the font scale inside a range the layout survives", () => {
    expect(normalizeAppearance({ defaults: { fontScale: 9 } }).defaults.fontScale).toBe(MAX_FONT_SCALE);
    expect(normalizeAppearance({ defaults: { fontScale: 0.1 } }).defaults.fontScale).toBe(MIN_FONT_SCALE);
    expect(normalizeAppearance({ defaults: { fontScale: "big" } }).defaults.fontScale).toBe(1);
  });

  it("takes only a plain hex colour", () => {
    expect(normalizeAppearance({ defaults: { textDark: "#FFF" } }).defaults.textDark).toBe("#fff");
    expect(normalizeAppearance({ defaults: { textDark: "#e8ecf2" } }).defaults.textDark).toBe("#e8ecf2");
    // These are set as inline style values, so a colour that carries CSS with
    // it must never reach the page.
    expect(normalizeAppearance({ defaults: { textDark: "red; background:url(x)" } }).defaults.textDark).toBeNull();
    expect(normalizeAppearance({ defaults: { textDark: "rgb(0,0,0)" } }).defaults.textDark).toBeNull();
  });
});

describe("uploaded fonts", () => {
  const font = { id: "abc123", label: "Rudaw Bold", url: "/uploads/abc123.woff2", format: "woff2" };

  it("keeps a well-formed font", () => {
    expect(normalizeAppearance({ fonts: [font] }).fonts).toEqual([font]);
  });

  it("drops a font hosted anywhere but our own uploads", () => {
    // Every page would fetch it, from a host nobody in this system chose.
    expect(normalizeAppearance({ fonts: [{ ...font, url: "https://evil.example/f.woff2" }] }).fonts).toEqual([]);
    expect(normalizeAppearance({ fonts: [{ ...font, url: "//evil.example/f.woff2" }] }).fonts).toEqual([]);
  });

  it("drops an id that could break out of the generated @font-face", () => {
    expect(normalizeAppearance({ fonts: [{ ...font, id: 'a";}body{display:none' }] }).fonts).toEqual([]);
  });

  it("drops an unknown format", () => {
    expect(normalizeAppearance({ fonts: [{ ...font, format: "exe" }] }).fonts).toEqual([]);
  });

  it("falls back to the default family when the chosen font is gone", () => {
    // Deleting a font must not leave every browser requesting a 404 forever.
    const result = normalizeAppearance({ defaults: { fontFamily: "abc123" }, fonts: [] });
    expect(result.defaults.fontFamily).toBe("default");
  });

  it("keeps the chosen font when it still exists", () => {
    const result = normalizeAppearance({ defaults: { fontFamily: "abc123" }, fonts: [font] });
    expect(result.defaults.fontFamily).toBe("abc123");
  });
});
