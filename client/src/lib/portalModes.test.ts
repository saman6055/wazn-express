import { describe, it, expect } from "vitest";
import {
  PORTAL_MODES,
  DEFAULT_PORTAL_MODE,
  modeDef,
  modeFromTheme,
  isLightHeader,
  headerGradient,
  tint,
  gradient,
} from "./portalModes";

/**
 * Theme and accent are stored as two separate values shared with the admin
 * side, so the portal has to be able to read a mode back out of that pair.
 * If two modes ever mapped to the same pair, one of them would become
 * unreachable — the dot would never light up however often it was tapped.
 */
describe("portal colour modes", () => {
  it("offers the four modes the portal shows", () => {
    expect(PORTAL_MODES.map((m) => m.id)).toEqual(["dark", "purple", "pink", "light"]);
  });

  it("maps each mode to a distinct theme/accent pair", () => {
    const pairs = PORTAL_MODES.map((m) => `${m.theme}/${m.accent}`);
    expect(new Set(pairs).size).toBe(PORTAL_MODES.length);
  });

  it("round-trips every mode through the stored theme and accent", () => {
    for (const mode of PORTAL_MODES) {
      expect(modeFromTheme(mode.theme, mode.accent), mode.id).toBe(mode.id);
    }
  });

  it("falls back to the default for a pair set outside the portal", () => {
    // The admin side can set accents the portal does not offer.
    expect(modeFromTheme("dark", "amber")).toBe(DEFAULT_PORTAL_MODE);
    expect(modeFromTheme("light", "ocean")).toBe(DEFAULT_PORTAL_MODE);
    expect(modeFromTheme("", "")).toBe(DEFAULT_PORTAL_MODE);
  });

  it("never returns undefined from modeDef, even for a stale saved value", () => {
    expect(modeDef("purple").id).toBe("purple");
    expect(modeDef("teal" as never).id).toBe(PORTAL_MODES[0].id);
  });

  it("treats only the light mode as needing dark header text", () => {
    expect(isLightHeader("light")).toBe(true);
    for (const mode of ["dark", "purple", "pink"] as const) {
      expect(isLightHeader(mode), mode).toBe(false);
    }
  });

  it("gives every mode a header gradient and a swatch", () => {
    for (const mode of PORTAL_MODES) {
      expect(headerGradient(mode.id), mode.id).toContain("linear-gradient");
      expect(mode.swatch).toHaveLength(2);
      for (const stop of mode.swatch) {
        expect(stop, `${mode.id} swatch`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("builds the header wash from the mode's own palette, so the two cannot drift", () => {
    for (const mode of PORTAL_MODES) {
      if (mode.id === "light") continue; // pale surface, not a brand colour
      const wash = headerGradient(mode.id);
      expect(wash, mode.id).toContain(mode.palette.brand);
      expect(wash, mode.id).toContain(mode.palette.deep);
    }
  });
});

/**
 * Brand colour is what follows the mode. Semantic colour — red for debt, amber
 * for a warning — must not, or a customer in pink mode would see a debt warning
 * in the same pink as everything else and lose the signal.
 */
describe("mode palettes", () => {
  it("gives every mode four brand roles", () => {
    for (const mode of PORTAL_MODES) {
      for (const role of ["deep", "brand", "light", "pale"] as const) {
        expect(mode.palette[role], `${mode.id}.${role}`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it("keeps the company blue for the two blue modes", () => {
    // Dark and light are the same brand on different backgrounds.
    expect(modeDef("dark").palette).toEqual(modeDef("light").palette);
    expect(modeDef("dark").palette.brand).toBe("#1C4D8D");
  });

  it("gives the purple and pink modes their own brand colours", () => {
    const brands = PORTAL_MODES.map((m) => m.palette.brand);
    expect(new Set(brands).size).toBe(3); // dark and light share one
    expect(modeDef("purple").palette.brand).not.toBe(modeDef("dark").palette.brand);
    expect(modeDef("pink").palette.brand).not.toBe(modeDef("purple").palette.brand);
  });

  it("orders each palette from dark to pale", () => {
    // The roles are used as gradient stops, so a palette that is not ordered
    // would read as a muddle rather than a gradient.
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    };
    for (const mode of PORTAL_MODES) {
      const { deep, brand, light, pale } = mode.palette;
      expect(luminance(deep), `${mode.id} deep<brand`).toBeLessThan(luminance(brand));
      expect(luminance(brand), `${mode.id} brand<light`).toBeLessThan(luminance(light));
      expect(luminance(light), `${mode.id} light<pale`).toBeLessThan(luminance(pale));
    }
  });
});

describe("colour helpers", () => {
  it("appends an alpha channel as two hex digits", () => {
    expect(tint("#1C4D8D", 1)).toBe("#1C4D8Dff");
    expect(tint("#1C4D8D", 0)).toBe("#1C4D8D00");
    expect(tint("#1C4D8D", 0.5)).toBe("#1C4D8D80");
  });

  it("pads a single-digit alpha, which would otherwise make a 7-digit colour", () => {
    // 0.02 → 5 → "05", not "5".
    expect(tint("#000000", 0.02)).toHaveLength(9);
    expect(tint("#000000", 0.02)).toBe("#00000005");
  });

  it("clamps an out-of-range alpha instead of producing nonsense", () => {
    expect(tint("#1C4D8D", 2)).toBe("#1C4D8Dff");
    expect(tint("#1C4D8D", -1)).toBe("#1C4D8D00");
  });

  it("joins gradient stops in the order given", () => {
    expect(gradient("to right", "#111111", "#222222")).toBe(
      "linear-gradient(to right, #111111, #222222)",
    );
  });

  it("names every mode in all four languages", () => {
    for (const mode of PORTAL_MODES) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(mode.label[lang], `${mode.id}.${lang}`).toBeTruthy();
      }
    }
  });
});
