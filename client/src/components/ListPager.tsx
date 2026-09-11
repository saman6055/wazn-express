import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtNumber } from "@/lib/portalFormat";

interface ListPagerProps {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  setPage: (page: number) => void;
}

/**
 * Previous and next under a long list, and where you are in it: "51–100 / 1,240".
 *
 * Takes what useClientPagination returns (`<ListPager {...pager} />`). Digits
 * are 0-9 in every language, and the arrows turn with the reading direction:
 * in Kurdish and Arabic "previous" points right. Nothing is drawn for a list
 * that fits on one page.
 */
export function ListPager({ page, pageCount, total, from, to, setPage }: ListPagerProps) {
  const { language } = useTranslation();
  if (pageCount <= 1) return null;

  const previous = pickLang(language, { ku: "لاپەڕەی پێشوو", en: "Previous page", ar: "الصفحة السابقة", zh: "上一页" });
  const next = pickLang(language, { ku: "لاپەڕەی دواتر", en: "Next page", ar: "الصفحة التالية", zh: "下一页" });

  return (
    <nav className="flex items-center justify-between gap-2 px-1 pt-3" aria-label={`${page} / ${pageCount}`}>
      <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
        {fmtNumber(from)}–{fmtNumber(to)} / {fmtNumber(total)}
      </span>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={previous} title={previous}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <span className="self-center text-xs text-muted-foreground tabular-nums" dir="ltr">
          {page} / {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label={next} title={next}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
