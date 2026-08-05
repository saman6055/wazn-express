/**
 * The company-wide look of the staff UI: text size, text colour, and the fonts
 * an admin has uploaded.
 *
 * All of it lives in one system-settings row as JSON, so there is no migration
 * to run and a bad value can never take a page down — everything read back is
 * put through `normalizeAppearance`, which drops anything it does not
 * recognise and falls back to the built-in defaults.
 *
 * The colour rule is the important one. A text colour that fails to parse, or
 * one supplied as an arbitrary CSS string, would end up injected straight into
 * a style attribute; only `#rgb` / `#rrggbb` is accepted here.
 */

export interface AppearanceDefaults {
  fontScale: number;
  textLight: string | null;
  textDark: string | null;
  mutedLight: string | null;
  mutedDark: string | null;
  fontFamily: string;
  autoFix: boolean;
}

export interface CustomFont {
  id: string;
  label: string;
  url: string;
  format: string;
}

export interface AppearanceRecord {
  defaults: AppearanceDefaults;
  fonts: CustomFont[];
}

export const APPEARANCE_SETTING_KEY = "ui_appearance";

export const MIN_FONT_SCALE = 0.9;
export const MAX_FONT_SCALE = 1.4;

/** Biggest font file accepted, before base64 encoding. A full CJK face can run
 *  to several megabytes; anything past this is almost certainly not a font. */
export const MAX_FONT_BYTES = 5 * 1024 * 1024;

export const DEFAULT_APPEARANCE: AppearanceDefaults = {
  fontScale: 1,
  textLight: null,
  textDark: null,
  mutedLight: null,
  mutedDark: null,
  fontFamily: "default",
  autoFix: true,
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** The four web font containers, and the `format()` each needs in @font-face. */
const FONT_FORMATS: Record<string, string> = {
  ttf: "truetype",
  otf: "opentype",
  woff: "woff",
  woff2: "woff2",
};

export function fontFormatFor(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FONT_FORMATS[ext] ?? null;
}

function cleanColor(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function cleanScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APPEARANCE.fontScale;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, n));
}

/** Font ids and labels reach the browser inside a generated @font-face block,
 *  so an id is restricted to characters that cannot end a CSS string early. */
function cleanId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : null;
}

function cleanFont(raw: unknown): CustomFont | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  const id = cleanId(f.id);
  const url = typeof f.url === "string" ? f.url.trim() : "";
  const format = typeof f.format === "string" ? f.format : "";
  if (!id || !url) return null;
  // Only our own uploads route, never an arbitrary host: a font is a font-file
  // download the browser performs on every page of the admin.
  if (!url.startsWith("/uploads/")) return null;
  if (!Object.values(FONT_FORMATS).includes(format)) return null;
  const label = typeof f.label === "string" && f.label.trim() ? f.label.trim().slice(0, 60) : id;
  return { id, label, url, format };
}

export function normalizeAppearance(raw: unknown): AppearanceRecord {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = (source.defaults && typeof source.defaults === "object" ? source.defaults : {}) as Record<string, unknown>;
  const fontsRaw = Array.isArray(source.fonts) ? source.fonts : [];

  const fonts = fontsRaw.map(cleanFont).filter((f): f is CustomFont => f !== null);

  // A family is either one of the two built-ins or an uploaded font that still
  // exists — a deleted font must not leave every browser asking for a 404.
  const requested = typeof d.fontFamily === "string" ? d.fontFamily : DEFAULT_APPEARANCE.fontFamily;
  const fontFamily =
    requested === "default" || requested === "system" || fonts.some((f) => f.id === requested)
      ? requested
      : DEFAULT_APPEARANCE.fontFamily;

  return {
    defaults: {
      fontScale: cleanScale(d.fontScale),
      textLight: cleanColor(d.textLight),
      textDark: cleanColor(d.textDark),
      mutedLight: cleanColor(d.mutedLight),
      mutedDark: cleanColor(d.mutedDark),
      fontFamily,
      autoFix: d.autoFix === undefined ? DEFAULT_APPEARANCE.autoFix : Boolean(d.autoFix),
    },
    fonts,
  };
}

/** Parse a stored settings row. Anything unreadable becomes the defaults. */
export function parseAppearance(stored: string | null): AppearanceRecord {
  if (!stored) return normalizeAppearance({});
  try {
    return normalizeAppearance(JSON.parse(stored));
  } catch {
    return normalizeAppearance({});
  }
}
