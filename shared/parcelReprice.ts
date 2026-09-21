/**
 * What happened to a parcel's price when somebody corrected it.
 *
 * The owner, 2026-09-21: a parcel is entered in Quick Register with the wrong
 * weight. The mistake is spotted, the weight is corrected — and the price does
 * not move. "I am forced to delete it and register it again."
 *
 * The edit does reprice, and has since `resolveParcelCost` was written. But it
 * refuses in three cases, and in all three it refused in silence:
 *
 *   - the parcel has already been charged to the customer's account, which
 *     happens the moment it enters a priced batch (his own 2026-09-09 rule),
 *     and an edit must not move a debt behind anybody's back;
 *   - the parcel has no owner yet, so there is no rate to price it at — that
 *     belongs to claiming it, which prices and charges properly;
 *   - no rate could be resolved at all: the batch has no price and no route
 *     rule covers it, and writing zero over a real price is worse than
 *     leaving it.
 *
 * Silence is what made it look broken. So the decision is made here, once,
 * and says what it did in a sentence the person who made the correction can
 * read. The server obeys it — it writes the new price only for `repriced` —
 * and the screen shows the same sentence.
 *
 * Pure: no database, no money. It decides what happened, not what is owed.
 */

export type RepriceOutcome =
  /** The stored price was worked out again and it changed. */
  | "repriced"
  /** Worked out again, and it came to the same figure. */
  | "unchanged"
  /** No rate to price it at — the stored figure is left alone. */
  | "no_rate"
  /** No owner yet: claiming the parcel is what prices it. */
  | "unclaimed"
  /** Already on the customer's account; an edit does not move a debt. */
  | "charged"
  /** Nothing behind the price moved, so nothing was asked. */
  | "untouched";

export interface RepriceReport {
  outcome: RepriceOutcome;
  /** What the parcel was priced at before the edit. */
  wasUsd: number | null;
  /** What it is priced at after it — the same figure unless `repriced`. */
  nowUsd: number | null;
}

export interface RepriceFacts {
  isUnclaimed?: boolean | null;
  isCharged?: boolean | null;
  /** The stored price before the edit. */
  wasUsd?: string | number | null;
  /**
   * What the resolver came to now. Undefined or null means it could not
   * answer — no rate — which is never written over a price that exists.
   */
  resolvedUsd?: string | number | null;
}

const money = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : null;
};

/** The same figure, to the cent. */
const same = (a: number | null, b: number | null): boolean =>
  a !== null && b !== null && Math.abs(a - b) < 0.005;

/**
 * Decide what the edit did to the price.
 *
 * Only `repriced` means the stored figure may be written. Everything else
 * leaves it exactly as it was.
 */
export function repriceReport(facts: RepriceFacts): RepriceReport {
  const wasUsd = money(facts.wasUsd);

  if (facts.isUnclaimed) return { outcome: "unclaimed", wasUsd, nowUsd: wasUsd };
  if (facts.isCharged) return { outcome: "charged", wasUsd, nowUsd: wasUsd };

  const resolved = money(facts.resolvedUsd);
  if (resolved === null) return { outcome: "no_rate", wasUsd, nowUsd: wasUsd };
  if (same(resolved, wasUsd)) return { outcome: "unchanged", wasUsd, nowUsd: wasUsd };
  return { outcome: "repriced", wasUsd, nowUsd: resolved };
}

/** True when the server should write the new figure. */
export function shouldStoreNewPrice(report: RepriceReport): boolean {
  return report.outcome === "repriced" && report.nowUsd !== null;
}

/** How loudly the screen says it: a correction that worked, or one that did not. */
export function repriceIsGood(report: RepriceReport): boolean {
  return report.outcome === "repriced" || report.outcome === "unchanged";
}

export interface RepriceWords {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

const usd = (amount: number | null): string => (amount === null ? "—" : `$${amount.toFixed(2)}`);

/**
 * One sentence for the person who corrected the parcel. Digits stay 0-9 and
 * the figures are written the same way in every language.
 */
export function repriceWords(report: RepriceReport): RepriceWords | null {
  const was = usd(report.wasUsd);
  const now = usd(report.nowUsd);

  switch (report.outcome) {
    case "repriced":
      return {
        ku: `نرخ نوێ کرایەوە: لە ${was} بۆ ${now}`,
        en: `Repriced: ${was} → ${now}`,
        ar: `أُعيد تسعيره: من ${was} إلى ${now}`,
        zh: `已重新计价：${was} → ${now}`,
      };
    case "unchanged":
      return {
        ku: `نرخ هەر ${now} مایەوە`,
        en: `The price is still ${now}`,
        ar: `السعر بقي ${now}`,
        zh: `价格仍为 ${now}`,
      };
    case "no_rate":
      return {
        ku: "نرخ نەگۆڕا — ڕێژەی نرخ بۆ ئەم پاکەتە نەدۆزرایەوە. نرخی باچەکە دابنێ، ئینجا دەستکاری پاشەکەوت بکە.",
        en: "Not repriced — no rate for this parcel yet. Give its batch a price, then save the edit again.",
        ar: "لم يُعد تسعيره — لا يوجد سعر لهذا الطرد بعد. ضع سعر الدفعة ثم احفظ التعديل مرة أخرى.",
        zh: "未重新计价 — 该包裹尚无费率。先给批次定价，然后再保存修改。",
      };
    case "unclaimed":
      return {
        ku: "ئەم پاکەتە بێ خاوەنە — نرخی بۆ دادەنرێت کاتێک کڕیارەکەی دیاری دەکرێت (خاوەنداری).",
        en: "This parcel has no owner yet — it is priced when it is claimed by a customer.",
        ar: "هذا الطرد بلا صاحب — يُسعّر عند إسناده إلى زبون.",
        zh: "该包裹尚无归属 — 认领给客户时才会计价。",
      };
    case "charged":
      return {
        ku: `نرخ نەگۆڕا — ئەم پاکەتە پێشتر بە ${was} خراوەتە سەر حسابی کڕیار. دەستکاری قەرزی حساب ناگۆڕێت.`,
        en: `Not repriced — the customer was already charged ${was} for this parcel. An edit does not move a debt.`,
        ar: `لم يُعد تسعيره — سبق أن حُمّل الزبون ${was} عن هذا الطرد. التعديل لا يغيّر الدين.`,
        zh: `未重新计价 — 该包裹已向客户计费 ${was}。修改不会改动欠款。`,
      };
    case "untouched":
    default:
      return null;
  }
}
