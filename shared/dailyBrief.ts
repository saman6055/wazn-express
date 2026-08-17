/**
 * The morning brief: everything the system knows, ranked by what to do about it.
 *
 * A super admin has a hundred screens and a few minutes. The dashboards
 * already show figures, but a figure does not say whether it is good, whether
 * it moved, or whether anybody should act — so reading them is a tour of the
 * building rather than a briefing, and the things that matter most are the
 * ones no screen was built to show at all.
 *
 * This turns the whole system into a short ranked list. Each item says what it
 * is, how it moved, and where to look. Nothing here writes, computes a charge,
 * or changes a record: it reads, compares, and reports.
 *
 * Four rules decide what earns a place, and they are the difference between a
 * brief somebody reads every morning and one they stop opening after a week.
 *
 *   1. A change is only worth saying if it is large enough to act on. A three
 *      percent move is weather. Below the threshold it does not appear at all,
 *      rather than appearing as a grey line nobody reads past.
 *
 *   2. Going from nothing to something is not "up ∞%". It is stated as a fact
 *      in words, because a percentage against zero is arithmetic nonsense that
 *      makes the whole report look automated and unread.
 *
 *   3. Wins are reported. A brief that only ever carries bad news gets avoided,
 *      and then the bad news is not read either.
 *
 *   4. When nothing is wrong it says so, plainly and briefly. A daily report
 *      that always finds something is padding, and padding teaches skimming.
 */

export interface Localised {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

/** What kind of thing this is, which decides how it is drawn and where it sits. */
export type SignalKind = "risk" | "win" | "change" | "note";

/** How loudly to say it. */
export type SignalWeight = "urgent" | "notable" | "quiet";

export interface Delta {
  direction: "up" | "down" | "flat" | "from_zero" | "to_zero";
  /** Whole percent. Meaningless — and absent — when the direction is from_zero. */
  percent?: number;
  before: number;
  after: number;
}

export interface Signal {
  id: string;
  kind: SignalKind;
  weight: SignalWeight;
  title: Localised;
  /** The figure, already formatted by whoever knows the unit. */
  value?: string;
  detail?: Localised;
  delta?: Delta;
  /** Where to go and look. A figure that cannot be traced is a figure nobody trusts. */
  path?: string;
}

/** Under this, a movement is weather rather than news. */
export const MOVEMENT_THRESHOLD_PERCENT = 10;

/**
 * How one figure moved against another.
 *
 * Zero is handled in words rather than as a percentage, both ways round.
 * "Up from nothing" and "down to nothing" are the two most interesting
 * movements a business figure makes, and both are undefined as arithmetic.
 */
export function compare(before: number, after: number): Delta {
  if (before === 0 && after === 0) return { direction: "flat", percent: 0, before, after };
  if (before === 0) return { direction: "from_zero", before, after };
  if (after === 0) return { direction: "to_zero", before, after };

  const percent = Math.round(((after - before) / Math.abs(before)) * 100);
  if (percent === 0) return { direction: "flat", percent: 0, before, after };

  return { direction: percent > 0 ? "up" : "down", percent: Math.abs(percent), before, after };
}

/** Is this movement big enough to put in front of somebody? */
export function worthSaying(delta: Delta, threshold = MOVEMENT_THRESHOLD_PERCENT): boolean {
  if (delta.direction === "flat") return false;
  if (delta.direction === "from_zero" || delta.direction === "to_zero") return true;
  return (delta.percent ?? 0) >= threshold;
}

/**
 * How a movement reads.
 *
 * `higherIsBetter` is passed rather than guessed: revenue rising is a win and
 * debt rising is a risk, and a brief that congratulates the owner on growing
 * debt would be worse than silent.
 */
export function describeDelta(delta: Delta, higherIsBetter: boolean): { kind: SignalKind; text: Localised } {
  const good =
    delta.direction === "up" || delta.direction === "from_zero" ? higherIsBetter : !higherIsBetter;
  const kind: SignalKind = delta.direction === "flat" ? "note" : good ? "win" : "risk";

  if (delta.direction === "from_zero") {
    return {
      kind,
      text: {
        ku: `لە سفرەوە بۆ ${delta.after}`,
        en: `from nothing to ${delta.after}`,
        ar: `من صفر إلى ${delta.after}`,
        zh: `从零升至 ${delta.after}`,
      },
    };
  }

  if (delta.direction === "to_zero") {
    return {
      kind,
      text: {
        ku: `لە ${delta.before}ـەوە بۆ سفر`,
        en: `from ${delta.before} to nothing`,
        ar: `من ${delta.before} إلى صفر`,
        zh: `从 ${delta.before} 降至零`,
      },
    };
  }

  const p = delta.percent ?? 0;
  if (delta.direction === "flat") {
    return {
      kind: "note",
      text: { ku: "وەکو خۆی", en: "unchanged", ar: "دون تغيير", zh: "无变化" },
    };
  }

  const up = delta.direction === "up";
  return {
    kind,
    text: {
      ku: up ? `${p}٪ زیادی کردووە` : `${p}٪ کەمی کردووە`,
      en: up ? `up ${p}%` : `down ${p}%`,
      ar: up ? `ارتفاع ${p}%` : `انخفاض ${p}%`,
      zh: up ? `上升 ${p}%` : `下降 ${p}%`,
    },
  };
}

const WEIGHT_RANK: Record<SignalWeight, number> = { urgent: 0, notable: 1, quiet: 2 };
const KIND_RANK: Record<SignalKind, number> = { risk: 0, change: 1, win: 2, note: 3 };

/**
 * The order they are read in.
 *
 * Weight first, then kind. A quiet risk sits below an urgent one but above a
 * notable win — because somebody skimming the first five lines must find
 * everything that needs a decision, and nothing that does not.
 */
export function rankSignals(signals: readonly Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    if (WEIGHT_RANK[a.weight] !== WEIGHT_RANK[b.weight]) return WEIGHT_RANK[a.weight] - WEIGHT_RANK[b.weight];
    if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    return a.id.localeCompare(b.id);
  });
}

