import { Monitor, Smartphone, Tablet, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePortalWidth, type PortalWidth } from "@/hooks/usePortalWidth";

/**
 * Choose how wide the portal sits.
 *
 * Hidden below the large breakpoint on purpose: on a phone there is nothing to
 * choose, and a control that only ever has one sensible answer is clutter. On
 * a desktop it lets the office look at exactly what a customer sees on a
 * handset without reaching for developer tools.
 */
export function PortalWidthPicker({ className }: { className?: string }) {
  const { language } = useLanguage();
  const [width, setWidth] = usePortalWidth();

  const options: { value: PortalWidth; icon: typeof Monitor; label: string }[] = [
    {
      value: "auto",
      icon: Maximize,
      label: pickLang(language, { ku: "بەپێی شاشە", en: "Fit screen", ar: "حسب الشاشة", zh: "适应屏幕" }),
    },
    {
      value: "phone",
      icon: Smartphone,
      label: pickLang(language, { ku: "مۆبایل", en: "Phone", ar: "الهاتف", zh: "手机" }),
    },
    {
      value: "tablet",
      icon: Tablet,
      label: pickLang(language, { ku: "تابلێت", en: "Tablet", ar: "الجهاز اللوحي", zh: "平板" }),
    },
    {
      value: "desktop",
      icon: Monitor,
      label: pickLang(language, { ku: "کۆمپیوتەر", en: "Desktop", ar: "الكمبيوتر", zh: "电脑" }),
    },
  ];

  return (
    <div
      className={cn(
        "hidden lg:flex items-center gap-0.5 rounded-full p-0.5",
        "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
        className,
      )}
      role="group"
      aria-label={pickLang(language, {
        ku: "پانی پۆرتاڵ",
        en: "Portal width",
        ar: "عرض البوابة",
        zh: "门户宽度",
      })}
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setWidth(value)}
          title={label}
          aria-label={label}
          aria-pressed={width === value}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            width === value
              ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-50 shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
