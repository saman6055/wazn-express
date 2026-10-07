import type { ReactNode } from "react";
import { Archive, CalendarCheck, CalendarRange, ChevronLeft, ChevronRight, Package, Wallet, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/CopyButton";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import { customerCodeOnly } from "@shared/customerCode";
import type { BoxOverview, PaidWindow, ReceivedSummary } from "@shared/boxOverview";

/**
 * The figures on top of the delivery page — each one the count of a list a
 * press opens (shared/boxOverview says why, in the owner's words).
 *
 * Two sides: what is not paid yet, and the money taken today, this week and
 * ever. Every figure is for ALL boxes, not the twenty on the screen, and the
 * amounts are the payment screen's own, so the boxes opened one by one add up
 * to the card. Somebody who may not see every account's money gets the
 * counts and the same links, without the dollars (the server leaves them out).
 */

type Words = { ku: string; en: string; ar: string; zh: string };

const BOXES: Words = { ku: "بۆکس", en: "boxes", ar: "صندوق", zh: "个箱子" };
const CUSTOMERS: Words = { ku: "کڕیار", en: "customers", ar: "عميل", zh: "位客户" };

const RECEIVED: Record<PaidWindow, { icon: LucideIcon; label: Words; hint?: Words; opens: Words }> = {
  today: {
    icon: CalendarCheck,
    label: { ku: "ئەمڕۆ وەرگیرا", en: "Received today", ar: "استُلم اليوم", zh: "今日已收" },
    opens: { ku: "ئەو بۆکسانەی ئەمڕۆ پارەیان وەرگیراوە", en: "Boxes receipted today", ar: "الصناديق التي استُلم مبلغها اليوم", zh: "今日已收款的箱子" },
  },
  week: {
    icon: CalendarRange,
    label: { ku: "ئەم هەفتەیە وەرگیرا", en: "Received this week", ar: "استُلم هذا الأسبوع", zh: "本周已收" },
    hint: { ku: "لە شەممەوە", en: "from Saturday", ar: "من السبت", zh: "周六起" },
    opens: { ku: "ئەو بۆکسانەی ئەم هەفتەیە پارەیان وەرگیراوە", en: "Boxes receipted this week", ar: "الصناديق التي استُلم مبلغها هذا الأسبوع", zh: "本周已收款的箱子" },
  },
  all: {
    icon: Archive,
    label: { ku: "کۆی وەرگیراو", en: "Received in all", ar: "إجمالي المستلم", zh: "累计已收" },
    hint: { ku: "هەموو کات", en: "all time", ar: "كل الوقت", zh: "全部时间" },
    opens: { ku: "هەموو ئەو بۆکسانەی پارەیان وەرگیراوە", en: "Every box that has been receipted", ar: "كل الصناديق التي استُلم مبلغها", zh: "所有已收款的箱子" },
  },
};

/** The sentence over the list when one of the "received" cards narrowed it. */
export function paidWindowTitle(window: PaidWindow): Words {
  return RECEIVED[window].opens;
}

interface DeliveryStatsProps {
  overview: BoxOverview | undefined;
  isLoading: boolean;
  /** The received window the list is narrowed to, if any: its card stays lit. */
  activeWindow: PaidWindow | null;
  onShowUnpaid: () => void;
  onOpenBox: (boxId: number) => void;
  onShowPaid: (window: PaidWindow) => void;
}

interface TileProps {
  testId: string;
  icon: LucideIcon;
  tone: "red" | "amber" | "emerald";
  label: string;
  hint?: string;
  value: ReactNode;
  lines: ReactNode[];
  onPress?: () => void;
  active?: boolean;
  className?: string;
  children?: ReactNode;
}

const TONE: Record<TileProps["tone"], { box: string; ink: string }> = {
  red: { box: "bg-red-100 dark:bg-red-900/30", ink: "text-red-600 dark:text-red-400" },
  amber: { box: "bg-amber-100 dark:bg-amber-900/30", ink: "text-amber-600 dark:text-amber-400" },
  emerald: { box: "bg-emerald-100 dark:bg-emerald-900/30", ink: "text-emerald-600 dark:text-emerald-400" },
};

function Tile({ testId, icon: Icon, tone, label, hint, value, lines, onPress, active, className, children }: TileProps) {
  const { language } = useTranslation();
  const Arrow = language === "ku" || language === "ar" ? ChevronLeft : ChevronRight;
  const shown = lines.filter(Boolean);
  // Stacked, not side by side: five of these sit in a row on a laptop, and a
  // figure squeezed beside its icon is a figure nobody can read.
  const body = (
    <>
      <span className="flex items-start gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE[tone].box)}>
          <Icon className={cn("h-4 w-4", TONE[tone].ink)} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm leading-tight text-muted-foreground">
          <span className="block">{label}</span>
          {hint && <span className="block text-xs">{hint}</span>}
        </span>
        {/* On a phone the tile is 150px wide: the words need the room more than the arrow does. */}
        {onPress && <Arrow className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />}
      </span>
      <span className="mt-2 block text-2xl font-bold tracking-tight tabular-nums">{value}</span>
      {shown.map((line, i) => (
        <span key={i} className="block text-xs text-muted-foreground">{line}</span>
      ))}
    </>
  );
  return (
    <Card
      data-testid={testId}
      className={cn("gap-0 overflow-hidden p-0", active && "ring-2 ring-emerald-500/70", className)}
    >
      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          className="flex w-full flex-1 flex-col p-4 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        <div className="flex w-full flex-1 flex-col p-4">{body}</div>
      )}
      {children}
    </Card>
  );
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5";
/** The first card is two wide until there is room for five across, so no row is left with a gap. */
const FIRST = "col-span-2 xl:col-span-1";

