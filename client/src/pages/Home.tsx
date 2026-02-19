import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CompanyLogo from "@/components/CompanyLogo";
import { useLandingTheme } from "@/contexts/LandingThemeContext";
import { useEffect } from "react";
import { useLocation } from "wouter";
import HomeClassic from "./HomeClassic";
import HomeMinimal from "./HomeMinimal";

export default function Home() {
  const { data: variant, isLoading: variantLoading } = trpc.public.getLandingPageVariant.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const { landingTheme } = useLandingTheme();
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "customer") setLocation("/portal");
      else setLocation("/dashboard");
    }
  }, [user, authLoading, setLocation]);

  if (authLoading || variantLoading) {
    return (
      <div className="landing-page min-h-screen flex items-center justify-center bg-[var(--landing-bg)]" data-theme={landingTheme}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <CompanyLogo size={48} iconClassName="h-8 w-8 text-[var(--landing-text)]" fallbackBg="bg-gradient-to-br from-amber-400 to-orange-500" />
          <p className="text-[var(--landing-text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return <HomeMinimal />;
  }

  return <HomeClassic />;
}
