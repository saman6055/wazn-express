import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, Copy, Search, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage } from "@/contexts/LanguageContext";
import { copyText } from "@/lib/copyText";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DOES_NOT_RECONCILE,
  EXPLAIN_HINT,
  HOW_CALCULATED,
  NO_PARTS,
  OPEN_RECORDS,
  RECONCILES,
  THE_PARTS,
  THE_WINDOW,
  figureMeta,
  reconcile,
  type DashboardFigureId,
  type FigurePart,
} from "@shared/dashboardExplain";
import { FILTER_LABEL, type Localised } from "@shared/listLinks";

/**
 * A dashboard figure that can say where it came from.
 *
 * The dashboard was twenty numbers and nothing else — no link, no source, no
 * way to ask which records were counted. Each of them is the end of a query
 * with decisions baked in, and the reader could see none of them.
 *
 * Wrapping the number rather than replacing the card: every stat card on the
 * page has its own layout, and a dozen slightly different drill-downs is how
 * they drift apart. The panel is the same panel everywhere, and the number in
 * it is the number on the card because it is passed in, not fetched again.
 */
export function ExplainableStat({
  figure,
  value,
  className,
  children,
}: {
  figure: DashboardFigureId;
  /** The figure as the card computed it, so the panel cannot disagree. */
  value: number;
  className?: string;
  /** The card's own rendering of the number. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={pickLang(language, EXPLAIN_HINT)}
        className={cn(
          "group inline-flex items-center gap-1.5 text-start",
          "underline decoration-dotted underline-offset-4 decoration-current/40",
          "hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          className,
        )}
      >
        {children}
        <Search className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
      {/* Mounted only once opened: the dashboard carries a dozen of these and
          none should cost a query until somebody asks. */}
      {open && <ExplainPanel figure={figure} value={value} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function ExplainPanel({
  figure,
  value,
  open,
  onOpenChange,
}: {
  figure: DashboardFigureId;
  value: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const meta = figureMeta(figure);
  const partsQuery = trpc.dashboard.figureParts.useQuery({ figure });

  const money = meta.kind === "money";
  const show = (n: number) => (money ? `$${n.toFixed(2)}` : n.toLocaleString("en-US"));

  /** The server returns keys; the words for them live in the shared list. */
  const parts: FigurePart[] = (partsQuery.data?.parts ?? []).map((p) => ({
    key: p.key,
    label: FILTER_LABEL[p.key] ?? PAYMENT_METHOD_LABEL[p.key] ?? asIs(p.key),
    value: p.value,
    count: p.count,
  }));

  const { partTotal, reconciles } = reconcile(value, parts);

  const copyAll = () => {
    const lines = [
      pickLang(language, meta.label) + ": " + show(value),
      pickLang(language, HOW_CALCULATED) + ": " + pickLang(language, meta.formula),
      meta.window ? pickLang(language, THE_WINDOW) + ": " + pickLang(language, meta.window) : "",
      ...parts.map((p) => `- ${pickLang(language, p.label)}: ${show(p.value)}${p.count ? ` (${p.count})` : ""}`),
    ].filter(Boolean);
    void copyText(lines.join("\n"));
    toast.success(pickLang(language, { ku: "لەبەرگیرایەوە", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-baseline justify-between gap-3">
            <span>{pickLang(language, meta.label)}</span>
            <span className="font-mono text-xl" dir="ltr">{show(value)}</span>
          </SheetTitle>
        </SheetHeader>

        <section className="mt-5">
          <h3 className="text-xs font-medium text-muted-foreground">{pickLang(language, HOW_CALCULATED)}</h3>
          <p className="mt-1 text-sm leading-relaxed">{pickLang(language, meta.formula)}</p>
        </section>

        {meta.window && (
          <section className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground">{pickLang(language, THE_WINDOW)}</h3>
            <p className="mt-1 text-sm leading-relaxed">{pickLang(language, meta.window)}</p>
          </section>
        )}

        <section className="mt-5">
          <h3 className="text-xs font-medium text-muted-foreground">{pickLang(language, THE_PARTS)}</h3>

          {partsQuery.isLoading && (
            <div className="mt-2 space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {!partsQuery.isLoading && parts.length === 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{pickLang(language, NO_PARTS)}</p>
          )}

          {parts.length > 0 && (
            <ul className="mt-2 divide-y rounded-lg border">
              {parts.map((part) => (
                <li key={part.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{pickLang(language, part.label)}</p>
                    {part.count != null && part.count > 0 && money && (
                      <p className="text-xs text-muted-foreground">
                        {part.count} {pickLang(language, { ku: "تۆمار", en: "records", ar: "سجل", zh: "条记录" })}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-sm" dir="ltr">{show(part.value)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Said either way. A panel that quietly disagrees with the card is
              two numbers of equal authority and nothing to choose between. */}
          {parts.length > 0 && (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                reconciles
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300",
              )}
            >
              {reconciles ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>
                {pickLang(language, reconciles ? RECONCILES : DOES_NOT_RECONCILE)}
                {!reconciles && <> — <span className="font-mono" dir="ltr">{show(partTotal)}</span></>}
              </span>
            </div>
          )}
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={meta.href}
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {pickLang(language, OPEN_RECORDS)} — {pickLang(language, meta.hrefLabel)}
            {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </Link>
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
            {pickLang(language, { ku: "لەبەرگرتنەوە", en: "Copy", ar: "نسخ", zh: "复制" })}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** How the money arrived. The payment methods the ledger records. */
const PAYMENT_METHOD_LABEL: Record<string, Localised> = {
  CASH: { ku: "نەقد", en: "Cash", ar: "نقداً", zh: "现金" },
  BANK_TRANSFER: { ku: "گواستنەوەی بانکی", en: "Bank transfer", ar: "حوالة بنكية", zh: "银行转账" },
  FIB: { ku: "FIB", en: "FIB", ar: "FIB", zh: "FIB" },
  FASTPAY: { ku: "FastPay", en: "FastPay", ar: "FastPay", zh: "FastPay" },
  ZAINCASH: { ku: "ZainCash", en: "ZainCash", ar: "ZainCash", zh: "ZainCash" },
  ASIAHAWALA: { ku: "AsiaHawala", en: "AsiaHawala", ar: "AsiaHawala", zh: "AsiaHawala" },
  CARD: { ku: "کارت", en: "Card", ar: "بطاقة", zh: "银行卡" },
  OTHER: { ku: "هی تر", en: "Other", ar: "أخرى", zh: "其他" },
};

/**
 * A key nobody has written words for yet.
 *
 * Shown as it is rather than hidden: a part with no label still carries a
 * value, and dropping it would make the parts stop adding up for no visible
 * reason.
 */
function asIs(key: string): Localised {
  return { ku: key, en: key, ar: key, zh: key };
}
