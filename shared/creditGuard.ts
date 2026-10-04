/**
 * No customer account goes below zero until the main admin has said yes.
 *
 * Owner, 2026-10-01: "no customer has credit" — nobody prepays here. Yet 75
 * accounts stood in credit, $13,202 between them, and every one of those
 * credits was made by an ordinary entry that nothing questioned: a payment
 * larger than the debt, a balance lowered by hand, a box paid over its due.
 *
 * Owner, 2026-10-02, once they were all back at zero: a credit is real only
 * when somebody pays more than they owe — owes $200, hands over $300. The
 * system must then say plainly that $100 becomes balance on the customer's
 * account. Anyone at the till may enter it, "but it goes onto the account
 * only once the main admin has confirmed it".
 *
 * So, at every door that takes money:
 *  - the main admin (super_admin) is asked once and, on yes, the whole
 *    amount is posted;
 *  - everybody else is told that the extra will wait. On yes, what is owed
 *    is posted now and the extra is held as a request (pendingCredits). The
 *    account stops at zero. When the main admin confirms, the extra is
 *    posted; if he refuses, nothing ever was.
 * A balance lowered by hand is not "the customer paid more", so only the
 * main admin may take an account below zero that way.
 */

import { withFix } from "./fixAdvice";

/** A cent of rounding is not a credit. */
export const CREDIT_SLACK_USD = 0.01;

/**
 * Marks the one refusal that is really a question. The client's approval
 * link looks for it, asks, and sends the same entry again with
 * `approveCredit: true`. It is stripped before anybody reads the message.
 */
export const ASK_ADMIN_MARK = "[[ask-admin]]";

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * How much credit the account would hold after this entry — 0 when it stays
 * at or above zero. `balanceUsd` positive is debt; `loweredByUsd` is the
 * payment, discount or adjustment about to come off it.
 */
export function creditAfter(balanceUsd: number, loweredByUsd: number): number {
  const after = round2(Number(balanceUsd || 0) - Math.max(0, Number(loweredByUsd || 0)));
  return after < -CREDIT_SLACK_USD ? round2(-after) : 0;
}

/** Only the main admin puts a credit on an account. */
export function mayApproveCredit(role: string | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * What a door does with an entry that would leave a credit.
 *
 *  none     — it leaves none; carry on.
 *  ask_main — ask the main admin; nothing is written yet.
 *  post     — the main admin said yes: post all of it.
 *  ask_hold — tell this person the extra will wait; nothing is written yet.
 *  hold     — they said yes: post what is owed, hold the extra for the main admin.
 *  refuse   — this door does not hold (a hand adjustment); only the main admin may.
 */
export type CreditVerdict = "none" | "ask_main" | "post" | "ask_hold" | "hold" | "refuse";

export function creditVerdict(args: {
  creditUsd: number;
  role: string | null | undefined;
  approved?: boolean;
  /** False for doors where "the customer paid extra" is not what happened. */
  canHold?: boolean;
}): CreditVerdict {
  if (!(args.creditUsd > 0)) return "none";
  if (mayApproveCredit(args.role)) return args.approved ? "post" : "ask_main";
  if (args.canHold === false) return "refuse";
  return args.approved ? "hold" : "ask_hold";
}

const usd = (n: number) => `$${n.toFixed(2)}`;

interface CreditFacts {
  customerCode: string;
  owesUsd: number;
  creditUsd: number;
}

/** A hand adjustment below zero, by anyone but the main admin. */
export function creditRefusal(args: CreditFacts): string {
  const owes = Math.max(0, args.owesUsd);
  return withFix(
    `ئەم تۆمارە سەیڤ ناکرێت: حیسابی ${args.customerCode} تەنها ${usd(owes)} قەرزارە، و ئەم بڕە ${usd(args.creditUsd)} کریدیتی بۆ دروست دەکات. تەنها ئادمینی سەرەکی دەتوانێت بە دەست حیسابێک بباتە ژێر سفر.`,
    [
      `بڕەکە بپشکنە — نابێت لە ${usd(owes)} زیاتر بێت`,
      "ئەگەر کڕیار بەڕاستی پارەی زیادەی داوە، وەک «پارەدان» تۆماری بکە، نەک وەک ڕاستکردنەوە — زیادەکە بۆ ئادمینی سەرەکی دەچێت",
      "ئەگەر دەبێت هەر بە ڕاستکردنەوە بکرێت، داوا لە ئادمینی سەرەکی بکە",
    ],
  );
}

/** What the main admin is asked. Carries the mark; the link strips it. */
/**
 * Said under every credit question (owner, 2026-10-04, AZ274): a customer who
 * paid exactly what the box asked has paid NO extra — a "credit" then means
 * something in the box was never charged. Confirming it would hide that.
 */
export const CREDIT_NOT_EXTRA_HINT =
  "⚠️ ئەگەر کڕیار تەنها ئەو بڕەی داوە کە بۆکسەکە داوای دەکات، «بەڵێ» مەکە: واتە شتێکی ناو بۆکسەکە حیساب نەکراوە، نەک پارەی زیادە. پاشگەزبەرەوە و ئادمینی سەرەکی ئاگادار بکە.";

export function creditQuestion(args: CreditFacts): string {
  const owes = Math.max(0, args.owesUsd);
  return (
    ASK_ADMIN_MARK +
    `حیسابی ${args.customerCode} تەنها ${usd(owes)} قەرزارە.\n` +
    `${usd(args.creditUsd)} زیادەیە: دەبێتە باڵانس (کریدیت) و دەچێتە سەر حیسابی کڕیار.\n\n` +
    "دڵنیایت کڕیار بەڕاستی ئەم پارە زیادەیەی داوە؟ ئەگەر بەڵێ، تۆمار دەکرێت و ناوت وەک ڕەزامەندیدەر دەنووسرێت.\n\n" +
    CREDIT_NOT_EXTRA_HINT
  );
}

/** What everybody else is asked: the extra will wait for the main admin. */
export function creditHoldQuestion(args: CreditFacts): string {
  const owes = Math.max(0, args.owesUsd);
  return (
    ASK_ADMIN_MARK +
    `حیسابی ${args.customerCode} تەنها ${usd(owes)} قەرزارە.\n` +
    `${usd(args.creditUsd)} زیادەیە.\n\n` +
    (owes > 0 ? `${usd(owes)} ئێستا تۆمار دەکرێت و حیسابەکە دەبێتە سفر.\n` : "") +
    `${usd(args.creditUsd)} زیادەکە نایەتە سەر حیسابی کڕیار تا ئادمینی سەرەکی پەسەندی نەکات. ئاگادارییەکەی ئێستا بۆی دەچێت.\n\n` +
    "دڵنیایت کڕیار ئەم پارە زیادەیەی داوە؟\n\n" +
    CREDIT_NOT_EXTRA_HINT
  );
}

/** Said to the person at the till after the extra was held. */
export function creditHeldNotice(creditUsd: number): string {
  return `${usd(creditUsd)} زیادەکە چاوەڕێی پەسەندکردنی ئادمینی سەرەکییە — هێشتا لەسەر حیسابی کڕیار نییە.`;
}
