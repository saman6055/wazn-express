import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DASHBOARD_FIGURE_IDS, type DashboardFigureId } from "@shared/dashboardExplain";
import { eq, desc } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { cacheGetOrSet, CACHE_TTL } from "../db/cache";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";
import { backups } from "../../drizzle/schema";
import { systemRouter } from "../_core/systemRouter";
import { getConfig } from "../config";
import { appLogger } from "../utils/logger";
import { runMigration } from "../services/migration.service";
import {
  getDashboardReportData,
  generateDashboardPDF,
  getDateFilteredDashboardData,
  generateDateFilteredDashboardPDF,
  getCustomerReportData,
  generateCustomerPDF,
  getBatchReportData,
  generateBatchPDF,
} from "../services/pdf.service";
import { createZipBackup, restoreFromZipBackup } from "../services/zipBackup.service";
import { createBackup, restoreBackup } from "../services/backup.service";
import { getScheduleConfig, updateScheduleConfig } from "../services/scheduledBackups.service";

export const migrationRouter = router({
  run: adminProcedure
    .input(z.object({ secret: z.string().min(1).max(500) }))
    .mutation(async ({ input }) => {
      if (input.secret !== getConfig().migrationSecret) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid migration secret" });
      }
      return runMigration();
    }),
});

export const dataManagementRouter = router({
    // Get data counts
    getCounts: adminProcedure.query(async () => {
      return db.getDataCounts();
    }),
    
    // Delete all customers
    deleteAllCustomers: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllCustomers();
      }),
    
    // Delete all packages
    deleteAllPackages: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllPackages();
      }),
    
    // Delete all batches
    deleteAllBatches: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllBatches();
      }),
    
    // Delete all invoices
    deleteAllInvoices: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllInvoices();
      }),
    
    // Delete all payments
    deleteAllPayments: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllPayments();
      }),
    
    // Delete all expenses
    deleteAllExpenses: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllExpenses();
      }),
    
    // Delete all ledger transactions (unified system)
    deleteAllLedgerTransactions: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllLedgerTransactions();
      }),
    
    // Delete all full packages
    deleteAllFullPackages: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllFullPackages();
      }),
    
    // Delete all suppliers
    deleteAllSuppliers: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllSuppliers();
      }),
    
    // Full system reset with automatic backup
    resetAllData: adminProcedure
      .input(z.object({ confirmation: z.literal('RESET ALL DATA') }))
      .mutation(async ({ ctx }) => {
        // Step 1: Create automatic backup before reset
        let backupInfo: { success: boolean; backupId?: number; fileUrl?: string; fileName?: string } = { success: false };
        try {
          const exportResult = await db.exportAllData();
          if (exportResult.success && exportResult.totalRecords > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `pre-reset-backup-${timestamp}.json`;
            const fileKey = `backups/pre-reset/${fileName}`;
            const jsonData = JSON.stringify(exportResult.data, null, 2);
            
            const { storagePut } = await import('../services/storage.service');
            const uploadResult = await storagePut(fileKey, jsonData, 'application/json');
            
            if (uploadResult.url) {
              const backupResult = await db.createPreResetBackup({
                filename: fileName,
                fileKey: fileKey,
                fileUrl: uploadResult.url,
                fileSize: Buffer.byteLength(jsonData, 'utf8'),
                recordsCount: exportResult.totalRecords,
                createdById: ctx.user.id,
                createdByName: ctx.user.name || 'Admin'
              });
              backupInfo = { success: true, backupId: backupResult.id, fileUrl: uploadResult.url, fileName };
            }
          }
        } catch (e) {
          appLogger.error('Failed to create pre-reset backup', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // Step 2: Perform the reset
        const result = await db.resetAllData();
        
        // Step 3: Log the reset
        if (result.success) {
          try {
            await db.createDeletionLog({
              category: 'all_data',
              deletionType: 'factory_reset',
              recordCount: 0,
              details: { affectedTables: ['All tables'], backupCreated: backupInfo.success },
              backupCreated: backupInfo.success,
              backupFileUrl: backupInfo.fileUrl,
              backupFileName: backupInfo.fileName,
              deletedById: ctx.user.id,
              deletedByName: ctx.user.name || 'Admin',
              reason: 'Factory reset performed by admin'
            });
          } catch (e) {
            appLogger.error('Failed to create deletion log', { error: e instanceof Error ? e.message : String(e) });
          }
          
          try {
            const { notifyOwner } = await import('../_core/notification');
            await notifyOwner({
              title: '⚠️ Factory Reset Performed',
              content: `All system data has been reset by ${ctx.user.name || 'Admin'}. ${backupInfo.success ? 'A backup was created before reset.' : 'No backup was created.'}`
            });
          } catch (e) {
            appLogger.error('Failed to send reset notification', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        
        return { ...result, backupCreated: backupInfo.success, backupUrl: backupInfo.fileUrl, backupFileName: backupInfo.fileName };
      }),
    
    // Get detailed data counts with stats
    getDetailedCounts: adminProcedure.query(async () => {
      return db.getDetailedDataCounts();
    }),
    
    // Get reset history (factory resets only)
    getResetHistory: adminProcedure
      .input(z.object({ limit: z.number().optional(), offset: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getResetHistory(input);
      }),
    
    // Delete old data
    deleteOldData: adminProcedure
      .input(z.object({
        confirmation: z.literal('DELETE'),
        daysOld: z.number().min(1),
        dataType: z.enum(['packages', 'scans', 'ledger', 'invoices'])
      }))
      .mutation(async ({ input }) => {
        return db.deleteOldData(input.daysOld, input.dataType);
      }),
    
    // Delete all scans
    deleteAllScans: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllScans();
      }),
    
    // Delete all status history
    deleteAllStatusHistory: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllStatusHistory();
      }),
    
    // Delete all audit logs
    deleteAllAuditLogs: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllAuditLogs();
      }),
    
    // Delete all blog posts
    deleteAllBlogPosts: adminProcedure
      .input(z.object({ confirmation: z.literal('DELETE') }))
      .mutation(async () => {
        return db.deleteAllBlogPosts();
      }),
    
    // Get deletion preview
    getDeletionPreview: adminProcedure
      .input(z.object({
        dataType: z.string(),
        daysOld: z.number().optional()
      }))
      .query(async ({ input }) => {
        return db.getDeletionPreview(input.dataType, input.daysOld);
      }),
    
    // ============ DELETION LOGS ============
    
    // Get deletion logs
    getDeletionLogs: adminProcedure
      .input(z.object({
        category: z.string().optional(),
        deletionType: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
        offset: z.number().optional()
      }).optional())
      .query(async ({ input }) => {
        return db.getDeletionLogs(input);
      }),
    
    // Create deletion log (internal use after deletions)
    createDeletionLog: adminProcedure
      .input(z.object({
        category: z.string(),
        deletionType: z.enum(['single_category', 'old_data', 'test_data', 'factory_reset']),
        recordCount: z.number(),
        details: z.record(z.string(), z.any()).optional(),
        backupCreated: z.boolean().optional(),
        backupFileUrl: z.string().optional(),
        backupFileName: z.string().optional(),
        reason: z.string().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createDeletionLog({
          ...input,
          deletedById: ctx.user.id,
          deletedByName: ctx.user.name || undefined
        });
      }),
    
    // ============ DATA EXPORT ============
    
    // Export category data
    exportCategory: adminProcedure
      .input(z.object({
        category: z.string()
      }))
      .mutation(async ({ input }) => {
        return db.exportCategoryData(input.category);
      }),
    
    // Export all data
    exportAllData: adminProcedure.mutation(async () => {
      return db.exportAllData();
    }),
    
    // ============ DATA IMPORT ============
    
    // Import category data
    importCategory: adminProcedure
      .input(z.object({
        category: z.string(),
        data: z.array(z.record(z.string(), z.any())),
        overwrite: z.boolean().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.importCategoryData(input.category, input.data, input.overwrite);
        // Notify owner about import
        if (result.success && result.importedCount > 0) {
          try {
            const { notifyOwner } = await import('../_core/notification');
            await notifyOwner({
              title: `Data Import: ${input.category}`,
              content: `${result.importedCount} records imported to ${input.category} by ${ctx.user.name || 'Admin'}`
            });
          } catch (e) {
            appLogger.error('Failed to send import notification', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        return result;
      }),
    
    // Import all data (full restore)
    importAllData: adminProcedure
      .input(z.object({
        data: z.record(z.string(), z.array(z.record(z.string(), z.any()))),
        overwrite: z.boolean().optional()
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.importAllData(input.data, input.overwrite);
        // Notify owner about full import
        if (result.success && result.totalImported > 0) {
          try {
            const { notifyOwner } = await import('../_core/notification');
            await notifyOwner({
              title: 'Full Data Import',
              content: `${result.totalImported} total records imported across ${Object.keys(input.data).length} categories by ${ctx.user.name || 'Admin'}`
            });
          } catch (e) {
            appLogger.error('Failed to send import notification', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        return result;
      }),
});

export const dashboardRouter = router({
    // Financial statistics (cached 30s)
    financialStats: staffProcedure.query(async () => {
      return cacheGetOrSet("dashboard:financialStats", CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardFinancialStats());
    }),

    /**
     * What one dashboard figure is made of.
     *
     * Asked for only when somebody opens a figure, not with the dashboard —
     * eleven breakdowns nobody looked at would be eleven queries on every
     * page load. Cached like the figures themselves so opening the same one
     * twice costs nothing.
     */
    figureParts: staffProcedure
      .input(z.object({ figure: z.enum(DASHBOARD_FIGURE_IDS as [DashboardFigureId, ...DashboardFigureId[]]) }))
      .query(async ({ input }) => {
        return cacheGetOrSet(
          `dashboard:figureParts:${input.figure}`,
          CACHE_TTL.DASHBOARD_STATS_MS,
          () => db.getDashboardFigureParts(input.figure),
        );
      }),
    
    // Revenue chart data (30 days) (cached 30s)
    revenueChart: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 30;
        return cacheGetOrSet(`dashboard:revenueChart:${days}`, CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardRevenueChart(days));
      }),

    // Profit/Loss chart: daily revenue, expenses, profit (داهات، خەرجی، قازانج) (cached 30s)
    profitLossChart: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 30;
        return cacheGetOrSet(`dashboard:profitLossChart:${days}`, CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardProfitLossChart(days));
      }),

    // Active batches (cached 30s)
    activeBatches: staffProcedure.query(async () => {
      return cacheGetOrSet("dashboard:activeBatches", CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardActiveBatches());
    }),
    
    // Top debtors (cached 30s)
    topDebtors: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit || 5;
        return cacheGetOrSet(`dashboard:topDebtors:${limit}`, CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardTopDebtors(limit));
      }),
    
    // Recent activity (cached 30s)
    recentActivity: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit || 10;
        return cacheGetOrSet(`dashboard:recentActivity:${limit}`, CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardRecentActivity(limit));
      }),
    
    // Alerts (cached 30s)
    alerts: staffProcedure.query(async () => {
      return cacheGetOrSet("dashboard:alerts", CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardAlerts());
    }),
    
    // New customers count (cached 30s)
    newCustomers: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 7;
        return cacheGetOrSet(`dashboard:newCustomers:${days}`, CACHE_TTL.DASHBOARD_STATS_MS, () => db.getDashboardNewCustomers(days));
      }),

    // Weekly wins / records to celebrate (cached 30s)
    weeklyHighlights: staffProcedure.query(async () => {
      return cacheGetOrSet("dashboard:weeklyHighlights", CACHE_TTL.DASHBOARD_STATS_MS, () => db.getWeeklyHighlights());
    }),
    
    // Export dashboard as PDF
    exportPDF: staffProcedure.mutation(async () => {
      const data = await getDashboardReportData();
      const pdfBuffer = await generateDashboardPDF(data);
      return {
        pdf: pdfBuffer.toString('base64'),
        filename: `wazn-express-dashboard-${new Date().toISOString().split('T')[0]}.pdf`
      };
    }),
    
    // Export dashboard with date filter as PDF
    exportFilteredPDF: staffProcedure
      .input(z.object({
        period: z.enum(['week', 'month', 'year', 'custom']),
        customStart: z.date().optional(),
        customEnd: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const data = await getDateFilteredDashboardData(input.period, input.customStart, input.customEnd);
        const pdfBuffer = await generateDateFilteredDashboardPDF(data);
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `wazn-express-report-${input.period}-${new Date().toISOString().split('T')[0]}.pdf`
        };
      }),
    
    // Export customer report as PDF
    exportCustomerPDF: staffProcedure
      .input(z.object({
        customerId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const data = await getCustomerReportData(input.customerId, input.startDate, input.endDate);
        if (!data) throw new Error('Customer not found');
        const pdfBuffer = await generateCustomerPDF(data);
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `wazn-express-customer-${data.customer.customerCode}-${new Date().toISOString().split('T')[0]}.pdf`
        };
      }),
    
    // Export batch report as PDF
    exportBatchPDF: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ input }) => {
        const data = await getBatchReportData(input.batchId);
        if (!data) throw new Error('Batch not found');
        const pdfBuffer = await generateBatchPDF(data);
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `wazn-express-batch-${data.batch.batchCode}-${new Date().toISOString().split('T')[0]}.pdf`
        };
      }),
});

