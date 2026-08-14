/**
 * Whether a test can reach a real database.
 *
 * Most of the server suite talks to MySQL. Without a connection those files
 * did not report "cannot run here" — their `beforeAll` threw and the file went
 * red, so thirty files were permanently failing for a reason that had nothing
 * to do with the code. A suite that is always red tells you nothing on the day
 * something actually breaks, and everybody learns to ignore it.
 *
 * `describe.skipIf(!hasDb())` says the honest thing instead: skipped, not
 * broken. Where a database is configured — CI, or a developer pointed at one —
 * the same tests run exactly as before.
 */
export const hasDb = (): boolean => Boolean(process.env.DATABASE_URL);
