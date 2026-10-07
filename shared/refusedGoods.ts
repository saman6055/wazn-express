/**
 * Refused goods — bought with the company's money, wanted by nobody.
 *
 * Owner, 2026-10-07: "some parcels are refused — the shipment was late, or
 * the customer was fake, or does not answer the phone, or wants three of the
 * five pieces, or the admin ordered it by mistake, or ordered it twice. There
 * is no place for them in the system, yet they are a loss until they are sold
 * for less, or not sold at all. And they still have their buying cost."
 *
 * What happens, in order, and all of it said on the books:
 *
 *   1. The refused pieces come off the customer's account — they no longer
 *      owe for what they did not take.
 *   2. If that leaves the customer's own money in our hands (an advance, or a
 *      payment already made), the main admin decides how much the company
 *      keeps. The owner: when the customer simply does not want it, the
 *      advance is not returned; when the shipment was very late, refusing is
 *      their right and it is. So the reason suggests an answer and never
 *      gives it.
 *   3. The pieces become the company's own stock, at what they cost.
 *
 * And it is a LOSS from that day. The owner, the same evening: "it must not
 * stay on the bad or refusing customer's account — it comes onto the
 * company's own loss"; goods sitting in the store are "dead goods that have
 * taken money". So the cost leaves profit the day of the refusal, and
 * whatever a later sale brings back comes off that loss the day it is sold.
 * A write-off changes nothing more: the cost was already counted.
 *
 * It is found by its tracking number both times — when it is refused and
 * when it is sold — and a sale ends it for good.
 */

export const REFUSAL_REASONS = ["late", "fake_customer", "no_answer", "partial", "changed_mind", "office_mistake", "office_duplicate", "abandoned", "ownerless", "other"] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];
export type RefusalFault = "customer" | "office" | "nobody";

/**
 * The reasons an ORDER is refused for, and the two a PARCEL ends up here by.
 *
 * A parcel is different: the company did not buy it, it only carried it
 * (owner, 2026-10-08: "the freight is a lot beside what the parcel itself is
 * worth, so the customer does not come for it and does not want it" — and
 * "some parcels, you do not know whose they are at all; the cost of carrying
 * them is a loss until the owner appears, and sometimes there never is one").
 * So a parcel has no buying cost: what is lost is the freight.
 */
export const ORDER_REFUSAL_REASONS = ["late", "fake_customer", "no_answer", "partial", "changed_mind", "office_mistake", "office_duplicate", "other"] as const satisfies readonly RefusalReason[];
export const PARCEL_REASONS = ["abandoned", "ownerless"] as const satisfies readonly RefusalReason[];

type Words = { ku: string; en: string; ar: string; zh: string };

export const REFUSAL_REASON_WORDS: Record<RefusalReason, Words> = {
  late: { ku: "بارەکە زۆر دواکەوت", en: "The shipment was very late", ar: "تأخرت الشحنة كثيراً", zh: "货物严重延误" },
  fake_customer: { ku: "کڕیاری فەیک", en: "Fake customer", ar: "عميل وهمي", zh: "虚假客户" },
  no_answer: { ku: "وەڵامی تەلەفۆن ناداتەوە", en: "Does not answer the phone", ar: "لا يرد على الهاتف", zh: "不接电话" },
  partial: { ku: "تەنها بەشێکی دەوێت", en: "Wants only part of it", ar: "يريد جزءاً فقط", zh: "只要一部分" },
  changed_mind: { ku: "کڕیار نایەوێت", en: "The customer no longer wants it", ar: "العميل لم يعد يريده", zh: "客户不要了" },
  office_mistake: { ku: "ئادمین بە هەڵە داوای کردووە", en: "Ordered by the office by mistake", ar: "طلبه المكتب بالخطأ", zh: "办公室误订" },
  office_duplicate: { ku: "ئادمین دوو جار داوای کردووە", en: "Ordered twice by the office", ar: "طلبه المكتب مرتين", zh: "办公室重复下单" },
  abandoned: { ku: "کرێی گواستنەوەی زۆرە، کڕیار پاکەتەکەی بەجێ هێشت", en: "The freight was too much; the customer left the parcel", ar: "أجرة الشحن مرتفعة، ترك العميل الطرد", zh: "运费过高，客户弃货" },
  ownerless: { ku: "پاکەتی بێ خاوەن", en: "A parcel with no owner", ar: "طرد بلا صاحب", zh: "无主包裹" },
  other: { ku: "هۆکارێکی تر — بینووسە", en: "Another reason — write it", ar: "سبب آخر — اكتبه", zh: "其他 — 请写明" },
};

/** Whose side each reason is on — what the loss report groups by. */
export const REFUSAL_FAULT: Record<RefusalReason, RefusalFault> = {
  late: "office",
  office_mistake: "office",
  office_duplicate: "office",
  fake_customer: "customer",
  no_answer: "customer",
  partial: "customer",
  changed_mind: "customer",
  abandoned: "customer",
  ownerless: "nobody",
  other: "customer",
};

/**
 * Does the company keep the customer's money by default? Only a suggestion:
 * the dialog shows it and the main admin answers every time.
 */