export const usersRouter = router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["super_admin", "admin", "employee", "accountant"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserRole(input.userId, input.role);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_role",
          entityType: "user",
          entityId: input.userId,
          newValues: { role: input.role },
        });
        return { success: true };
      }),
});

export const auditLogsRouter = router({
    // Advanced list with filters
    list: adminProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        category: z.string().optional(),
        entityType: z.string().optional(),
        action: z.string().optional(),
        userId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        // Convert string dates to Date objects if provided
        let startDate = input?.startDate;
        let endDate = input?.endDate;
        
        if (input?.dateFrom) {
          startDate = new Date(input.dateFrom);
          startDate.setHours(0, 0, 0, 0);
        }
        if (input?.dateTo) {
          endDate = new Date(input.dateTo);
          endDate.setHours(23, 59, 59, 999);
        }
        
        return db.getAdvancedAuditLogs(
          {
            category: input?.category,
            entityType: input?.entityType,
            action: input?.action,
            userId: input?.userId,
            startDate,
            endDate,
            search: input?.search,
          },
          input?.limit || 100,
          input?.offset || 0
        );
      }),
    
    // Get single audit log by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getAuditLogById(input.id);
      }),
    
    // Get audit logs for specific entity
    getByEntity: adminProcedure
      .input(z.object({
        entityType: z.string(),
        entityId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getAuditLogsByEntity(input.entityType, input.entityId);
      }),
    
    // Get audit logs for customer
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getAuditLogsByEntity("customer", input.customerId);
      }),
    
    // Get audit log statistics
    getStats: adminProcedure.query(async () => {
      return db.getAuditLogStats();
    }),
    
    // Get available filters (for dropdowns)
    getFilters: adminProcedure.query(async () => {
      return {
        categories: [
          { value: 'customer', label: 'کڕیارەکان' },
          { value: 'package', label: 'پاکەتەکان' },
          { value: 'batch', label: 'باچەکان' },
          { value: 'full_package', label: 'پاکێجی تەواو' },
          { value: 'purchase_request', label: 'داواکاری کڕین' },
          { value: 'commission', label: 'کڕین بە تێچوو' },
          { value: 'finance', label: 'دارایی' },
          { value: 'settings', label: 'ڕێکخستنەکان' },
          { value: 'user', label: 'بەکارهێنەرەکان' },
          { value: 'system', label: 'سیستەم' },
        ],
        actions: [
          { value: 'create', label: 'دروستکردن' },
          { value: 'update', label: 'نوێکردنەوە' },
          { value: 'delete', label: 'سڕینەوە' },
          { value: 'status_change', label: 'گۆڕینی بارودۆخ' },
          { value: 'charge', label: 'چارج کردن' },
          { value: 'payment', label: 'پارەدان' },
        ],
      };
    }),
});

