import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";
import { systemSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../db/connection";

// Use the shared connection pool instead of creating individual connections
async function getDbConnection() {
  return await getDb();
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Get all system settings
  getSettings: protectedProcedure.query(async () => {
    const db = await getDbConnection();
    if (!db) return [];
    const settings = await db.select().from(systemSettings);
    return settings;
  }),

  // Get a specific setting by key
  getSetting: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const db = await getDbConnection();
      if (!db) return null;
      const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, input.key)).limit(1);
      return result.length > 0 ? result[0] : null;
    }),

  // Update or create a setting (admin only)
  updateSetting: adminProcedure
    .input(z.object({
      key: z.string(),
      value: z.string(),
      type: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDbConnection();
      if (!db) throw new Error("Database not available");
      
      // Check if setting exists
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, input.key)).limit(1);
      
      if (existing.length > 0) {
        // Update existing
        await db.update(systemSettings)
          .set({
            settingValue: input.value,
            settingType: input.type || "string",
            description: input.description,
            updatedById: ctx.user.id,
          })
          .where(eq(systemSettings.settingKey, input.key));
      } else {
        // Create new
        await db.insert(systemSettings).values({
          settingKey: input.key,
          settingValue: input.value,
          settingType: input.type || "string",
          description: input.description,
          updatedById: ctx.user.id,
        });
      }
      
      return { success: true };
    }),

  // Delete a setting (admin only)
  deleteSetting: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDbConnection();
      if (!db) throw new Error("Database not available");
      
      await db.delete(systemSettings).where(eq(systemSettings.settingKey, input.key));
      return { success: true };
    }),
});
