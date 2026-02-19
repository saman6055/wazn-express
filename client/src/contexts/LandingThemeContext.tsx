import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type LandingThemeName = "dark" | "light" | "ocean";

interface LandingThemeContextType {
  landingTheme: LandingThemeName;
  setLandingTheme: (theme: LandingThemeName) => void;
  isLoading: boolean;
}

const LandingThemeContext = createContext<LandingThemeContextType | undefined>(undefined);

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const [landingTheme, setLandingThemeState] = useState<LandingThemeName>("dark");
  const [isLoading, setIsLoading] = useState(true);

  const { data: themeSetting } = trpc.public.getLandingTheme.useQuery();

  useEffect(() => {
    if (themeSetting && ["dark", "light", "ocean"].includes(themeSetting)) {
      setLandingThemeState(themeSetting as LandingThemeName);
    }
    setIsLoading(false);
  }, [themeSetting]);

  const setLandingTheme = (theme: LandingThemeName) => {
    setLandingThemeState(theme);
  };

  return (
    <LandingThemeContext.Provider value={{ landingTheme, setLandingTheme, isLoading }}>
      {children}
    </LandingThemeContext.Provider>
  );
}

export function useLandingTheme() {
  const context = useContext(LandingThemeContext);
  if (context === undefined) {
    throw new Error("useLandingTheme must be used within a LandingThemeProvider");
  }
  return context;
}