export const activityAlertsRouter = router({
    // Get alerts list
    list: adminProcedure
      .input(z.object({
        category: z.string().optional(),
        severity: z.string().optional(),
        isRead: z.boolean().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }).optional())
      .query(async ({ input }) => {
        return db.getActivityAlerts({
          category: input?.category,
          severity: input?.severity,
          isRead: input?.isRead,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
      }),
    
    // Get alert statistics
    getStats: adminProcedure.query(async () => {
      return db.getAlertStats();
    }),
    
    // Mark alert as read
    markAsRead: adminProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markAlertAsRead(input.alertId, ctx.user.id);
        return { success: true };
      }),
    
    // Mark all alerts as read
    markAllAsRead: adminProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllAlertsAsRead(ctx.user.id);
        return { success: true };
      }),
});

export const adminMessagesRouter = router({
    // Get all conversations with customers
    getConversations: adminProcedure.query(async () => {
      return db.getAllConversations();
    }),
    
    // Get messages for a specific customer
    getMessages: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const messages = await db.getCustomerMessages(input.customerId, 100);
        // Mark messages as read by admin
        await db.markCustomerMessagesAsRead(input.customerId, 'admin');
        return messages;
      }),
    
    // Send reply to customer
    sendReply: adminProcedure
      .input(z.object({
        customerId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        // Get customer's conversation ID or create new one
        const existingMessages = await db.getCustomerMessages(input.customerId, 1);
        const conversationId = existingMessages.length > 0 
          ? existingMessages[0].conversationId 
          : `conv_${input.customerId}_${Date.now()}`;
        
        const message = await db.createCustomerMessage({
          customerId: input.customerId,
          conversationId,
          senderType: 'admin',
          senderId: ctx.user.id,
          message: input.message,
          isRead: false,
        });

        // Notify the customer (in-app + SSE + auto web-push with sound) so a
        // reply never sits unseen until they happen to open the chat.
        try {
          const preview = input.message.slice(0, 160);
          await db.createCustomerNotification({
            customerId: input.customerId,
            type: "info",
            relatedType: "package",
            actionUrl: "/portal/messages",
            title: "New reply from support", titleKu: "وەڵامی نوێ لە پشتگیری", titleAr: "رد جديد من الدعم",
            message: preview, messageKu: preview, messageAr: preview,
          });
        } catch {
          // Best-effort — the chat message itself already saved.
        }

        return message;
      }),
    
    // Get unread count for all customers
    getUnreadCount: adminProcedure.query(async () => {
      const conversations = await db.getAllConversations();
      return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    }),
});

