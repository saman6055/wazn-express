/**
 * The numbers worth saying well done about.
 *
 * The best of the greetings, because unlike a calendar date this one is
 * earned and is true of nobody else. "Your hundredth parcel with us" means
 * something a seasonal message never can.
 *
 * Chosen to thin out as they climb. Somebody's first is the one that matters
 * most and should never be missed; after that they arrive rarely enough to
 * stay special. A customer who ships constantly must not be congratulated
 * every week, or it becomes the daily blessing problem in slower motion.
 */

export const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

export type Milestone = (typeof MILESTONES)[number];

export interface MilestoneGreeting {
  count: Milestone;
  title: { ku: string; en: string; ar: string; zh: string };
  message: { ku: string; en: string; ar: string; zh: string };
}

/**
 * Which milestone this count has reached, if any is still uncelebrated.
 *
 * `alreadyCelebrated` is the highest one this customer has been congratulated
 * for. Without it a customer at 120 parcels would be told about their
 * hundredth every time they opened the portal, which turns a compliment into
 * a nag — and the second time somebody reads it they know the first was not
 * meant either.
 *
 * Returns the highest milestone at or below the count that is above whatever
 * was last celebrated. Highest, not next: a customer who arrives from an old
 * system with 300 parcels behind them gets one message about 250, not four
 * messages climbing to it.
 */
export function milestoneReached(
  count: number,
  alreadyCelebrated = 0,
): Milestone | null {
  if (!Number.isFinite(count) || count < 1) return null;
  let best: Milestone | null = null;
  for (const m of MILESTONES) {
    if (m <= count && m > alreadyCelebrated) best = m;
  }
  return best;
}

const T = (ku: string, en: string, ar: string, zh: string) => ({ ku, en, ar, zh });

/**
 * What to say about it.
 *
 * The first one is a welcome and the rest are thanks. Deliberately plain —
 * every customer has to be able to read it — and deliberately about them
 * rather than about the company.
 */
export function milestoneGreeting(count: Milestone): MilestoneGreeting {
  if (count === 1) {
    return {
      count,
      title: T("بەخێربێیت بۆ وەزن", "Welcome to Wazn", "أهلًا بك في وزن", "欢迎来到 Wazn"),
      message: T(
        "یەکەم پاکێجت لەگەڵ ئێمە. سوپاس بۆ متمانەکەت — بە باشی دەیگەیەنین.",
        "Your first parcel with us. Thank you for trusting us with it.",
        "أول طرد لك معنا. شكرًا لثقتك بنا.",
        "你与我们的第一件包裹。感谢你的信任。",
      ),
    };
  }
  return {
    count,
    title: T(
      `دەست خۆش — ${count} پاکێت`,
      `Well done — ${count} parcels`,
      `أحسنت — ${count} طردًا`,
      `恭喜——${count} 件包裹`,
    ),
    message: T(
      `${count} پاکێتت لەگەڵ وەزن گەیاندووە. سوپاس بۆ بەردەوامیت لەگەڵمان.`,
      `${count} parcels shipped with Wazn. Thank you for staying with us.`,
      `${count} طرد تم شحنها مع وزن. شكرًا لاستمرارك معنا.`,
      `已与 Wazn 运送 ${count} 件包裹。感谢你一路同行。`,
    ),
  };
}
