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
import { runMigrations, getMigrationStatus, TABLE_DEFINITIONS } from "./migrations";

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
      console.log(`[${timestamp}] ${prefix} [AutoMigrate] ${message}`);
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
    } catch (error: any) {
      const errorMsg = error.message || String(error);
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
    
    if (status.missingTables.length === 0) {
      log('All tables already exist, no migration needed', 'success');
      result.success = true;
      result.tablesSkipped = status.existingTables.length;
      result.duration = Date.now() - startTime;
      await connection.end();
      return result;
    }
    
    // Run migrations
    const migrationResult = await runMigrations({
      connection,
      logger: (msg, level) => log(msg, level),
      dryRun: false
    });
    
    result.success = migrationResult.success;
    result.tablesCreated = migrationResult.tablesCreated.length;
    result.tablesSkipped = migrationResult.tablesSkipped.length;
    result.errors = migrationResult.errors.map(e => `${e.table}: ${e.error}`);
    
    if (result.success) {
      log(`Migration completed successfully! Created ${result.tablesCreated} tables.`, 'success');
    } else {
      log(`Migration completed with ${result.errors.length} errors`, 'error');
    }
    
  } catch (error: any) {
    const errorMsg = error.message || String(error);
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
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  console.log('🚀 Starting Wazn Express Auto-Migration v2.0');
  console.log('='.repeat(50));
  
  const result = await autoMigrate({
    databaseUrl,
    retryAttempts: 3,
    retryDelay: 5000,
    verbose: true
  });
  
  console.log('='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   Total tables: ${result.totalTables}`);
  console.log(`   Created: ${result.tablesCreated}`);
  console.log(`   Skipped: ${result.tablesSkipped}`);
  console.log(`   Errors: ${result.errors.length}`);
  console.log(`   Duration: ${result.duration}ms`);
  console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
  }
  
  process.exit(result.success ? 0 : 1);
}

// Check if running as standalone script
if (require.main === module) {
  runStandalone();
}

export default autoMigrate;
