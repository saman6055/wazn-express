import { Boxes, Layers } from "lucide-react";
import { pickLang } from "@/lib/lang";

/**
 * «2 کارتۆن» and «×3 پارچە» beside a tracking (owner, 2026-10-21): one
 * tracking of several cartons, or an order of several pieces, must say so
 * wherever it is counted out - the parcel list and the box. Nothing is shown
 * for one carton and one piece.
 */
export function CountBadges({
  cartons,
  pieces,
  language,
}: {
  cartons?: number | string | null;
  pieces?: number | string | null;
  language: string;
}) {
  const c = Math.floor(Number(cartons ?? 1) || 1);
  const p = Math.floor(Number(pieces ?? 1) || 1);
  if (c <= 1 && p <= 1) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="count-badges">
      {c > 1 && (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200" data-testid="badge-cartons">
          <Boxes className="h-3 w-3" />
          {pickLang(language, { ku: `${c} کارتۆن`, en: `${c} cartons`, ar: `${c} كراتين`, zh: `${c} 箱` })}
        </span>
      )}
      {p > 1 && (
        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" data-testid="badge-pieces">
          <Layers className="h-3 w-3" />
          {pickLang(language, { ku: `×${p} پارچە`, en: `×${p} pieces`, ar: `×${p} قطع`, zh: `×${p} 件` })}
        </span>
      )}
    </span>
  );
}
