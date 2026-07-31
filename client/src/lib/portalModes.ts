import type { Accent } from "@/contexts/ThemeContext";

/**
 * The four colour moods a customer can pick in the portal.
 *
 * Each one is just a pairing of the light/dark switch with an accent skin —
 * both already exist and are already styled in index.css. What was missing was
 * a name for the combinations and anywhere in the portal to choose one.
 */
export type PortalMode = "dark" | "purple" | "pink" | "light";

/**
 * The four brand colours each mode paints the portal with.
 *
 * The portal was written with the company blue spelled out in the markup, so
 * changing mode recoloured the header and left everything under it blue. These
 * are the same four roles that blue played — deep, brand, light, pale — so a
 * surface can ask for the role it needs and get the right colour for whichever
 * mode is on.
 *
 * Only brand colour goes through here. Red for debt, amber for a warning and
 * green for success mean something, and must not follow the mode.
 */
export interface PortalPalette {
  /** Darkest — gradient ends and deep backgrounds. */
  deep: string;
  /** The main brand colour: buttons, tiles, the balance card. */
  brand: string;
  /** A step lighter — the other end of most gradients. */
  light: string;
  /** Pale tint for text and icons sitting on a brand-coloured surface. */
  pale: string;
}

export interface PortalModeDef {
  id: PortalMode;
  theme: "light" | "dark";
  accent: Accent;
  /** Two stops for the swatch dot and the header wash, darkest last. */
  swatch: [string, string];
  palette: PortalPalette;
  label: { ku: string; en: string; ar: string; zh: string };
}

/**
 * Add an alpha channel to a hex colour: tint("#1C4D8D", 0.15).
 *
 * Written as 8-digit hex rather than a Tailwind `/15` suffix, which cannot
 * take a colour that is only known at runtime.
 */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** A linear gradient from runtime colours, for an inline background-image. */
export function gradient(direction: string, ...stops: string[]): string {
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

export const PORTAL_MODES: PortalModeDef[] = [
  {
    id: "dark",
    theme: "dark",
    accent: "default",
    swatch: ["#1e3a8a", "#0f172a"],
    // The company blue the portal was built in.
    palette: { deep: "#0F2854", brand: "#1C4D8D", light: "#4988C4", pale: "#BDE8F5" },
    label: { ku: "تاریک", en: "Dark", ar: "داكن", zh: "深色" },
  },
  {
    id: "purple",
    theme: "dark",
    accent: "violet",
    swatch: ["#8b5cf6", "#6d28d9"],
    palette: { deep: "#3B1D6E", brand: "#6D28D9", light: "#8B5CF6", pale: "#DDD6FE" },
    label: { ku: "مۆر", en: "Purple", ar: "بنفسجي", zh: "紫色" },
  },
  {
    id: "pink",
    theme: "dark",
    accent: "rose",
    swatch: ["#f472b6", "#db2777"],
    palette: { deep: "#831843", brand: "#DB2777", light: "#F472B6", pale: "#FBCFE8" },
    label: { ku: "پەمەیی", en: "Pink", ar: "وردي", zh: "粉色" },
  },
  {
    id: "light",
    theme: "light",
    accent: "default",
    swatch: ["#f8fafc", "#cbd5e1"],
    // Light mode keeps the company blue; only the page behind it turns pale.
    palette: { deep: "#0F2854", brand: "#1C4D8D", light: "#4988C4", pale: "#BDE8F5" },
    label: { ku: "ڕووناک", en: "Light", ar: "فاتح", zh: "浅色" },
  },
];

export const PORTAL_MODE_KEY = "portal-mode";

export const DEFAULT_PORTAL_MODE: PortalMode = "dark";

export function modeDef(id: PortalMode): PortalModeDef {
  return PORTAL_MODES.find((m) => m.id === id) ?? PORTAL_MODES[0];
}

/**
 * Recover the saved mode from a theme/accent pair. The two values are stored
 * separately (they are shared with the admin side), so on a fresh page load
 * the mode has to be read back out of them rather than trusted from its own
 * key alone.
 */
export function modeFromTheme(theme: string, accent: string): PortalMode {
  const match = PORTAL_MODES.find((m) => m.theme === theme && m.accent === accent);
  return match?.id ?? DEFAULT_PORTAL_MODE;
}

/**
 * The header wash for each mode, built from that mode's own palette so the
 * two can never drift apart. Light mode is the exception: its header is a pale
 * surface, not a brand-coloured one.
 */
export function headerGradient(mode: PortalMode): string {
  if (mode === "light") return "linear-gradient(140deg, #dbe6f3, #eef2f7 55%, #e7edf5)";
  const { deep, brand } = modeDef(mode).palette;
  return `linear-gradient(140deg, ${deep}, ${brand} 55%, ${deep})`;
}

/** Light mode needs dark text on the header; the rest are white on colour. */
export function isLightHeader(mode: PortalMode): boolean {
  return mode === "light";
}

/**
 * The banner across the top of an interior page.
 *
 * Every page used to pick its own colour — sky here, amber there, emerald on
 * the terms page — so the portal read as a rainbow and none of it followed the
 * customer's chosen mode. They all use this now.
 *
 * Unlike the home hero, this stays a saturated brand colour even in light
 * mode. Interior banners carry white text, and a pale banner would need every
 * one of those pages rewritten to stay legible.
 */
export function bannerGradient(mode: PortalMode): string {
  const { brand, light } = modeDef(mode).palette;
  return `linear-gradient(135deg, ${brand}, ${light})`;
}

/** Style object for an interior page banner. */
export function bannerStyle(mode: PortalMode): { backgroundImage: string } {
  return { backgroundImage: bannerGradient(mode) };
}
