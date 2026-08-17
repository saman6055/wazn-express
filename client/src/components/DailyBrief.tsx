import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  FileDown,
  RefreshCw,
  Sunrise,
} from "lucide-react";
import type { Signal } from "@shared/dailyBrief";

/**
 * The morning brief, at the top of the dashboard.
 *
 * A super admin has a hundred screens and a few minutes. Below this sit the
 * charts and the tiles, which are excellent at showing a figure and silent on
 * whether it is good, whether it moved, or whether anybody should act. This is
 * the answer to those three, in the order they matter, before anything else on
 * the page.
 *
 * Every line goes somewhere. A brief that reports a problem and leaves the
 * reader to hunt for it has moved the work rather than done it.
 *
 * It shows and it says. It changes nothing: there is no button here that
 * writes, and the endpoint behind it is a query.
 */

const TONE: Record<string, string> = {
  urgentRisk: "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40",
  risk: "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40",
  win: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40",
  quiet: "border-border bg-card",
};

function toneFor(signal: Signal): string {
  if (signal.kind === "risk") return signal.weight === "urgent" ? TONE.urgentRisk : TONE.risk;
  if (signal.kind === "win") return TONE.win;
  return TONE.quiet;
}

function SignalRow({ signal, language, onOpen }: { signal: Signal; language: string; onOpen: (p: string) => void }) {
  const Icon =
    signal.kind === "risk"
      ? AlertTriangle
      : signal.kind === "win"
        ? signal.delta?.direction === "down" || signal.delta?.direction === "to_zero"
          ? ArrowDownRight
          : ArrowUpRight
        : CheckCircle2;

  const clickable = !!signal.path;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => signal.path && onOpen(signal.path)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors",
        toneFor(signal),
        clickable && "hover:brightness-95 dark:hover:brightness-110",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          signal.kind === "risk"
            ? signal.weight === "urgent"
              ? "text-red-600 dark:text-red-300"
              : "text-amber-600 dark:text-amber-300"
            : signal.kind === "win"
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-muted-foreground",
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{pickLang(language, signal.title)}</p>
        {signal.detail && (
          <p className="truncate text-xs text-muted-foreground">{pickLang(language, signal.detail)}</p>
        )}
      </div>

      {signal.value && <span className="shrink-0 font-mono text-sm font-bold">{signal.value}</span>}
      {clickable && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />}
    </button>
  );
}

export function DailyBrief({ language }: { language: string }) {
  const [, setLocation] = useLocation();
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = trpc.audit.brief.useQuery(undefined, {
    // The brief reads the whole system. It runs when the dashboard opens and
    // when somebody asks again — not because a tab was left open.
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  });

  const print = () => {
    // The browser's own print dialog, with a stylesheet that hides everything
    // but the brief. No PDF library, no server round trip, and it saves or
    // prints to whatever the reader actually uses.
    //
    // The class comes off in a finally, not after print() returns: some
    // browsers return immediately and some block until the dialog closes, and
    // a dashboard left permanently hidden would be a far worse bug than a
    // missing PDF.
    document.body.classList.add("printing-brief");
    try {
      window.print();
    } finally {
      window.setTimeout(() => document.body.classList.remove("printing-brief"), 500);
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;

  /**
   * It failed, and it says so.
   *
   * This returned null on error, so the panel simply was not there — which
   * is indistinguishable from "not deployed yet" and from "there is nothing
   * to report". A brief whose whole argument is that silence is dangerous
   * must not go silent itself.
   */
  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
        <p className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {pickLang(language, {
            ku: "ڕاپۆرتی بەیانی نەهات",
            en: "The morning brief could not load",
            ar: "تعذّر تحميل موجز الصباح",
            zh: "晨间简报无法加载",
          })}
        </p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">
          {pickLang(language, {
            ku: "ئەمە واتای ئەوە نییە هەموو شتێک ڕێکە — واتای ئەوەیە سەیر نەکراوە.",
            en: "This does not mean all is well. It means nothing looked.",
            ar: "هذا لا يعني أن كل شيء سليم، بل أن أحداً لم ينظر.",
            zh: "这不代表一切正常，而是根本没有检查。",
          })}
        </p>
        <p className="mt-2 rounded bg-background/70 p-2 font-mono text-xs text-red-800 dark:text-red-200">
          {error.message}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="me-2 h-4 w-4" />
          {pickLang(language, { ku: "دووبارە هەوڵ بدە", en: "Try again", ar: "إعادة المحاولة", zh: "重试" })}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const visible = showAll ? data.signals : data.signals.slice(0, 6);
  const hidden = data.signals.length - visible.length;

  return (
    <div className="wazn-brief space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2 dark:bg-amber-950/50">
            <Sunrise className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-lg font-bold">{pickLang(language, data.headline)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(data.ranAt).toLocaleString()}
              {data.summary.risks > 0 && ` · ${data.summary.risks} ${pickLang(language, { ku: "مەترسی", en: "risks", ar: "مخاطر", zh: "风险" })}`}
              {data.summary.wins > 0 && ` · ${data.summary.wins} ${pickLang(language, { ku: "دەستکەوت", en: "wins", ar: "مكاسب", zh: "进展" })}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("me-2 h-4 w-4", isFetching && "animate-spin")} />
            {pickLang(language, { ku: "نوێکردنەوە", en: "Refresh", ar: "تحديث", zh: "刷新" })}
          </Button>
          <Button size="sm" onClick={print}>
            <FileDown className="me-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Said out loud rather than left to be inferred from a page of rises.
          A first morning has nothing to compare against, and every figure
          would otherwise read as a triumph. */}
      {data.firstMorning && (
        <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          {pickLang(language, {
            ku: "ئەمە یەکەم بەیانییە — هێشتا ڕۆژێکی پێشوو نییە بۆ بەراوردکردن. بەراوردەکان لە سبەینێوە دەست پێدەکەن.",
            en: "This is the first morning — there is no earlier day to compare against yet. Comparisons begin tomorrow.",
            ar: "هذا أول صباح — لا يوجد يوم سابق للمقارنة بعد. تبدأ المقارنات غداً.",
            zh: "这是第一个早晨——还没有可对比的前一天。对比从明天开始。",
          })}
        </p>
      )}

      {data.signals.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            {pickLang(language, {
              ku: "هەموو بەشەکان پشکنران و هیچ شتێک نەدۆزرایەوە کە پێویستی بە بڕیار بێت.",
              en: "Every part of the system was checked and nothing needs a decision.",
              ar: "تم فحص كل أجزاء النظام ولا شيء يستدعي قراراً.",
              zh: "系统各部分均已检查，无需任何决策。",
            })}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((signal) => (
            <SignalRow key={signal.id} signal={signal} language={language} onOpen={setLocation} />
          ))}

          {hidden > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted print:hidden"
            >
              {pickLang(language, {
                ku: `پیشاندانی ${hidden}ی تر`,
                en: `Show ${hidden} more`,
                ar: `عرض ${hidden} أخرى`,
                zh: `显示其余 ${hidden} 条`,
              })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DailyBrief;
