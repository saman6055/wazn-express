import { schedule } from "node-cron";
import { createBackup } from "./backupService.js";
import { getDb } from "./db.js";
import { backups } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Scheduled Backup Configuration
 */
interface ScheduleConfig {
  schedule: "daily" | "weekly" | "monthly";
  cronExpression: string;
  enabled: boolean;
}

const BACKUP_SCHEDULES: ScheduleConfig[] = [
  {
    schedule: "daily",
    cronExpression: "0 2 * * *", // Every day at 2:00 AM
    enabled: true,
  },
  {
    schedule: "weekly",
    cronExpression: "0 3 * * 0", // Every Sunday at 3:00 AM
    enabled: true,
  },
  {
    schedule: "monthly",
    cronExpression: "0 4 1 * *", // First day of month at 4:00 AM
    enabled: true,
  },
];

/**
 * Initialize scheduled backups
 */
export function initializeScheduledBackups() {
  console.log("[Scheduled Backups] Initializing...");

  BACKUP_SCHEDULES.forEach((config) => {
    if (!config.enabled) {
      console.log(`[Scheduled Backups] ${config.schedule} backup is disabled`);
      return;
    }

    schedule(config.cronExpression, async () => {
      console.log(`[Scheduled Backups] Running ${config.schedule} backup...`);
      
      try {
        const result = await createBackup({
          backupType: "scheduled",
          backupContent: "database_only", // Default to database only for scheduled backups
          schedule: config.schedule,
          createdById: 1, // System user
          createdByName: "System",
        });

        console.log(
          `[Scheduled Backups] ${config.schedule} backup completed`
        );
      } catch (error) {
        console.error(
          `[Scheduled Backups] ${config.schedule} backup failed:`,
          error
        );
      }
    });

    console.log(
      `[Scheduled Backups] ${config.schedule} backup scheduled: ${config.cronExpression}`
    );
  });

  console.log("[Scheduled Backups] All schedules initialized");

  // Schedule daily cleanup of old backups (runs at 5:00 AM)
  schedule("0 5 * * *", async () => {
    console.log("[Scheduled Backups] Running cleanup of old backups...");
    try {
      await cleanupOldBackups(30); // Keep last 30 days
      console.log("[Scheduled Backups] Cleanup completed successfully");
    } catch (error) {
      console.error("[Scheduled Backups] Cleanup failed:", error);
    }
  });

  console.log("[Scheduled Backups] Cleanup job scheduled: 0 5 * * * (daily at 5 AM)");
}

/**
 * Get scheduled backup configuration
 */
export function getScheduleConfig() {
  return BACKUP_SCHEDULES.map((config) => ({
    schedule: config.schedule,
    cronExpression: config.cronExpression,
    enabled: config.enabled,
    description: getScheduleDescription(config.schedule),
  }));
}

/**
 * Get human-readable schedule description
 */
function getScheduleDescription(schedule: "daily" | "weekly" | "monthly"): string {
  switch (schedule) {
    case "daily":
      return "هەموو ڕۆژێک لە کاتژمێر 2:00 ی بەیانی";
    case "weekly":
      return "هەموو یەکشەممەیەک لە کاتژمێر 3:00 ی بەیانی";
    case "monthly":
      return "یەکەمی هەر مانگێک لە کاتژمێر 4:00 ی بەیانی";
  }
}

/**
 * Update schedule configuration
 */
export function updateScheduleConfig(
  schedule: "daily" | "weekly" | "monthly",
  enabled: boolean
) {
  const config = BACKUP_SCHEDULES.find((c) => c.schedule === schedule);
  if (config) {
    config.enabled = enabled;
    console.log(`[Scheduled Backups] ${schedule} backup ${enabled ? "enabled" : "disabled"}`);
    return true;
  }
  return false;
}

/**
 * Clean up old backups based on retention policy
 */
export async function cleanupOldBackups(retentionDays: number = 30) {
  const db = await getDb();
  if (!db) {
    console.error("[Scheduled Backups] Database connection failed");
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const deleted = await db
      .delete(backups)
      .where(
        and(
          eq(backups.backupType, "scheduled"),
          // @ts-ignore - Drizzle ORM type issue with date comparison
          backups.createdAt < cutoffDate
        )
      );

    console.log(
      `[Scheduled Backups] Cleaned up old backups (older than ${retentionDays} days)`
    );
  } catch (error) {
    console.error("[Scheduled Backups] Cleanup failed:", error);
  }
}
