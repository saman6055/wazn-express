/**
 * Where a batch packed in China stands, from what really happened (owner,
 * 2026-10-26). Nobody sets it; each stage follows one recorded event:
 *
 *   packing   - the batch has cartons, the dispatch check is not finished;
 *   left      - finished in China, nothing of it checked in at Erbil yet;
 *   arriving  - some of its packed parcels have arrived, not all;
 *   arrived   - every packed parcel has arrived.
 *
 * "Arrived" is a parcel scanned on the arrival check, or one already ready
 * for or handed to its customer - AIR-2026-069GZ had 18 parcels given out
 * with no arrival scan, and they had certainly arrived.
 */

export type DispatchStage = "packing" | "left" | "arriving" | "arrived";

/** Statuses that mean the parcel is in Erbil whether or not it was scanned in. */
export const ARRIVED_PARCEL_STATUSES = ["ready_for_delivery", "out_for_delivery", "delivered"] as const;

export function parcelHasArrived(p: { scannedIn: boolean; status: string | null | undefined }): boolean {
  return p.scannedIn || (ARRIVED_PARCEL_STATUSES as readonly string[]).includes(String(p.status ?? ""));
}

export function dispatchStage(f: { finished: boolean; packed: number; arrived: number }): DispatchStage {
  if (!f.finished) return "packing";
  if (f.arrived <= 0) return "left";
  if (f.arrived < f.packed) return "arriving";
  return "arrived";
}

type Words = { ku: string; en: string; ar: string; zh: string };

export const DISPATCH_STAGE_WORDS: Record<DispatchStage, Words> = {
  packing: { ku: "خستنە ناو کارتۆن", en: "Packing", ar: "قيد التعبئة", zh: "装箱中" },
  left: { ku: "لە چین ڕۆیشت", en: "Left China", ar: "غادرت الصين", zh: "已从中国发出" },
  arriving: { ku: "گەیشتە هەولێر — کەمە", en: "In Erbil — some missing", ar: "وصلت أربيل — ناقص", zh: "已到埃尔比勒 — 有缺件" },
  arrived: { ku: "هەمووی گەیشت", en: "All arrived", ar: "وصل الكل", zh: "全部到达" },
};

/** The portal notice each customer gets when their goods leave China. No arrival date is promised. */
export function leftChinaNotice(batchCode: string, count: number): { en: string; ku: string; ar: string; zh: string; titleEn: string; titleKu: string; titleAr: string; titleZh: string } {
  return {
    titleEn: "Your goods left China",
    titleKu: "کاڵاکانت لە چینەوە نێردران",
    titleAr: "غادرت بضاعتك الصين",
    titleZh: "您的货物已从中国发出",
    en: `${count} of your parcels left China in batch ${batchCode}. We will tell you when they reach Erbil.`,
    ku: `${count} پاکێجت لە چینەوە نێردرا لە باچی ${batchCode}. کاتێک گەیشتنە هەولێر ئاگادارت دەکەینەوە.`,
    ar: `غادرت ${count} من طرودك الصين في الدفعة ${batchCode}. سنخبرك عند وصولها إلى أربيل.`,
    zh: `您的 ${count} 件包裹已随批次 ${batchCode} 从中国发出。到达埃尔比勒后我们会通知您。`,
  };
}

/** The WhatsApp message to one customer: the same words, with their trackings. */
export function leftChinaWhatsApp(name: string | null, batchCode: string, trackings: string[]): string {
  const hello = name ? `سڵاو بەڕێز ${name}` : "سڵاو";
  return [
    hello,
    `${trackings.length} کاڵات لە چینەوە نێردرا لە باچی ${batchCode}. کاتێک گەیشتە هەولێر ئاگادارت دەکەینەوە.`,
    "",
    ...trackings.map((t) => `• ${t}`),
    "",
    "سوپاس — Wazn Express",
  ].join("\n");
}
