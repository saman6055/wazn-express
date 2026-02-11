import { drizzle } from "drizzle-orm/mysql2";
import { appLogger } from "../utils/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      appLogger.warn("Database connection failed", { error: error instanceof Error ? error.message : String(error) });
      _db = null;
    }
  }
  return _db;
}
