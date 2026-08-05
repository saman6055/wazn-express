import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Typography and text colour, under the reader's control.
 *
 * Dark mode kept producing text nobody could read — dark ink on the dark
 * canvas. index.css carries the automatic repair; this carries the manual
 * override, so when a screen still reads badly the answer is a slider rather
 * than a bug report.
 *
 * Two layers, deliberately:
 *   • the company default, saved on the server by an admin — what a new
 *     browser gets before anyone touches anything;
 *   • this browser's own choice, in localStorage — what the person sitting
 *     here picked, which always wins over the default.
 */

export interface AppearancePrefs {
  /** 1 = 100%. Scales the root font size, so spacing scales with it. */
  fontScale: number;
  /** Text colour per mode; null keeps the theme's own. */
  textLight: string | null;
  textDark: string | null;
  /** Colour of quiet/secondary labels per mode. */
  mutedLight: string | null;
  mutedDark: string | null;
  /** "default" | "system" | a custom font id. */
  fontFamily: string;
  /** The automatic dark-mode repair in index.css. */
  autoFix: boolean;
}

export interface CustomFont {
  id: string;
  label: string;
  url: string;
  format: string;
}

export const DEFAULT_PREFS: AppearancePrefs = {
  fontScale: 1,
  textLight: null,
  textDark: null,
  mutedLight: null,
  mutedDark: null,
  fontFamily: "default",
  autoFix: true,
};

export const MIN_SCALE = 0.9;
export const MAX_SCALE = 1.4;

const STORAGE_KEY = "wazn-appearance";
const FONT_STYLE_ID = "wazn-custom-fonts";

const BUILTIN_STACKS: Record<string, string> = {
  default: '"Rudaw", "Inter", system-ui, sans-serif',
  system: 'system-ui, -apple-system, "Segoe UI", "Noto Sans Arabic", sans-serif',
};

/** CSS family name for an uploaded font — derived, so a label with quotes or
 *  spaces in it can never break the stylesheet. */
export function fontFamilyName(id: string): string {
  return `wazn-font-${id}`;
}

interface AppearanceContextType {
  prefs: AppearancePrefs;
  /** Company default from the server, for showing "you have changed this". */
  companyDefaults: Partial<AppearancePrefs>;
  fonts: CustomFont[];
  /** True when this browser has its own choice saved. */
  overridden: boolean;
  update: (patch: Partial<AppearancePrefs>) => void;
  /** Drop this browser's choice and fall back to the company default. */
  reset: () => void;
  refetchFonts: () => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

function readStored(): Partial<AppearancePrefs> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppearancePrefs>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [local, setLocal] = useState<Partial<AppearancePrefs> | null>(() => readStored());

  // Public on purpose: the login screen and the landing page render with the
  // company's font too, and a signed-out visitor must never be bounced to
  // /login just because this query 401'd.
  const query = trpc.settings.getAppearance.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const companyDefaults = useMemo<Partial<AppearancePrefs>>(
    () => (query.data?.defaults ?? {}) as Partial<AppearancePrefs>,
    [query.data]
  );
  const fonts = useMemo<CustomFont[]>(() => (query.data?.fonts ?? []) as CustomFont[], [query.data]);

  const prefs = useMemo<AppearancePrefs>(
    () => ({ ...DEFAULT_PREFS, ...companyDefaults, ...(local ?? {}) }),
    [companyDefaults, local]
  );

  const update = useCallback((patch: Partial<AppearancePrefs>) => {
    setLocal((prev) => {
      const next = { ...(prev ?? {}), ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* a full or blocked storage must not stop the change taking effect */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLocal(null);
  }, []);

  // ---- Uploaded fonts: one <style> holding every @font-face ----------------
  useEffect(() => {
    if (!fonts.length) return;
    let el = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = FONT_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = fonts
      .map(
        (f) =>
          `@font-face{font-family:"${fontFamilyName(f.id)}";src:url("${f.url}") format("${f.format}");font-display:swap;}`
      )
      .join("\n");
  }, [fonts]);

  // ---- Apply everything to <html> -----------------------------------------
  useEffect(() => {
    const root = document.documentElement;

    root.dataset.textfix = prefs.autoFix ? "on" : "off";

    // Root font size drives every rem in the app, so spacing grows with the
    // text instead of the text outgrowing its boxes.
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prefs.fontScale || 1));
    if (scale === 1) root.style.removeProperty("font-size");
    else root.style.fontSize = `${Math.round(scale * 100)}%`;

    const stack =
      BUILTIN_STACKS[prefs.fontFamily] ??
      `"${fontFamilyName(prefs.fontFamily)}", "Rudaw", "Inter", system-ui, sans-serif`;
    root.style.setProperty("--font-sans", stack);

    const text = theme === "dark" ? prefs.textDark : prefs.textLight;
    const muted = theme === "dark" ? prefs.mutedDark : prefs.mutedLight;

    // --wazn-fg is what index.css paints text with; the token vars keep the
    // rest of the design system (cards, popovers, sidebar) in step with it.
    const TOKENS = [
      "--foreground",
      "--card-foreground",
      "--popover-foreground",
      "--secondary-foreground",
      "--sidebar-foreground",
    ];
    if (text) {
      root.style.setProperty("--wazn-fg", text);
      TOKENS.forEach((t) => root.style.setProperty(t, text));
    } else {
      root.style.removeProperty("--wazn-fg");
      TOKENS.forEach((t) => root.style.removeProperty(t));
    }

    if (muted) {
      root.style.setProperty("--wazn-fg-muted", muted);
      root.style.setProperty("--muted-foreground", muted);
    } else {
      root.style.removeProperty("--wazn-fg-muted");
      root.style.removeProperty("--muted-foreground");
    }
  }, [prefs, theme]);

  // react-query keeps refetch stable; depending on the whole query object
  // instead would rebuild this value on every render and re-render the app.
  const refetch = query.refetch;
  const refetchFonts = useCallback(() => void refetch(), [refetch]);

  const value = useMemo(
    () => ({
      prefs,
      companyDefaults,
      fonts,
      overridden: local !== null,
      update,
      reset,
      refetchFonts,
    }),
    [prefs, companyDefaults, fonts, local, update, reset, refetchFonts]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
