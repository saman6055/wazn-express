import { TRPCError } from "@trpc/server";
import { creditAfter, creditQuestion, creditRefusal, mayApproveCredit } from "@shared/creditGuard";

/**
 * The one question every balance-lowering door asks (shared/creditGuard).
 *
 * Returns the credit an admin approved — for the audit log — or 0 when the
 * account stays at or above zero. Throws CONFLICT for staff, and
 * PRECONDITION_FAILED carrying the question for an admin who has not yet
 * said yes.
 */
export function guardAgainstCredit(args: {
  customerCode: string;
  /** The account now: positive is debt. */
  balanceUsd: number;
  /** What is about to come off it. */
  loweredByUsd: number;
  role: string | null | undefined;
  approved?: boolean;
}): number {
  const creditUsd = creditAfter(args.balanceUsd, args.loweredByUsd);
  if (creditUsd === 0) return 0;
  const facts = { customerCode: args.customerCode, owesUsd: args.balanceUsd, creditUsd };
  if (!mayApproveCredit(args.role)) {
    throw new TRPCError({ code: "CONFLICT", message: creditRefusal(facts) });
  }
  if (!args.approved) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: creditQuestion(facts) });
  }
  return creditUsd;
}
