import type { Accent } from "@/contexts/ThemeContext";

/**
 * The four colour moods a customer can pick in the portal.
 *
 * Each one is just a pairing of the light/dark switch with an accent skin —
 * both already exist and are already styled in index.css. What was missing was
 * a name for the combinations and anywhere in the portal to choose one.
 */
export type PortalMode = "dark" | "purple" | "pink" | "light";

export interface PortalModeDef {
  id: PortalMode;
  theme: "light" | "dark";
  accent: Accent;
  /** Two stops for the swatch dot and the header wash, darkest last. */
  swatch: [string, string];
  label: { ku: string; en: string; ar: string; zh: string };
}

export const PORTAL_MODES: PortalModeDef[] = [
  {
    id: "dark",
    theme: "dark",
    accent: "default",
    swatch: ["#1e3a8a", "#0f172a"],
    label: { ku: "تاریک", en: "Dark", ar: "داكن", zh: "深色" },
  },
  {
    id: "purple",
    theme: "dark",
    accent: "violet",
    swatch: ["#8b5cf6", "#6d28d9"],
    label: { ku: "مۆر", en: "Purple", ar: "بنفسجي", zh: "紫色" },
  },
  {
    id: "pink",
    theme: "dark",
    accent: "rose",
    swatch: ["#f472b6", "#db2777"],
    label: { ku: "پەمەیی", en: "Pink", ar: "وردي", zh: "粉色" },
  },
  {
    id: "light",
    theme: "light",
    accent: "default",
    swatch: ["#f8fafc", "#cbd5e1"],
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
 * The header wash for each mode. The classic portal's blue is the "dark"
 * default; the others shift the whole gradient so the mode is felt
 * immediately, not just in small accents.
 */
export const MODE_HEADER_GRADIENT: Record<PortalMode, string> = {
  dark: "from-[#0f2f5e] via-[#1c4d8d] to-[#123a72]",
  purple: "from-[#3b1d6e] via-[#6d28d9] to-[#4c1d95]",
  pink: "from-[#831843] via-[#db2777] to-[#9d174d]",
  light: "from-[#dbe6f3] via-[#eef2f7] to-[#e7edf5]",
};

/** Light mode needs dark text on the header; the rest are white on colour. */
export function isLightHeader(mode: PortalMode): boolean {
  return mode === "light";
}
