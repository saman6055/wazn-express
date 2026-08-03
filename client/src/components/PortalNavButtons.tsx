import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePortalHistory } from "@/contexts/PortalHistoryContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * Shared Back (←) / Forward (→) navigation buttons for the customer portal.
 * Placed in every skin's top bar so navigation is consistent across all
 * pages. Uses the app-wide PortalHistory stack to disable a direction when
 * there is nowhere to go, so the buttons never step outside the portal.
 * Arrows flip in RTL: "back" points to the start-of-reading side.
 */
export function PortalNavButtons({ className }: { className?: string }) {
  const { canBack, canForward, back, forward } = usePortalHistory();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  // In RTL the "previous" direction is visually to the right.
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ForwardIcon = isRTL ? ArrowLeft : ArrowRight;

  const btn = (enabled: boolean) =>
    cn(
      "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
      enabled
        ? isDark
          ? "text-zinc-200 hover:bg-white/10 active:scale-95"
          : "text-slate-700 dark:text-slate-300 hover:bg-black/5 active:scale-95"
        : isDark
          ? "text-zinc-600 cursor-not-allowed"
          : "text-slate-300 cursor-not-allowed"
    );

  return (
    <div className={cn("flex items-center gap-0.5 shrink-0", className)}>
      <button
        type="button"
        onClick={back}
        disabled={!canBack}
        aria-label={isRTL ? "گەڕانەوە" : "Back"}
        className={btn(canBack)}
      >
        <BackIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={forward}
        disabled={!canForward}
        aria-label={isRTL ? "پێشەوە" : "Forward"}
        className={btn(canForward)}
      >
        <ForwardIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export default PortalNavButtons;
