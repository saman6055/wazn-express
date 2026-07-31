import { describe, it, expect } from "vitest";
import {
  PORTAL_MODES,
  MODE_HEADER_GRADIENT,
  DEFAULT_PORTAL_MODE,
  modeDef,
  modeFromTheme,
  isLightHeader,
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
      expect(MODE_HEADER_GRADIENT[mode.id], mode.id).toBeTruthy();
      expect(mode.swatch).toHaveLength(2);
      for (const stop of mode.swatch) {
        expect(stop, `${mode.id} swatch`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("names every mode in all four languages", () => {
    for (const mode of PORTAL_MODES) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(mode.label[lang], `${mode.id}.${lang}`).toBeTruthy();
      }
    }
  });
});
