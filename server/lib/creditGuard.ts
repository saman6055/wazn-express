import { TRPCError } from "@trpc/server";
import {
  creditAfter, creditHoldQuestion, creditQuestion, creditRefusal, creditVerdict,
} from "@shared/creditGuard";

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
