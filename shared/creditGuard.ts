/**
 * No customer account goes below zero without an admin saying so.
 *
 * Owner, 2026-10-01: "no customer has credit" — nobody prepays here. Yet 75
 * accounts stood in credit, $13,202 between them, and every one of those
 * credits was made by an ordinary entry that nothing questioned: a payment
 * larger than the debt, a balance lowered by hand, a box paid over its due.
 * A credit is almost always a mistake about which debt was being paid, and
 * it is invisible until somebody asks why the customer "has money with us".
 *
 * So the entry itself is stopped. Staff are refused, with the cause and the
 * cure. An admin is asked once, sees how far below zero the account would
 * go, and may say yes — a real overpayment does happen. The doors that can
 * lower a balance all ask the same question through here.
 */

import { withFix } from "./fixAdvice";

/** A cent of rounding is not a credit. */
export const CREDIT_SLACK_USD = 0.01;

/**
 * Marks the one refusal an admin may answer "yes" to. The client's approval
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

export function mayApproveCredit(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/** What ordinary staff are told. */
export function creditRefusal(args: { customerCode: string; owesUsd: number; creditUsd: number }): string {
  const owes = Math.max(0, args.owesUsd);
  return withFix(
    `ئەم تۆمارە سەیڤ ناکرێت: حیسابی ${args.customerCode} تەنها ${usd(owes)} قەرزارە، و ئەم بڕە ${usd(args.creditUsd)} کریدیتی بۆ دروست دەکات. لە سیستەمدا هیچ کڕیارێک نابێت کریدیتی هەبێت.`,
    [
      `بڕەکە بپشکنە — نابێت لە ${usd(owes)} زیاتر بێت`,
      "دڵنیابە لەوەی ئەم پارەیە هی هەمان کڕیارە و پێشتر تۆمار نەکراوە",
      "ئەگەر کڕیار بەڕاستی پارەی زیادەی داوە، داوا لە بەڕێوەبەر بکە تۆماری بکات",
    ],
  );
}

/** What an admin is asked. Carries the mark; the link strips it. */
export function creditQuestion(args: { customerCode: string; owesUsd: number; creditUsd: number }): string {
  const owes = Math.max(0, args.owesUsd);
  return (
    ASK_ADMIN_MARK +
    `حیسابی ${args.customerCode} تەنها ${usd(owes)} قەرزارە.\n` +
    `ئەم تۆمارە ${usd(args.creditUsd)} کریدیتی بۆ دروست دەکات — واتە وەزن قەرزاری کڕیار دەبێت.\n\n` +
    "دڵنیایت کڕیار بەڕاستی ئەم پارە زیادەیەی داوە؟ ناوت وەک ڕەزامەندیدەر تۆمار دەکرێت."
  );
}
