/**
 * Reading a MySQL error that Drizzle has wrapped.
 *
 * mysql2 puts everything useful on the error object — `code`
 * ("ER_DUP_ENTRY"), `errno` (1062), and `sqlMessage`, which says what went
 * wrong without the SQL text glued to the front. Drizzle wraps that error and
 * moves those fields onto `cause`, leaving a `message` that reads
 * "Failed query: insert into `x` ... params: ...".
 *
 * Code that checks `err.code` on the wrapper therefore sees nothing, and code
 * that greps `err.message` for "duplicate" finds nothing either, because the
 * wrapper's message is the SQL rather than the reason.
 *
 * Found in production: the startup backfill treats a duplicate as "already
 * linked, nothing to do" and anything else as a failure worth logging. Every
 * duplicate was misread as a failure, so once the backfill had run once, every
 * subsequent startup logged a warning for every row it had already written —
 * hundreds of identical lines burying anything that actually mattered.
 *
 * One reader, so the next place that needs this cannot get it subtly wrong.
 */

type ErrLike = Record<string, unknown>;

const asObject = (v: unknown): ErrLike =>
  v && typeof v === "object" ? (v as ErrLike) : {};

/**
 * Walk the wrapper and its cause chain for a field, nearest first.
 * Depth-limited: a cycle in `cause` would otherwise hang the process.
 */
function fromChain<T>(err: unknown, pick: (o: ErrLike) => T | undefined): T | undefined {
  let current = asObject(err);
  for (let depth = 0; depth < 5; depth++) {
    const found = pick(current);
    if (found !== undefined) return found;
    if (!current.cause) return undefined;
    current = asObject(current.cause);
  }
  return undefined;
}

/** MySQL's error code, e.g. "ER_DUP_ENTRY". Empty when there isn't one. */
export function dbErrorCode(err: unknown): string {
  return fromChain(err, (o) => (typeof o.code === "string" ? o.code : undefined)) ?? "";
}

/** MySQL's numeric error, e.g. 1062. Zero when there isn't one. */
export function dbErrorNumber(err: unknown): number {
  return fromChain(err, (o) => (typeof o.errno === "number" ? o.errno : undefined)) ?? 0;
}

/**
 * The reason, without the SQL text.
 *
 * Prefers `sqlMessage` — "Duplicate entry 'EB000016' for key 'packageCode'" —
 * over `message`, which on the wrapper is the whole statement and gets
 * truncated exactly where the useful part would have been.
 */
export function dbErrorReason(err: unknown): string {
  const sqlMessage = fromChain(err, (o) =>
    typeof o.sqlMessage === "string" && o.sqlMessage ? o.sqlMessage : undefined,
  );
  if (sqlMessage) return sqlMessage;
  const message = fromChain(err, (o) =>
    typeof o.message === "string" && o.message ? o.message : undefined,
  );
  return message ?? "";
}

/** A row that already exists — usually "nothing to do", not a failure. */
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    dbErrorCode(err) === "ER_DUP_ENTRY" ||
    dbErrorNumber(err) === 1062 ||
    /duplicate entry|duplicate key/i.test(dbErrorReason(err))
  );
}

/** A referenced row is missing — the data is wrong, not merely repeated. */
export function isForeignKeyError(err: unknown): boolean {
  const code = dbErrorCode(err);
  return (
    code === "ER_NO_REFERENCED_ROW_2" ||
    code === "ER_ROW_IS_REFERENCED_2" ||
    dbErrorNumber(err) === 1452 ||
    dbErrorNumber(err) === 1451
  );
}
