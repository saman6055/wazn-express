import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
export type Accent = "default" | "rose" | "violet" | "ocean" | "amber";

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

  const [accent, setAccent] = useState<Accent>(() => {
    const stored = localStorage.getItem("theme-accent") as Accent | null;
    return stored || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

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
    () => ({ theme, toggleTheme, setTheme, switchable, accent, setAccent }),
    [theme, toggleTheme, switchable, accent]
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
