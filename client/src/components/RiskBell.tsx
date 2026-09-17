import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCircle2, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/numericDate";
import { soundManager } from "@/lib/soundManager";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RISK_CHIP, RISK_DOT } from "@/lib/riskStyle";
import { RISK_LEVEL_LABEL, RISK_LEVELS, worstLevel } from "@shared/riskRules";
import {
  AUDIT_ROLES,
  describeRisk,
  isAuditRisk,
  localDay,
  markSeen,
  parseSeen,
  riskGate,
  riskGroup,
  riskPath,
  shouldChime,
  shouldFlash,
  type RiskGroup,
  type RiskItem,
  type RiskSeen,
} from "@shared/riskBell";

type Words = { ku: string; en: string; ar: string; zh: string };

/** Per person, per browser: what they had seen when they last opened the bell. */
const seenKey = (userId: number) => `wazn-risk-bell-seen:${userId}`;
/** Per person, per browser: what the bell last chimed about. */
const chimedKey = (userId: number) => `wazn-risk-bell-chimed:${userId}`;
/** Per person, per browser: the bell kept quiet. */
const mutedKey = (userId: number) => `wazn-risk-bell-muted:${userId}`;
/** Shared by every open tab, so only one of them chimes. */
const CHIME_LOCK = "wazn-risk-bell-chime-lock";

function readMark(key: string): RiskSeen | null {
  try {
    return parseSeen(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readMuted(userId: number): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(mutedKey(userId)) === "1";
  } catch {
    return false;
  }
}

const BADGE: Record<"critical" | "high" | "notice", string> = {
  critical: "bg-red-600",
  high: "bg-amber-500",
  notice: "bg-sky-500",
};

const GROUP_TITLE: Record<RiskGroup, Words> = {
  risks: { ku: "مەترسییەکان", en: "Risks", ar: "المخاطر", zh: "风险" },
  incomplete: { ku: "هەڵە و ناتەواوییەکان", en: "Errors and gaps", ar: "أخطاء ونواقص", zh: "错误与缺失" },
};

/**
 * The system's bell — its sensor.
 *
 * Owner, 2026-09-16: a bell for the whole system, its risks by size, there
 * every day, flashing. 2026-09-17: make it stronger — anything incomplete, any
 * error, any risk shows there, and a soft chime for the very big ones, never
 * annoying, never repeated.
 *
 * So it holds the standing risks and, beside them, the auditor's findings and
 * empty boxes, each group under its own heading. It flashes (and rings) while
 * a critical or high risk has not been looked at today; it chimes once for a
 * critical risk that is new, grown or newly critical — once a day at most, one
 * tab only, and not at all when the person has muted it or switched sounds off.
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
  const role = String((user as { role?: string } | null)?.role ?? "");

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<RiskSeen | null>(() => (userId ? readMark(seenKey(userId)) : null));
  const [muted, setMuted] = useState(() => readMuted(userId));
  useEffect(() => {
    setSeen(userId ? readMark(seenKey(userId)) : null);
    setMuted(readMuted(userId));
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

  const items: RiskItem[] = (risksQ.data ?? []).filter(
    (item) => canViewPath(riskGate(item.id)) && (!isAuditRisk(item.id) || AUDIT_ROLES.includes(role)),
  );
  const today = localDay(new Date());
  const flashing = shouldFlash(items, seen, today);
  const worst = worstLevel(items.map((item) => item.level));
  const Arrow = isRTL ? ChevronLeft : ChevronRight;
  const signature = items.map((item) => `${item.id}:${item.level}:${item.count}`).join("|");

  // The chime: a critical risk that is new since the person last looked and
  // since the bell last chimed. One tab claims it; the others stay quiet.
  useEffect(() => {
    if (!userId || muted || items.length === 0) return;
    if (!shouldChime(items, seen, readMark(chimedKey(userId)), today)) return;
    try {
      const now = Date.now();
      if (now - Number(localStorage.getItem(CHIME_LOCK) || 0) < 15_000) return;
      localStorage.setItem(CHIME_LOCK, String(now));
      localStorage.setItem(chimedKey(userId), JSON.stringify(markSeen(items, today)));
    } catch {
      // Storage refused: without a record it would chime on every refresh — stay quiet.
      return;
    }
    soundManager.playRiskChime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, seen, muted, userId, today]);

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

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(mutedKey(userId), next ? "1" : "0");
    } catch {
      /* kept for this visit only */
    }
  };

  const bellLabel = L({ ku: "ئاگادارییەکانی سیستەم", en: "System alerts", ar: "تنبيهات النظام", zh: "系统提醒" });
  const counts = RISK_LEVELS.map((level) => ({ level, n: items.filter((item) => item.level === level).length })).filter((c) => c.n > 0);

  const row = (item: RiskItem) => {
    const { title, detail } = describeRisk(item);
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate(riskPath(item.id));
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
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9 rounded-full", flashing && "bg-red-500/10", className)}
          title={bellLabel}
          aria-label={items.length > 0 ? `${bellLabel} (${items.length})` : bellLabel}
          data-flashing={flashing ? "true" : undefined}
        >
          {flashing && (
            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-red-500/40 motion-reduce:animate-none" />
          )}
          <Bell className={cn("relative h-5 w-5", flashing && "wazn-bell-ring text-red-600 dark:text-red-400")} />
          {items.length > 0 && worst && (
            <span
              dir="ltr"
              className={cn(
                "absolute -top-1 -end-1 min-w-[1.25rem] rounded-full px-1 text-center text-[11px] font-bold leading-[1.25rem] text-white shadow-sm ring-2 ring-background",
                BADGE[worst],
                flashing && "animate-pulse motion-reduce:animate-none",
              )}
            >
              {items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)] p-0" dir={isRTL ? "rtl" : "ltr"}>
        <div className="border-b px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {L({ ku: "هەستەوەری سیستەم", en: "System sensor", ar: "مستشعر النظام", zh: "系统监测" })}
            </p>
            <div className="flex items-center gap-2">
              {risksQ.dataUpdatedAt > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  <bdi dir="ltr">{fmtTime(new Date(risksQ.dataUpdatedAt))}</bdi>
                </span>
              )}
              <button
                type="button"
                onClick={toggleMuted}
                aria-pressed={!muted}
                data-testid="risk-bell-sound"
                className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {muted
                  ? L({ ku: "بێدەنگ", en: "Muted", ar: "صامت", zh: "静音" })
                  : L({ ku: "دەنگ", en: "Sound", ar: "صوت", zh: "声音" })}
              </button>
            </div>
          </div>
          {counts.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
              {counts.map((c) => (
                <span key={c.level} className={cn("rounded-full px-1.5 py-px font-semibold", RISK_CHIP[c.level])}>
                  <bdi dir="ltr">{c.n}</bdi> {L(RISK_LEVEL_LABEL[c.level])}
                </span>
              ))}
            </p>
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
          <div className="max-h-[65vh] overflow-y-auto">
            {(["risks", "incomplete"] as const).map((group) => {
              const list = items.filter((item) => riskGroup(item.id) === group);
              if (list.length === 0) return null;
              return (
                <section key={group}>
                  <p className="bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">{L(GROUP_TITLE[group])}</p>
                  <ul className="divide-y">{list.map(row)}</ul>
                </section>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
