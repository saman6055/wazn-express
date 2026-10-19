/**
 * How a box reaches the customer (owner, 2026-10-19).
 *
 * "It matters who takes the box - which of our drivers, which delivery
 * company. Hyper Post, Wasit and Prime, and if there is another one we can
 * add it right there. And nothing is printed until it is said how it reaches
 * the customer." The delivery company's tracking numbers are kept too - one
 * per carton, a box can leave as several - but they never hold the paper up.
 *
 * Read by the box screen, the box list and the server alike, so the rule
 * that stops a print is the rule that explains why.
 */

export type HandoverMode = "pickup" | "driver" | "courier";
export type CarrierKind = "driver" | "courier";

export const HANDOVER_MODES: readonly HandoverMode[] = ["pickup", "driver", "courier"] as const;

type Words = { ku: string; en: string; ar: string; zh: string };

export const HANDOVER_LABELS: Record<HandoverMode, Words> = {
  pickup: { ku: "کڕیار خۆی دێت", en: "Customer collects", ar: "الزبون يستلم بنفسه", zh: "客户自取" },
  driver: { ku: "شۆفێری ئێمە", en: "Our driver", ar: "سائقنا", zh: "我们的司机" },
  courier: { ku: "کۆمپانیای گواستنەوە", en: "Delivery company", ar: "شركة توصيل", zh: "快递公司" },
};

/** Where the money is once the box has gone out and no receipt took it. */
export const MONEY_WITH: Record<HandoverMode, Words> = {
  pickup: { ku: "پارە نەگەیشتووە", en: "Not paid yet", ar: "لم يُدفع بعد", zh: "尚未付款" },
  driver: { ku: "پارەکە لای شۆفێرە", en: "The money is with the driver", ar: "المال مع السائق", zh: "款项在司机处" },
  courier: { ku: "پارەکە لای کۆمپانیای گواستنەوەیە", en: "The money is with the delivery company", ar: "المال مع شركة التوصيل", zh: "款项在快递公司处" },
};

export interface BoxHandover {
  handoverMode?: string | null;
  carrierId?: number | null;
  carrierName?: string | null;
}

/**
 * Why this box may not be printed or sent yet, or null when it may.
 * A way is chosen, and for a driver or a company, which one.
 */
export function handoverProblem(box: BoxHandover | null | undefined): Words | null {
  const mode = box?.handoverMode;
  if (mode !== "pickup" && mode !== "driver" && mode !== "courier") {
    return {
      ku: "سەرەتا دیاری بکە بە چ ڕێگایەک دەگاتە دەستی کڕیار — کڕیار خۆی دێت، شۆفێری ئێمە، یان کۆمپانیای گواستنەوە.",
      en: "First say how the box reaches the customer — they collect it, our driver, or a delivery company.",
      ar: "حدّد أولاً كيف يصل الصندوق إلى الزبون — يستلمه بنفسه، سائقنا، أو شركة توصيل.",
      zh: "请先选择箱子如何送到客户手中——客户自取、我们的司机或快递公司。",
    };
  }
  if (mode !== "pickup" && !String(box?.carrierName ?? "").trim()) {
    return mode === "driver"
      ? { ku: "شۆفێرەکە هەڵبژێرە.", en: "Choose the driver.", ar: "اختر السائق.", zh: "请选择司机。" }
      : { ku: "کۆمپانیای گواستنەوەکە هەڵبژێرە.", en: "Choose the delivery company.", ar: "اختر شركة التوصيل.", zh: "请选择快递公司。" };
  }
  return null;
}

/** The company's tracking numbers as stored (a JSON array), cleaned. */
export function parseCarrierTrackings(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? cleanTrackings(list.map(String)) : [];
  } catch {
    return cleanTrackings(String(raw).split(/[\n,]/));
  }
}

export function cleanTrackings(list: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of list) {
    const v = String(t ?? "").trim().slice(0, 100);
    if (v && !out.includes(v)) out.push(v);
  }
  return out.slice(0, 50);
}

/** A carrier's name as written: trimmed, single-spaced, at most 120. */
export function cleanCarrierName(name: string): string {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** The ones the owner named, offered the first time the list is empty. */
export const STARTER_COURIERS = ["هایپەر پۆست", "واسط", "پرایم"] as const;

export const RECEIPT_ACTION_LABELS: Record<"print" | "pdf" | "whatsapp" | "payment" | "reversed", Words> = {
  print: { ku: "چاپ", en: "Printed", ar: "طباعة", zh: "打印" },
  pdf: { ku: "PDF", en: "PDF", ar: "PDF", zh: "PDF" },
  whatsapp: { ku: "واتسئاپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" },
  payment: { ku: "پارەدان", en: "Payment", ar: "دفع", zh: "付款" },
  reversed: { ku: "هەڵوەشاندنەوە", en: "Undone", ar: "إلغاء", zh: "撤销" },
};