export const suppliersRouter = router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().default(true) }).optional())
      .query(async ({ input }) => {
        return db.getAllSuppliers(input?.activeOnly ?? true);
      }),
    
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSupplierById(input.id);
      }),
    
    create: staffProcedure
      .input(z.object({
        name: z.string().min(1),
        nameArabic: z.string().optional(),
        nameChinese: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        wechatId: z.string().optional(),
        email: z.string().email().optional(),
        platform: z.enum(["1688", "taobao", "alibaba", "pinduoduo", "other"]).default("1688"),
        platformShopUrl: z.string().optional(),
        rating: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const supplier = await db.createSupplier({
          ...input,
          createdById: ctx.user.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_supplier",
          entityType: "supplier",
          entityId: supplier.id,
          newValues: input,
        });
        
        return supplier;
      }),
    
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameArabic: z.string().optional(),
        nameChinese: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        wechatId: z.string().optional(),
        email: z.string().email().optional(),
        platform: z.enum(["1688", "taobao", "alibaba", "pinduoduo", "other"]).optional(),
        platformShopUrl: z.string().optional(),
        rating: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const existing = await db.getSupplierById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
        }
        
        await db.updateSupplier(id, data);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_supplier",
          entityType: "supplier",
          entityId: id,
          oldValues: existing,
          newValues: data,
        });
        
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteSupplier(input.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_supplier",
          entityType: "supplier",
          entityId: input.id,
        });
        
        return { success: true };
      }),
});

