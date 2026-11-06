import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
export type Accent = "default" | "rose" | "violet" | "ocean" | "amber";
/** The admin's look: the warm light default, or the optional dark «فینتێک». */
export type Skin = "classic" | "fintech";
const SKIN_KEY = "wazn-admin-skin";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  /**
   * Set light or dark outright. Toggling is no use to the portal's mode
   * picker, which has to land on a named mode rather than flip whatever is
   * currently set.
   */
  setTheme: (t: Theme) => void;
  switchable: boolean;
  accent: Accent;
  setAccent: (a: Accent) => void;
  /** This browser's admin skin. Takes effect only on office pages. */
  skin: Skin;
  setSkin: (s: Skin) => void;
  /** Office pages turn the skin on while they are on screen; the portal never does. */
  setSkinScope: (on: boolean) => void;
  /** True while the fintech skin is actually showing. */
  fintech: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [skin, setSkinState] = useState<Skin>(() => {
    try { return localStorage.getItem(SKIN_KEY) === "fintech" ? "fintech" : "classic"; } catch { return "classic"; }
  });
  const [skinScope, setSkinScope] = useState(false);
  const setSkin = useCallback((next: Skin) => {
    setSkinState(next);
    try { localStorage.setItem(SKIN_KEY, next); } catch { /* the choice still applies for this visit */ }
  }, []);
  const fintech = skin === "fintech" && skinScope;
  // Fintech is a dark look: screens that ask "is it dark?" get yes while it shows.
  const shownTheme: Theme = fintech ? "dark" : theme;

  const [accent, setAccent] = useState<Accent>(() => {
    const stored = localStorage.getItem("theme-accent") as Accent | null;
    return stored || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (shownTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (fintech) root.setAttribute("data-skin", "fintech");
    else root.removeAttribute("data-skin");

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, shownTheme, fintech, switchable]);

  // Accent skin is applied via a data-theme attribute on <html>; "default" keeps
  // the brand teal (no attribute). Independent of light/dark.
  useEffect(() => {
    const root = document.documentElement;
    if (accent && accent !== "default") {
      root.setAttribute("data-theme", accent);
    } else {
      root.removeAttribute("data-theme");
    }
    localStorage.setItem("theme-accent", accent);
  }, [accent]);

  const doToggleTheme = useCallback(() => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  }, []);
  const toggleTheme = switchable ? doToggleTheme : undefined;

  const value = useMemo(
    () => ({ theme: shownTheme, toggleTheme, setTheme, switchable, accent, setAccent, skin, setSkin, setSkinScope, fintech }),
    [shownTheme, toggleTheme, switchable, accent, skin, setSkin, fintech]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
