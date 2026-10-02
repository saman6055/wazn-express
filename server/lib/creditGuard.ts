import { TRPCError } from "@trpc/server";
import {
  ASK_ADMIN_MARK, creditAfter, creditHoldQuestion, creditQuestion, creditRefusal, creditVerdict, mayApproveCredit,
} from "@shared/creditGuard";
import { CreditWouldBeMadeError } from "../db/finance.db";

/**
 * The one question every balance-lowering door asks (shared/creditGuard).
 *
 * Returns what the door must do:
 *  - `post`  — write the whole entry; `creditUsd` is the credit it leaves
 *              (0 when none), approved by the main admin when above zero.
 *  - `hold`  — write only what is owed and hold `creditUsd` for the main
 *              admin (createPendingCredit).
 * Throws PRECONDITION_FAILED carrying the question while nobody has said
 * yes, and CONFLICT for a door that cannot hold.
 */
export function guardAgainstCredit(args: {
  customerCode: string;
  /** The account now: positive is debt. */
  balanceUsd: number;
  /** What is about to come off it. */
  loweredByUsd: number;
  role: string | null | undefined;
  approved?: boolean;
  /** False for a hand adjustment: only the main admin may take it below zero. */
  canHold?: boolean;
}): { action: "post" | "hold"; creditUsd: number } {
  const creditUsd = creditAfter(args.balanceUsd, args.loweredByUsd);
  const facts = { customerCode: args.customerCode, owesUsd: args.balanceUsd, creditUsd };
  switch (creditVerdict({ creditUsd, role: args.role, approved: args.approved, canHold: args.canHold })) {
    case "none":
    case "post":
      return { action: "post", creditUsd };
    case "hold":
      return { action: "hold", creditUsd };
    case "ask_main":
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: creditQuestion(facts) });
    case "ask_hold":
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: creditHoldQuestion(facts) });
    case "refuse":
      throw new TRPCError({ code: "CONFLICT", message: creditRefusal(facts) });
  }
}

/**
 * An undo that the ledger refused because it would leave a credit
 * (CreditWouldBeMadeError in db/finance.db).
 *
 * Everybody is told the cure: undo the receipt first. The main admin is
 * asked instead, because he alone may say "this was paid out of the
 * customer's own official credit, so it goes back there" — and sending the
 * same request again with `approveCredit` lets it through.
 *
 * Returns the error to throw, or null when `err` is something else.
 */
export function undoCreditRefusal(err: unknown, role: string | null | undefined): TRPCError | null {
  if (!(err instanceof CreditWouldBeMadeError)) return null;
  if (!mayApproveCredit(role)) return new TRPCError({ code: "CONFLICT", message: err.message });
  return new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      ASK_ADMIN_MARK +
      `ئەم کارە $${err.creditUsd.toFixed(2)} دەخاتە سەر کریدیتی کڕیار.\n\n` +
      "ئەمە تەنها کاتێک ڕاستە کە پارەی ئەم شتە لە کریدیتی ڕەسمیی کڕیار خۆیەوە ڕۆیشتبێت — ئەوکات دەگەڕێتەوە شوێنی خۆی.\n" +
      "ئەگەر پارەکەی بە وەسڵ وەرگیراوە، پاشگەز ببەوە و یەکەم وەسڵەکە هەڵبوەشێنەوە.\n\n" +
      "دڵنیایت پارەکە لە کریدیتی کڕیارەوە ڕۆیشتبوو؟",
  });
}
