import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { appLogger } from "../utils/logger";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

export async function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    appLogger.warn("DATABASE_URL not set — running without database");
    return null;
  }

  try {
    const poolSize = parseInt(process.env.DB_POOL_SIZE ?? "10", 10) || 10;
    _pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: poolSize,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });

    _db = drizzle(_pool) as unknown as ReturnType<typeof drizzle>;
    appLogger.info("Database connection pool created");
    return _db;
  } catch (error) {
    appLogger.error("Database connection failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    appLogger.info("Database connection pool closed");
  }
}
