/**
 * The auditor: an account that sees everything and changes nothing.
 *
 * The owner cannot read every screen of this system every day, so an agent is
 * being given an account to do it — read the figures, compare them, and say
 * when two numbers that should agree do not. That account must not be able to
 * touch a single record, and "must not" here cannot mean "was asked not to".
 * Anything holding the account, person or program, has every button on screen
 * in front of it.
 *
 * So the rule lives on the server and it is one rule, not two hundred and
 * seventy-nine. Checking each mutation individually would work today and fail
 * the first time somebody adds a new one and forgets — and forgetting is the
 * normal case, not the exception. Asking instead "is this a write?" is a
 * question tRPC already answers for every call, so a new router inherits the
 * protection without anyone remembering it exists.
 *
 * This is deliberately not built on the `permissions` table. That table is
 * real, but it is read only by the sidebar: it decides which links are drawn,
 * not which calls are allowed (see server/routers/admin.router.ts). A guarantee
 * built on it would be a guarantee about what the auditor can *see a link to*.
 */

export const AUDITOR_ROLE = "auditor";

/** Roles that may read the whole system and write no part of it. */
export function isReadOnlyRole(role: string | null | undefined): boolean {
  return role === AUDITOR_ROLE;
}

/**
 * Whether a role may run this kind of call.
 *
 * Only mutations are refused. Queries and subscriptions are reads, and reading
 * is the entire point of the account — an auditor that could not read the
 * finance figures would have nothing to audit.
 */
export function mayPerform(
  role: string | null | undefined,
  operation: "query" | "mutation" | "subscription",
): boolean {
  return operation !== "mutation" || !isReadOnlyRole(role);
}

/**
 * What the refused caller is told.
 *
 * It names the reason plainly. There is nothing to hide here and nothing to be
 * gained by vagueness: the account is meant to be read-only, the holder knows
 * it, and a confusing error would only send somebody hunting for a bug.
 */
export const READ_ONLY_REFUSAL =
  "ئەم هەژمارە تەنها بۆ بینینە. ناتوانێت هیچ شتێک زیاد بکات، بگۆڕێت یان بسڕێتەوە.";