export function suggestKeep(reason: RefusalReason): boolean {
  return REFUSAL_FAULT[reason] === "customer" && reason !== "other";
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export interface RefusalFacts {
  /** Pieces on the order, and how many of them are refused. */
  orderQuantity: number;
  refuseQuantity: number;
  /** Per piece: what the customer was charged, and what the company paid. */
  unitSellUsd: number;
  unitBuyUsd: number;
  /** Is the order on the customer's account at all? */
  charged: boolean;
  /** The customer's balance now. Positive is owed to us. */
  balanceUsd: number;
}

export interface RefusalPlan {
  /** Every piece refused: the order ends. Otherwise it goes on, smaller. */
  whole: boolean;
  remainingQuantity: number;
  /** What comes off the customer's account. */
  takenOffUsd: number;
  /** What the refused pieces cost — the figure the stock stands at. */
  costUsd: number;
  /** The customer's balance once the pieces are off, before anything is kept. */
  balanceAfterUsd: number;
  /** The customer's own money that would be in our hands: the most that can be kept. */
  keepableUsd: number;
}

export function planRefusal(f: RefusalFacts): RefusalPlan {
  const orderQuantity = Math.max(1, Math.round(f.orderQuantity) || 1);
  const refuseQuantity = Math.min(orderQuantity, Math.max(1, Math.round(f.refuseQuantity) || 1));
  const takenOffUsd = f.charged ? cents(f.unitSellUsd * refuseQuantity) : 0;
  const balanceAfterUsd = cents(f.balanceUsd - takenOffUsd);
  return {
    whole: refuseQuantity >= orderQuantity,
    remainingQuantity: orderQuantity - refuseQuantity,
    takenOffUsd,
    costUsd: cents(f.unitBuyUsd * refuseQuantity),
    balanceAfterUsd,
    keepableUsd: cents(Math.max(0, -balanceAfterUsd)),
  };
}

/** What is kept can be nothing, or anything up to the customer's money in our hands. */
export function clampKeep(keepUsd: number, plan: RefusalPlan): number {
  return cents(Math.min(plan.keepableUsd, Math.max(0, Number(keepUsd) || 0)));
}

// ---------------------------------------------------------------------------
// What a stock row does to the books
// ---------------------------------------------------------------------------

export type StockStatus = "held" | "sold" | "written_off";

export interface StockRow {
  status: StockStatus;
  costUsd: number;
  keptUsd: number;
  soldPriceUsd: number | null;
  /** What carrying it cost — a parcel's whole loss, and part of an order's story. */
  freightCostUsd?: number | null;
}

/** How it ended: nothing yet, a profit, or a loss. Kept money is not in this figure. */
export function stockOutcomeUsd(row: StockRow): number {
  if (row.status === "sold") return cents((row.soldPriceUsd ?? 0) - row.costUsd);
  if (row.status === "written_off") return cents(-row.costUsd);
  return 0;
}

/**
 * The whole story of one refusal in money: what the company kept, plus how
 * the goods ended. This is what the loss report totals.
 */
export function stockResultUsd(row: StockRow): number {
  return cents(row.keptUsd + stockOutcomeUsd(row));
}

/**
 * What a piece has cost the company so far: its cost, less the customer's
 * money that was kept, less what a sale brought back. Never below nothing on
 * a held piece — it is the figure shown in red beside it.
 */
export function stockLossSoFarUsd(row: StockRow): number {
  return cents(row.costUsd + (Number(row.freightCostUsd) || 0) - row.keptUsd - (row.status === "sold" ? (row.soldPriceUsd ?? 0) : 0));
}

/**
 * What carrying one parcel cost: the batch's real rate (shared/batchCost)
 * times the weight or volume the carrier is paid on. Zero while the batch
 * has no cost recorded — an unknown is not shown as a figure.
 */
export function parcelFreightCostUsd(facts: { unit: "kg" | "cbm"; ratePerUnit: number; weightKg: number; lengthCm: number; widthCm: number; heightCm: number; volumeCbm: number; divisor: number }): number {
  const cm3 = Math.max(0, facts.lengthCm) * Math.max(0, facts.widthCm) * Math.max(0, facts.heightCm);
  if (!(facts.ratePerUnit > 0)) return 0;
  if (facts.unit === "cbm") return cents(facts.ratePerUnit * (facts.volumeCbm > 0 ? facts.volumeCbm : cm3 / 1_000_000));
  const divisor = facts.divisor > 0 ? facts.divisor : 6000;
  return cents(facts.ratePerUnit * Math.max(Math.max(0, facts.weightKg), cm3 / divisor));
}

/** Goods still on our hands, at what they cost — shown beside the totals, already counted as a loss. */
export function stockHeldUsd(rows: readonly StockRow[]): number {
  return cents(rows.filter((r) => r.status === "held").reduce((s, r) => s + r.costUsd, 0));
}

/** Held this long, a piece of stock wants a decision: sell it cheaper or write it off. */
export const STOCK_OLD_DAYS = 60;

export function refusalLedgerReason(orderCode: string, reason: RefusalReason, quantity: number): string {
  return `کاڵا ڕەتکرایەوە — ${REFUSAL_REASON_WORDS[reason].ku} (${orderCode}، ${quantity} دانە)`;
}

export function abandonLedgerReason(tracking: string): string {
  return `پاکەت بەجێ هێڵرا — کڕیار وەریناگرێت، کرێی گواستنەوەکەی لەسەری لابرا (${tracking})`;
}

export function keptLedgerReason(orderCode: string): string {
  return `قەرەبووی ڕەتکردنەوە — پارەی کڕیار لای شەریکە مایەوە (${orderCode})`;
}

export function stockSaleLedgerText(productName: string | null, orderCode: string | null): string {
  return `فرۆشتنی کاڵای ماوە — ${productName ?? "کاڵا"}${orderCode ? ` (${orderCode})` : ""}`;
}
