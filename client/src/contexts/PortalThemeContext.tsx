import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type PortalThemeName = "classic" | "modern" | "skin3";

interface PortalThemeContextType {
  portalTheme: PortalThemeName;
  setPortalTheme: (theme: PortalThemeName) => void;
  isLoading: boolean;
}

const PortalThemeContext = createContext<PortalThemeContextType | undefined>(undefined);

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const [portalTheme, setPortalThemeState] = useState<PortalThemeName>("classic");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the portal theme from settings (public endpoint)
  const { data: themeSetting } = trpc.public.getPortalTheme.useQuery();

  useEffect(() => {
    if (themeSetting) {
      setPortalThemeState(themeSetting as PortalThemeName);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [themeSetting]);

  const setPortalTheme = (theme: PortalThemeName) => {
    setPortalThemeState(theme);
  };

  return (
    <PortalThemeContext.Provider value={{ portalTheme, setPortalTheme, isLoading }}>
      {children}
    </PortalThemeContext.Provider>
  );
}

export function usePortalTheme() {
  const context = useContext(PortalThemeContext);
  if (context === undefined) {
    throw new Error("usePortalTheme must be used within a PortalThemeProvider");
  }
  return context;
}
