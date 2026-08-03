import {
  chargeableWeight,
  exceedsVolumetricThreshold,
  isAirShipping,
  DEFAULT_VOLUMETRIC_DIVISOR,
  type ChargeableBreakdown,
} from "./chargeableWeight";

/**
 * When a parcel is billed on its size rather than its weight, who is told and
 * in what words.
 *
 * Air freight sells space, so a 2 kg carton measuring 12 kg by volume is
 * invoiced as 12 kg. The customer weighed it themselves and will not accept
 * that number without an explanation, and the explanation has to arrive before
 * the invoice does — not after.
 *
 * The wording lives here rather than in a component because the same text goes
 * to four places: the customer's portal, the WhatsApp draft an admin sends by
 * hand, the admin's own alert, and the registration record. Four copies would
 * mean four versions of what we tell people about their money.
 */

export type VolumetricThresholds = {
  /** Ignore anything under this many extra kilos, however lopsided the ratio. */
  minExtraKg: number;
  /** …and under this multiple of the actual weight. */
  minRatio: number;
  /**
   * Except: this many extra kilos always speaks up, whatever the ratio.
   * A 20 kg parcel billed as 29 is only 1.46× over, but it is nine kilos of
   * someone's money, and the customer pays in kilos, not in ratios.
   */
  alwaysAboveExtraKg: number;
};

export const DEFAULT_VOLUMETRIC_THRESHOLDS: VolumetricThresholds = {
  minExtraKg: 3,
  minRatio: 1.5,
  alwaysAboveExtraKg: 8,
};

/** Settings keys, so the reader and the writer cannot disagree on spelling. */
export const VOLUMETRIC_SETTING_KEYS = {
  minExtraKg: "volumetric_alert_min_extra_kg",
  minRatio: "volumetric_alert_min_ratio",
  alwaysAboveExtraKg: "volumetric_alert_always_above_kg",
} as const;

export type VolumetricAssessment = ChargeableBreakdown & {
  /** True when this parcel is billed on size and the gap is worth explaining. */
  alert: boolean;
  divisor: number;
};

/**
 * Everything about one air parcel's volumetric position, in one object.
 *
 * Sea never reaches the alert: it is billed on volume outright, so there is no
 * surprise to explain. It still gets a breakdown so callers can render numbers
 * without branching.
 */
export function assessVolumetric(
  input: {
    shippingType: string;
    weightKg?: string | number | null;
    lengthCm?: string | number | null;
    widthCm?: string | number | null;
    heightCm?: string | number | null;
  },
  options: { divisor?: number; thresholds?: VolumetricThresholds } = {},
): VolumetricAssessment {
  const divisor = options.divisor && options.divisor > 0 ? options.divisor : DEFAULT_VOLUMETRIC_DIVISOR;
  const t = options.thresholds ?? DEFAULT_VOLUMETRIC_THRESHOLDS;
  const breakdown = chargeableWeight(input, divisor);

  if (!isAirShipping(input.shippingType)) {
    return { ...breakdown, alert: false, divisor };
  }

  // Either the ordinary rule, or a gap big enough to speak for itself.
  const alert =
    exceedsVolumetricThreshold(breakdown, { minExtraKg: t.minExtraKg, minRatio: t.minRatio }) ||
    (breakdown.billedOnVolume && breakdown.actualKg > 0 && breakdown.extraKg >= t.alwaysAboveExtraKg);

  return { ...breakdown, alert, divisor };
}

/** Trim a kilo figure to something a person would say out loud. */
function kg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export type VolumetricMessageInput = {
  customerName: string;
  trackingNumber: string;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  assessment: VolumetricAssessment;
};

/**
 * The message an admin reviews and sends. Deliberately explains rather than
 * announces: it names the numbers, shows the arithmetic every airline uses,
 * says plainly that the surcharge is the airline's and not ours, and gives the
 * customer a day to object before the parcel is batched.
 */