export interface BriefSummary {
  risks: number;
  wins: number;
  changes: number;
  urgent: number;
  /** True when the system looked at everything and found nothing needing a decision. */
  allWell: boolean;
}

export function summarise(signals: readonly Signal[]): BriefSummary {
  const summary: BriefSummary = { risks: 0, wins: 0, changes: 0, urgent: 0, allWell: false };

  for (const s of signals) {
    if (s.kind === "risk") summary.risks += 1;
    if (s.kind === "win") summary.wins += 1;
    if (s.kind === "change") summary.changes += 1;
    if (s.weight === "urgent") summary.urgent += 1;
  }

  summary.allWell = summary.risks === 0 && summary.urgent === 0;
  return summary;
}

/**
 * The single line at the top.
 *
 * Said as a number of things to decide, not as a mood. "Three things need you
 * today" can be acted on; "attention required" cannot.
 */
export function headline(summary: BriefSummary): Localised {
  if (summary.urgent > 0) {
    const n = summary.urgent;
    return {
      ku: `${n} شت هەیە کە ئەمڕۆ پێویستی بە تۆیە`,
      en: n === 1 ? "1 thing needs you today" : `${n} things need you today`,
      ar: `${n} من الأمور تحتاجك اليوم`,
      zh: `${n} 项事务今天需要您处理`,
    };
  }

  if (summary.risks > 0) {
    const n = summary.risks;
    return {
      ku: `هیچی بەپەلە نییە. ${n} شت چاودێری دەوێت.`,
      en: `Nothing urgent. ${n} to keep an eye on.`,
      ar: `لا شيء عاجل. ${n} تحتاج متابعة.`,
      zh: `没有紧急事项。${n} 项需留意。`,
    };
  }

  if (summary.wins > 0) {
    return {
      ku: `هەموو شتێک ڕێکە — و ${summary.wins} شت باشتر بووە`,
      en: `All well — and ${summary.wins} things improved`,
      ar: `كل شيء على ما يرام — و${summary.wins} تحسّنت`,
      zh: `一切正常——并有 ${summary.wins} 项改善`,
    };
  }

  return {
    ku: "هەموو شتێک ڕێکە. هیچ بڕیارێک چاوەڕێت ناکات.",
    en: "All well. Nothing is waiting on a decision.",
    ar: "كل شيء على ما يرام. لا شيء ينتظر قراراً.",
    zh: "一切正常。没有待决事项。",
  };
}

/* ─── the numbers a day is remembered by ─────────────────────────────────── */