export const notificationsRouter = router({
    getSettings: adminProcedure.query(async () => {
      return await db.getNotificationSettings();
    }),
    
    updateSetting: adminProcedure
      .input(z.object({
        eventType: z.string(),
        emailEnabled: z.boolean(),
        smsEnabled: z.boolean(),
        whatsappEnabled: z.boolean(),
        customSubject: z.string().optional(),
        customBody: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await db.upsertNotificationSetting({
          ...input,
          updatedById: ctx.user.id,
        });
      }),
    
    saveWhatsappConfig: adminProcedure
      .input(z.object({
        apiKey: z.string(),
        phoneNumberId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Save WhatsApp config to all notification settings
        await db.updateWhatsappConfig(input.apiKey, input.phoneNumberId, ctx.user.id);
        return { success: true };
      }),
});

export const backupRouter = router({
    // Create a new backup
    create: adminProcedure
      .input(z.object({
        backupType: z.enum(["manual", "scheduled"]).default("manual"),
        backupContent: z.enum(["database_only", "files_only", "full"]).default("database_only"),
        schedule: z.enum(["daily", "weekly", "monthly"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        appLogger.info('[BACKUP] Create backup called', { input, userId: ctx.user.id, userName: ctx.user.name });
        
        // Use new ZIP backup system for full backups
        if (input.backupContent === "full") {
          try {
            return await createZipBackup({
              backupType: input.backupType,
              schedule: input.schedule,
              createdById: ctx.user.id,
              createdByName: ctx.user.name || undefined,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            appLogger.error("[BACKUP] Full ZIP backup failed", { error: msg });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: msg || "پاشەکەوتی ZIP شکستی هێنا / ZIP backup failed",
            });
          }
        }
        
        // Use original backup service for database-only and files-only
        return await createBackup({
          backupType: input.backupType,
          backupContent: input.backupContent,
          schedule: input.schedule,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || undefined,
        });
      }),

    // List all backups
    list: adminProcedure
      .input(z.object({
        status: z.enum(["in_progress", "completed", "failed"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        let query = database.select().from(backups);
        
        if (input.status) {
          query = query.where(eq(backups.status, input.status)) as any;
        }
        
        const results = await query
          .orderBy(desc(backups.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        
        return results;
      }),

    // Get backup by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const [backup] = await database.select().from(backups).where(eq(backups.id, input.id));
        
        if (!backup) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Backup not found" });
        }
        
        return backup;
      }),

    // Delete a backup
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        await database.delete(backups).where(eq(backups.id, input.id));
        
        return { success: true };
      }),

    // Restore from backup
    restore: adminProcedure
      .input(z.object({ 
        id: z.number(),
        clearExisting: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        // Get backup to check if it's a ZIP backup
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const [backup] = await database.select().from(backups).where(eq(backups.id, input.id));
        
        if (!backup) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Backup not found" });
        }
        
        // Check if it's a ZIP backup (filename ends with .zip)
        if (backup.filename?.endsWith('.zip')) {
          return await restoreFromZipBackup(input.id, input.clearExisting);
        }
        
        // Use original restore for JSON backups
        return await restoreBackup(input.id);
      }),

    // Get schedule configuration
    getScheduleConfig: adminProcedure.query(() => getScheduleConfig()),

    // Update schedule configuration
    updateSchedule: adminProcedure
      .input(z.object({
        schedule: z.enum(["daily", "weekly", "monthly"]),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const success = updateScheduleConfig(input.schedule, input.enabled);
        return { success };
      }),
});

/**
 * May this user change that user's permissions?
 *
 * `bulkUpdate` carried this check inline while `setPermission`,
 * `setSubPermission` and `deletePermissions` sat on bare `protectedProcedure`
 * — which any signed-in session satisfies, including a portal customer. A
 * customer could grant themselves nothing useful today, because permissions
 * are enforced in the UI rather than on the server, but they could strip an
 * admin's rows and write audit entries stamped `userRole: "customer"`. The
 * moment enforcement moves server-side it becomes privilege escalation.
 *
 * Now every writer goes through here, and the rule is stated once.
 */
async function assertCanManagePermissions(
  ctx: { user: { role: string } },
  targetUserId: number,
): Promise<void> {
  const targetUser = await db.getUserById(targetUserId);
  if (!targetUser) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  if (ctx.user.role === "super_admin") return;
  if (ctx.user.role === "admin") {
    // An admin must not be able to edit another admin, or themselves upward.
    if (targetUser.role !== "employee" && targetUser.role !== "accountant") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin can only manage Employee and Accountant roles",
      });
    }
    return;
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You do not have permission to manage user permissions",
  });
}

export const permissionsRouter = router({
    // Get user permissions
    getUserPermissions: staffProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const perms = await db.getUserPermissions(input.userId);
        const subPerms = await db.getUserSubPermissions(input.userId);
        return {
          permissions: perms,
          subPermissions: subPerms,
        };
      }),

    // Check if user has permission
    checkPermission: staffProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        action: z.enum(["view", "create", "edit", "delete"]),
      }))
      .query(async ({ input }) => {
        const hasPermission = await db.checkUserPermission(
          input.userId,
          input.module,
          input.action
        );
        return { hasPermission };
      }),

    // Check if user has sub-permission
    checkSubPermission: staffProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        permissionKey: z.string(),
      }))
      .query(async ({ input }) => {
        const hasPermission = await db.checkUserSubPermission(
          input.userId,
          input.module,
          input.permissionKey
        );
        return { hasPermission };
      }),

    // Set module permission
    setPermission: adminProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        canView: z.boolean(),
        canCreate: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertCanManagePermissions(ctx, input.userId);
        const permission = await db.setUserPermission(input);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_permission",
          entityType: "permission",
          entityId: input.userId,
        });
        
        return permission;
      }),

    // Set sub-permission
    setSubPermission: adminProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        permissionKey: z.string(),
        isAllowed: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertCanManagePermissions(ctx, input.userId);
        const subPermission = await db.setUserSubPermission(input);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_sub_permission",
          entityType: "permission",
          entityId: input.userId,
        });
        
        return subPermission;
      }),

    // Bulk update permissions
    bulkUpdate: adminProcedure
      .input(z.object({
        userId: z.number(),
        permissions: z.array(z.object({
          module: z.string(),
          canView: z.boolean(),
          canCreate: z.boolean(),
          canEdit: z.boolean(),
          canDelete: z.boolean(),
        })),
        subPermissions: z.array(z.object({
          module: z.string(),
          permissionKey: z.string(),
          isAllowed: z.boolean(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertCanManagePermissions(ctx, input.userId);
        await db.bulkUpdateUserPermissions(input);
        
        // Create audit log
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_permissions",
          entityType: "user",
          entityId: input.userId,
        });
        
        return { success: true };
      }),

    // Delete user permissions
    deletePermissions: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await assertCanManagePermissions(ctx, input.userId);
        await db.deleteUserPermissions(input.userId);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_permissions",
          entityType: "user",
          entityId: input.userId,
        });
        
        return { success: true };
      }),
});

