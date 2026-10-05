/**
 * Correcting the last registration, without leaving Quick Register.
 *
 * The owner, 2026-10-05: «کاتێ لە تۆماری خێرا ئۆردەرێ تۆمار دەکەی، ئەگەر هەڵەت
 * لە کێش یا قیاس یا لە شتێ کرد، خۆشە ڕیتێرنی دوایین ئۆردەری تۆمار کراو هەبێ،
 * ئەو کات دەستکاری بکەیت … بەس دەقیق بێت». Asked which of two ways, he chose:
 * the same parcel is put right — the same code — and only the difference in
 * the money is written. And only the last one: «بۆ ئەوانی تر ئەتوانی لە هەموو
 * پاکەتەکان دەستکاری بکەیت».
 *
 * The parts with no database in them live here: which figures are stored,
 * what goes back into the form, whether the price is touched at all, the line
 * the customer's statement will carry and the sentence the screen says. The
 * money itself is moved in server/db/parcelCorrection.db.ts.
 */

export interface ParcelMeasures {
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  volumeCbm?: string | number | null;
}

export interface ParcelOwner {
  customerId?: number | null;
  isUnclaimed?: boolean | null;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/** A figure without the zeros a decimal column pads it with: 1.500 → 1.5. */
export function plainNumber(v: unknown, decimals = 3): string {
  const x = num(v);
  if (!(x > 0)) return "";
  return String(parseFloat(x.toFixed(decimals)));
}

/**
 * A measurement as the row stores it: the figure, or null when the box was
 * left empty or holds something that is not a positive number. Registration
 * stores nothing for an empty box, and a correction that empties one must
 * leave the row reading the same way.
 */
export function storedMeasure(v: unknown): string | null {
  const text = String(v ?? "").trim();
  if (!text) return null;
  return num(text) > 0 ? text : null;
}

/**
 * The volume a registration stores: the one typed in, else the three sides,
 * else none. The rule packages.register writes with, to the same six places.
 */
export function storedVolumeCbm(
  typedCbm: unknown,
  lengthCm: unknown,
  widthCm: unknown,
  heightCm: unknown,
): string | null {
  const typed = num(typedCbm);
  if (typed > 0) return typed.toFixed(6);
  const l = num(lengthCm);
  const w = num(widthCm);
  const h = num(heightCm);
  if (l > 0 && w > 0 && h > 0) return ((l * w * h) / 1000000).toFixed(6);
  return null;
}

/**
 * What goes back into the "CBM" box when a parcel is opened for correction.
 *
 * The row keeps one volume and does not say whether somebody typed it or the
 * three sides produced it. If the sides give that same figure it was worked
 * out, so the box stays empty and the sides go on deciding — otherwise a
 * corrected side would be ignored in favour of a volume nobody typed.
 */
export function typedCbmOf(parcel: ParcelMeasures): string {
  const stored = num(parcel.volumeCbm);
  if (!(stored > 0)) return "";
  const fromSides = storedVolumeCbm(null, parcel.lengthCm, parcel.widthCm, parcel.heightCm);
  if (fromSides !== null && Math.abs(parseFloat(fromSides) - stored) < 0.0000015) return "";
  return plainNumber(stored, 6);
}

const sameFigure = (a: unknown, b: unknown): boolean => Math.abs(num(a) - num(b)) < 0.0000005;

/** Did the scales, the tape or the typed volume change? */
export function measuresChanged(before: ParcelMeasures, after: ParcelMeasures): boolean {
  return !(
    sameFigure(before.weightKg, after.weightKg) &&
    sameFigure(before.lengthCm, after.lengthCm) &&
    sameFigure(before.widthCm, after.widthCm) &&
    sameFigure(before.heightCm, after.heightCm) &&
    sameFigure(before.volumeCbm, after.volumeCbm)
  );
}

/** Is the parcel somebody else's now — or nobody's, or somebody's at last? */
export function ownerChanged(before: ParcelOwner, after: ParcelOwner): boolean {
  return (before.customerId ?? null) !== (after.customerId ?? null)
    || Boolean(before.isUnclaimed) !== Boolean(after.isUnclaimed);
}

/**
 * Did a fact behind the price move?
 *
 * Only then is the price asked for again and the account looked at. A
 * photograph added, a description fixed or a category chosen must not reprice
 * a parcel behind anybody's back — the rule the parcel edit has kept since
 * 2026-09-21, kept here too.
 */
export function moneyFactsChanged(
  before: ParcelMeasures & ParcelOwner,
  after: ParcelMeasures & ParcelOwner,
): boolean {
  return measuresChanged(before, after) || ownerChanged(before, after);
}

/**
 * What was corrected, in a line short enough for an account statement.
 *
 * It is written beside the difference on the customer's account and shown in
 * the main admin's bell, so it says the thing that explains the money: the
 * weight that was, and the weight that is.
 *
 * In words — «لە 15 بۆ 1.5» — and never with an arrow. In a right-to-left
 * line the two numbers change places and the arrow does not turn round, so
 * "15 → 1.5" is read as the weight going from 1.5 to 15: the opposite of
 * what happened, on the one line that is there to explain it.
 */
export function correctionNote(
  name: string,
  before: ParcelMeasures,
  after: ParcelMeasures,
  owner?: { before?: string | null; after?: string | null },
): string {
  const parts: string[] = [];
  const figure = (v: unknown, decimals = 3) => plainNumber(v, decimals) || "0";

  if (!sameFigure(before.weightKg, after.weightKg)) {
    parts.push(`کێش لە ${figure(before.weightKg)} بۆ ${figure(after.weightKg)} kg`);
  }
  const sidesMoved =
    !sameFigure(before.lengthCm, after.lengthCm) ||
    !sameFigure(before.widthCm, after.widthCm) ||
    !sameFigure(before.heightCm, after.heightCm);
  if (sidesMoved) {
    const sides = (m: ParcelMeasures) => `${figure(m.lengthCm, 2)}×${figure(m.widthCm, 2)}×${figure(m.heightCm, 2)}`;
    parts.push(`قیاس لە ${sides(before)} بۆ ${sides(after)} cm`);
  }
  if (!sameFigure(before.volumeCbm, after.volumeCbm)) {
    parts.push(`قەبارە لە ${figure(before.volumeCbm, 6)} بۆ ${figure(after.volumeCbm, 6)} m³`);
  }
  if (owner && (owner.before ?? "") !== (owner.after ?? "")) {
    parts.push(`خاوەن لە ${owner.before || "بێ خاوەن"} بۆ ${owner.after || "بێ خاوەن"}`);
  }

  const head = `چاککردنەوەی تۆماری پاکەت ${name}`;
  return parts.length > 0 ? `${head} — ${parts.join("، ")}` : head;
}

export type CorrectionMoney =
  /** Nothing on any account moved. */
  | "none"
  /** The same charge, moved by the difference. */
  | "adjusted"
  /** The charge came off whole; nothing is due as the parcel now reads. */
  | "reversed"
  /** The charge came off the owner it was wrongly given to. */
  | "moved";

export interface CorrectionOutcome {
  money: CorrectionMoney;
  /** What stood on the account for the parcel before. */
  wasUsd: number;
  /** What stands on that same account for it now. */
  nowUsd: number;
  /** What was put on the account by the charge that followed, if one did. */
  chargedUsd: number;
  /** The parcel's stored price now, or null when it has none. */
  priceUsd: number | null;
}

export interface CorrectionWords {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

const usd = (amount: number): string => `$${Math.abs(amount).toFixed(2)}`;

/**
 * The same figure inside a right-to-left sentence, held left to right.
 *
 * Without the isolate a dollar sign is a neutral character and takes the
 * direction of the Kurdish around it: "$165.00" is drawn as "165.00$".
 */
const rtl = (amount: number): string => `\u2066${usd(amount)}\u2069`;

/**
 * One sentence for the person who made the correction: what the account said,
 * what it says now, and that only the difference was written. Digits stay
 * 0-9 and the figures read the same in every language.
 */
export function correctionWords(outcome: CorrectionOutcome): CorrectionWords {
  const { money, wasUsd, nowUsd, chargedUsd, priceUsd } = outcome;

  if (money === "adjusted") {
    const diff = Math.round((nowUsd - wasUsd) * 100) / 100;
    const down = diff < 0;
    return {
      ku: `چاک کرایەوە. لەسەر حیسابی کڕیار ${rtl(wasUsd)} بوو، ئێستا ${rtl(nowUsd)} ـە — تەنها جیاوازییەکە نووسرا: ${rtl(diff)} ${down ? "کەم کرایەوە" : "زیاد کرا"}.`,
      en: `Corrected. The account said ${usd(wasUsd)} for it and now says ${usd(nowUsd)} — only the difference was written: ${usd(diff)} ${down ? "less" : "more"}.`,
      ar: `تم التصحيح. كان على حساب الزبون ${rtl(wasUsd)} وأصبح ${rtl(nowUsd)} — كُتب الفرق فقط: ${rtl(diff)} ${down ? "أقل" : "أكثر"}.`,
      zh: `已更正。客户账上原为 ${usd(wasUsd)}，现为 ${usd(nowUsd)} — 只记了差额：${down ? "减" : "加"} ${usd(diff)}。`,
    };
  }

  if (money === "moved") {
    return chargedUsd > 0
      ? {
          ku: `چاک کرایەوە. ${rtl(wasUsd)} لەسەر حیسابی خاوەنە هەڵەکە لابرا، و ${rtl(chargedUsd)} خرایە سەر حیسابی خاوەنە ڕاستەکە.`,
          en: `Corrected. ${usd(wasUsd)} came off the wrong owner's account, and ${usd(chargedUsd)} went onto the right one's.`,
          ar: `تم التصحيح. أُزيل ${rtl(wasUsd)} من حساب المالك الخطأ، وأُضيف ${rtl(chargedUsd)} إلى حساب المالك الصحيح.`,
          zh: `已更正。已从错误的货主账上撤下 ${usd(wasUsd)}，并在正确的货主账上记入 ${usd(chargedUsd)}。`,
        }
      : {
          ku: `چاک کرایەوە. ${rtl(wasUsd)} لەسەر حیسابی خاوەنە هەڵەکە لابرا. هیچ شتێک نەخرایە سەر حیسابی کەسی تر.`,
          en: `Corrected. ${usd(wasUsd)} came off the wrong owner's account. Nothing was put on anybody else's.`,
          ar: `تم التصحيح. أُزيل ${rtl(wasUsd)} من حساب المالك الخطأ. لم يُضف شيء إلى حساب آخر.`,
          zh: `已更正。已从错误的货主账上撤下 ${usd(wasUsd)}。未记入其他人的账。`,
        };
  }

  if (money === "reversed") {
    return chargedUsd > 0
      ? {
          ku: `چاک کرایەوە. ${rtl(wasUsd)} لەسەر حیسابی کڕیار لابرا و ${rtl(chargedUsd)} بە ژمارە ڕاستەکان خرایەوە سەری.`,
          en: `Corrected. ${usd(wasUsd)} came off the account and ${usd(chargedUsd)} went back on with the right figures.`,
          ar: `تم التصحيح. أُزيل ${rtl(wasUsd)} من الحساب وأُعيد ${rtl(chargedUsd)} بالأرقام الصحيحة.`,
          zh: `已更正。已从账上撤下 ${usd(wasUsd)}，并按正确数字重新记入 ${usd(chargedUsd)}。`,
        }
      : {
          ku: `چاک کرایەوە. ${rtl(wasUsd)} لەسەر حیسابی کڕیار لابرا — بەم زانیارییانە ئێستا هیچ نرخێکی نییە.`,
          en: `Corrected. ${usd(wasUsd)} came off the account — as it now reads, the parcel has no price.`,
          ar: `تم التصحيح. أُزيل ${rtl(wasUsd)} من الحساب — بهذه البيانات لا سعر للطرد الآن.`,
          zh: `已更正。已从账上撤下 ${usd(wasUsd)} — 按现在的数据，该包裹没有价格。`,
        };
  }

  if (chargedUsd > 0) {
    return {
      ku: `چاک کرایەوە. ${rtl(chargedUsd)} خرایە سەر حیسابی کڕیار.`,
      en: `Corrected. ${usd(chargedUsd)} went onto the customer's account.`,
      ar: `تم التصحيح. أُضيف ${rtl(chargedUsd)} إلى حساب الزبون.`,
      zh: `已更正。已在客户账上记入 ${usd(chargedUsd)}。`,
    };
  }

  return priceUsd !== null && priceUsd > 0
    ? {
        ku: `چاک کرایەوە. نرخی پاکەتەکە: ${rtl(priceUsd)}. هیچ پارەیەک لەسەر حیساب نەجووڵا.`,
        en: `Corrected. The parcel's price: ${usd(priceUsd)}. No money moved on any account.`,
        ar: `تم التصحيح. سعر الطرد: ${rtl(priceUsd)}. لم يتحرك أي مبلغ على أي حساب.`,
        zh: `已更正。包裹价格：${usd(priceUsd)}。账上没有任何变动。`,
      }
    : {
        ku: "چاک کرایەوە. هیچ پارەیەک لەسەر حیساب نەجووڵا.",
        en: "Corrected. No money moved on any account.",
        ar: "تم التصحيح. لم يتحرك أي مبلغ على أي حساب.",
        zh: "已更正。账上没有任何变动。",
      };
}
