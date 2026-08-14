import { useEffect, useState } from "react";
import { Monitor, Smartphone, Tablet, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { DESKTOP_MIN_PX, usePortalWidth, type PortalWidth } from "@/hooks/usePortalWidth";

/**
 * See the portal at another screen's width.
 *
 * Two people want this, for different reasons. The office answers "I can't
 * find that button on my phone" from a desk with a 27-inch monitor, where the
 * portal looks nothing like the customer's screen. And a customer at a desk
 * may simply prefer the narrow column — some people do, and it is their
 * portal.
 *
 * On a phone it is not offered to customers, and that is the whole of the
 * safety here: a setting you can change is a setting you can forget, and a
 * customer who once tapped "phone" on a laptop would otherwise ring up months
 * later to report the portal had gone narrow and broken. Offered only where
 * there is room to offer it, the control is always visible beside the effect
 * it caused, so it can be undone by the person who caused it.
 *
 * Staff see it at any size, because their reason for wanting it is to look at
 * a size other than their own.
 */

const OPTIONS: { value: PortalWidth; icon: typeof Monitor; label: { ku: string; en: string; ar: string; zh: string } }[] = [
  { value: "auto", icon: Wand2, label: { ku: "خۆکار", en: "Auto", ar: "تلقائي", zh: "自动" } },
  { value: "phone", icon: Smartphone, label: { ku: "مۆبایل", en: "Phone", ar: "هاتف", zh: "手机" } },
  { value: "tablet", icon: Tablet, label: { ku: "تابلێت", en: "Tablet", ar: "لوحي", zh: "平板" } },
  { value: "desktop", icon: Monitor, label: { ku: "کۆمپیوتەر", en: "Desktop", ar: "مكتبي", zh: "电脑" } },
];

export function PortalWidthSwitch() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [width, setWidth] = usePortalWidth();
  const [onDesktop, setOnDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN_PX,
  );

  // Followed rather than read once: a window dragged between monitors, or a
  // tablet turned on its side, changes the answer.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(`(min-width: ${DESKTOP_MIN_PX}px)`);
    const onChange = () => setOnDesktop(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // A customer session carries isCustomer; staff sessions do not.
  const isStaff = Boolean(user) && !(user as { isCustomer?: boolean })?.isCustomer;
  if (!isStaff && !onDesktop) return null;

  return (
    <div
      className={cn(
        "fixed bottom-24 start-3 z-40 flex items-center gap-0.5 rounded-full p-1 shadow-lg backdrop-blur",
        "border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95",
      )}
      title={pickLang(language, {
        ku: "پۆرتاڵ بە قەبارەی شاشەیەکی تر ببینە",
        en: "View the portal at another screen size",
        ar: "اعرض البوابة بمقاس شاشة آخر",
        zh: "以其他屏幕尺寸查看门户",
      })}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = width === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setWidth(option.value)}
            aria-label={pickLang(language, option.label)}
            aria-pressed={active}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