export const supportChatRouter = router({
    // Get or create a chat for the current customer
    getOrCreateChat: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user.isCustomer) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer access required' });
        }
        
        const chat = await db.getOrCreateCustomerChat(
          ctx.user.id,
          (ctx.user as any).fullName || (ctx.user as any).name || undefined,
          (ctx.user as any).customerCode || undefined
        );
        
        if (!chat) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create chat' });
        }
        
        return chat;
      }),

    // Get customer's chats
    getMyChats: protectedProcedure
      .input(z.object({
        status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (!ctx.user.isCustomer) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer access required' });
        }
        
        return db.getSupportChats({
          customerId: ctx.user.id,
          status: input?.status,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    // Get all chats (staff only)
    getAllChats: staffProcedure
      .input(z.object({
        status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
        assignedToId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getSupportChats({
          status: input?.status,
          assignedToId: input?.assignedToId,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    // Get chat by ID
    getChatById: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .query(async ({ ctx, input }) => {
        const chat = await db.getSupportChatById(input.chatId);
        
        if (!chat) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chat not found' });
        }
        
        // Customers can only see their own chats
        if (ctx.user.isCustomer && chat.customerId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        return chat;
      }),

    // Send a message
    sendMessage: protectedProcedure
      .input(z.object({
        chatId: z.number(),
        content: z.string().min(1),
        messageType: z.enum(['text', 'image', 'file', 'voice']).optional(),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const chat = await db.getSupportChatById(input.chatId);
        
        if (!chat) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chat not found' });
        }
        
        // Customers can only send to their own chats
        if (ctx.user.isCustomer && chat.customerId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        const senderType = ctx.user.isCustomer ? 'customer' : 'staff';
        
        const messageId = await db.createChatMessage({
          chatId: input.chatId,
          senderType,
          senderId: ctx.user.id,
          senderName: (ctx.user as any).fullName || (ctx.user as any).name || undefined,
          content: input.content,
          messageType: input.messageType,
          attachmentUrl: input.attachmentUrl,
          attachmentName: input.attachmentName,
          attachmentType: input.attachmentType,
        });
        
        return { messageId };
      }),

    // Get messages for a chat
    getMessages: protectedProcedure
      .input(z.object({
        chatId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        beforeId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const chat = await db.getSupportChatById(input.chatId);
        
        if (!chat) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chat not found' });
        }
        
        // Customers can only see their own chats
        if (ctx.user.isCustomer && chat.customerId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        return db.getChatMessages(input.chatId, {
          limit: input.limit,
          offset: input.offset,
          beforeId: input.beforeId,
        });
      }),

    // Mark messages as read
    markAsRead: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const chat = await db.getSupportChatById(input.chatId);
        
        if (!chat) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Chat not found' });
        }
        
        // Customers can only mark their own chats
        if (ctx.user.isCustomer && chat.customerId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        const senderType = ctx.user.isCustomer ? 'customer' : 'staff';
        await db.markMessagesAsRead(input.chatId, senderType);
        
        return { success: true };
      }),

    // Update chat status (staff only)
    updateChatStatus: staffProcedure
      .input(z.object({
        chatId: z.number(),
        status: z.enum(['open', 'pending', 'resolved', 'closed']),
        assignedToId: z.number().optional(),
        assignedToName: z.string().optional(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateSupportChat(input.chatId, {
          status: input.status,
          assignedToId: input.assignedToId,
          assignedToName: input.assignedToName,
          priority: input.priority,
        });
        
        return { success: true };
      }),

    // Get unread count for customer
    getUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.isCustomer) {
          return db.getUnreadChatCount(ctx.user.id);
        }
        return db.getStaffUnreadChatCount();
      }),
});

export const publicRouter = router({
    // Get portal theme setting
    getPortalTheme: publicProcedure
      .query(async () => {
        const theme = await db.getSetting('portalTheme');
        return theme || 'classic';
      }),
    // Get landing (first) page theme setting
    getLandingTheme: publicProcedure
      .query(async () => {
        const theme = await db.getSetting('landingTheme');
        return theme || 'dark';
      }),
    // Get landing page variant (classic | minimal | professional)
    getLandingPageVariant: publicProcedure
      .query(async () => {
        const v = await db.getSetting('landingPageVariant');
        const variant = v === 'minimal' ? 'minimal' : v === 'professional' ? 'professional' : 'classic';
        return variant as 'classic' | 'minimal' | 'professional';
      }),
    // Get landing team members (for "Our Team" section)
    getLandingTeam: publicProcedure
      .query(async () => {
        const raw = await db.getSetting('landingTeamMembers');
        if (!raw) return [];
        try {
          const arr = JSON.parse(raw) as Array<{ id?: string; name: string; role: string; description: string; imageUrl?: string; order?: number }>;
          if (!Array.isArray(arr)) return [];
          return arr
            .filter((m) => m && typeof m.name === 'string')
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((m, i) => ({ id: m.id ?? `member-${i}`, name: m.name, role: m.role ?? '', description: m.description ?? '', imageUrl: m.imageUrl ?? null }));
        } catch {
          return [];
        }
      }),
  });

export const adminRouters = {
  system: systemRouter,
  migration: migrationRouter,
  dataManagement: dataManagementRouter,
  dashboard: dashboardRouter,
  users: usersRouter,
  auditLogs: auditLogsRouter,
  activityAlerts: activityAlertsRouter,
  adminMessages: adminMessagesRouter,
  suppliers: suppliersRouter,
  notifications: notificationsRouter,
  backup: backupRouter,
  permissions: permissionsRouter,
  supportChat: supportChatRouter,
  public: publicRouter,
};
