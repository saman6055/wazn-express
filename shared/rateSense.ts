/**
 * A dollar rate that is not logical (owner, 2026-10-04: "foresee the errors to
 * come and stop them"). The rate turns every dinar taken at the till into
 * dollars on the customer's account; one slipped digit — 15,600 for 1,560 —
 * credits a tenth or ten times what was handed over, and nothing asked.
 *
 * A question, never a refusal: the rate does move. Asked when it is outside
 * any rate Iraq has seen in years, or far from the last one used.
 */

export const IQD_RATE_MIN = 1000;
export const IQD_RATE_MAX = 2500;
/** How far from the last rate used, as a share, before it is asked about. */
export const IQD_RATE_JUMP = 0.1;

/** The reason it looks wrong, in Sorani; null when it looks right. */
export function oddRate(rate: number, lastRate?: number | null): string | null {
  if (!(rate > 0)) return null;
  if (rate < IQD_RATE_MIN || rate > IQD_RATE_MAX) {
    return `نرخی دۆلار ${rate.toLocaleString("en-US")} دینارە — نرخی ئاسایی لە نێوان ${IQD_RATE_MIN.toLocaleString("en-US")} و ${IQD_RATE_MAX.toLocaleString("en-US")} دایە. لەوانەیە سفرێک زیاد یان کەم بێت.`;
  }
  const last = Number(lastRate ?? 0);
  if (last > 0 && Math.abs(rate - last) / last > IQD_RATE_JUMP) {
    return `نرخی دۆلار ${rate.toLocaleString("en-US")} دینارە — دوایین نرخی بەکارهاتوو ${last.toLocaleString("en-US")} بوو (${Math.round((Math.abs(rate - last) / last) * 100)}% جیاواز).`;
  }
  return null;
}

/** The confirm text. */
export function oddRateQuestion(reason: string): string {
  return `${reason}\n\nئەم نرخە هەموو دینارەکانی ئەم وەسڵە دەکات بە دۆلار لەسەر حیسابی کڕیار. تکایە دووبارە دڵنیا بەرەوە.`;
}
