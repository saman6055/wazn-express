import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/numericDate";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RISK_CHIP, RISK_DOT } from "@/lib/riskStyle";
import { RISK_LEVEL_LABEL, worstLevel } from "@shared/riskRules";
import {
  describeRisk,
  localDay,
  markSeen,
  parseSeen,
  shouldFlash,
  RISK_GATE,
  RISK_PATH,
  type RiskSeen,
} from "@shared/riskBell";

type Words = { ku: string; en: string; ar: string; zh: string };

/** Per person, per browser: what they had seen when they last opened the bell. */
const seenKey = (userId: number) => `wazn-risk-bell-seen:${userId}`;

function readSeen(userId: number): RiskSeen | null {
  if (!userId) return null;
  try {
    return parseSeen(localStorage.getItem(seenKey(userId)));
  } catch {
    return null;
  }
}

const BADGE: Record<"critical" | "high" | "notice", string> = {
  critical: "bg-red-600",
  high: "bg-amber-500",
  notice: "bg-sky-500",
};

/**
 * The system's bell: today's risks, worst first, one tap to each list.
 *
 * The owner's word (2026-09-16): a notification bell for the whole system,
 * its risks by size, there every day, flashing. It flashes while a critical
 * or high risk has not been looked at today — opening it stops that, and a
 * new or growing risk, or the next day, starts it again (shared/riskBell).
 * Everybody is told about the pages they may open, and nothing more: the
 * server filters, and so does this.
 */
export function RiskBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const L = (words: Words) => pickLang(language, words);
  const [, navigate] = useLocation();
  const { canViewPath } = usePermissions();
  const userId = Number((user as { id?: number } | null)?.id ?? 0);

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<RiskSeen | null>(() => readSeen(userId));
  useEffect(() => {
    setSeen(readSeen(userId));
  }, [userId]);

  const risksQ = trpc.dashboard.risks.useQuery(undefined, {
    enabled: userId > 0,
    staleTime: 60_000,
    // Every five minutes while the tab is in front — the day's risks do not
    // change by the second, and a background tab has nobody to tell.
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const items = (risksQ.data ?? []).filter((item) => canViewPath(RISK_GATE[item.id]));
  const today = localDay(new Date());
  const flashing = shouldFlash(items, seen, today);
  const worst = worstLevel(items.map((item) => item.level));
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next || items.length === 0) return;
    // Opened: these are seen for today, and the flashing stops.
    const mark = markSeen(items, today);
    setSeen(mark);
    try {
      localStorage.setItem(seenKey(userId), JSON.stringify(mark));
    } catch {
      // Storage refused: it flashes again next time, which is the safe side.
    }
  };

  const bellLabel = L({ ku: "ئاگادارییەکانی سیستەم", en: "System alerts", ar: "تنبيهات النظام", zh: "系统提醒" });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-8 w-8 rounded-full", className)}
          title={bellLabel}
          aria-label={items.length > 0 ? `${bellLabel} (${items.length})` : bellLabel}
          data-flashing={flashing ? "true" : undefined}
        >
          {flashing && (
            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-red-500/40 motion-reduce:animate-none" />
          )}
          <Bell className={cn("relative h-4 w-4", flashing && "text-red-600 dark:text-red-400")} />
          {items.length > 0 && worst && (
            <span
              dir="ltr"
              className={cn(
                "absolute -top-1 -end-1 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white",
                BADGE[worst],
                flashing && "animate-pulse motion-reduce:animate-none",
              )}
            >
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">
            {L({ ku: "ئاگادارییەکانی ئەمڕۆ", en: "Today's alerts", ar: "تنبيهات اليوم", zh: "今日提醒" })}
          </p>
          {risksQ.dataUpdatedAt > 0 && (
            <span className="text-[11px] text-muted-foreground">
              <bdi dir="ltr">{fmtTime(new Date(risksQ.dataUpdatedAt))}</bdi>
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium">
              {risksQ.isError
                ? L({ ku: "نەتوانرا ئاگادارییەکان بهێنرێن", en: "Couldn't load the alerts", ar: "تعذّر تحميل التنبيهات", zh: "无法加载提醒" })
                : L({ ku: "هیچ مەترسییەک نییە", en: "No risks right now", ar: "لا توجد مخاطر الآن", zh: "目前没有风险" })}
            </p>
          </div>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {items.map((item) => {
              const { title, detail } = describeRisk(item);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(RISK_PATH[item.id]);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-muted"
                  >
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", RISK_DOT[item.level])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{L(title)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn("rounded-full px-1.5 py-px font-semibold", RISK_CHIP[item.level])}>
                          {L(RISK_LEVEL_LABEL[item.level])}
                        </span>
                        {detail && <span>{L(detail)}</span>}
                      </span>
                    </span>
                    <Arrow className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