export function DeliveryStats({ overview, isLoading, activeWindow, onShowUnpaid, onOpenBox, onShowPaid }: DeliveryStatsProps) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const money = (usd: number) => <bdi dir="ltr">{fmtUsd(usd)}</bdi>;

  if (isLoading || !overview) {
    return (
      <div className={GRID} data-testid="delivery-stats-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className={cn("flex flex-row items-center gap-3 p-4 animate-pulse", i === 0 && FIRST)}>
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-6 w-16 rounded bg-muted" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const { unpaid, received } = overview;
  const top = unpaid.top;
  const topCode = top ? customerCodeOnly(top.customerCode ?? "") : "";

  const receivedTile = (window: PaidWindow) => {
    const r: ReceivedSummary = received[window];
    const words = RECEIVED[window];
    return (
      <Tile
        key={window}
        testId={`stat-received-${window}`}
        icon={words.icon}
        tone="emerald"
        label={L(words.label)}
        hint={words.hint ? L(words.hint) : undefined}
        value={r.usd === null ? <>{r.boxes} <span className="text-sm font-medium">{L(BOXES)}</span></> : money(r.usd)}
        lines={[
          r.usd === null ? null : <>{r.boxes} {L(BOXES)}</>,
          r.discountUsd !== null && r.discountUsd > 0.005
            ? <>{L({ ku: "داشکاندن", en: "discount", ar: "خصم", zh: "折扣" })} {money(r.discountUsd)}</>
            : null,
        ]}
        onPress={r.boxes > 0 ? () => onShowPaid(window) : undefined}
        active={activeWindow === window}
      />
    );
  };

  return (
    <div className={GRID} data-testid="delivery-stats">
      <Tile
        testId="stat-unpaid"
        className={FIRST}
        icon={Wallet}
        tone="red"
        label={L({ ku: "پارەی نەدراو", en: "Not paid yet", ar: "غير مدفوع بعد", zh: "未收款" })}
        value={unpaid.usd === null ? <>{unpaid.boxes} <span className="text-sm font-medium">{L(BOXES)}</span></> : money(unpaid.usd)}
        lines={[
          <>
            {unpaid.usd === null ? null : <>{unpaid.boxes} {L(BOXES)} · </>}
            {unpaid.customers} {L(CUSTOMERS)}
          </>,
          unpaid.boxes > 0 && unpaid.oldestDays !== null
            ? L({
                ku: `کۆنترین: ${unpaid.oldestDays} ڕۆژ`,
                en: `oldest: ${unpaid.oldestDays} days`,
                ar: `الأقدم: ${unpaid.oldestDays} يوماً`,
                zh: `最久：${unpaid.oldestDays} 天`,
              })
            : null,
        ]}
        onPress={unpaid.boxes > 0 ? onShowUnpaid : undefined}
      />

      <Tile
        testId="stat-top-box"
        icon={Package}
        tone="amber"
        label={L({ ku: "زۆرترین پارە لە یەک بۆکس", en: "The box that owes most", ar: "أكثر صندوق مبلغاً", zh: "欠款最多的箱子" })}
        value={!top ? "—" : top.usd === null ? <bdi dir="ltr" className="font-mono text-base">{top.boxCode}</bdi> : money(top.usd)}
        lines={[top?.customerName ?? null]}
        onPress={top ? () => onOpenBox(top.boxId) : undefined}
      >
        {top && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <bdi dir="ltr" className="font-mono">{top.boxCode}</bdi>
              <CopyButton value={top.boxCode} />
            </span>
            {topCode && (
              <span className="inline-flex items-center gap-1">
                <bdi dir="ltr" className="font-mono">{topCode}</bdi>
                <CopyButton value={topCode} />
              </span>
            )}
          </div>
        )}
      </Tile>

      {receivedTile("today")}
      {receivedTile("week")}
      {receivedTile("all")}
    </div>
  );
}
