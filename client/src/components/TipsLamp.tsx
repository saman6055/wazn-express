import { Lightbulb } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { askForTip, TIP_WORD } from "@/lib/tipsLamp";
import { cn } from "@/lib/utils";

/**
 * The tips lamp, in the foot of the menu rail.
 *
 * It was a button floating over the bottom corner of every page until the
 * owner, 2026-10-07: «زۆر بەکەڵکن بەڵام جێگا دەگرن، دەکەونە سەر نووسین و شت لە
 * سیستەمدا» (lib/floatingCorner). Still the amber disc the office knows, so it
 * is found again in its new place; the square grey icons above it are pages,
 * this is not one.
 *
 * It only asks: the card with the tips is a lazy chunk mounted outside the
 * layout, and hears the request through lib/tipsLamp.
 */
export function TipsLamp({ className }: { className?: string }) {
  const { language } = useTranslation();
  const word = pickLang(language, TIP_WORD);
  return (
    <button
      type="button"
      onClick={() => askForTip()}
      title={word}
      aria-label={word}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-500 text-white shadow-sm transition hover:bg-amber-600 active:scale-95 print:hidden",
        className,
      )}
      data-testid="tips-lamp"
    >
      <Lightbulb className="h-5 w-5" />
    </button>
  );
}
