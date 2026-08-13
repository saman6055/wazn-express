import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useLanguage, useTranslation } from "@/contexts/LanguageContext";
import { copyText } from "@/lib/copyText";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, ChevronLeft, Copy, Info, Search } from "lucide-react";
import type { FigureId, Localised } from "@shared/financeExplain";

/**
 * A figure that can say where it came from.
 *
 * Every number on the finance screens is the end of a computation, and the
 * screen used to throw away everything about how it got there — answering
 * "where did this come from" meant reading the SQL. Clicking one of these
 * opens the calculation in words, the parts it is made of, and where to go to
 * see the records behind each part.
 *
 * One component rather than a panel per page: a dozen slightly different
 * drill-downs is how they drift, and the whole value here is that the number
 * on the card and the number in the panel are the same number.
 */
export function ExplainableFigure({
  figure,
  period,
  value,
  className,
  children,
}: {
  figure: FigureId;
  period?: "today" | "week" | "month" | "year";
  /** The figure as the card renders it, so the trigger looks unchanged. */
  value: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("finance.explainHint")}
        className={cn(
          "group inline-flex items-center gap-1.5 text-start",
          "underline decoration-dotted underline-offset-4 decoration-current/40",
          "hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
          className
        )}
      >
        {value}
        <Search className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      </button>
      {children}
      {/* Mounted only once opened: the dashboard shows several of these and
          none should cost a query until somebody asks. */}
      {open && <ExplainPanel figure={figure} period={period} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function ExplainPanel({
  figure,
  period,
  open,
  onOpenChange,
}: {
  figure: FigureId;
  period?: "today" | "week" | "month" | "year";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const say = (text: Localised) => pickLang(language, text);

  const { data, isLoading, isError, error } = trpc.financeIntegration.explainFigure.useQuery(
    { figure, period },
    { staleTime: 60_000 }
  );

  const money = (n: number) =>
    `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /** The whole explanation as text, for pasting into a message. */
  const asText = () => {
    if (!data) return "";
    const lines = [
      `${say(data.label)}: ${money(data.value)}`,
      "",
      say(data.formula),
      "",
      ...data.components.map((c) => `  ${say(c.label)}: ${money(c.value)}${c.count ? ` (${c.count})` : ""}`),
      "",
      `${t("finance.componentTotal")}: ${money(data.componentTotal)}`,
    ];
    if (data.caveat) lines.push("", say(data.caveat));
    return lines.join("\n");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data ? say(data.label) : t("finance.explainTitle")}</SheetTitle>
        </SheetHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-8">{t("common.loading")}</p>}

        {isError && (
          <p className="text-sm text-destructive py-8">{error?.message || t("common.error")}</p>
        )}

        {data && (
          <div className="space-y-5 py-4">
            <p className="text-3xl font-bold">{money(data.value)}</p>

            {/* When the label and the arithmetic disagree, say so here rather
                than letting the reader find out months later. */}
            {data.caveat && (
              <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">{say(data.caveat)}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("finance.howItIsCalculated")}</p>
              <p className="text-sm rounded-lg bg-muted p-3">{say(data.formula)}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("finance.components")}</p>
              <div className="space-y-1.5">
                {data.components.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("finance.noComponents")}</p>
                )}
                {data.components.map((component) => {
                  const row = (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                      <span className="text-sm min-w-0">
                        {say(component.label)}
                        {component.count ? (
                          <span className="text-xs text-muted-foreground ms-1.5">({component.count})</span>
                        ) : null}
                      </span>
                      <span className="font-mono text-sm shrink-0">{money(component.value)}</span>
                    </div>
                  );
                  return component.href ? (
                    <Link key={component.key} href={component.href} onClick={() => onOpenChange(false)}>
                      <a className="block hover:opacity-80">{row}</a>
                    </Link>
                  ) : (
                    <div key={component.key}>{row}</div>
                  );
                })}
              </div>
            </div>

            {/* The point of the whole panel: the parts have to add up. When
                they do not, something is genuinely wrong with the arithmetic
                and this is where it shows. */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2",
                data.reconciles
                  ? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
              )}
            >
              <span className="text-xs inline-flex items-center gap-1.5">
                {!data.reconciles && <AlertTriangle className="h-4 w-4 shrink-0" />}
                {data.reconciles ? t("finance.reconciles") : t("finance.doesNotReconcile")}
              </span>
              <span className="font-mono text-xs">{money(data.componentTotal)}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              // copyText reports whether it actually worked — the clipboard
              // is missing in some in-app browsers, and a toast that claims
              // success while copying nothing is worse than no button.
              onClick={async () => {
                const copied = await copyText(asText());
                if (copied) toast.success(t("finance.explanationCopied"));
                else toast.error(t("common.error"));
              }}
            >
              <Copy className="h-4 w-4 me-2" />
              {t("finance.copyExplanation")}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
