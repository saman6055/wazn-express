/**
 * What never leaves the server about an account.
 *
 * `auth.me` handed the browser the whole account row, and the page kept a
 * copy in localStorage: the password hash, the lockout counters and — for a
 * customer — the passport and national-ID scan links and the office's own
 * notes about them. The staff customer list sent every customer's hash to
 * every staff role, the read-only auditor included, and the staff list sent
 * every colleague's. Nothing on any screen used a single one of these fields.
 */
const SECRET_FIELDS = ["passwordHash", "failedLoginAttempts", "lastFailedLoginAt", "lockedUntil"] as const;

/** The office's file on a customer — not part of anyone's own session. */
const OFFICE_FILE_FIELDS = ["passportUrl", "nationalIdUrl", "contractUrl", "notes"] as const;

type SecretField = (typeof SECRET_FIELDS)[number];
type OfficeFileField = (typeof OFFICE_FILE_FIELDS)[number];
/** Omit that keeps a union a union (staff | customer), so neither side loses its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An account row for a staff screen: everything but the secrets. */
export function withoutSecrets<T extends object>(row: T): DistributiveOmit<T, SecretField> {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const key of SECRET_FIELDS) delete copy[key];
  return copy as DistributiveOmit<T, SecretField>;
}

/** Who is signed in, as the browser may know it. */
export function sessionAccount<T extends object>(
  user: T | null | undefined,
): DistributiveOmit<T, SecretField | OfficeFileField> | null {
  if (!user) return null;
  const copy: Record<string, unknown> = { ...(user as Record<string, unknown>) };
  for (const key of SECRET_FIELDS) delete copy[key];
  for (const key of OFFICE_FILE_FIELDS) delete copy[key];
  return copy as DistributiveOmit<T, SecretField | OfficeFileField>;
}
