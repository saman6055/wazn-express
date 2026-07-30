import { describe, it, expect } from "vitest";
import { platformColor, platformInitials } from "./PlatformSelect";

/**
 * Platforms are an open list — an admin can add their own from the order form —
 * so the badge is derived from the name rather than a bundled brand logo. That
 * keeps a brand-new platform looking right immediately, with no trademarked
 * assets to ship.
 */
describe("platformInitials", () => {
  it("uses the first letter, upper-cased", () => {
    expect(platformInitials("Taobao")).toBe("T");
    expect(platformInitials("pinduoduo")).toBe("P");
  });

  it("uses two digits for a numeric platform like 1688", () => {
    expect(platformInitials("1688")).toBe("16");
  });

  it("ignores surrounding whitespace", () => {
    expect(platformInitials("  Alibaba  ")).toBe("A");
  });

  it("degrades to a placeholder rather than crashing on an empty name", () => {
    expect(platformInitials("")).toBe("?");
    expect(platformInitials("   ")).toBe("?");
  });

  it("handles a non-Latin name without throwing", () => {
    expect(platformInitials("وەیشات")).toHaveLength(1);
  });
});

describe("platformColor", () => {
  it("gives each default platform its own brand colour", () => {
    expect(platformColor("Taobao")).toBe("#FF4400");
    expect(platformColor("Pinduoduo")).toBe("#E22E1F");
    expect(platformColor("1688")).toBe("#378ADD");
  });

  it("matches regardless of the case the admin typed", () => {
    expect(platformColor("taobao")).toBe(platformColor("TAOBAO"));
    expect(platformColor("  Wechat ")).toBe(platformColor("wechat"));
  });

  it("treats Wechat and Weixin as the same shop", () => {
    expect(platformColor("wechat")).toBe(platformColor("weixin"));
  });

  it("is stable for a custom platform — same badge on every render", () => {
    const first = platformColor("Temu");
    expect(platformColor("Temu")).toBe(first);
    expect(platformColor("temu")).toBe(first);
  });

  it("returns a usable colour for any custom name", () => {
    for (const name of ["Temu", "Shein", "JD", "کۆمپانیا", "x"]) {
      expect(platformColor(name)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("does not collapse every custom platform onto one colour", () => {
    const colors = new Set(["Temu", "Shein", "JD", "Amazon", "Etsy", "Coupang"].map(platformColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
