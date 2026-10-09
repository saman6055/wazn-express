/**
 * How many wrong passwords before an account stops answering.
 *
 * The login limiter counts by IP address, which stops one machine hammering
 * the door. It does nothing about the other shape of the attack: one account,
 * tried from a hundred addresses, each one well under the limit. That account
 * can be guessed at all day and nothing notices.
 *
 * So the count belongs to the account, not the connection.
 *
 * What the customer is told when it locks is deliberately vague. It does not
 * say "wrong password" — repeating that to somebody who has typed five wrong
 * passwords is how they learn which of the two fields to keep changing — and
 * it does not say "this account is locked", which confirms the account exists.
 * It says the sign-in cannot be completed and to try later or call us, which
 * is true, useful to the customer, and useless to anybody else.
 */

/** Five wrong tries. Enough for a bad memory, far short of a guessing run. */
export const MAX_LOGIN_ATTEMPTS = 5;

/** How long the account stays shut afterwards. */
export const LOCK_MINUTES = 15;

/**
 * A customer's own door is far more forgiving than the office's.
 *
 * The owner, 2026-10-09: «لە پۆرتال موشتەری بتوانێ بە ئاسانی داخل بێت، نەک 5
 * جار هەوڵی دا هەڵە بوو لێنەگەڕێ چیتر هەوڵ بداتەوە». Five tries is a fair
 * limit for staff, who type the same password every morning; a customer
 * opens the portal once a fortnight, on a phone, with a password somebody at
 * the counter gave them, and five slips is an ordinary evening. Shut out for
 * a quarter of an hour, they ring the office or give up.
 *
 * So a person is never stopped: thirty wrong tries inside an hour is not
 * somebody remembering a password. What that still stops is a script working
 * through a list against one account, and even then only for five minutes at
 * a time. The office's five-and-fifteen above is untouched.
 */
export const CUSTOMER_LOCK: LockRule = { maxAttempts: 30, lockMinutes: 5 };

/** The office's rule, as a rule. */
export const STAFF_LOCK: LockRule = { maxAttempts: MAX_LOGIN_ATTEMPTS, lockMinutes: LOCK_MINUTES };

/** How many wrong tries shut a door, and for how long. */
export interface LockRule {
  maxAttempts: number;
  lockMinutes: number;
}

/**
 * How long a run of failures stays "the same run".
 *
 * Without this, four wrong tries in January and one in March would lock the
 * account in March. The counter forgets a quiet hour.
 */
export const ATTEMPT_WINDOW_MINUTES = 60;

const MINUTE = 60 * 1000;

export interface LockInput {
  /** Failures counted so far in the current run. */
  failedAttempts?: number | null;
  /** When the last failure was. */
  lastFailedAt?: Date | string | null;
  /** When the lock lifts, if the account is locked. */
  lockedUntil?: Date | string | null;
  /** Passed in rather than read, so this stays testable. */
  now: Date;
}

export interface LockState {
  locked: boolean;
  /** Milliseconds until the lock lifts. 0 when not locked. */
  remainingMs: number;
  /** Rounded up, for telling somebody how long to wait. */
  remainingMinutes: number;
}

function time(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Is this account shut right now, and for how much longer? */
export function lockState(input: LockInput): LockState {
  const until = time(input.lockedUntil);
  const now = input.now.getTime();
  if (until === null || until <= now) return { locked: false, remainingMs: 0, remainingMinutes: 0 };
  const remainingMs = until - now;
  return { locked: true, remainingMs, remainingMinutes: Math.ceil(remainingMs / MINUTE) };
}

export interface AfterFailure {
  /** What to store as the running count. */
  failedAttempts: number;
  /** When the lock should lift, or null if this failure did not lock it. */
  lockedUntil: Date | null;
  /** True only on the failure that tipped it over. */
  justLocked: boolean;
}

/**
 * What one more wrong password does.
 *
 * A failure after a quiet hour starts a fresh run — the previous tries are
 * old news, and holding them against somebody who mistypes once a month is
 * not protection, it is an obstacle.
 */
export function registerFailure(input: LockInput, rule: LockRule = STAFF_LOCK): AfterFailure {
  const now = input.now.getTime();
  const last = time(input.lastFailedAt);
  const stale = last === null || now - last > ATTEMPT_WINDOW_MINUTES * MINUTE;

  const failedAttempts = stale ? 1 : Math.max(0, Number(input.failedAttempts) || 0) + 1;

  if (failedAttempts >= rule.maxAttempts) {
    return {
      failedAttempts,
      lockedUntil: new Date(now + rule.lockMinutes * MINUTE),
      justLocked: true,
    };
  }
  return { failedAttempts, lockedUntil: null, justLocked: false };
}

/** What a customer is told when the account will not open. */
export const LOCKED_MESSAGE = {
  ku: "ناتوانرێت ئێستا بچیتە ژوورەوە. تکایە دوای چەند خولەکێک هەوڵ بدەرەوە، یان پەیوەندیمان پێوە بکە.",
  en: "Sign-in cannot be completed right now. Please try again in a few minutes, or contact us.",
  ar: "تعذّر إتمام تسجيل الدخول الآن. حاول بعد بضع دقائق أو تواصل معنا.",
  zh: "目前无法完成登录。请几分钟后再试，或联系我们。",
};
