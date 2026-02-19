/**
 * Wazn Express - Auto Migration Runner v2.0
 * 
 * This file automatically runs database migrations when the server starts.
 * It ensures all tables exist before the application begins serving requests.
 * 
 * @author Wazn Express Development Team
 * @version 2.0.0
 * @date 2026-02-01
 */

import mysql from "mysql2/promise";
import { appLogger } from "../utils/logger";
import { runMigrations, getMigrationStatus, TABLE_DEFINITIONS, runSchemaPatches } from "./migrations";

// ============ CONFIGURATION ============

interface AutoMigrateConfig {
  databaseUrl: string;
  retryAttempts?: number;
  retryDelay?: number;
  verbose?: boolean;
}

interface AutoMigrateResult {
  success: boolean;
  totalTables: number;
  tablesCreated: number;
  tablesSkipped: number;
  errors: string[];
  duration: number;
}

// ============ LOGGER ============

const createLogger = (verbose: boolean) => {
  return (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[level];
    
    if (verbose || level === 'error' || level === 'success') {
      if (level === 'error') appLogger.error(`[AutoMigrate] ${message}`);
      else if (level === 'warn') appLogger.warn(`[AutoMigrate] ${message}`);
      else appLogger.info(`[AutoMigrate] ${message}`);
    }
  };
};

// ============ DATABASE CONNECTION ============

async function createConnection(databaseUrl: string, retryAttempts: number, retryDelay: number, log: Function): Promise<mysql.Connection | null> {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      log(`Attempting database connection (attempt ${attempt}/${retryAttempts})...`, 'info');
      
      const connection = await mysql.createConnection({
        uri: databaseUrl,
        multipleStatements: true,
        connectTimeout: 30000,
      });
      
      // Test connection
      await connection.ping();
      log('Database connection established successfully', 'success');
      
      return connection;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`Connection attempt ${attempt} failed: ${errorMsg}`, 'error');
      
      if (attempt < retryAttempts) {
        log(`Retrying in ${retryDelay / 1000} seconds...`, 'info');
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  return null;
}

// ============ MAIN MIGRATION FUNCTION ============

export async function autoMigrate(config: AutoMigrateConfig): Promise<AutoMigrateResult> {
  const startTime = Date.now();
  const retryAttempts = config.retryAttempts || 3;
  const retryDelay = config.retryDelay || 5000;
  const verbose = config.verbose ?? true;
  
  const log = createLogger(verbose);
  
  const result: AutoMigrateResult = {
    success: false,
    totalTables: TABLE_DEFINITIONS.length,
    tablesCreated: 0,
    tablesSkipped: 0,
    errors: [],
    duration: 0
  };
  
  log(`Starting auto-migration for ${TABLE_DEFINITIONS.length} tables...`, 'info');
  
  // Create database connection
  const connection = await createConnection(config.databaseUrl, retryAttempts, retryDelay, log);
  
  if (!connection) {
    result.errors.push('Failed to establish database connection after all retry attempts');
    result.duration = Date.now() - startTime;
    log('Auto-migration failed: Could not connect to database', 'error');
    return result;
  }
  
  try {
    // Check current migration status
    const status = await getMigrationStatus(connection);
    log(`Current status: ${status.existingTables.length} tables exist, ${status.missingTables.length} missing`, 'info');
    
    if (status.missingTables.length > 0) {
      // Run migrations for missing tables
      const migrationResult = await runMigrations({
        connection,
        logger: (msg, level) => log(msg, level),
        dryRun: false
      });
      result.success = migrationResult.success;
      result.tablesCreated = migrationResult.tablesCreated.length;
      result.tablesSkipped = migrationResult.tablesSkipped.length;
      result.errors = migrationResult.errors.map(e => `${e.table}: ${e.error}`);
      if (!result.success) {
        log(`Migration completed with ${result.errors.length} errors`, 'error');
        result.duration = Date.now() - startTime;
        await connection.end();
        return result;
      }
    } else {
      log('All tables already exist', 'success');
      result.tablesSkipped = status.existingTables.length;
    }

    // Run schema patches (e.g. add missing columns to serviceTypes on existing DBs)
    const patchResult = await runSchemaPatches({
      connection,
      logger: (msg, level) => log(msg, level),
      dryRun: false
    });
    if (patchResult.applied.length > 0) {
      log(`Schema patches applied: ${patchResult.applied.length}`, 'success');
    }

    if (status.missingTables.length === 0) {
      result.success = true;
    }
    if (result.success) {
      log(`Migration completed successfully! Created ${result.tablesCreated} tables.`, 'success');
    } else if (result.errors.length > 0) {
      log(`Migration completed with ${result.errors.length} errors`, 'error');
    }
    
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Migration error: ${errorMsg}`);
    log(`Migration failed: ${errorMsg}`, 'error');
  } finally {
    try {
      await connection.end();
      log('Database connection closed', 'info');
    } catch (e) {
      // Ignore close errors
    }
  }
  
  result.duration = Date.now() - startTime;
  log(`Total migration time: ${result.duration}ms`, 'info');
  
  return result;
}

// ============ STANDALONE EXECUTION ============

/**
 * Run migration as standalone script
 * Usage: npx ts-node server/_core/autoMigrate.ts
 */
export async function runStandalone(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    appLogger.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  appLogger.info('Starting Wazn Express Auto-Migration v2.0');
  appLogger.info('='.repeat(50));
  
  const result = await autoMigrate({
    databaseUrl,
    retryAttempts: 3,
    retryDelay: 5000,
    verbose: true
  });
  
  appLogger.info('='.repeat(50));
  appLogger.info('Migration Summary', { totalTables: result.totalTables, created: result.tablesCreated, skipped: result.tablesSkipped, errors: result.errors.length, duration: result.duration, success: result.success });
  
  if (result.errors.length > 0) {
    appLogger.error('Migration errors', { errors: result.errors });
  }
  
  process.exit(result.success ? 0 : 1);
}

// Check if running as standalone script
if (require.main === module) {
  runStandalone();
}

export default autoMigrate;
