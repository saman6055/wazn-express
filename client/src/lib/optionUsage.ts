/**
 * Which choices this person actually makes, so the list stops making them
 * scroll past twelve things to reach the one they pick every time.
 *
 * The owner's rule (Sep 2026), for every picker in the app: the ones used
 * most come first, and the last one used comes first among equals. A fixed
 * alphabetical-ish list is fine the day it is written and wrong a month
 * later, when the shop turns out to sell mostly clothes and accessories.
 *
 * Two deliberate limits, because a list that reorders itself freely is worse
 * than one that does not:
 *
 *  • only a handful are promoted (`TOP_COUNT`), and they are shown in their
 *    own group with a heading, so it is obvious WHY the order changed and
 *    the rest of the list keeps the order it has always had;
 *  • a value picked once does not jump above one picked twenty times — the
 *    count leads and recency only breaks ties.
 *
 * Kept per browser, not per account: it is a convenience for the person at
 * this desk, it is worth nothing to anyone else, and it must never become
 * another thing the server has to be asked for before a form can be drawn.
 */

/** How many go into the "used most" group at the top. */
export const TOP_COUNT = 5;

export interface OptionUse {
  /** How many times this value has been chosen. */
  count: number;
  /** When it was last chosen, epoch ms — the tie-breaker. */
  last: number;
}

export type OptionUsage = Record<string, OptionUse>;

const storageKey = (list: string) => `wazn-option-usage:${list}`;

/** Never throws: a browser with storage switched off still gets a list. */
export function readOptionUsage(list: string): OptionUsage {
  try {
    const raw = localStorage.getItem(storageKey(list));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: OptionUsage = {};
    for (const [value, use] of Object.entries(parsed as Record<string, unknown>)) {
      const u = use as { count?: unknown; last?: unknown };
      const count = Number(u?.count);
      const last = Number(u?.last);
      if (Number.isFinite(count) && count > 0) {
        out[value] = { count, last: Number.isFinite(last) ? last : 0 };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Remember one pick.
 *
 * `now` is a parameter so the rule can be tested without waiting for a
 * clock, and so two picks in the same millisecond still order sensibly.
 */
export function recordOptionUse(list: string, value: string, now = Date.now()): OptionUsage {
  const usage = readOptionUsage(list);
  if (!value) return usage;
  const before = usage[value];
  usage[value] = { count: (before?.count ?? 0) + 1, last: now };
  try {
    localStorage.setItem(storageKey(list), JSON.stringify(usage));
  } catch {
    // Storage refused — the pick still works, it just is not remembered.
  }
  return usage;
}

/** Forget one list's history. */
export function clearOptionUsage(list: string): void {
  try {
    localStorage.removeItem(storageKey(list));
  } catch {
    // Nothing to do: there is no state of ours left to be wrong about.
  }
}

/**
 * Split a list into the few used most and everything else.
 *
 * `rest` keeps the order it arrived in — the list somebody curated in
 * settings — so the only thing that moves is the small group on top.
 */
export function rankOptions<T>(
  options: readonly T[],
  usage: OptionUsage,
  valueOf: (option: T) => string,
  topCount = TOP_COUNT,
): { top: T[]; rest: T[] } {
  const used = options.filter((o) => (usage[valueOf(o)]?.count ?? 0) > 0);
  if (used.length === 0) return { top: [], rest: [...options] };

  const ranked = [...used].sort((a, b) => {
    const ua = usage[valueOf(a)]!;
    const ub = usage[valueOf(b)]!;
    // Count leads, so one stray pick never outranks a habit.
    if (ub.count !== ua.count) return ub.count - ua.count;
    // Among equals, the one used most recently.
    return ub.last - ua.last;
  });

  const top = ranked.slice(0, Math.max(0, topCount));
  const promoted = new Set(top.map(valueOf));
  return { top, rest: options.filter((o) => !promoted.has(valueOf(o))) };
}
