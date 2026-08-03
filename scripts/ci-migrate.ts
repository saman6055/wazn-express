/**
 * Build the schema on a blank database so CI can actually run the tests.
 *
 * Most of this suite talks to MySQL. On a machine with no database they fail
 * on "Database not available" — 87 of them did, which meant the business logic
 * they cover was never verified by anything. Handing CI a real database is
 * what turns them from decoration back into tests.
 *
 * Uses the same autoMigrate the production server runs at startup, so CI
 * exercises the real migration path rather than a parallel one that could
 * quietly disagree with it.
 */
import autoMigrate from "../server/_core/autoMigrate";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set — nothing to migrate against.");
    process.exit(1);
  }

  const result = await autoMigrate({
    databaseUrl,
    // The service container reports healthy a moment before it accepts
    // connections; a few retries beat a flaky first run.
    retryAttempts: 10,
    retryDelay: 3000,
    verbose: true,
  });

  console.log(
    `tables: ${result.tablesCreated} created, ${result.tablesSkipped} already present ` +
    `(of ${result.totalTables})`,
  );

  if (!result.success) {
    console.error("Migration failed:");
    for (const error of result.errors ?? []) console.error(`  ${error}`);
    process.exit(1);
  }

  // Schema patches are additive ALTERs that re-run harmlessly; a failure in
  // one is reported by autoMigrate itself and already caught above.
  console.log("Schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