/**
 * One day, as the brief needs to remember it.
 *
 * Written once each morning for the day before. Without a stored yesterday
 * there is no "down 12%", and a brief that can only describe today is a
 * dashboard with sentences.
 */
export interface DaySnapshot {
  revenueUsd: number;
  expensesUsd: number;
  parcelsRegistered: number;
  parcelsDelivered: number;
  newCustomers: number;
  kilos: number;
  outstandingDebtUsd: number;
  openBatches: number;
}

export const EMPTY_DAY: DaySnapshot = {
  revenueUsd: 0,
  expensesUsd: 0,
  parcelsRegistered: 0,
  parcelsDelivered: 0,
  newCustomers: 0,
  kilos: 0,
  outstandingDebtUsd: 0,
  openBatches: 0,
};

interface MetricSpec {
  id: string;
  key: keyof DaySnapshot;
  higherIsBetter: boolean;
  title: Localised;
  unit: "usd" | "count" | "kg";
  path?: string;
}

/** What is compared each morning, and which way is good. */
export const METRICS: readonly MetricSpec[] = [
  {
    id: "revenue",
    key: "revenueUsd",
    higherIsBetter: true,
    unit: "usd",
    path: "/reports",
    title: { ku: "داهات", en: "Revenue", ar: "الإيرادات", zh: "收入" },
  },
  {
    id: "expenses",
    key: "expensesUsd",
    higherIsBetter: false,
    unit: "usd",
    path: "/company/expenses",
    title: { ku: "خەرجی", en: "Expenses", ar: "المصاريف", zh: "支出" },
  },
  {
    id: "parcels_registered",
    key: "parcelsRegistered",
    higherIsBetter: true,
    unit: "count",
    path: "/packages/all",
    title: { ku: "پاکەتی تۆمارکراو", en: "Parcels registered", ar: "طرود مسجّلة", zh: "已登记包裹" },
  },
  {
    id: "parcels_delivered",
    key: "parcelsDelivered",
    higherIsBetter: true,
    unit: "count",
    path: "/packages/all",
    title: { ku: "پاکەتی گەیەنراو", en: "Parcels delivered", ar: "طرود مُسلَّمة", zh: "已派送包裹" },
  },
  {
    id: "new_customers",
    key: "newCustomers",
    higherIsBetter: true,
    unit: "count",
    path: "/customers",
    title: { ku: "کڕیاری نوێ", en: "New customers", ar: "عملاء جدد", zh: "新客户" },
  },
  {
    id: "kilos",
    key: "kilos",
    higherIsBetter: true,
    unit: "kg",
    path: "/batches",
    title: { ku: "کیلۆی گواسترا", en: "Kilos shipped", ar: "الكيلوات المشحونة", zh: "已发运公斤" },
  },
  {
    id: "outstanding_debt",
    key: "outstandingDebtUsd",
    higherIsBetter: false,
    unit: "usd",
    path: "/finance/debtors",
    title: { ku: "قەرزی کۆکراوە", en: "Outstanding debt", ar: "الديون المستحقة", zh: "未结欠款" },
  },
];

function format(value: number, unit: MetricSpec["unit"]): string {
  if (unit === "usd") return `$${value.toFixed(2)}`;
  if (unit === "kg") return `${value} kg`;
  return String(value);
}

/**
 * What moved, and by enough to say.
 *
 * Only metrics that crossed the threshold produce a signal. Everything else is
 * left out entirely rather than listed as unchanged — a page of "no change"
 * lines is how a reader learns to skim past the one line that mattered.
 */
export function movementSignals(
  today: DaySnapshot,
  before: DaySnapshot,
  threshold = MOVEMENT_THRESHOLD_PERCENT,
): Signal[] {
  const out: Signal[] = [];

  for (const metric of METRICS) {
    const delta = compare(before[metric.key], today[metric.key]);
    if (!worthSaying(delta, threshold)) continue;

    const described = describeDelta(delta, metric.higherIsBetter);

    out.push({
      id: `movement:${metric.id}`,
      kind: described.kind,
      // A movement is worth reading, not worth waking somebody for. Only the
      // system's own faults and stalled work earn "urgent".
      weight: "notable",
      title: metric.title,
      value: format(today[metric.key], metric.unit),
      detail: described.text,
      delta,
      path: metric.path,
    });
  }

  return out;
}
