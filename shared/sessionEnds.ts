/**
 * A password change ends every session that was open before it.
 *
 * A session is a signed token the browser keeps, and the server never kept
 * a list of them. So changing a password — the thing a person does when a
 * phone is stolen or a password is seen — changed nothing for whoever held
 * the old session: a customer's token stayed good for a year, a staff
 * member's for the rest of the day. The office had no way to end it.
 *
 * Now a password change stamps the account (`sessionsValidFrom`), every
 * token carries the moment it was minted (`iat`), and a token minted before
 * the stamp is refused on its next request. The customer's own rule — stay
 * signed in until they delete the app (context.ts) — is untouched: nothing
 * here runs a clock, only a password change moves the stamp.
 *
 * Tokens minted before this existed carry no `iat`; they are left alone, and
 * they are replaced within a week anyway (a staff token lasts a day, a
 * customer's renews itself weekly).
 */
export function sessionEnded(
  issuedAtSeconds: number | undefined | null,
  validFrom: Date | string | null | undefined,
): boolean {
  if (!issuedAtSeconds || !validFrom) return false;
  const from = new Date(validFrom).getTime();
  if (!Number.isFinite(from)) return false;
  // Both to the second: the stamp is stored without milliseconds, and a
  // sign-in in the same second as the change is the new password's.
  return Math.floor(issuedAtSeconds) < Math.floor(from / 1000);
}

/** What the browser is told. The cure is the one thing that works. */
export const SESSION_ENDED_MESSAGE = "Session ended by a password change";
