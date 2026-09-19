import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSmartBack } from "@/hooks/useSmartBack";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/** The word every back arrow says, when it says one. */
export const BACK_WORDS = { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" };

/**
 * The portal's back arrow: one step back, the way the phone's Back button
 * goes — see hooks/useSmartBack. Each page keeps its own look through
 * `className`; what the arrow does, and which way it points, is decided
 * here once. It points right in Kurdish and Arabic, where the way back is
 * to the right; four pages had it pointing forward.
 */
export function PortalBackButton({
  fallback,
  to,
  icon = "arrow",
  className,
  iconClassName,
  children,
}: {
  /** Where to go when nothing of the portal is behind. The home by default. */
  fallback?: string;
  /** A button that names its page ("back to all posts") goes there if it is not the page behind. */
  to?: string;
  icon?: "arrow" | "chevron";
  className?: string;
  iconClassName?: string;
  /** Words beside the arrow. Without them the arrow says "Back" to a screen reader. */
  children?: ReactNode;
}) {
  const { language } = useLanguage();
  const back = useSmartBack(fallback);
  const isRTL = language === "ku" || language === "ar";
  const Icon = icon === "chevron" ? (isRTL ? ChevronRight : ChevronLeft) : isRTL ? ArrowRight : ArrowLeft;

  return (
    <button
      type="button"
      onClick={() => back(to)}
      aria-label={children ? undefined : pickLang(language, BACK_WORDS)}
      className={cn("relative tap-44 inline-flex items-center", className)}
    >
      <Icon className={iconClassName ?? "h-5 w-5"} aria-hidden="true" />
      {children}
    </button>
  );
}
