import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import CompanyLogo from "@/components/CompanyLogo";
import { PortalNavButtons } from "@/components/PortalNavButtons";
import { cn } from "@/lib/utils";

/**
 * Slim sticky header showing the company logo (uploaded in Settings) plus
 * the localized company name. Used by the portal skins that have no top bar
 * of their own (Modern, Skin3). The logo comes from the PUBLIC
 * settings.getCompanyInfo endpoint via useCompanyInfo, so it loads for
 * logged-in customers without touching any staff-only procedure; CompanyLogo
 * falls back to a package icon when no logo has been uploaded.
 */
export function PortalTopBar() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const company = useCompanyInfo();

  const name =
    language === "ku"
      ? company.nameKu || company.name
      : language === "ar"
        ? company.nameAr || company.name
        : company.name;

  return (
    <div
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-sm transition-colors duration-300",
        isDark ? "bg-zinc-900/90 border-zinc-800/60" : "bg-white/90 border-gray-200/60"
      )}
    >
      <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-2.5">
        <CompanyLogo size={34} className="shrink-0" />
        <span
          className={cn(
            "font-bold text-base truncate",
            isDark ? "text-zinc-100" : "text-gray-800 dark:text-gray-200"
          )}
        >
          {name}
        </span>
        <PortalNavButtons className="ms-auto" />
      </div>
    </div>
  );
}

export default PortalTopBar;
