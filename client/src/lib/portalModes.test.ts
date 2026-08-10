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

  /**
   * Ordering is not readability.
   *
   * The check above says the four roles get lighter in turn, which keeps a
   * gradient looking like a gradient. It says nothing about whether the text
   * laid over them can be read, and those are different questions: a palette
   * can be perfectly ordered and still put 3.3:1 text on a header.
   *
   * So this measures the real thing — the WCAG relative-luminance ratio — for
   * the pairs the portal actually paints. 4.5:1 is the standard for body text,
   * 3:1 for icons and large text.
   */
  const contrast = (a: string, b: string) => {
    const lum = (hex: string) => {
      const h = hex.replace("#", "");
      const c = [0, 2, 4].map((i) => {
        const v = parseInt(h.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("white text can be read on every brand and deep surface", () => {
    // Buttons, the balance card, and the header wash all carry white text.
    for (const mode of PORTAL_MODES) {
      const { brand, deep } = mode.palette;
      expect(contrast("#FFFFFF", brand), `${mode.id}: white on brand`).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#FFFFFF", deep), `${mode.id}: white on deep`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("pale icons can be read on the header wash", () => {
    // pale is used for icons on the header, which runs deep -> brand. Icons
    // and other non-text marks need 3:1, not 4.5:1.
    for (const mode of PORTAL_MODES) {
      const { brand, deep, pale } = mode.palette;
      expect(contrast(pale, brand), `${mode.id}: pale icon on brand`).toBeGreaterThanOrEqual(3);
      expect(contrast(pale, deep), `${mode.id}: pale icon on deep`).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * Documents the one pair that does not reach the body-text standard, so the
   * number cannot drift further without this failing.
   *
   * Pink's brand (#DB2777) is the lightest of the three, and pale text on it
   * measures 3.33:1 where small text wants 4.5:1. Lightening pale does not
   * rescue it — pure white on that pink is only 4.60:1 — so the fix is a
   * darker pink, which is a decision about how the mode should look rather
   * than something to change quietly inside a test. Until then, small text on
   * the header uses white, and this records where the floor currently sits.
   */
  it("records the known-weak pair rather than pretending it passes", () => {
    const pink = modeDef("pink").palette;
    const measured = contrast(pink.pale, pink.brand);
    expect(measured).toBeGreaterThanOrEqual(3);
    expect(measured, "if pink's palette changes, revisit the header text colour")
      .toBeLessThan(4.5);
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