export function buildVolumetricMessage(input: VolumetricMessageInput): string {
  const { customerName, trackingNumber, assessment: a } = input;
  const dims = [input.lengthCm, input.widthCm, input.heightCm]
    .map((v) => (v === null || v === undefined ? 0 : parseFloat(String(v))))
    .filter((n) => Number.isFinite(n) && n > 0);
  const dimsLine = dims.length === 3 ? `${dims[0]} × ${dims[1]} × ${dims[2]} سم` : null;

  return [
    `سڵاو ${customerName} 🌟`,
    ``,
    `بارەکەت گەیشتە کۆگاکەمان لە چین.`,
    ``,
    `📦 زانیاری بارەکە`,
    `تراکینگ: ${trackingNumber}`,
    `کێشی ڕاستەقینە: ${kg(a.actualKg)} کیلۆ`,
    ...(dimsLine ? [`قەبارە: ${dimsLine}`] : []),
    `کێشی قەبارەیی: ${kg(a.volumetricKg)} کیلۆ`,
    `حساب لەسەر: ${kg(a.chargeableKg)} کیلۆ`,
    ``,
    `ℹ️ بۆچی بە ${kg(a.chargeableKg)} کیلۆ حساب دەکرێت؟`,
    `هێڵە ئاسمانییەکان لە فڕۆکەدا شوێن دەفرۆشن، نەک تەنها کێش.`,
    `کارتۆنێکی گەورەی سووک هەمان شوێن دەگرێت کە کارتۆنێکی`,
    `بچووکی قورس دەیگرێت.`,
    ``,
    `بۆیە هەموو هێڵە ئاسمانییەکانی جیهان بەم شێوەیە حساب دەکەن:`,
    `(درێژی × پانی × بەرزی) ÷ ${a.divisor} = کێشی قەبارەیی`,
    `پاشان گەورەترین ژمارە هەڵدەبژێردرێت لە نێوان`,
    `کێشی ڕاستەقینە و کێشی قەبارەیی.`,
    ``,
    `⚠️ گرنگ`,
    `ئەم زیادەیە هی ئێمە نییە. ئەمە کرێی هێڵی ئاسمانییە و`,
    `ئێمەش بە هەمان شێوە پارەکەی دەدەین. هیچ زیادەیەکی`,
    `لەسەر نییە لەلایەن ئێمەوە.`,
    ``,
    `ئەمە شتێکی ئاسایی و ڕەوایە لە هەموو جیهاندا، چونکە`,
    `بارەکەت لە فڕۆکەدا شوێنێکی زۆر دەگرێت.`,
    ``,
    `⏳ ماوەی 24 کاتژمێر`,
    `ئەگەر تێبینیت هەبوو، تکایە لە ماوەی 24 کاتژمێردا`,
    `ئاگادارمان بکەوە. دوای ئەوە بارەکەت دەخرێتە ناو باچ و`,
    `ئامادە دەکرێت بۆ بەڕێکردن.`,
    ``,
    `بۆ هەر پرسیارێک لە خزمەتتاندا ئامادەین 🤝`,
    `وەزن ئێکسپرێس`,
  ].join("\n");
}

/**
 * A wa.me link that opens the customer's chat with the message already typed.
 *
 * Nothing is sent: WhatsApp opens, the admin reads what is there and presses
 * send. That is the point — no message about someone's bill leaves without a
 * person having looked at it.
 *
 * Returns null when the number is unusable, so the caller renders nothing
 * rather than a link that opens an empty chat.
 */
export function buildWhatsAppLink(mobileNumber: string | null | undefined, message: string): string | null {
  if (!mobileNumber) return null;

  // wa.me wants digits only, in full international form.
  let digits = String(mobileNumber).replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\+/g, "");
  // A local Iraqi number starts 07…; wa.me needs the country code instead.
  if (digits.startsWith("0")) digits = `964${digits.slice(1)}`;

  if (digits.length < 8 || digits.length > 15) return null;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
