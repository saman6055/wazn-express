import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { fullPackageOrders, packages } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateCustomerCode } from "@shared/types";
import { nanoid } from "nanoid";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { notifyPackageStatusChange, notifyBatchStatusChange, sendNotification } from "./notifications";
import { runMigration } from "./runMigration";
import { getConfig } from "./config";

// Helper to check admin/employee role
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "employee", "accountant"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Staff access required" });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const accountantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["super_admin", "admin", "accountant"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Accountant access required" });
  }
  return next({ ctx });
});

// QR Code signing
function signQrData(data: string): string {
  const secret = getConfig().jwtSecret;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function verifyQrSignature(data: string, signature: string): boolean {
  const expectedSignature = signQrData(data);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export const appRouter = router({
  system: systemRouter,
  
  // Migration endpoint (Admin Only)
  migration: router({
    run: adminProcedure
      .input(z.object({ secret: z.string() }))
      .mutation(async ({ input }) => {
        // Simple secret check for extra security
        if (input.secret !== getConfig().migrationSecret) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Invalid migration secret" });
        }
        return runMigration();
      }),
  }),
  
  // Data Management Router (Admin Only)
  dataManagement: router({
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
            
            const { storagePut } = await import('./storage');
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
          console.error('Failed to create pre-reset backup:', e);
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
            console.error('Failed to create deletion log:', e);
          }
          
          try {
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: '⚠️ Factory Reset Performed',
              content: `All system data has been reset by ${ctx.user.name || 'Admin'}. ${backupInfo.success ? 'A backup was created before reset.' : 'No backup was created.'}`
            });
          } catch (e) {
            console.error('Failed to send reset notification:', e);
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
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: `Data Import: ${input.category}`,
              content: `${result.importedCount} records imported to ${input.category} by ${ctx.user.name || 'Admin'}`
            });
          } catch (e) {
            console.error('Failed to send import notification:', e);
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
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: 'Full Data Import',
              content: `${result.totalImported} total records imported across ${Object.keys(input.data).length} categories by ${ctx.user.name || 'Admin'}`
            });
          } catch (e) {
            console.error('Failed to send import notification:', e);
          }
        }
        return result;
      }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // Customer login with mobile + password (from customers table)
    customerLogin: publicProcedure
      .input(z.object({
        mobileNumber: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        // Find customer by mobile number from customers table
        const customer = await db.getCustomerByMobile(input.mobileNumber);
        if (!customer) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        if (!customer.isActive) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ئەکاونتەکە ناچالاکە" });
        }
        if (!customer.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "وشەی نهێنی دانەنراوە" });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(input.password, customer.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        
        // Create session token
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(getConfig().jwtSecret);
        const token = await new SignJWT({
          customerId: customer.id,
          customerCode: customer.customerCode,
          role: "customer",
          isCustomer: true,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("7d")
          .sign(secret);
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        return { 
          success: true, 
          customer: {
            id: customer.id,
            name: customer.fullName,
            customerCode: customer.customerCode,
          }
        };
      }),
    
    // Staff login with email OR mobile + password
    staffLogin: publicProcedure
      .input(z.object({
        identifier: z.string().min(1), // Can be email or mobile number
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        // Find staff user by username, email, or mobile number
        const isEmail = input.identifier.includes('@');
        const isMobile = /^[0-9+\-\s]+$/.test(input.identifier) && input.identifier.length >= 10;
        let user;
        
        // First try getUserByUsername which searches username, email, and name
        user = await db.getUserByUsername(input.identifier);
        
        // If not found and looks like a mobile number, try mobile search
        if (!user && isMobile) {
          user = await db.getUserByMobile(input.identifier);
        }
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ئیمەیڵ/ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        if (!user.isActive) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ئەکاونتەکە ناچالاکە" });
        }
        if (!user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "وشەی نهێنی دانەنراوە. تکایە پەیوەندی بکە بە ئەدمین" });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە" });
        }
        
        // Create session token
        const { SignJWT } = await import("jose");
        const secret = new TextEncoder().encode(getConfig().jwtSecret);
        const token = await new SignJWT({
          userId: user.id,
          openId: user.openId || `staff_${user.id}`,
          role: user.role,
          isStaff: true,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("7d")
          .sign(secret);

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

        // Update last signed in
        await db.updateUserLastSignIn(user.id);

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
          }
        };
      }),

    // Staff registration (admin only)
    registerStaff: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        username: z.string().min(3).optional(),
        email: z.string().optional(),
        mobileNumber: z.string().optional(),
        password: z.string().min(6),
        role: z.enum(["admin", "employee", "accountant"]),
      }))
      .mutation(async ({ input }) => {
        // Validate that at least username, email or mobile is provided
        if (!input.username && !input.email && !input.mobileNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "دەبێت یوزەرنەیم، ئیمەیڵ یان ژمارەی مۆبایل دابنێیت" });
        }
        
        // Check if user already exists by username
        if (input.username) {
          const existingByUsername = await db.getUserByUsername(input.username);
          if (existingByUsername) {
            throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم یوزەرنەیمە پێشتر هەیە" });
          }
        }
        
        // Check if user already exists by email
        if (input.email) {
          const existingByEmail = await db.getUserByUsername(input.email);
          if (existingByEmail) {
            throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم ئیمەیڵە پێشتر هەیە" });
          }
        }
        
        // Check if user already exists by mobile
        if (input.mobileNumber) {
          const existingByMobile = await db.getUserByMobile(input.mobileNumber);
          if (existingByMobile) {
            throw new TRPCError({ code: "CONFLICT", message: "بەکارهێنەرێک بەم ژمارەی مۆبایلە پێشتر هەیە" });
          }
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(input.password, 10);
        
        // Create user
        const user = await db.createStaffUser({
          name: input.name,
          username: input.username,
          email: input.email,
          mobileNumber: input.mobileNumber,
          passwordHash,
          role: input.role,
        });
        
        return { success: true, user };
      }),
    
    // Reset staff password (admin only)
    resetStaffPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateUserPassword(input.userId, passwordHash);
        return { success: true };
      }),
    
    // Change own password (any logged in user)
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change password" });
        }
        
        // Verify current password
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        
        // Update password
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateUserPassword(ctx.user.id, passwordHash);
        
        return { success: true };
      }),
    
    // Get all staff members (admin only)
    getStaffList: adminProcedure.query(async () => {
      return db.getAllStaff();
    }),
    
    // Toggle staff active status (admin only)
    toggleStaffStatus: adminProcedure
      .input(z.object({
        userId: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.userId, input.isActive);
        return { success: true };
      }),

    // Delete staff member (role-based: admin deletes employees/accountants, super_admin deletes all)
    deleteStaff: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Cannot delete yourself
        if (input.userId === ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot delete your own account",
          });
        }

        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Role hierarchy check
        if (ctx.user.role === "admin") {
          // Admin can only delete employees and accountants
          if (targetUser.role === "admin" || targetUser.role === "super_admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Admin can only delete employees and accountants",
            });
          }
        }
        // super_admin can delete anyone (except themselves, already checked above)

        await db.deleteStaffUser(input.userId);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_staff",
          entityType: "user",
          entityId: input.userId,
          description: `Deleted staff: ${targetUser.name} (${targetUser.role})`,
        });

        return { success: true, deletedUser: targetUser.name };
      }),
  }),

  // ============ PROFESSIONAL DASHBOARD ============
  dashboard: router({
    // Financial statistics
    financialStats: staffProcedure.query(async () => {
      return db.getDashboardFinancialStats();
    }),
    
    // Revenue chart data (30 days)
    revenueChart: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getDashboardRevenueChart(input?.days || 30);
      }),
    
    // Active batches
    activeBatches: staffProcedure.query(async () => {
      return db.getDashboardActiveBatches();
    }),
    
    // Top debtors
    topDebtors: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getDashboardTopDebtors(input?.limit || 5);
      }),
    
    // Recent activity
    recentActivity: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getDashboardRecentActivity(input?.limit || 10);
      }),
    
    // Alerts
    alerts: staffProcedure.query(async () => {
      return db.getDashboardAlerts();
    }),
    
    // New customers count
    newCustomers: staffProcedure
      .input(z.object({ days: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getDashboardNewCustomers(input?.days || 7);
      }),
    
    // Export dashboard as PDF
    exportPDF: staffProcedure.mutation(async () => {
      const { getDashboardReportData, generateDashboardPDF } = await import('./pdfGenerator');
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
        const { getDateFilteredDashboardData, generateDateFilteredDashboardPDF } = await import('./pdfReports');
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
        const { getCustomerReportData, generateCustomerPDF } = await import('./pdfReports');
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
        const { getBatchReportData, generateBatchPDF } = await import('./pdfReports');
        const data = await getBatchReportData(input.batchId);
        if (!data) throw new Error('Batch not found');
        const pdfBuffer = await generateBatchPDF(data);
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `wazn-express-batch-${data.batch.batchCode}-${new Date().toISOString().split('T')[0]}.pdf`
        };
      }),
  }),

  // ============ USER MANAGEMENT ============
  users: router({
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
  }),

  // ============ CUSTOMER MANAGEMENT ============
  customers: router({
    list: staffProcedure.query(async () => {
      return db.getAllCustomers();
    }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const customer = await db.getCustomerById(input.id);
        if (!customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        }
        return customer;
      }),
    create: staffProcedure
      .input(z.object({
        fullName: z.string().min(1),
        fullNameArabic: z.string().optional(),
        fullNameKurdish: z.string().optional(),
        gender: z.enum(["male", "female"]).optional(),
        nationality: z.string().optional(),
        businessType: z.string().optional(),
        mobileNumber: z.string().min(1),
        secondaryMobile: z.string().optional(),
        password: z.string().min(6),
        email: z.string().email().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        address: z.string().optional(),
        codePrefix: z.string().optional(), // Customer code prefix (AZ, WZ, etc.)
        customCode: z.string().optional(), // Manual customer code (overrides auto-generation)
        goodsTypePreferences: z.array(z.string()).optional(),
        shippingTypePreferences: z.array(z.string()).optional(),
        notes: z.string().optional(),
        // Document URLs (uploaded to S3)
        passportUrl: z.string().optional(),
        nationalIdUrl: z.string().optional(),
        contractUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if mobile already exists in customers table
        const existingCustomer = await db.getCustomerByMobile(input.mobileNumber);
        if (existingCustomer) {
          throw new TRPCError({ code: "CONFLICT", message: "ئەم ژمارە مۆبایلە پێشتر تۆمارکراوە" });
        }

        const passwordHash = await bcrypt.hash(input.password, 10);

        // Retry logic for handling race conditions with sequenceNumber
        let customer;
        let lastError: Error | null = null;
        
        for (let retries = 0; retries < 3; retries++) {
          try {
            let customerCode: string;
            let sequenceNumber: number;
            
            if (input.customCode) {
              // Use manual customer code
              customerCode = input.customCode;
              // Check if code already exists
              const existing = await db.getCustomerByCode(customerCode);
              if (existing) {
                throw new TRPCError({ code: "CONFLICT", message: "Customer code already exists" });
              }
              // Use a placeholder sequence number for manual codes
              sequenceNumber = 0;
            } else {
              // Auto-generate customer code - sequence is per-prefix, not global
              const prefix = input.codePrefix || "AZ";
              sequenceNumber = await db.getNextSequenceForPrefix(prefix);
              customerCode = generateCustomerCode(sequenceNumber, input.fullName, prefix);
            }
            
            // Create customer in customers table
            customer = await db.createCustomer({
              customerCode,
              sequenceNumber,
              fullName: input.fullName,
              fullNameArabic: input.fullNameArabic,
              fullNameKurdish: input.fullNameKurdish,
              gender: input.gender,
              nationality: input.nationality,
              businessType: input.businessType,
              mobileNumber: input.mobileNumber,
              secondaryMobile: input.secondaryMobile,
              passwordHash,
              email: input.email,
              country: input.country,
              city: input.city,
              district: input.district,
              address: input.address,
              goodsTypePreferences: input.goodsTypePreferences,
              shippingTypePreferences: input.shippingTypePreferences,
              notes: input.notes,
              passportUrl: input.passportUrl,
              nationalIdUrl: input.nationalIdUrl,
              contractUrl: input.contractUrl,
              createdById: ctx.user.id,
              isActive: true,
            });
            
            // Success - break out of retry loop
            break;
          } catch (error: unknown) {
            lastError = error as Error;
            // Check if it's a duplicate key error (race condition)
            const errorMessage = (error as Error).message || '';
            if (errorMessage.includes('Duplicate') || errorMessage.includes('unique')) {
              // Wait a bit and retry
              await new Promise(resolve => setTimeout(resolve, 100 * (retries + 1)));
              continue;
            }
            // For other errors, throw immediately
            throw error;
          }
        }
        
        if (!customer) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: lastError?.message || "Failed to create customer after multiple retries" 
          });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_customer",
          entityType: "user",
          entityId: customer.id,
          newValues: { customerCode: customer.customerCode, fullName: input.fullName },
        });

        // Send welcome notification to customer
        if (input.email || input.mobileNumber) {
          try {
            await sendNotification({
              customerId: customer.id,
              eventType: "account_created",
              variables: {},
              channels: input.email ? ["email", "sms"] : ["sms"],
            });
          } catch (e) {
            console.error("[Notification] Failed to send welcome notification:", e);
          }
        }

        return customer;
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        customerCode: z.string().optional(),
        fullName: z.string().optional(),
        fullNameArabic: z.string().optional(),
        fullNameKurdish: z.string().optional(),
        gender: z.enum(["male", "female"]).optional(),
        nationality: z.string().optional(),
        businessType: z.string().optional(),
        secondaryMobile: z.string().optional(),
        district: z.string().optional(),
        email: z.string().email().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        passportUrl: z.string().optional(),
        nationalIdUrl: z.string().optional(),
        contractUrl: z.string().optional(),
        goodsTypePreferences: z.array(z.string()).optional(),
        shippingTypePreferences: z.array(z.string()).optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // If customerCode is being updated, check uniqueness
        if (data.customerCode) {
          const existing = await db.getCustomerByCode(data.customerCode);
          if (existing && existing.id !== id) {
            throw new TRPCError({ code: "CONFLICT", message: "Customer code already exists" });
          }
        }
        
        await db.updateCustomer(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_customer",
          entityType: "customer",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    resetPassword: staffProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateCustomerPassword(input.id, passwordHash);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "reset_customer_password",
          entityType: "customer",
          entityId: input.id,
        });
        return { success: true };
      }),
    getBalance: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerBalance(input.customerId);
      }),
    getLedger: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerTransactionHistory(input.customerId);
      }),
    uploadDocument: staffProcedure
      .input(z.object({
        customerId: z.number(),
        documentType: z.enum(["passport", "nationalId", "contract"]),
        fileData: z.string(), // base64 encoded file data
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        const { nanoid } = await import("nanoid");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        
        // Generate unique filename
        const ext = input.fileName.split(".").pop() || "pdf";
        const uniqueFileName = `customer-${input.customerId}/${input.documentType}-${nanoid(8)}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(`documents/${uniqueFileName}`, buffer, input.mimeType);
        
        // Update customer record with document URL (skip if customerId is 0 - new customer being created)
        if (input.customerId > 0) {
          const updateData: Record<string, string> = {};
          if (input.documentType === "passport") updateData.passportUrl = url;
          if (input.documentType === "nationalId") updateData.nationalIdUrl = url;
          if (input.documentType === "contract") updateData.contractUrl = url;
          
          await db.updateCustomer(input.customerId, updateData);
        }
        
        // Only create audit log if updating existing customer
        if (input.customerId > 0) {
          await db.createAuditLog({
            userId: ctx.user.id,
            userRole: ctx.user.role,
            action: "upload_customer_document",
            entityType: "customer",
            entityId: input.customerId,
            newValues: { documentType: input.documentType, url },
          });
        }
        
        return { success: true, url };
      }),
    deleteDocument: staffProcedure
      .input(z.object({
        customerId: z.number(),
        documentType: z.enum(["passport", "nationalId", "contract"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const updateData: Record<string, null> = {};
        if (input.documentType === "passport") updateData.passportUrl = null;
        if (input.documentType === "nationalId") updateData.nationalIdUrl = null;
        if (input.documentType === "contract") updateData.contractUrl = null;
        
        await db.updateCustomer(input.customerId, updateData);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_customer_document",
          entityType: "customer",
          entityId: input.customerId,
          newValues: { documentType: input.documentType },
        });
        
        return { success: true };
      }),
  }),

  // ============ CUSTOMER CODE PREFIX MANAGEMENT ============
  customerCodePrefixes: router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllCustomerCodePrefixes(input?.activeOnly);
      }),
    create: staffProcedure
      .input(z.object({
        code: z.string().min(1).max(10),
        label: z.string().min(1).max(100),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prefix = await db.createCustomerCodePrefix(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_code_prefix",
          entityType: "customer_code_prefix",
          entityId: prefix.id,
          newValues: input,
        });
        return prefix;
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1).max(10).optional(),
        label: z.string().min(1).max(100).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCustomerCodePrefix(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_code_prefix",
          entityType: "customer_code_prefix",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCustomerCodePrefix(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_code_prefix",
          entityType: "customer_code_prefix",
          entityId: input.id,
        });
        return { success: true };
      }),
  }),

  // ============ COUNTRY MANAGEMENT ============
  countries: router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllCountries(input?.activeOnly);
      }),
    getOrigins: staffProcedure.query(async () => {
      return db.getOriginCountries();
    }),
    getDestinations: staffProcedure.query(async () => {
      return db.getDestinationCountries();
    }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        isoCode: z.string().length(2).or(z.string().length(3)),
        defaultCurrency: z.string().optional(),
        isOrigin: z.boolean().optional(),
        isDestination: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const country = await db.createCountry(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_country",
          entityType: "country",
          entityId: country.id,
          newValues: input,
        });
        return country;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        defaultCurrency: z.string().optional(),
        isActive: z.boolean().optional(),
        isOrigin: z.boolean().optional(),
        isDestination: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCountry(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_country",
          entityType: "country",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
  }),

  // ============ WAREHOUSE MANAGEMENT ============
  warehouses: router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllWarehouses(input?.activeOnly);
      }),
    getByCountry: staffProcedure
      .input(z.object({ countryId: z.number() }))
      .query(async ({ input }) => {
        return db.getWarehousesByCountry(input.countryId);
      }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getWarehouseById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        countryId: z.number(),
        city: z.string().min(1),
        addressEn: z.string().optional(),
        addressAr: z.string().optional(),
        addressKu: z.string().optional(),
        warehouseType: z.enum(["air", "sea", "custom"]),
        codePrefix: z.string().min(1).max(10),
        expectedDeliveryMin: z.number().optional(),
        expectedDeliveryMax: z.number().optional(),
        pricingModel: z.enum(["per_kg", "per_cbm"]),
        contactInfo: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const warehouse = await db.createWarehouse(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_warehouse",
          entityType: "warehouse",
          entityId: warehouse.id,
          newValues: input,
        });
        return warehouse;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        nameZh: z.string().optional(),
        nameTr: z.string().optional(),
        nameFa: z.string().optional(),
        city: z.string().optional(),
        addressEn: z.string().optional(),
        addressAr: z.string().optional(),
        addressKu: z.string().optional(),
        warehouseType: z.enum(["air", "sea", "custom"]).optional(),
        expectedDeliveryMin: z.number().optional(),
        expectedDeliveryMax: z.number().optional(),
        pricingModel: z.enum(["per_kg", "per_cbm"]).optional(),
        contactInfo: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateWarehouse(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_warehouse",
          entityType: "warehouse",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
  }),

  // ============ PRICING MANAGEMENT ============
  pricing: router({
    list: staffProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllPricingRules(input?.activeOnly);
      }),
    getApplicable: staffProcedure
      .input(z.object({
        originCountryId: z.number(),
        destinationCountryId: z.number(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
      }))
      .query(async ({ input }) => {
        return db.getApplicablePricingRule(
          input.originCountryId,
          input.destinationCountryId,
          input.shippingType
        );
      }),
    create: adminProcedure
      .input(z.object({
        originCountryId: z.number(),
        originWarehouseId: z.number().optional(),
        destinationCountryId: z.number(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        pricePerUnit: z.string(),
        unit: z.enum(["kg", "cbm"]),
        effectiveFrom: z.date(),
        effectiveTo: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const rule = await db.createPricingRule({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_pricing_rule",
          entityType: "pricing_rule",
          entityId: rule.id,
          newValues: input,
        });
        return rule;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        pricePerUnit: z.string().optional(),
        effectiveTo: z.date().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updatePricingRule(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_pricing_rule",
          entityType: "pricing_rule",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
  }),

  // ============ BATCH MANAGEMENT ============
  batches: router({
    list: staffProcedure.query(async () => {
      const batches = await db.getAllBatches();
      // Add hasCustomerPricing flag to each batch with error handling
      const batchesWithPricingInfo = await Promise.all(
        batches.map(async (batch) => {
          try {
            const customerPricing = await db.getBatchCustomerPricing(batch.id);
            return {
              ...batch,
              hasCustomerPricing: customerPricing.length > 0,
              customerPricingCount: customerPricing.length,
            };
          } catch (error) {
            // If table doesn't exist or query fails, return batch without pricing info
            console.error(`Error fetching customer pricing for batch ${batch.id}:`, error);
            return {
              ...batch,
              hasCustomerPricing: false,
              customerPricingCount: 0,
            };
          }
        })
      );
      return batchesWithPricingInfo;
    }),
    getActive: staffProcedure.query(async () => {
      return db.getActiveBatches();
    }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchById(input.id);
      }),
    getPackages: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackagesByBatch(input.batchId);
      }),
    create: staffProcedure
      .input(z.object({
        batchCode: z.string().min(1),
        originWarehouseId: z.number(),
        destinationCountryId: z.number(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        carrierInfo: z.string().optional(),
        // Detailed shipping info
        airlineName: z.string().optional(),
        flightNumber: z.string().optional(),
        shippingCompany: z.string().optional(),
        containerNumber: z.string().optional(),
        vesselName: z.string().optional(),
        shippingCost: z.string().optional(),
        departureDate: z.date().optional(),
        estimatedArrival: z.date().optional(),
        // Actual measurements
        actualWeightKg: z.string().optional(),
        actualCbm: z.string().optional(),
        // Charged measurements (what we pay)
        chargedWeightKg: z.string().optional(),
        chargedCbm: z.string().optional(),
        // Cost fields (our cost)
        costPerKg: z.string().optional(),
        costPerCbm: z.string().optional(),
        // Selling price fields
        pricePerKg: z.string().optional(),
        pricePerCbm: z.string().optional(),
        // Tiered pricing
        useTieredPricing: z.boolean().optional(),
        pricingTiers: z.array(z.object({
          minValue: z.string(),
          maxValue: z.string().nullable(),
          pricePerUnit: z.string(),
        })).optional(),
        // Customer-specific pricing
        customerPricing: z.array(z.object({
          customerId: z.number(),
          pricePerKg: z.string().optional(),
          pricePerCbm: z.string().optional(),
          notes: z.string().optional(),
        })).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { pricingTiers, customerPricing, ...batchData } = input;
        const batch = await db.createBatch({
          ...batchData,
          createdById: ctx.user.id,
        });
        
        // Create pricing tiers if provided
        if (pricingTiers && pricingTiers.length > 0) {
          await db.setBatchPricingTiers(batch.id, pricingTiers.map((tier, index) => ({
            minValue: tier.minValue,
            maxValue: tier.maxValue,
            pricePerUnit: tier.pricePerUnit,
            sortOrder: index,
          })));
        }
        
        // Create customer-specific pricing if provided
        if (customerPricing && customerPricing.length > 0) {
          await db.setBatchCustomerPricing(batch.id, customerPricing.map(cp => ({
            customerId: cp.customerId,
            pricePerKg: cp.pricePerKg,
            pricePerCbm: cp.pricePerCbm,
            notes: cp.notes,
            createdById: ctx.user.id,
          })));
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_batch",
          entityType: "batch",
          entityId: batch.id,
          newValues: input,
        });
        return batch;
      }),
    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["preparing", "in_transit", "arrived", "customs", "delivered", "closed"]),
        actualArrival: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateBatch(id, data);
        
        // Update all packages in batch if status changes
        if (input.status === "in_transit") {
          const packages = await db.getPackagesByBatch(id);
          for (const pkg of packages) {
            await db.updatePackage(pkg.id, { status: "in_transit" });
          }
          // Notify customers about batch departure
          try {
            await notifyBatchStatusChange(id, "batch_departed");
          } catch (e) {
            console.error("[Notification] Failed to send batch departure notification:", e);
          }
        } else if (input.status === "arrived" || input.status === "customs") {
          const packages = await db.getPackagesByBatch(id);
          for (const pkg of packages) {
            await db.updatePackage(pkg.id, { status: "customs_processing" });
          }
          // Notify customers about batch arrival
          try {
            await notifyBatchStatusChange(id, "batch_arrived");
          } catch (e) {
            console.error("[Notification] Failed to send batch arrival notification:", e);
          }
        } else if (input.status === "delivered" || input.status === "closed") {
          // When batch is delivered or closed:
          // 1. Update all packages to delivered
          // 2. Calculate and charge each package (EXCEPT those linked to Full Package)
          // 3. Create invoices for each customer
          const packages = await db.getPackagesByBatch(id);
          const batch = await db.getBatchById(id);
          
          // Group packages by customer (only non-Full Package linked packages)
          const packagesByCustomer = new Map<number, typeof packages>();
          
          for (const pkg of packages) {
            // Update package status to delivered
            await db.updatePackage(pkg.id, { 
              status: "delivered",
              deliveredAt: new Date()
            });
            
            // Check if this package is linked to a Full Package order or Purchase Request
            let isLinkedToFullPackage = false;

            
            if (pkg.trackingNumber) {
              // Check Full Package first
              const linkedFPOrder = await db.getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
              if (linkedFPOrder) {
                isLinkedToFullPackage = true;
                // Update Full Package with shipping cost (our cost, not charged to customer)
                const pricePerKg = batch ? parseFloat(batch.pricePerKg?.toString() || "0") : 0;
                const pricePerCbm = batch ? parseFloat(batch.pricePerCbm?.toString() || "0") : 0;
                const isSea = batch?.shippingType === 'sea';
                
                let shippingCost = 0;
                if (isSea && pricePerCbm > 0) {
                  const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                  shippingCost = cbm * pricePerCbm;
                } else if (pricePerKg > 0) {
                  // Use chargeable weight (max of actual weight and volumetric weight)
                  const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                  const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                  const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                  const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                  const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                  const chargeableKg = Math.max(actualKg, volumetricKg);
                  shippingCost = chargeableKg * pricePerKg;
                }
                
                if (shippingCost > 0) {
                  // Save calculated cost to package for reference
                  await db.updatePackage(pkg.id, { calculatedCostUsd: shippingCost.toFixed(2) });
                  
                  // Update Full Package with shipping cost and recalculate profit
                  await db.updateFullPackageOrder(linkedFPOrder.id, {
                    status: 'delivered',
                    shippingCostUsd: shippingCost.toFixed(2),
                    deliveredDate: new Date(),
                  }, ctx.user.id);
                  console.log(`[FullPackage] Package ${pkg.packageCode} linked to FP ${linkedFPOrder.orderCode} - shipping cost $${shippingCost} (OUR cost, not charged to customer)`);
                }
                
                // Auto-charge customer balance and create invoice for full package delivery
                // IMPORTANT: Check BOTH isCharged (set by updateFullPackageOrder) and isChargedToCustomer to prevent double charging
                // The updatePackage call above triggers updateFullPackageOrder which may have already charged the customer
                const refreshedFPOrder = await db.getFullPackageOrderById(linkedFPOrder.id);
                if (refreshedFPOrder && refreshedFPOrder.customerId && refreshedFPOrder.sellingPriceUsd && !refreshedFPOrder.isCharged && !refreshedFPOrder.isChargedToCustomer) {
                  try {
                    const customer = await db.getCustomerById(refreshedFPOrder.customerId);
                    if (customer) {
                      const sellingPrice = parseFloat(refreshedFPOrder.sellingPriceUsd?.toString() || '0');
                      
                      // Record charge to customer balance
                      await db.recordPackageCharge(
                        refreshedFPOrder.customerId,
                        customer.customerCode,
                        pkg.id,
                        sellingPrice,
                        `فول پاکێج ${refreshedFPOrder.orderCode} - ${refreshedFPOrder.productName} - گەیاندن`,
                        ctx.user.id
                      );
                      
                      // Create invoice for full package
                      const invoiceNumber = `INV-FP-${Date.now()}-${refreshedFPOrder.id}`;
                      await db.createInvoice({
                        invoiceNumber,
                        customerId: refreshedFPOrder.customerId,
                        batchId: id,
                        subtotalUsd: sellingPrice.toFixed(2),
                        totalUsd: sellingPrice.toFixed(2),
                        status: "issued",
                        issuedAt: new Date(),
                        lineItems: [{
                          description: `فول پاکێج ${refreshedFPOrder.orderCode} - ${refreshedFPOrder.productName}`,
                          quantity: refreshedFPOrder.quantity || 1,
                          unitPrice: sellingPrice / (refreshedFPOrder.quantity || 1),
                          total: sellingPrice
                        }],
                        notes: `پسووڵەی فول پاکێج ${refreshedFPOrder.orderCode} - باچ ${batch?.batchCode || ''} - کۆی $${sellingPrice.toFixed(2)}`,
                        createdById: ctx.user.id,
                      });
                      
                      // Mark as charged - also set isCharged for consistency
                      await db.updateFullPackageOrder(refreshedFPOrder.id, {
                        isCharged: true,
                        isChargedToCustomer: true,
                        chargedAt: new Date(),
                        paidFromBalanceUsd: sellingPrice.toFixed(2),
                      }, ctx.user.id);
                      
                      console.log(`[FullPackage] Charged customer ${customer.customerCode} $${sellingPrice} for FP ${refreshedFPOrder.orderCode}`);
                    }
                  } catch (chargeError) {
                    console.error(`[FullPackage] Failed to charge customer for FP ${linkedFPOrder.orderCode}:`, chargeError);
                  }
                }
                
                // For commission orders: charge shipping cost to customer (separate from item+commission already charged)
                // Re-fetch the order to check if shipping was already charged by updateFullPackageOrder
                const refreshedForCommission = refreshedFPOrder || await db.getFullPackageOrderById(linkedFPOrder.id);
                if (refreshedForCommission && refreshedForCommission.orderType === 'commission' && refreshedForCommission.customerId && shippingCost > 0 && !refreshedForCommission.isShippingCharged) {
                  try {
                    const customer = await db.getCustomerById(refreshedForCommission.customerId);
                    if (customer) {
                      // Calculate chargeable weight (max of actual weight and volumetric weight)
                      const actualWeight = parseFloat(pkg.weightKg?.toString() || "0");
                      // Calculate volumetric weight from dimensions if available
                      const length = parseFloat(pkg.lengthCm?.toString() || "0");
                      const width = parseFloat(pkg.widthCm?.toString() || "0");
                      const height = parseFloat(pkg.heightCm?.toString() || "0");
                      const volumetricWeight = (length * width * height) / 6000;
                      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
                      const chargeableShippingCost = chargeableWeight * pricePerKg;
                      
                      // Record shipping charge to customer balance
                      await db.recordPackageCharge(
                        refreshedForCommission.customerId,
                        customer.customerCode,
                        pkg.id,
                        chargeableShippingCost,
                        `کڕین بە عمولە ${refreshedForCommission.orderCode} - ${refreshedForCommission.productName} - نرخی گواستنەوە (${chargeableWeight.toFixed(2)} KG)`,
                        ctx.user.id
                      );
                      
                      // Create invoice for shipping charge
                      const invoiceNumber = `INV-CM-SHIP-${Date.now()}-${refreshedForCommission.id}`;
                      await db.createInvoice({
                        invoiceNumber,
                        customerId: refreshedForCommission.customerId,
                        batchId: id,
                        subtotalUsd: chargeableShippingCost.toFixed(2),
                        totalUsd: chargeableShippingCost.toFixed(2),
                        status: "issued",
                        issuedAt: new Date(),
                        lineItems: [{
                          description: `کڕین بە عمولە ${refreshedForCommission.orderCode} - ${refreshedForCommission.productName} - نرخی گواستنەوە`,
                          quantity: 1,
                          unitPrice: chargeableShippingCost,
                          total: chargeableShippingCost,
                          // Note: chargeable weight = max(actual, volumetric) = chargeableWeight KG
                        }],
                        notes: `پسووڵەی گواستنەوەی کڕین بە عمولە ${refreshedForCommission.orderCode} - باچ ${batch?.batchCode || ''} - کێشی کڕێیی ${chargeableWeight.toFixed(2)} KG - کۆی $${chargeableShippingCost.toFixed(2)}`,
                        createdById: ctx.user.id,
                      });
                      
                      // Mark shipping as charged and update net profit
                      const grossProfit = parseFloat(refreshedForCommission.grossProfitUsd || '0');
                      const netProfitUsd = (grossProfit - shippingCost).toFixed(2); // Our cost is actual shipping, not chargeable
                      
                      await db.updateFullPackageOrder(refreshedForCommission.id, {
                        isShippingCharged: true,
                        shippingChargedAt: new Date(),
                        shippingChargedUsd: chargeableShippingCost.toFixed(2),
                        netProfitUsd,
                      }, ctx.user.id);
                      
                      console.log(`[Commission] Charged customer ${customer.customerCode} $${chargeableShippingCost} shipping for CM ${refreshedForCommission.orderCode} (chargeable: ${chargeableWeight}kg, our cost: $${shippingCost})`);
                    }
                  } catch (chargeError) {
                    console.error(`[Commission] Failed to charge shipping for CM ${linkedFPOrder.orderCode}:`, chargeError);
                  }
                }
              }
              
              // Purchase Request logic removed
            }
            
            // Group by customer for invoice generation (only packages NOT linked to Full Package)
            if (pkg.customerId && !isLinkedToFullPackage) {
              const existing = packagesByCustomer.get(pkg.customerId) || [];
              existing.push(pkg);
              packagesByCustomer.set(pkg.customerId, existing);
            }
          }
          
          // Get batch pricing info
          const pricePerKg = batch ? parseFloat(batch.pricePerKg?.toString() || "0") : 0;
          const pricePerCbm = batch ? parseFloat(batch.pricePerCbm?.toString() || "0") : 0;
          const isSea = batch?.shippingType === 'sea';
          
          // Create invoice for each customer with packages in this batch
          for (const [customerId, customerPackages] of Array.from(packagesByCustomer.entries())) {
            try {
              // Calculate total for this customer's packages
              let totalAmount = 0;
              const lineItems = [];
              
              for (const pkg of customerPackages) {
                // Calculate price from batch pricing
                let pkgPrice = 0;
                let quantity = 0;
                let unit = 'KG';
                
                if (isSea && pricePerCbm > 0) {
                  // Sea shipping - use CBM
                  const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                  pkgPrice = cbm * pricePerCbm;
                  quantity = cbm;
                  unit = 'CBM';
                } else if (pricePerKg > 0) {
                  // Air shipping - use chargeable weight (max of actual weight and volumetric weight)
                  const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                  const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                  const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                  const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                  // Volumetric weight = (L × W × H) / 6000 for air shipping
                  const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                  // Chargeable weight is the higher of actual weight and volumetric weight
                  const chargeableKg = Math.max(actualKg, volumetricKg);
                  pkgPrice = chargeableKg * pricePerKg;
                  quantity = chargeableKg;
                  unit = 'KG';
                }
                
                // Update package with calculated cost
                if (pkgPrice > 0) {
                  await db.updatePackage(pkg.id, { 
                    calculatedCostUsd: pkgPrice.toFixed(2)
                  });
                }
                
                totalAmount += pkgPrice;
                
                lineItems.push({
                  description: `پاکەت ${pkg.trackingNumber || pkg.packageCode} - ${quantity.toFixed(2)} ${unit} × $${isSea ? pricePerCbm : pricePerKg}`,
                  quantity: 1,
                  unitPrice: pkgPrice,
                  total: pkgPrice
                });
              }
              
              if (totalAmount > 0) {
                // Create ONE consolidated invoice for this customer's packages in this batch
                const invoiceNumber = `INV-${Date.now()}-${customerId}`;
                const invoice = await db.createInvoice({
                  invoiceNumber,
                  customerId,
                  batchId: id,
                  subtotalUsd: totalAmount.toFixed(2),
                  totalUsd: totalAmount.toFixed(2),
                  status: "issued",
                  issuedAt: new Date(),
                  lineItems: lineItems as { description: string; quantity: number; unitPrice: number; total: number; }[],
                  notes: `پسووڵەی باچ ${batch?.batchCode || ''} - ${customerPackages.length} پاکەت - کۆی $${totalAmount.toFixed(2)}`,
                  createdById: ctx.user.id,
                });
                
                // Record charge for each package WITHOUT creating individual invoices
                // Link all charges to the consolidated invoice
                // IMPORTANT: Check isCharged to prevent double charging
                const customer = await db.getCustomerById(customerId);
                if (customer) {
                  for (const pkg of customerPackages) {
                    // Re-fetch package to get latest isCharged status
                    const freshPkg = await db.getPackageById(pkg.id);
                    
                    // SKIP if package is already charged (prevents double charging)
                    if (freshPkg?.isCharged) {
                      console.log(`[Batch] Package ${pkg.packageCode} already charged, skipping`);
                      continue;
                    }
                    
                    let pkgPrice = 0;
                    if (isSea && pricePerCbm > 0) {
                      const cbm = parseFloat(pkg.volumeCbm?.toString() || "0");
                      pkgPrice = cbm * pricePerCbm;
                    } else if (pricePerKg > 0) {
                      // Use chargeable weight (max of actual and volumetric)
                      const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
                      const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
                      const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
                      const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
                      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                      const chargeableKg = Math.max(actualKg, volumetricKg);
                      pkgPrice = chargeableKg * pricePerKg;
                    }
                    
                    if (pkgPrice > 0) {
                      // Use recordPackageChargeWithoutInvoice to avoid creating duplicate invoices
                      await db.recordPackageChargeWithoutInvoice(
                        customerId,
                        customer.customerCode,
                        pkg.id,
                        pkgPrice,
                        `پاکەت ${pkg.trackingNumber || pkg.packageCode} - باچ ${batch?.batchCode || ''}`,
                        ctx.user.id,
                        invoice.id  // Link to the consolidated invoice
                      );
                      
                      // Mark package as charged to prevent future double charging
                      await db.updatePackage(pkg.id, { isCharged: true });
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`[Invoice] Failed to create invoice for customer ${customerId}:`, e);
            }
          }
          
          // Notify customers about delivery
          try {
            await notifyBatchStatusChange(id, "batch_arrived"); // Use arrived notification for now
          } catch (e) {
            console.error("[Notification] Failed to send batch delivery notification:", e);
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_batch_status",
          entityType: "batch",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        batchCode: z.string().optional(),
        carrierInfo: z.string().optional(),
        // Detailed shipping info
        airlineName: z.string().optional(),
        flightNumber: z.string().optional(),
        shippingCompany: z.string().optional(),
        containerNumber: z.string().optional(),
        vesselName: z.string().optional(),
        shippingCost: z.string().optional(),
        departureDate: z.date().optional(),
        estimatedArrival: z.date().optional(),
        // Actual measurements
        actualWeightKg: z.string().optional(),
        actualCbm: z.string().optional(),
        // Charged measurements (what we pay)
        chargedWeightKg: z.string().optional(),
        chargedCbm: z.string().optional(),
        // Cost fields (our cost)
        costPerKg: z.string().optional(),
        costPerCbm: z.string().optional(),
        // Selling price fields
        pricePerKg: z.string().optional(),
        pricePerCbm: z.string().optional(),
        // Tiered pricing
        useTieredPricing: z.boolean().optional(),
        pricingTiers: z.array(z.object({
          minValue: z.string(),
          maxValue: z.string().nullable(),
          pricePerUnit: z.string(),
        })).optional(),
        // Customer-specific pricing
        customerPricing: z.array(z.object({
          customerId: z.number(),
          pricePerKg: z.string().optional(),
          pricePerCbm: z.string().optional(),
          notes: z.string().optional(),
        })).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, pricingTiers, customerPricing, ...data } = input;
        await db.updateBatch(id, data);
        
        // Update pricing tiers if provided
        if (pricingTiers !== undefined) {
          await db.setBatchPricingTiers(id, pricingTiers.map((tier, index) => ({
            minValue: tier.minValue,
            maxValue: tier.maxValue,
            pricePerUnit: tier.pricePerUnit,
            sortOrder: index,
          })));
        }
        
        // Update customer-specific pricing if provided
        if (customerPricing !== undefined) {
          await db.setBatchCustomerPricing(id, customerPricing.map(cp => ({
            customerId: cp.customerId,
            pricePerKg: cp.pricePerKg,
            pricePerCbm: cp.pricePerCbm,
            notes: cp.notes,
            createdById: ctx.user.id,
          })));
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_batch",
          entityType: "batch",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    // Get batches filtered by shipping type
    getByShippingType: staffProcedure
      .input(z.object({ shippingType: z.enum(["air_regular", "air_irregular", "sea"]) }))
      .query(async ({ input }) => {
        return db.getBatchesByShippingType(input.shippingType);
      }),
    
    // Get pricing tiers for a batch
    getPricingTiers: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchPricingTiers(input.batchId);
      }),
    
    // Get customer-specific pricing for a batch
    getCustomerPricing: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        const pricing = await db.getBatchCustomerPricing(input.batchId);
        // Get customer details for each pricing entry
        const customers = await db.getAllCustomers();
        const customerMap = new Map(customers.map(c => [c.id, c]));
        return pricing.map(p => ({
          ...p,
          customer: customerMap.get(p.customerId),
        }));
      }),
    
    // List all customer-specific pricing across all batches
    listAllCustomerPricing: staffProcedure.query(async () => {
      const batches = await db.getAllBatches();
      const allPricing: any[] = [];
      
      for (const batch of batches) {
        const pricing = await db.getBatchCustomerPricing(batch.id);
        allPricing.push(...pricing);
      }
      
      return allPricing;
    }),
    
    // Get financial summary for a batch
    getFinancialSummary: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return db.getBatchFinancialSummary(input.batchId);
      }),
    
    // Get customer packages in a batch with Full Package detection
    getCustomerPackages: staffProcedure
      .input(z.object({ batchId: z.number(), customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerPackagesInBatch(input.customerId, input.batchId);
      }),
    
    // Generate PDF report for batch financial summary
    generateFinancialPDF: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ input }) => {
        const { generateBatchFinancialPDF } = await import("./pdf-generator");
        const batch = await db.getBatchById(input.batchId);
        if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Batch not found" });
        
        const summary = await db.getBatchFinancialSummary(input.batchId);
        if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "Financial summary not found" });
        
        const customers = await db.getAllCustomers();
        const customerMap = new Map(customers.map(c => [c.id, c]));
        
        const pdfUrl = await generateBatchFinancialPDF({
          batchCode: batch.batchCode,
          shippingType: batch.shippingType,
          status: batch.status,
          departureDate: batch.departureDate ? new Date(batch.departureDate).toLocaleDateString() : undefined,
          arrivalDate: batch.actualArrival ? new Date(batch.actualArrival).toLocaleDateString() : undefined,
          actualVolume: summary.shippingType === 'sea' ? summary.actualCbm : summary.actualWeight,
          chargedVolume: summary.shippingType === 'sea' ? summary.chargedCbm : summary.chargedWeight,
          costPerUnit: summary.shippingType === 'sea' ? summary.costPerCbm : summary.costPerKg,
          totalCost: summary.totalCost,
          totalRevenue: summary.totalRevenue,
          profit: summary.profit,
          profitMargin: summary.profitMargin,
          customerBreakdown: summary.customerBreakdown.map(cb => {
            const customer = customerMap.get(cb.customerId);
            return {
              customerName: customer?.fullName || 'Unknown',
              customerCode: customer?.customerCode || 'N/A',
              packages: cb.packages,
              volume: summary.shippingType === 'sea' ? cb.cbm : cb.weight,
              revenue: cb.revenue,
            };
          }),
        });
        
        return { url: pdfUrl };
      }),
    
    // Calculate price for a customer in a batch
    calculateCustomerPrice: staffProcedure
      .input(z.object({
        batchId: z.number(),
        customerId: z.number(),
      }))
      .query(async ({ input }) => {
        const batch = await db.getBatchById(input.batchId);
        if (!batch) return null;
        
        const unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
        const customerTotal = await db.getCustomerTotalInBatch(input.batchId, input.customerId, unit);
        
        // Check if batch uses tiered pricing
        if (batch.useTieredPricing) {
          const tierPrice = await db.getApplicableTierPrice(input.batchId, customerTotal);
          if (tierPrice !== null) {
            return {
              customerTotal,
              unit,
              pricePerUnit: tierPrice,
              totalPrice: customerTotal * tierPrice,
              isTiered: true,
            };
          }
        }
        
        // Use default price
        const defaultPrice = unit === 'cbm' 
          ? Number(batch.pricePerCbm) || 0 
          : Number(batch.pricePerKg) || 0;
        
        return {
          customerTotal,
          unit,
          pricePerUnit: defaultPrice,
          totalPrice: customerTotal * defaultPrice,
          isTiered: false,
        };
      }),
  }),

  // ============ PACKAGE MANAGEMENT ============
  packages: router({
    list: staffProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        shippingType: z.string().optional(),
        batchId: z.number().optional(),
        customerId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllPackages({
          page: input?.page,
          pageSize: input?.pageSize,
          search: input?.search,
          status: input?.status,
          shippingType: input?.shippingType,
          batchId: input?.batchId,
          customerId: input?.customerId,
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
        });
      }),
    stats: staffProcedure
      .query(async () => {
        return db.getPackagesStats();
      }),
    recentPackages: staffProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getRecentPackages(input?.limit || 10);
      }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPackageById(input.id);
      }),
    getByCode: staffProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return db.getPackageByCode(input.code);
      }),
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackagesByCustomer(input.customerId);
      }),
    getByStatus: staffProcedure
      .input(z.object({ status: z.string() }))
      .query(async ({ input }) => {
        return db.getPackagesByStatus(input.status);
      }),
    // Lookup tracking number to identify package type (regular/full_package/commission)
    lookupTracking: staffProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        // Check if tracking exists in fullPackageOrders
        const order = await database.select({
          id: fullPackageOrders.id,
          orderCode: fullPackageOrders.orderCode,
          orderType: fullPackageOrders.orderType,
          customerId: fullPackageOrders.customerId,
          productName: fullPackageOrders.productName,
          status: fullPackageOrders.status,
        }).from(fullPackageOrders)
          .where(eq(fullPackageOrders.trackingNumber, input.trackingNumber))
          .limit(1);
        
        if (order.length > 0) {
          // Get customer info
          const customer = await db.getCustomerById(order[0].customerId);
          return {
            found: true as const,
            type: order[0].orderType as 'full_package' | 'commission',
            orderId: order[0].id,
            orderCode: order[0].orderCode,
            productName: order[0].productName,
            status: order[0].status,
            customerId: order[0].customerId,
            customerCode: customer?.customerCode || '',
            customerName: customer?.fullName || '',
          };
        }
        
        // Check if tracking already exists in packages (duplicate check)
        const existingPkg = await database.select({
          id: packages.id,
          packageCode: packages.packageCode,
        }).from(packages)
          .where(eq(packages.trackingNumber, input.trackingNumber))
          .limit(1);
        
        if (existingPkg.length > 0) {
          return {
            found: false as const,
            type: 'duplicate' as const,
            existingPackageCode: existingPkg[0].packageCode,
          };
        }
        
        return { found: false as const, type: 'regular' as const };
      }),
    
    // Get CBM divisor setting
    getCbmDivisor: staffProcedure
      .query(async () => {
        const value = await db.getSetting('cbm_divisor');
        return { divisor: value ? parseInt(value) : 6000 };
      }),
    
    // Set CBM divisor setting
    setCbmDivisor: adminProcedure
      .input(z.object({ divisor: z.number().min(1).max(99999) }))
      .mutation(async ({ input, ctx }) => {
        await db.setSystemSetting({
          key: 'cbm_divisor',
          value: input.divisor.toString(),
          type: 'number',
          description: 'CBM volumetric weight divisor for air shipping (default: 6000)',
          updatedById: ctx.user.id,
        });
        return { divisor: input.divisor };
      }),

    register: staffProcedure
      .input(z.object({
        customerId: z.number().optional(), // Optional for unclaimed packages
        originWarehouseId: z.number(),
        isUnclaimed: z.boolean().optional(), // True if registering without customer
        trackingNumber: z.string().optional(),
        weightKg: z.string().optional(),
        lengthCm: z.string().optional(),
        widthCm: z.string().optional(),
        heightCm: z.string().optional(),
        volumeCbm: z.string().optional(), // Direct CBM input for sea shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]),
        description: z.string().optional(),
        photos: z.array(z.string()).optional(),
        batchId: z.number().optional(),
        categoryId: z.number().optional(),
        fullPackageOrderId: z.number().optional(), // Link to full package order if tracking matched
      }))
      .mutation(async ({ input, ctx }) => {
        const warehouse = await db.getWarehouseById(input.originWarehouseId);
        if (!warehouse) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Warehouse not found" });
        }

        // For unclaimed packages, customer is optional
        let customer = null;
        if (input.customerId && !input.isUnclaimed) {
          customer = await db.getCustomerById(input.customerId);
          if (!customer) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
          }
        }

        // Generate package code - use UNC prefix for unclaimed
        const packageCode = input.isUnclaimed 
          ? await db.getNextUnclaimedPackageCode()
          : await db.getNextPackageCode(warehouse.codePrefix);

        // Calculate volume if dimensions provided, or use direct CBM input
        let volumeCbm: string | undefined;
        if (input.volumeCbm) {
          // Use direct CBM input (for sea shipping)
          volumeCbm = parseFloat(input.volumeCbm).toFixed(6);
        } else if (input.lengthCm && input.widthCm && input.heightCm) {
          // Calculate from dimensions
          const vol = (parseFloat(input.lengthCm) * parseFloat(input.widthCm) * parseFloat(input.heightCm)) / 1000000;
          volumeCbm = vol.toFixed(6);
        }

        // Get applicable pricing
        const country = await db.getCountryById(warehouse.countryId);
        const destCountries = await db.getDestinationCountries();
        const destCountry = destCountries[0]; // Default to first destination (Iraq)
        
        let calculatedCostUsd: string | undefined;
        let appliedPricingRuleId: number | undefined;
        
        if (country && destCountry) {
          const pricingRule = await db.getApplicablePricingRule(
            country.id,
            destCountry.id,
            input.shippingType
          );
          
          if (pricingRule) {
            appliedPricingRuleId = pricingRule.id;
            const pricePerUnit = parseFloat(pricingRule.pricePerUnit);
            
            if (pricingRule.unit === "kg" && input.weightKg) {
              calculatedCostUsd = (pricePerUnit * parseFloat(input.weightKg)).toFixed(2);
            } else if (pricingRule.unit === "cbm" && volumeCbm) {
              calculatedCostUsd = (pricePerUnit * parseFloat(volumeCbm)).toFixed(2);
            }
          }
        }

        // Generate QR data
        const qrData = JSON.stringify({
          customerCode: customer?.customerCode || "UNCLAIMED",
          packageCode,
          trackingNumber: input.trackingNumber,
          timestamp: Date.now(),
        });
        const qrSignature = signQrData(qrData);

        const pkg = await db.createPackage({
          packageCode,
          trackingNumber: input.trackingNumber,
          customerId: input.isUnclaimed ? undefined : input.customerId,
          originWarehouseId: input.originWarehouseId,
          qrCodeData: qrData,
          qrCodeSignature: qrSignature,
          weightKg: input.weightKg,
          lengthCm: input.lengthCm,
          widthCm: input.widthCm,
          heightCm: input.heightCm,
          volumeCbm,
          shippingType: input.shippingType,
          description: input.description,
          photos: input.photos,
          calculatedCostUsd: input.isUnclaimed ? undefined : calculatedCostUsd,
          appliedPricingRuleId: input.isUnclaimed ? undefined : appliedPricingRuleId,
          registeredById: ctx.user.id,
          batchId: input.batchId,
          categoryId: input.categoryId,
          isUnclaimed: input.isUnclaimed || false,
          fullPackageOrderId: input.fullPackageOrderId,
        });

        // Create ledger transaction for charge (only for claimed packages)
        if (calculatedCostUsd && input.customerId && !input.isUnclaimed) {
          const customer = await db.getCustomerById(input.customerId);
          if (customer) {
            await db.applyCharge(
              input.customerId,
              customer.customerCode,
              'PACKAGE',
              pkg.id,
              parseFloat(calculatedCostUsd),
              `Package ${packageCode} - ${input.shippingType}`,
              ctx.user.id
            );
          }
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "register_package",
          entityType: "package",
          entityId: pkg.id,
          newValues: { packageCode, customerId: input.customerId },
        });

        return pkg;
      }),
    // Get unclaimed packages
    getUnclaimed: staffProcedure
      .query(async () => {
        return db.getUnclaimedPackages();
      }),
    // Get unclaimed package count
    getUnclaimedCount: staffProcedure
      .query(async () => {
        return db.getUnclaimedPackageCount();
      }),
    // ============ CLAIM REQUESTS MANAGEMENT ============
    
    // Get all claim requests (admin)
    getClaimRequests: adminProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllClaimRequests(input);
      }),
    
    // Get pending claim requests count (for badge)
    getPendingClaimRequestsCount: staffProcedure
      .query(async () => {
        return db.getPendingClaimRequestsCount();
      }),
    
    // Approve a claim request
    approveClaimRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getClaimRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Claim request not found" });
        }
        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Request has already been processed" });
        }
        
        const result = await db.approveClaimRequest(input.requestId, ctx.user.id, input.adminNote);
        
        // Calculate and apply pricing if package is in a batch
        const pkg = await db.getPackageById(request.packageId);
        if (pkg && pkg.batchId) {
          const batch = await db.getBatchById(pkg.batchId);
          if (batch) {
            let calculatedCost = 0;
            if (batch.pricePerKg && pkg.weightKg) {
              // Use chargeable weight (max of actual and volumetric)
              const actualKg = parseFloat(pkg.weightKg?.toString() || "0");
              const lengthCm = parseFloat(pkg.lengthCm?.toString() || "0");
              const widthCm = parseFloat(pkg.widthCm?.toString() || "0");
              const heightCm = parseFloat(pkg.heightCm?.toString() || "0");
              const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
              const chargeableKg = Math.max(actualKg, volumetricKg);
              calculatedCost = parseFloat(batch.pricePerKg) * chargeableKg;
            } else if (batch.pricePerCbm && pkg.volumeCbm) {
              calculatedCost = parseFloat(batch.pricePerCbm) * parseFloat(pkg.volumeCbm);
            }
            
            if (calculatedCost > 0) {
              await db.updatePackage(request.packageId, {
                calculatedCostUsd: calculatedCost.toFixed(2),
              });
              
              // Create ledger transaction and invoice
              const customer = await db.getCustomerById(request.customerId);
              if (customer) {
                // Get exchange rates for invoice
                const iqdRate = await db.getCurrentExchangeRate("IQD");
                const rmbRate = await db.getCurrentExchangeRate("RMB");
                
                // Create invoice for the claimed package
                const invoiceNumber = `INV-CLM-${Date.now()}-${pkg.id}`;
                const chargeableKg = pkg.weightKg ? Math.max(
                  parseFloat(pkg.weightKg?.toString() || "0"),
                  ((parseFloat(pkg.lengthCm?.toString() || "0") * parseFloat(pkg.widthCm?.toString() || "0") * parseFloat(pkg.heightCm?.toString() || "0")) / 6000)
                ) : 0;
                
                const isAirShipment = batch.shippingType === 'air_regular' || batch.shippingType === 'air_irregular';
                const lineItems = [{
                  description: `پاکەتی داواکراو ${pkg.packageCode} - ${pkg.trackingNumber || ''} - باچ ${batch.batchCode}`,
                  quantity: 1,
                  unitPrice: calculatedCost,
                  total: calculatedCost,
                }];
                
                // Use applyCharge which automatically creates invoice
                await db.applyCharge(
                  request.customerId,
                  customer.customerCode,
                  'PACKAGE',
                  pkg.id,
                  calculatedCost,
                  `پاکەتی داواکراو ${pkg.packageCode} - باچ ${batch.batchCode} - ${isAirShipment ? 'ئاسمانی' : 'دەریایی'}`,
                  ctx.user.id,
                  lineItems
                );
              }
            }
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "approve_claim_request",
          entityType: "claim_request",
          entityId: input.requestId,
          newValues: { status: "approved", customerId: request.customerId },
        });
        
        return result;
      }),
    
    // Reject a claim request
    rejectClaimRequest: adminProcedure
      .input(z.object({
        requestId: z.number(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getClaimRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Claim request not found" });
        }
        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Request has already been processed" });
        }
        
        const result = await db.rejectClaimRequest(input.requestId, ctx.user.id, input.adminNote);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "reject_claim_request",
          entityType: "claim_request",
          entityId: input.requestId,
          newValues: { status: "rejected" },
        });
        
        return result;
      }),
    
    // Claim a package (assign customer)
    claimPackage: staffProcedure
      .input(z.object({
        packageId: z.number(),
        customerId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        if (!pkg.isUnclaimed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Package is already claimed" });
        }
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        const updated = await db.claimPackage(input.packageId, input.customerId, ctx.user.id);
        
        // Calculate and apply pricing if batch has pricing
        if (updated && updated.batchId) {
          const batch = await db.getBatchById(updated.batchId);
          if (batch) {
            let calculatedCost = 0;
            if (batch.pricePerKg && updated.weightKg) {
              // Use chargeable weight (max of actual and volumetric)
              const actualKg = parseFloat(updated.weightKg?.toString() || "0");
              const lengthCm = parseFloat(updated.lengthCm?.toString() || "0");
              const widthCm = parseFloat(updated.widthCm?.toString() || "0");
              const heightCm = parseFloat(updated.heightCm?.toString() || "0");
              const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
              const chargeableKg = Math.max(actualKg, volumetricKg);
              calculatedCost = parseFloat(batch.pricePerKg) * chargeableKg;
            } else if (batch.pricePerCbm && updated.volumeCbm) {
              calculatedCost = parseFloat(batch.pricePerCbm) * parseFloat(updated.volumeCbm);
            }
            
            if (calculatedCost > 0) {
              await db.updatePackage(input.packageId, {
                calculatedCostUsd: calculatedCost.toFixed(2),
              });
              
               // Create ledger transaction
              const customerData = await db.getCustomerById(input.customerId);
              if (customerData) {
                await db.applyCharge(
                  input.customerId,
                  customerData.customerCode,
                  'PACKAGE',
                  pkg.id,
                  calculatedCost,
                  `Package ${pkg.packageCode} claimed - ${pkg.shippingType}`,
                  ctx.user.id
                );
              }
            }
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "claim_package",
          entityType: "package",
          entityId: input.packageId,
          newValues: { customerId: input.customerId },
        });
        
        return updated;
      }),
    assignToBatch: staffProcedure
      .input(z.object({
        packageId: z.number(),
        batchId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updatePackage(input.packageId, {
          batchId: input.batchId,
          status: "in_batch",
        });
        
        // Update batch package count
        const batch = await db.getBatchById(input.batchId);
        if (batch) {
          await db.updateBatch(input.batchId, {
            totalPackages: batch.totalPackages + 1,
          });
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "assign_package_to_batch",
          entityType: "package",
          entityId: input.packageId,
          newValues: { batchId: input.batchId },
        });
        return { success: true };
      }),
    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum([
          "registered", "in_batch", "in_transit", "customs_processing",
          "ready_for_delivery", "out_for_delivery", "delivered", "returned", "cancelled"
        ]),
        recipientName: z.string().optional(),
        recipientSignature: z.string().optional(),
        deliveryPhoto: z.string().optional(),
        deliveryType: z.enum(["air_transit", "warehouse_pickup", "direct_delivery"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Get package details before update
        const pkg = await db.getPackageById(id);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        const updateData: any = { ...data };
        if (input.status === "delivered") {
          updateData.deliveredAt = new Date();
          updateData.deliveredById = ctx.user.id;
          
          // Check if this package is linked to a Full Package order
          // If linked, DO NOT charge customer - shipping is our cost, not customer's
          let isLinkedToFullPackage = false;
          let linkedFullPackageOrder = null;
          if (pkg.trackingNumber) {
            linkedFullPackageOrder = await db.getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
            if (linkedFullPackageOrder) {
              isLinkedToFullPackage = true;
              console.log(`[FullPackage] Package ${pkg.packageCode} is linked to Full Package ${linkedFullPackageOrder.orderCode} - shipping cost will NOT be charged to customer`);
            }
          }
          
          // Automatic pricing on delivery - only if not already charged and has customer
          // SKIP charging if package is linked to Full Package (shipping is our cost)
          if (!pkg.isCharged && pkg.customerId && !pkg.isUnclaimed && !isLinkedToFullPackage) {
            let chargeAmount = 0;
            let pricePerUnit = 0;
            let unit: 'kg' | 'cbm' = 'kg';
            let pricingSource = '';
            
            // First, try batch-based pricing if package is in a batch
            if (pkg.batchId) {
              const batch = await db.getBatchById(pkg.batchId);
              if (batch) {
                unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
                const customerTotal = await db.getCustomerTotalInBatch(pkg.batchId, pkg.customerId, unit);
                
                // Check if batch uses tiered pricing
                if (batch.useTieredPricing) {
                  const tierPrice = await db.getApplicableTierPrice(pkg.batchId, customerTotal);
                  if (tierPrice !== null) {
                    pricePerUnit = tierPrice;
                    pricingSource = 'batch_tiered';
                  }
                }
                
                // If no tiered price, use batch default price
                if (pricePerUnit === 0) {
                  pricePerUnit = unit === 'cbm' 
                    ? Number(batch.pricePerCbm) || 0 
                    : Number(batch.pricePerKg) || 0;
                  pricingSource = 'batch_default';
                }
                
                // Calculate charge based on unit
                if (pricePerUnit > 0) {
                  if (unit === 'cbm' && pkg.volumeCbm) {
                    chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                  } else if (unit === 'kg') {
                    // Use chargeable weight (max of actual weight and volumetric weight)
                    const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                    const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                    const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                    const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                    const chargeableKg = Math.max(actualKg, volumetricKg);
                    chargeAmount = pricePerUnit * chargeableKg;
                  }
                }
              }
            }
            
            // Fallback to global pricing rules if no batch pricing
            if (chargeAmount === 0 && pkg.weightKg) {
              const warehouse = await db.getWarehouseById(pkg.originWarehouseId);
              const destCountries = await db.getDestinationCountries();
              const destCountry = destCountries[0];
              
              if (warehouse && destCountry) {
                const pricingRule = await db.getApplicablePricingRule(
                  warehouse.countryId,
                  destCountry.id,
                  pkg.shippingType
                );
                
                if (pricingRule) {
                  pricePerUnit = parseFloat(pricingRule.pricePerUnit);
                  unit = pricingRule.unit;
                  pricingSource = 'global_rule';
                  
                  if (pricingRule.unit === "kg") {
                    // Use chargeable weight (max of actual weight and volumetric weight)
                    const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                    const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                    const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                    const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                    const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                    const chargeableKg = Math.max(actualKg, volumetricKg);
                    chargeAmount = pricePerUnit * chargeableKg;
                  } else if (pricingRule.unit === "cbm" && pkg.volumeCbm) {
                    chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                  }
                }
              }
            }
            
            if (chargeAmount > 0) {
              // Create ledger transaction for charge
              const customerForCharge = await db.getCustomerById(pkg.customerId);
              // Calculate chargeable weight for description
              let quantity: string | null;
              if (unit === 'cbm') {
                quantity = pkg.volumeCbm;
              } else {
                const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                const chargeableKg = Math.max(actualKg, volumetricKg);
                quantity = chargeableKg.toFixed(2);
              }
              if (customerForCharge) {
                await db.applyCharge(
                  pkg.customerId,
                  customerForCharge.customerCode,
                  'PACKAGE',
                  pkg.id,
                  chargeAmount,
                  `Delivery charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                  ctx.user.id
                );
              }
              
              // Mark package as charged
              updateData.isCharged = true;
              updateData.calculatedCostUsd = chargeAmount.toFixed(2);
              
              // Create revenue record for finance tracking
              try {
                await db.createRevenueRecord({
                  recordDate: new Date(),
                  revenueType: 'package_delivery',
                  referenceType: 'package',
                  referenceId: pkg.id,
                  customerId: pkg.customerId,
                  amountUsd: chargeAmount,
                  description: `Package delivery - ${pkg.packageCode}`,
                  createdById: ctx.user.id,
                });
                
                // Update daily financial summary
                await db.updateDailyFinancialSummary(new Date(), { addRevenue: chargeAmount, revenueType: 'package_delivery' });
              } catch (e) {
                console.error('[Finance] Failed to create revenue record:', e);
              }
              
              // Create ledger transaction for new accounting system
              try {
                const customer = await db.getCustomerById(pkg.customerId);
                if (customer) {
                  await db.recordPackageCharge(
                    pkg.customerId,
                    customer.customerCode,
                    pkg.id,
                    chargeAmount,
                    `Delivery charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                    ctx.user.id
                  );
                }
              } catch (e) {
                console.error('[Ledger] Failed to create ledger transaction:', e);
              }
              
              // NOTE: Individual package delivery invoices are disabled
              // Invoices are now created at batch level (one invoice per customer per batch)
              // This provides cleaner accounting and fewer invoices for customers
              // See batch.markArrived for consolidated invoice creation
            }
          }
        }
        
        await db.updatePackage(id, updateData);
        
        // Sync status to fullPackageOrder if this package is linked to one
        // Also calculate shipping cost for Full Package even though we don't charge customer
        if (pkg.trackingNumber) {
          try {
            const fullPackageOrder = await db.getFullPackageOrderByTrackingNumber(pkg.trackingNumber);
            if (fullPackageOrder) {
              // Map package status to fullPackageOrder status
              const statusMap: Record<string, string> = {
                'registered': 'ordered',
                'in_batch': 'in_transit',
                'in_transit': 'in_transit',
                'customs_processing': 'in_transit',
                'ready_for_delivery': 'arrived',
                'out_for_delivery': 'arrived',
                'delivered': 'delivered',
                'returned': 'ordered',
                'cancelled': 'cancelled'
              };
              
              const newStatus = statusMap[input.status];
              if (newStatus && newStatus !== fullPackageOrder.status) {
                const fpUpdateData: any = { status: newStatus };
                
                // If delivered, calculate shipping cost for Full Package profit calculation
                // This is OUR cost, not charged to customer
                if (input.status === 'delivered') {
                  // Calculate shipping cost based on batch pricing or global rules
                  let shippingCost = 0;
                  
                  // If package already has calculated cost, use it
                  if (pkg.calculatedCostUsd) {
                    shippingCost = parseFloat(pkg.calculatedCostUsd);
                  } else {
                    // Calculate shipping cost based on pricing rules
                    let pricePerUnit = 0;
                    let unit: 'kg' | 'cbm' = 'kg';
                    
                    // Try batch-based pricing first
                    if (pkg.batchId) {
                      const batch = await db.getBatchById(pkg.batchId);
                      if (batch) {
                        unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
                        const customerTotal = pkg.customerId ? await db.getCustomerTotalInBatch(pkg.batchId, pkg.customerId, unit) : 0;
                        
                        if (batch.useTieredPricing) {
                          const tierPrice = await db.getApplicableTierPrice(pkg.batchId, customerTotal);
                          if (tierPrice !== null) pricePerUnit = tierPrice;
                        }
                        
                        if (pricePerUnit === 0) {
                          pricePerUnit = unit === 'cbm' 
                            ? Number(batch.pricePerCbm) || 0 
                            : Number(batch.pricePerKg) || 0;
                        }
                      }
                    }
                    
                    // Fallback to global pricing rules
                    if (pricePerUnit === 0 && pkg.weightKg) {
                      const warehouse = await db.getWarehouseById(pkg.originWarehouseId);
                      const destCountries = await db.getDestinationCountries();
                      const destCountry = destCountries[0];
                      
                      if (warehouse && destCountry) {
                        const pricingRule = await db.getApplicablePricingRule(
                          warehouse.countryId,
                          destCountry.id,
                          pkg.shippingType
                        );
                        
                        if (pricingRule) {
                          pricePerUnit = parseFloat(pricingRule.pricePerUnit);
                          unit = pricingRule.unit;
                        }
                      }
                    }
                    
                    // Calculate shipping cost
                    if (pricePerUnit > 0) {
                      if (unit === 'cbm' && pkg.volumeCbm) {
                        shippingCost = pricePerUnit * parseFloat(pkg.volumeCbm);
                      } else if (unit === 'kg') {
                        // Use chargeable weight (max of actual weight and volumetric weight)
                        const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                        const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                        const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                        const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                        const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                        const chargeableKg = Math.max(actualKg, volumetricKg);
                        shippingCost = pricePerUnit * chargeableKg;
                      }
                    }
                    
                    // Save calculated cost to package for reference
                    if (shippingCost > 0) {
                      await db.updatePackage(pkg.id, { calculatedCostUsd: shippingCost.toFixed(2) });
                    }
                  }
                  
                  if (shippingCost > 0) {
                    fpUpdateData.shippingCostUsd = shippingCost.toFixed(2);
                    console.log(`[FullPackage] Updating order ${fullPackageOrder.id} with shipping cost: $${shippingCost} (OUR cost, not charged to customer)`);
                  }
                }
                
                await db.updateFullPackageOrder(fullPackageOrder.id, fpUpdateData, ctx.user.id);
                console.log(`[FullPackage] Synced status from package ${pkg.packageCode} to order ${fullPackageOrder.id}: ${newStatus}`);
              }
            }
          } catch (e) {
            console.error('[FullPackage] Failed to sync status to fullPackageOrder:', e);
          }
        }
        
        // Send notification to customer about status change
        try {
          await notifyPackageStatusChange(id, input.status);
        } catch (e) {
          console.error("[Notification] Failed to send package status notification:", e);
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_package_status",
          entityType: "package",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        customerId: z.number().optional(),
        weightKg: z.string().optional(),
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        description: z.string().optional(),
        lengthCm: z.string().optional(),
        widthCm: z.string().optional(),
        heightCm: z.string().optional(),
        trackingNumber: z.string().optional(),
        batchId: z.number().nullable().optional(),
        categoryId: z.number().nullable().optional(),
        volumeCbm: z.string().optional(),
        photos: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, volumeCbm: inputVolumeCbm, photos, ...data } = input;
        
        // Calculate volume if dimensions provided, or use direct input
        const updateData: any = { ...data };
        if (inputVolumeCbm) {
          updateData.volumeCbm = inputVolumeCbm;
        } else if (data.lengthCm && data.widthCm && data.heightCm) {
          const volumeCbm = (parseFloat(data.lengthCm) * parseFloat(data.widthCm) * parseFloat(data.heightCm)) / 1000000;
          updateData.volumeCbm = volumeCbm.toFixed(6);
        }
        
        // Handle photos
        if (photos) {
          updateData.photos = JSON.stringify(photos);
        }
        
        // Handle batch assignment status change
        if (data.batchId !== undefined) {
          if (data.batchId === null) {
            updateData.status = 'registered';
          } else {
            const pkg = await db.getPackageById(id);
            if (pkg && pkg.status === 'registered') {
              updateData.status = 'in_batch';
            }
          }
        }
        
        await db.updatePackage(id, updateData);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_package",
          entityType: "package",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.id);
        if (!pkg) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        await db.deletePackage(input.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_package",
          entityType: "package",
          entityId: input.id,
          oldValues: pkg,
        });
        return { success: true };
      }),
    verifyQr: staffProcedure
      .input(z.object({
        qrData: z.string(),
        signature: z.string(),
      }))
      .query(async ({ input }) => {
        const isValid = verifyQrSignature(input.qrData, input.signature);
        if (!isValid) {
          return { valid: false, package: null };
        }
        
        try {
          const data = JSON.parse(input.qrData);
          const pkg = await db.getPackageByCode(data.packageCode);
          return { valid: true, package: pkg };
        } catch {
          return { valid: false, package: null };
        }
      }),
  }),

  // ============ INVOICES ============
  invoices: router({
    list: accountantProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllInvoices(input?.limit);
      }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoiceById(input.id);
      }),
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoicesByCustomer(input.customerId);
      }),
    create: accountantProcedure
      .input(z.object({
        customerId: z.number(),
        packageId: z.number().optional(),
        includeExtraServices: z.boolean().optional(), // Include unpaid extra services
        lineItems: z.array(z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          total: z.number(),
          extraServiceId: z.number().optional(), // Link to extra service if applicable
        })),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let allLineItems = [...input.lineItems];
        
        // If includeExtraServices is true, add unpaid extra services to line items
        if (input.includeExtraServices) {
          const unpaidServices = await db.getExtraServicesWithDetails(input.customerId);
          const unpaidServiceItems = unpaidServices
            .filter(s => !s.isPaid && !s.invoiceId)
            .map(s => ({
              description: `${s.serviceType?.nameEn || 'Service'}: ${s.description}`,
              quantity: 1,
              unitPrice: Number(s.priceAmount || 0),
              total: Number(s.priceAmount || 0),
              extraServiceId: s.id,
            }));
          allLineItems = [...allLineItems, ...unpaidServiceItems];
        }
        
        const invoiceNumber = await db.getNextInvoiceNumber();
        const subtotal = allLineItems.reduce((sum, item) => sum + item.total, 0);
        
        // Get current exchange rates
        const iqdRate = await db.getCurrentExchangeRate("IQD");
        const rmbRate = await db.getCurrentExchangeRate("RMB");
        
        const invoice = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          packageId: input.packageId,
          subtotalUsd: subtotal.toFixed(2),
          totalUsd: subtotal.toFixed(2),
          exchangeRateIqd: iqdRate?.rate,
          exchangeRateRmb: rmbRate?.rate,
          totalIqd: iqdRate ? (subtotal * parseFloat(iqdRate.rate)).toFixed(0) : undefined,
          totalRmb: rmbRate ? (subtotal * parseFloat(rmbRate.rate)).toFixed(2) : undefined,
          lineItems: allLineItems,
          notes: input.notes,
          createdById: ctx.user.id,
        });

        // Link extra services to this invoice
        if (input.includeExtraServices) {
          const serviceIds = allLineItems
            .filter(item => item.extraServiceId)
            .map(item => item.extraServiceId as number);
          for (const serviceId of serviceIds) {
            await db.linkExtraServiceToInvoice(serviceId, invoice.id);
          }
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_invoice",
          entityType: "invoice",
          entityId: invoice.id,
          newValues: { invoiceNumber },
        });

        return invoice;
      }),
    issue: accountantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateInvoice(input.id, {
          status: "issued",
          issuedAt: new Date(),
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "issue_invoice",
          entityType: "invoice",
          entityId: input.id,
        });
        return { success: true };
      }),
    markPaid: accountantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateInvoice(input.id, {
          status: "paid",
          paidAt: new Date(),
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "mark_invoice_paid",
          entityType: "invoice",
          entityId: input.id,
        });
        return { success: true };
      }),
    
    // ============ INVOICE REPORTS ============
    
    // Get invoice summary for a date range
    getSummary: accountantProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const startDate = input?.startDate ? new Date(input.startDate) : undefined;
        const endDate = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getInvoiceSummary(startDate, endDate);
      }),
    
    // Get monthly invoice breakdown for a year
    getMonthlyReport: accountantProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        return db.getMonthlyInvoiceReport(input.year);
      }),
    
    // Get yearly invoice summary for multiple years
    getYearlyReport: accountantProcedure
      .input(z.object({ years: z.array(z.number()) }))
      .query(async ({ input }) => {
        return db.getYearlyInvoiceReport(input.years);
      }),
    
    // Get invoice statistics by customer
    getByCustomerReport: accountantProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const startDate = input?.startDate ? new Date(input.startDate) : undefined;
        const endDate = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getInvoicesByCustomerReport(startDate, endDate, input?.limit);
      }),
    
    // Get invoice statistics by service type
    getByServiceTypeReport: accountantProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const startDate = input?.startDate ? new Date(input.startDate) : undefined;
        const endDate = input?.endDate ? new Date(input.endDate) : undefined;
        return db.getInvoicesByServiceTypeReport(startDate, endDate);
      }),
    
    // Get recent invoices with pagination
    getRecent: accountantProcedure
      .input(z.object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getRecentInvoices(
          input?.page || 1,
          input?.pageSize || 20,
          input?.status,
          input?.customerId
        );
      }),

    // Generate PDF invoice
    generatePDF: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { generateInvoicePDF } = await import("./pdf-generator");
        const invoice = await db.getInvoiceById(input.id);
        if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
        
        const customer = await db.getCustomerById(invoice.customerId);
        if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
        const lineItems = typeof invoice.lineItems === 'string' 
          ? JSON.parse(invoice.lineItems) 
          : invoice.lineItems;
        
        const pdfUrl = await generateInvoicePDF({
          invoiceNumber: invoice.invoiceNumber,
          date: new Date(invoice.createdAt).toLocaleDateString(),
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : undefined,
          customer: {
            name: customer.fullName,
            code: customer.customerCode,
            phone: customer.mobileNumber || undefined,
            address: customer.address || undefined,
          },
          items: lineItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
          subtotal: Number(invoice.subtotalUsd),
          tax: invoice.taxUsd ? Number(invoice.taxUsd) : undefined,
          total: Number(invoice.totalUsd),
          notes: invoice.notes || undefined,
          isPaid: invoice.status === 'paid',
        });
        
        return { url: pdfUrl };
      }),
  }),

  // ============ EXCHANGE RATES ============
  exchangeRates: router({
    list: staffProcedure.query(async () => {
      return db.getAllExchangeRates();
    }),
    getCurrent: staffProcedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return db.getCurrentExchangeRate(input.currency);
      }),
    create: accountantProcedure
      .input(z.object({
        targetCurrency: z.string(),
        rate: z.string(),
        isManualOverride: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const rate = await db.createExchangeRate({
          ...input,
          source: input.isManualOverride ? "manual" : "api",
          createdById: ctx.user.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_exchange_rate",
          entityType: "exchange_rate",
          entityId: rate.id,
          newValues: input,
        });
        return rate;
      }),
  }),

  // ============ AUDIT LOGS (ADVANCED) ============
  auditLogs: router({
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
          { value: 'full_package', label: 'فول پاکیج' },
          { value: 'purchase_request', label: 'داواکاری کڕین' },
          { value: 'commission', label: 'کڕین بە عمولە' },
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
  }),

  // ============ ACTIVITY ALERTS ============
  activityAlerts: router({
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
  }),

  // ============ REPORTS ============
  reports: router({
    revenue: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getRevenueByDateRange(input.startDate, input.endDate);
      }),
    packagesByStatus: staffProcedure.query(async () => {
      return db.getPackageCountByStatus();
    }),
    customersWithBalance: accountantProcedure.query(async () => {
      return db.getCustomersWithBalance();
    }),
    profitReport: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getProfitReport(input.startDate, input.endDate);
      }),
    topCustomers: staffProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return db.getTopCustomersByRevenue(input?.limit || 10);
      }),
    customersWithDebt: accountantProcedure.query(async () => {
      return db.getCustomersWithDebt();
    }),
    packageStats: staffProcedure.query(async () => {
      return db.getPackageStatsByStatus();
    }),
    timePeriodSummary: staffProcedure
      .input(z.object({ period: z.enum(["day", "week", "month"]) }))
      .query(async ({ input }) => {
        return db.getTimePeriodSummary(input.period);
      }),
    batchPerformance: staffProcedure.query(async () => {
      return db.getBatchPerformanceReport();
    }),
    getProfitByType: accountantProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getProfitByOrderType(input?.startDate, input?.endDate);
      }),
  }),

  // ============ CUSTOMER PORTAL ============
  customerPortal: router({
    getMyAccount: protectedProcedure.query(async ({ ctx }) => {
      // For merged model, the user IS the customer if isCustomer is true
      if (ctx.user.isCustomer) {
        const customer = ctx.user as any;
        return {
          id: customer.id,
          customerCode: customer.customerCode,
          fullName: customer.fullName || customer.name,
          mobileNumber: customer.mobileNumber,
          email: customer.email,
          country: customer.country,
          city: customer.city,
          address: customer.address,
        };
      }
      // Legacy: find customer linked to this user
      const customer = await db.getCustomerByUserId(ctx.user.id);
      return customer;
    }),
    getMyPackages: protectedProcedure.query(async ({ ctx }) => {
      // For merged model, use user.id directly as customerId
      if (ctx.user.isCustomer) {
        return db.getPackagesByCustomer(ctx.user.id);
      }
      // Legacy
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return db.getPackagesByCustomer(customer.id);
    }),
    getMyInvoices: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.isCustomer) {
        return db.getInvoicesByCustomer(ctx.user.id);
      }
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return [];
      return db.getInvoicesByCustomer(customer.id);
    }),
    getMyBalance: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.isCustomer) {
        return db.getCustomerBalance(ctx.user.id);
      }
      const customer = await db.getCustomerByUserId(ctx.user.id);
      if (!customer) return 0;
      return db.getCustomerBalance(customer.id);
    }),
    
    // Get customer's batches with their package count
    getMyBatches: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerBatches(customerId);
    }),
    
    // Get customer's packages in a specific batch
    getMyPackagesInBatch: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerPackagesInBatch(customerId, input.batchId);
      }),
    
    // Get unbatched packages
    getMyUnbatchedPackages: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerUnbatchedPackages(customerId);
    }),
    
    // Get customer's full package orders (for customer portal)
    getMyFullPackageOrders: protectedProcedure
      .input(z.object({
        orderType: z.enum(["full_package", "commission", "purchase_request"]).optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getFullPackageOrdersByCustomer(customerId, input);
      }),
    
    // Get financial summary
    getMyFinancialSummary: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return null;
      return db.getCustomerFinancialSummary(customerId);
    }),
    
    // Get transaction history
    getMyTransactions: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerTransactionHistory(customerId, input?.limit || 50);
      }),
    
    // Search package by tracking number
    searchPackage: protectedProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return null;
        return db.searchCustomerPackage(customerId, input.trackingNumber);
      }),
    
    // Get notification count
    getNotificationCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getCustomerNotificationCount(customerId);
    }),
    
    // Generate PDF receipt for a transaction
    getReceiptData: protectedProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
        // Get customer account to verify ownership
        const account = await db.getCustomerAccountByCustomerId(customerId);
        if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
        
        const transaction = await db.getLedgerTransactionById(input.transactionId);
        if (!transaction || transaction.accountId !== account.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
        }
        
        const customer = await db.getCustomerById(customerId);
        
        const ctxCustomer = ctx.user as any;
        return {
          transaction,
          customer: {
            fullName: customer?.fullName || ctxCustomer.fullName || ctxCustomer.name,
            customerCode: customer?.customerCode || ctxCustomer.customerCode,
            mobileNumber: customer?.mobileNumber || ctxCustomer.mobileNumber,
          },
          companyName: "Wazn Express",
          generatedAt: new Date().toISOString(),
        };
      }),
    
    // Get package details with image
    getPackageDetails: protectedProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || pkg.customerId !== customerId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
        }
        
        return pkg;
      }),
    
    // ============ UNCLAIMED PACKAGES & CLAIM REQUESTS ============
    
    // Get all unclaimed packages with search
    getUnclaimedPackages: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getUnclaimedPackagesWithSearch(input);
      }),
    
    // Create a claim request for an unclaimed package
    createClaimRequest: protectedProcedure
      .input(z.object({
        packageId: z.number(),
        trackingNumber: z.string(),
        customerNote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        
        // Check if package exists and is unclaimed
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg || !pkg.isUnclaimed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Package is not available for claiming" });
        }
        
        // Check if customer already has a pending claim for this package
        const hasExisting = await db.hasExistingClaimRequest(input.packageId, customerId);
        if (hasExisting) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You already have a pending claim for this package" });
        }
        
        return db.createClaimRequest({
          packageId: input.packageId,
          trackingNumber: input.trackingNumber,
          customerId,
          customerNote: input.customerNote,
        });
      }),
    
    // Get customer's claim requests
    getMyClaimRequests: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getClaimRequestsByCustomer(customerId);
    }),
    
    // Get single full package order detail
    getMyFullPackageOrderDetail: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return null;
        
        const order = await db.getFullPackageOrderById(input.orderId);
        if (!order || order.customerId !== customerId) return null;
        return order;
      }),
    
    // ============ MESSAGES ============
    getMyMessages: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getConversationMessages(`CONV-${customerId}`);
    }),
    
    sendMessage: protectedProcedure
      .input(z.object({ message: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer not found' });
        
        return db.createCustomerMessage({
          conversationId: `CONV-${customerId}`,
          customerId,
          message: input.message,
          senderType: 'customer',
          senderId: ctx.user.id,
        });
      }),
    
    markMessagesAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return;
      await db.markCustomerMessagesAsRead(customerId, 'customer');
    }),
    
    getUnreadMessageCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getUnreadMessageCount(customerId, 'customer');
    }),
    
    // ============ NOTIFICATIONS ============
    getMyNotifications: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) return [];
        return db.getCustomerNotifications(customerId, { unreadOnly: input?.unreadOnly });
      }),
    
    markNotificationAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationAsRead(input.notificationId);
        return { success: true };
      }),
    
    markAllNotificationsAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return;
      await db.markAllNotificationsAsRead(customerId);
    }),
    
    getUnreadNotificationCount: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return 0;
      return db.getUnreadNotificationCount(customerId);
    }),
    
    // ============ ADDRESSES ============
    getMyAddresses: protectedProcedure.query(async ({ ctx }) => {
      const customerId = ctx.user.isCustomer ? ctx.user.id : 
        (await db.getCustomerByUserId(ctx.user.id))?.id;
      if (!customerId) return [];
      return db.getCustomerAddresses(customerId);
    }),
    
    createAddress: protectedProcedure
      .input(z.object({
        label: z.string().min(1),
        recipientName: z.string().min(1),
        phone: z.string().min(1),
        country: z.string().default('Iraq'),
        city: z.string().min(1),
        district: z.string().optional(),
        street: z.string().optional(),
        building: z.string().optional(),
        floor: z.string().optional(),
        apartment: z.string().optional(),
        landmark: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        if (!customerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Customer not found' });
        
        return db.createCustomerAddress({
          ...input,
          customerId,
        });
      }),
    
    updateAddress: protectedProcedure
      .input(z.object({
        addressId: z.number(),
        label: z.string().optional(),
        recipientName: z.string().optional(),
        phone: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        street: z.string().optional(),
        building: z.string().optional(),
        floor: z.string().optional(),
        apartment: z.string().optional(),
        landmark: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addressId, ...data } = input;
        const address = await db.getCustomerAddressById(addressId);
        
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        return db.updateCustomerAddress(addressId, data);
      }),
    
    deleteAddress: protectedProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);
        
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        await db.deleteCustomerAddress(input.addressId);
        return { success: true };
      }),
    
    setDefaultAddress: protectedProcedure
      .input(z.object({ addressId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const address = await db.getCustomerAddressById(input.addressId);
        
        const customerId = ctx.user.isCustomer ? ctx.user.id : 
          (await db.getCustomerByUserId(ctx.user.id))?.id;
        
        if (!address || address.customerId !== customerId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Address not found' });
        }
        
        await db.setDefaultAddress(input.addressId, customerId);
        return { success: true };
      }),
  }),

  // ============ SETTINGS ============
  settings: router({
    get: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return db.getSetting(input.key);
      }),
    set: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setSetting(input.key, input.value, ctx.user.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_setting",
          entityType: "setting",
          newValues: input,
        });
        return { success: true };
      }),
    list: adminProcedure.query(async () => {
      return db.getAllSettings();
    }),
  }),

  // ============ INVOICE TEMPLATES ============
  invoiceTemplates: router({
    list: adminProcedure.query(async () => {
      return db.getInvoiceTemplates();
    }),
    
    getDefault: adminProcedure.query(async () => {
      return db.getDefaultInvoiceTemplate();
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoiceTemplateById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        isDefault: z.boolean().optional(),
        style: z.enum(["modern", "classic", "minimal"]).optional(),
        companyName: z.string().optional(),
        companyNameAr: z.string().optional(),
        companyNameKu: z.string().optional(),
        companyAddress: z.string().optional(),
        companyAddressAr: z.string().optional(),
        companyAddressKu: z.string().optional(),
        companyPhone: z.string().optional(),
        companyPhone2: z.string().optional(),
        companyEmail: z.string().optional(),
        companyWebsite: z.string().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        logoPosition: z.enum(["left", "center", "right"]).optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        textColor: z.string().optional(),
        backgroundColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
        bankName: z.string().optional(),
        bankAccountName: z.string().optional(),
        bankAccountNumber: z.string().optional(),
        bankIban: z.string().optional(),
        bankSwift: z.string().optional(),
        bank2Name: z.string().optional(),
        bank2AccountName: z.string().optional(),
        bank2AccountNumber: z.string().optional(),
        bank2Currency: z.string().optional(),
        footerText: z.string().optional(),
        footerTextAr: z.string().optional(),
        footerTextKu: z.string().optional(),
        termsText: z.string().optional(),
        termsTextAr: z.string().optional(),
        termsTextKu: z.string().optional(),
        showQrCode: z.boolean().optional(),
        showWatermark: z.boolean().optional(),
        watermarkText: z.string().optional(),
        invoicePrefix: z.string().optional(),
        invoiceNumberDigits: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.createInvoiceTemplate({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_invoice_template",
          entityType: "invoice_template",
          entityId: template.id,
          newValues: input,
        });
        return template;
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
        style: z.enum(["modern", "classic", "minimal"]).optional(),
        companyName: z.string().optional(),
        companyNameAr: z.string().optional(),
        companyNameKu: z.string().optional(),
        companyAddress: z.string().optional(),
        companyAddressAr: z.string().optional(),
        companyAddressKu: z.string().optional(),
        companyPhone: z.string().optional(),
        companyPhone2: z.string().optional(),
        companyEmail: z.string().optional(),
        companyWebsite: z.string().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        logoPosition: z.enum(["left", "center", "right"]).optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        textColor: z.string().optional(),
        backgroundColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
        bankName: z.string().optional(),
        bankAccountName: z.string().optional(),
        bankAccountNumber: z.string().optional(),
        bankIban: z.string().optional(),
        bankSwift: z.string().optional(),
        bank2Name: z.string().optional(),
        bank2AccountName: z.string().optional(),
        bank2AccountNumber: z.string().optional(),
        bank2Currency: z.string().optional(),
        footerText: z.string().optional(),
        footerTextAr: z.string().optional(),
        footerTextKu: z.string().optional(),
        termsText: z.string().optional(),
        termsTextAr: z.string().optional(),
        termsTextKu: z.string().optional(),
        showQrCode: z.boolean().optional(),
        showWatermark: z.boolean().optional(),
        watermarkText: z.string().optional(),
        invoicePrefix: z.string().optional(),
        invoiceNumberDigits: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const oldTemplate = await db.getInvoiceTemplateById(id);
        const template = await db.updateInvoiceTemplate(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_invoice_template",
          entityType: "invoice_template",
          entityId: id,
          oldValues: oldTemplate,
          newValues: data,
        });
        return template;
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.getInvoiceTemplateById(input.id);
        await db.deleteInvoiceTemplate(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_invoice_template",
          entityType: "invoice_template",
          entityId: input.id,
          oldValues: template,
        });
        return { success: true };
      }),
    
    setDefault: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.setDefaultInvoiceTemplate(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "set_default_invoice_template",
          entityType: "invoice_template",
          entityId: input.id,
        });
        return template;
      }),
    
    ensureDefault: adminProcedure.mutation(async () => {
      return db.ensureDefaultInvoiceTemplate();
    }),
  }),

  // ============ ADMIN CUSTOMER MESSAGES ============
  adminMessages: router({
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
        
        return message;
      }),
    
    // Get unread count for all customers
    getUnreadCount: adminProcedure.query(async () => {
      const conversations = await db.getAllConversations();
      return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
    }),
  }),

  // ============ FULL PACKAGE ORDERS ============
  fullPackage: router({
    list: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        supplierId: z.number().optional(),
        status: z.string().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission", "resale", "purchase"]).optional(),
        hasBatch: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]).optional(),
        isReturned: z.boolean().optional(),
        search: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllFullPackageOrders(input);
      }),
    
    // Get dashboard statistics (enhanced)
    getStats: staffProcedure.query(async () => {
      return db.getFullPackageStats();
    }),
    
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getFullPackageOrderById(input.id);
      }),
    
    create: staffProcedure
      .input(z.object({
        customerId: z.number(),
        supplierId: z.number().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).default("full_package"),
        productName: z.string().min(1),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).default(1),
        color: z.string().optional(),
        size: z.string().optional(),
        // Supplier tracking
        supplierTrackingNumber: z.string().optional(),
        supplierOrderNumber: z.string().optional(),
        purchaseInvoiceUrl: z.string().optional(),
        // Resale pricing
        purchasePriceUsd: z.string().optional(),
        purchasePriceCny: z.string().optional(),
        sellingPriceUsd: z.string().optional(),
        // Purchase service pricing
        estimatedPriceUsd: z.string().optional(),
        purchaseFeeUsd: z.string().optional(),
        // Commission purchase fields
        itemPriceUsd: z.string().optional(), // For commission: actual item price
        itemPriceCny: z.string().optional(), // For commission: item price in CNY
        commissionFeeUsd: z.string().optional(), // For commission: service fee
        totalPrepaidUsd: z.string().optional(), // For commission: total prepaid (item + commission)
        // Legacy commission fields
        commissionRate: z.string().optional(),
        commissionAmount: z.string().optional(),
        // Shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        volumeCbm: z.string().optional(),
        dimensionLength: z.string().optional(),
        dimensionWidth: z.string().optional(),
        dimensionHeight: z.string().optional(),
        // Order info
        orderNumber: z.string().optional(),
        trackingNumber: z.string().optional(),
        orderDate: z.date().optional(),
        expectedDeliveryDate: z.date().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        customerNotes: z.string().optional(),
        internalNotes: z.string().optional(),
        packageOwnership: z.enum(["customer", "company"]).optional(),
        batchId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Generate unique order code based on order type
        const prefix = input.orderType === 'commission' ? 'CM' : 
                       input.orderType === 'purchase_request' ? 'PR' : 'FP';
        const orderCode = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
        
        // Determine initial status based on order type
        let initialStatus: 'pending_quote' | 'ordered' | 'pending';
        if (input.orderType === 'purchase_request') {
          initialStatus = 'pending_quote'; // Customer request needs quote first
        } else if (input.orderNumber) {
          initialStatus = 'ordered';
        } else {
          initialStatus = 'pending';
        }
        
        // Calculate gross profit for full_package orders (per unit - display multiplies by quantity)
        let grossProfitUsd: string | undefined;
        if (input.orderType === 'full_package' && 
            input.sellingPriceUsd && input.purchasePriceUsd) {
          const selling = parseFloat(input.sellingPriceUsd);
          const purchase = parseFloat(input.purchasePriceUsd);
          // Store per-unit profit - frontend will multiply by quantity for display
          grossProfitUsd = (selling - purchase).toFixed(2);
        }
        
        // For commission orders, calculate total prepaid if not provided
        let totalPrepaid = input.totalPrepaidUsd;
        let itemPrice = 0;
        let commissionFee = 0;
        if (input.orderType === 'commission') {
          itemPrice = parseFloat(input.itemPriceUsd || '0');
          commissionFee = parseFloat(input.commissionFeeUsd || '0');
          if (!totalPrepaid && input.itemPriceUsd) {
            totalPrepaid = (itemPrice + commissionFee).toFixed(2);
          }
          // Commission is our profit
          grossProfitUsd = commissionFee.toFixed(2);
        }
        
        const order = await db.createFullPackageOrder({
          ...input,
          orderCode,
          status: initialStatus,
          grossProfitUsd,
          totalPrepaidUsd: totalPrepaid,
          orderDate: input.orderDate || (input.orderNumber ? new Date() : undefined),
          createdById: ctx.user.id,
          // Mark as paid for commission orders
          isPrepaid: input.orderType === 'commission' ? true : undefined,
          prepaidAt: input.orderType === 'commission' ? new Date() : undefined,
          isPaid: input.orderType === 'commission' ? true : undefined,
          paidFromBalanceUsd: input.orderType === 'commission' ? totalPrepaid : undefined,
          // IMPORTANT: Mark commission orders as charged at creation to prevent double charging at delivery
          // Commission orders are charged upfront (itemPrice + commissionFee), shipping is charged separately at delivery
          isCharged: input.orderType === 'commission' ? true : undefined,
          isChargedToCustomer: input.orderType === 'commission' ? true : undefined,
          chargedAt: input.orderType === 'commission' ? new Date() : undefined,
        });
        
        // For commission orders, automatically charge customer and create invoice
        if (input.orderType === 'commission' && totalPrepaid) {
          const customer = await db.getCustomerById(input.customerId);
          if (customer) {
            const totalAmount = parseFloat(totalPrepaid);
            const quantity = input.quantity || 1;
            
            // Create line items for invoice - show only total price
            const lineItems = [
              {
                description: `${input.productName}`,
                quantity: quantity,
                unitPrice: totalAmount / quantity,
                total: totalAmount,
              },
            ];
            
            // Apply charge - this creates ledger transaction and invoice
            await db.applyCharge(
              input.customerId,
              customer.customerCode,
              'COMMISSION',
              order.id,
              totalAmount,
              `کڕینی عمولە - ${input.productName}`,
              ctx.user.id,
              lineItems
            );
            
            console.log(`[Commission] Auto-charged customer ${customer.customerCode} for order ${orderCode}: $${totalAmount}`);
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: input.orderType === 'commission' ? "create_commission_order" : "create_full_package_order",
          entityType: "full_package_order",
          entityId: order.id,
          newValues: input,
        });
        
        return order;
      }),

    bulkCreate: staffProcedure
      .input(z.object({
        customerId: z.number(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).default("full_package"),
        items: z.array(z.object({
          supplierId: z.number().optional(),
          productName: z.string().min(1),
          productLink: z.string().optional(),
          productImage: z.string().optional(),
          productImages: z.array(z.string()).optional(),
          productDescription: z.string().optional(),
          quantity: z.number().min(1).default(1),
          color: z.string().optional(),
          size: z.string().optional(),
          supplierTrackingNumber: z.string().optional(),
          supplierOrderNumber: z.string().optional(),
          purchaseInvoiceUrl: z.string().optional(),
          purchasePriceUsd: z.string().optional(),
          purchasePriceCny: z.string().optional(),
          sellingPriceUsd: z.string().optional(),
          estimatedPriceUsd: z.string().optional(),
          purchaseFeeUsd: z.string().optional(),
          itemPriceUsd: z.string().optional(),
          itemPriceCny: z.string().optional(),
          commissionFeeUsd: z.string().optional(),
          totalPrepaidUsd: z.string().optional(),
          commissionRate: z.string().optional(),
          commissionAmount: z.string().optional(),
          shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
          shippingCostUsd: z.string().optional(),
          weightKg: z.string().optional(),
          volumeCbm: z.string().optional(),
          dimensionLength: z.string().optional(),
          dimensionWidth: z.string().optional(),
          dimensionHeight: z.string().optional(),
          orderNumber: z.string().optional(),
          trackingNumber: z.string().optional(),
          orderDate: z.date().optional(),
          expectedDeliveryDate: z.date().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
          tags: z.array(z.string()).optional(),
          notes: z.string().optional(),
          customerNotes: z.string().optional(),
          internalNotes: z.string().optional(),
          packageOwnership: z.enum(["customer", "company"]).optional(),
          batchId: z.number().optional(),
        })).min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const results: any[] = [];
        const errors: { index: number; error: string }[] = [];
        
        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          try {
            const prefix = input.orderType === 'commission' ? 'CM' : 
                           input.orderType === 'purchase_request' ? 'PR' : 'FP';
            const orderCode = `${prefix}-${Date.now().toString(36).toUpperCase()}${i}`;
            
            let initialStatus: 'pending_quote' | 'ordered' | 'pending';
            if (input.orderType === 'purchase_request') {
              initialStatus = 'pending_quote';
            } else if (item.orderNumber) {
              initialStatus = 'ordered';
            } else {
              initialStatus = 'pending';
            }
            
            let grossProfitUsd: string | undefined;
            if (input.orderType === 'full_package' && 
                item.sellingPriceUsd && item.purchasePriceUsd) {
              const selling = parseFloat(item.sellingPriceUsd);
              const purchase = parseFloat(item.purchasePriceUsd);
              grossProfitUsd = (selling - purchase).toFixed(2);
            }
            
            let totalPrepaid = item.totalPrepaidUsd;
            let itemPrice = 0;
            let commissionFee = 0;
            if (input.orderType === 'commission') {
              itemPrice = parseFloat(item.itemPriceUsd || '0');
              commissionFee = parseFloat(item.commissionFeeUsd || '0');
              if (!totalPrepaid && item.itemPriceUsd) {
                totalPrepaid = (itemPrice + commissionFee).toFixed(2);
              }
              grossProfitUsd = commissionFee.toFixed(2);
            }
            
            const order = await db.createFullPackageOrder({
              ...item,
              customerId: input.customerId,
              orderType: input.orderType,
              orderCode,
              status: initialStatus,
              grossProfitUsd,
              totalPrepaidUsd: totalPrepaid,
              orderDate: item.orderDate || (item.orderNumber ? new Date() : undefined),
              createdById: ctx.user.id,
              isPrepaid: input.orderType === 'commission' ? true : undefined,
              prepaidAt: input.orderType === 'commission' ? new Date() : undefined,
              isPaid: input.orderType === 'commission' ? true : undefined,
              paidFromBalanceUsd: input.orderType === 'commission' ? totalPrepaid : undefined,
              isCharged: input.orderType === 'commission' ? true : undefined,
              isChargedToCustomer: input.orderType === 'commission' ? true : undefined,
              chargedAt: input.orderType === 'commission' ? new Date() : undefined,
            });
            
            // For commission orders, charge customer
            if (input.orderType === 'commission' && totalPrepaid) {
              const customer = await db.getCustomerById(input.customerId);
              if (customer) {
                const totalAmount = parseFloat(totalPrepaid);
                const quantity = item.quantity || 1;
                const lineItems = [
                  {
                    description: `${item.productName}`,
                    quantity: quantity,
                    unitPrice: totalAmount / quantity,
                    total: totalAmount,
                  },
                ];
                await db.applyCharge(
                  input.customerId,
                  customer.customerCode,
                  'COMMISSION',
                  order.id,
                  totalAmount,
                  `کڕینی عمولە - ${item.productName}`,
                  ctx.user.id,
                  lineItems
                );
              }
            }
            
            results.push(order);
          } catch (err: any) {
            errors.push({ index: i, error: err.message || 'Unknown error' });
          }
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: `bulk_create_${input.orderType}_orders`,
          entityType: "full_package_order",
          entityId: results[0]?.id || 0,
          newValues: { count: results.length, orderType: input.orderType, errors: errors.length },
        });
        
        return { created: results, errors, total: input.items.length };
      }),
    
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        supplierId: z.number().nullable().optional(),
        productName: z.string().optional(),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).optional(),
        color: z.string().optional(),
        size: z.string().optional(),
        // Supplier tracking
        supplierTrackingNumber: z.string().optional(),
        supplierOrderNumber: z.string().optional(),
        purchaseInvoiceUrl: z.string().optional(),
        // Pricing
        purchasePriceUsd: z.string().optional(),
        purchasePriceCny: z.string().optional(),
        sellingPriceUsd: z.string().optional(),
        estimatedPriceUsd: z.string().optional(),
        actualPriceUsd: z.string().optional(),
        purchaseFeeUsd: z.string().optional(),
        commissionRate: z.string().optional(),
        commissionAmount: z.string().optional(),
        // Shipping
        shippingType: z.enum(["air_regular", "air_irregular", "sea"]).optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        volumeCbm: z.string().optional(),
        dimensionLength: z.string().optional(),
        dimensionWidth: z.string().optional(),
        dimensionHeight: z.string().optional(),
        // Order info
        orderNumber: z.string().optional(),
        trackingNumber: z.string().optional(),
        expectedDeliveryDate: z.date().nullable().optional(),
        // Quality check
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]).optional(),
        qualityCheckNotes: z.string().optional(),
        // Tags & Notes
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
        customerNotes: z.string().optional(),
        internalNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const existing = await db.getFullPackageOrderById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        await db.updateFullPackageOrder(id, data, ctx.user.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_full_package_order",
          entityType: "full_package_order",
          entityId: id,
          oldValues: existing,
          newValues: data,
        });
        
        return { success: true };
      }),
    
    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending_quote", "quoted", "pending", "approved", "rejected", "ordered", "tracking_added", "in_china_warehouse", "quality_check", "in_batch", "in_transit", "arrived", "ready_for_delivery", "delivered", "cancelled", "refunded", "returned"]),
        trackingNumber: z.string().optional(),
        batchId: z.number().optional(),
        actualPriceUsd: z.string().optional(),
        shippingCostUsd: z.string().optional(),
        weightKg: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        const updateData: any = { status: input.status };
        
        // If adding tracking number
        if (input.trackingNumber && !existing.trackingNumber) {
          updateData.trackingNumber = input.trackingNumber;
          updateData.trackingAddedDate = new Date();
          if (input.status === "tracking_added" || existing.status === "ordered") {
            updateData.status = "tracking_added";
          }
        }
        
        // If assigning to batch
        if (input.batchId) {
          updateData.batchId = input.batchId;
          if (input.status === "in_batch") {
            updateData.status = "in_batch";
          }
        }
        
        // Set date fields based on status
        if (input.status === "delivered" && !existing.deliveredDate) {
          updateData.deliveredDate = new Date();
          updateData.actualDeliveryDate = new Date();
          
          // Create revenue record for finance tracking
          try {
            const sellingPrice = parseFloat(existing.sellingPriceUsd || '0');
            const purchasePrice = parseFloat(existing.purchasePriceUsd || '0');
            const shippingCost = parseFloat(existing.shippingCostUsd || '0');
            const profit = sellingPrice - purchasePrice - shippingCost;
            await db.createRevenueRecord({
              recordDate: new Date(),
              revenueType: 'full_package_sale',
              referenceType: 'fullPackageOrder',
              referenceId: existing.id,
              customerId: existing.customerId,
              amountUsd: sellingPrice,
              costUsd: purchasePrice + shippingCost,
              description: `Full Package - ${existing.orderCode} (${existing.productName})`,
              createdById: ctx.user.id,
            });
            
            // Update daily financial summary with profit
            await db.updateDailyFinancialSummary(new Date(), { addRevenue: sellingPrice, revenueType: 'full_package_sale', addFullPackagesSold: 1 });
          } catch (e) {
            console.error('[Finance] Failed to create revenue record for full package:', e);
          }
        }
        if (input.status === "arrived" && !existing.arrivedDate) {
          updateData.arrivedDate = new Date();
        }
        
        await db.updateFullPackageOrder(input.id, updateData, ctx.user.id);
        
        // Create status history entry
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: input.status,
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.notes,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_full_package_status",
          entityType: "full_package_order",
          entityId: input.id,
          oldValues: { status: existing.status },
          newValues: updateData,
        });
        
        return { success: true };
      }),
    
    // Get status history for an order
    getStatusHistory: staffProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return db.getFullPackageStatusHistoryByOrderId(input.orderId);
      }),
    
    // Mark order as returned
    markReturned: staffProcedure
      .input(z.object({
        id: z.number(),
        returnReason: z.string(),
        refundAmount: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        await db.updateFullPackageOrder(input.id, {
          isReturned: true,
          returnReason: input.returnReason,
          returnDate: new Date(),
          returnStatus: "requested",
          refundAmount: input.refundAmount,
          status: "returned",
        });
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: "returned",
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: `Return requested: ${input.returnReason}`,
        });
        
        return { success: true };
      }),
    
    // Update quality check
    updateQualityCheck: staffProcedure
      .input(z.object({
        id: z.number(),
        qualityCheckStatus: z.enum(["pending", "passed", "failed", "partial"]),
        qualityCheckNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateFullPackageOrder(input.id, {
          qualityCheckStatus: input.qualityCheckStatus,
          qualityCheckNotes: input.qualityCheckNotes,
          qualityCheckDate: new Date(),
          qualityCheckById: ctx.user.id,
        }, ctx.user.id);
        
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        await db.deleteFullPackageOrder(input.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_full_package_order",
          entityType: "full_package_order",
          entityId: input.id,
          oldValues: existing,
        });
        
        return { success: true };
      }),
    
    // Get orders needing tracking reminder
    getOverdueOrders: staffProcedure.query(async () => {
      return db.getOrdersNeedingTrackingReminder();
    }),
    
    // Get profit summary
    getProfitSummary: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitSummary(input?.startDate, input?.endDate);
      }),
    
    // Get profit summary grouped by order type
    getProfitSummaryByType: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitSummaryByType(input?.startDate, input?.endDate);
      }),
    
    // Assign multiple orders to a batch
    assignToBatch: staffProcedure
      .input(z.object({
        orderIds: z.array(z.number()),
        batchId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        for (const orderId of input.orderIds) {
          await db.updateFullPackageOrder(orderId, {
            batchId: input.batchId,
            status: "in_batch",
          }, ctx.user.id);
        }
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "assign_full_package_to_batch",
          entityType: "full_package_order",
          newValues: input,
        });
        
        return { success: true, count: input.orderIds.length };
      }),
    
    // Reports
    getProfitBySupplier: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitBySupplier(input?.startDate, input?.endDate);
      }),
    
    getProfitByCustomer: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitByCustomer(input?.startDate, input?.endDate);
      }),
    
    getReturnsReport: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageReturnsReport(input?.startDate, input?.endDate);
      }),
    
    getDeliveryTimeReport: staffProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageDeliveryTimeReport(input?.startDate, input?.endDate);
      }),
    
    // ============ TRACKING ALERT SYSTEM ============
    
    // Get tracking alert statistics
    getTrackingAlertStats: staffProcedure.query(async () => {
      return db.getTrackingAlertStats();
    }),
    
    // Get orders pending tracking
    getOrdersPendingTracking: staffProcedure.query(async () => {
      const orders = await db.getOrdersPendingTracking();
      const now = new Date();
      
      // Calculate days waiting and alert level for each order
      return orders.map(order => {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        const daysWaiting = orderDate ? Math.floor((now.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        
        let alertLevel: "none" | "warning" | "urgent" | "critical" = "none";
        if (daysWaiting >= 7) alertLevel = "critical";
        else if (daysWaiting >= 5) alertLevel = "urgent";
        else if (daysWaiting >= 3) alertLevel = "warning";
        
        return {
          ...order,
          daysWaiting,
          calculatedAlertLevel: alertLevel,
        };
      });
    }),
    
    // Get orders by alert level
    getOrdersByAlertLevel: staffProcedure
      .input(z.object({ alertLevel: z.enum(["warning", "urgent", "critical"]) }))
      .query(async ({ input }) => {
        return db.getOrdersByAlertLevel(input.alertLevel);
      }),
    
    // Process and update all alert levels
    processAlerts: staffProcedure.mutation(async ({ ctx }) => {
      const result = await db.processTrackingAlerts();
      
      await db.createAuditLog({
        userId: ctx.user.id,
        userRole: ctx.user.role,
        action: "process_tracking_alerts",
        entityType: "system",
        entityId: 0,
        newValues: result,
      });
      
      return result;
    }),
    
    // Get supplier tracking performance
    getSupplierTrackingPerformance: staffProcedure.query(async () => {
      return db.getSupplierTrackingPerformance();
    }),
    
    // ============ PURCHASE REQUEST PROCEDURES ============
    
    // Quote a purchase request (staff sets the price)
    quoteOrder: staffProcedure
      .input(z.object({
        id: z.number(),
        purchasePriceUsd: z.string(), // Our cost
        sellingPriceUsd: z.string(), // Price to customer
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        if (existing.status !== 'pending_quote') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not pending quote" });
        }
        
        // Calculate gross profit
        const selling = parseFloat(input.sellingPriceUsd);
        const purchase = parseFloat(input.purchasePriceUsd);
        const grossProfitUsd = (selling - purchase).toFixed(2);
        
        await db.updateFullPackageOrder(input.id, {
          purchasePriceUsd: input.purchasePriceUsd,
          sellingPriceUsd: input.sellingPriceUsd,
          grossProfitUsd,
          status: 'quoted',
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'quoted',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.notes || `Quoted: $${input.sellingPriceUsd}`,
        });
        
        // TODO: Send notification to customer about the quote
        
        return { success: true };
      }),
    
    // Customer approves a quoted order
    approveQuote: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Verify customer owns this order
        if (existing.customerId !== ctx.user.id && ctx.user.role !== 'admin' && ctx.user.role !== 'employee') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        
        if (existing.status !== 'quoted') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not quoted" });
        }
        
        const sellingPrice = parseFloat(existing.sellingPriceUsd || '0');
        
        // Charge customer account using unified applyCharge function
        const customerForOrder = await db.getCustomerById(existing.customerId);
        if (!customerForOrder) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        // applyCharge automatically creates ledger transaction and invoice
        await db.applyCharge(
          existing.customerId,
          customerForOrder.customerCode,
          'FULL_PACKAGE',
          existing.id,
          sellingPrice,
          `Full Package Order - ${existing.orderCode} (${existing.productName})`,
          ctx.user.id,
          [{
            description: `${existing.productName} (${existing.orderCode})`,
            quantity: existing.quantity || 1,
            unitPrice: sellingPrice,
            total: sellingPrice,
          }]
        );
        
        // Update order status
        await db.updateFullPackageOrder(input.id, {
          status: 'approved',
          isPaid: true,
          paidFromBalanceUsd: sellingPrice.toFixed(2),
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'approved',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: `Customer approved and paid $${sellingPrice.toFixed(2)}`,
        });
        
        return { success: true };
      }),
    
    // Customer rejects a quoted order
    rejectQuote: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Verify customer owns this order
        if (existing.customerId !== ctx.user.id && ctx.user.role !== 'admin' && ctx.user.role !== 'employee') {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
        }
        
        if (existing.status !== 'quoted') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not quoted" });
        }
        
        await db.updateFullPackageOrder(input.id, {
          status: 'rejected',
        }, ctx.user.id);
        
        await db.createFullPackageStatusHistory({
          orderId: input.id,
          previousStatus: existing.status,
          newStatus: 'rejected',
          changedById: ctx.user.id,
          changedByName: ctx.user.name,
          notes: input.reason || 'Customer rejected the quote',
        });
        
        return { success: true };
      }),
    
    // Charge shipping cost when batch arrives (for full_package orders)
    chargeShippingCost: staffProcedure
      .input(z.object({
        id: z.number(),
        shippingCostUsd: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getFullPackageOrderById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        if (existing.isChargedToCustomer) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shipping already charged" });
        }
        
        const shippingCost = parseFloat(input.shippingCostUsd);
        const grossProfit = parseFloat(existing.grossProfitUsd || '0');
        const netProfitUsd = (grossProfit - shippingCost).toFixed(2);
        
        await db.updateFullPackageOrder(input.id, {
          shippingCostUsd: input.shippingCostUsd,
          netProfitUsd,
          isChargedToCustomer: true,
          chargedAt: new Date(),
        }, ctx.user.id);
        
        return { success: true, netProfitUsd };
      }),
    
    // ============ COMMISSION ORDER PROCEDURES ============
    
    // Create commission order with prepaid
    createCommissionOrder: staffProcedure
      .input(z.object({
        customerId: z.number(),
        productName: z.string().min(1),
        productLink: z.string().optional(),
        productImage: z.string().optional(),
        productImages: z.array(z.string()).optional(),
        productDescription: z.string().optional(),
        quantity: z.number().min(1).default(1),
        color: z.string().optional(),
        size: z.string().optional(),
        itemPriceUsd: z.string(), // Actual item price (customer knows)
        itemPriceCny: z.string().optional(),
        commissionFeeUsd: z.string(), // Service fee
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const orderCode = `CM-${Date.now().toString(36).toUpperCase()}`;
        
        const itemPrice = parseFloat(input.itemPriceUsd);
        const commission = parseFloat(input.commissionFeeUsd);
        const totalPrepaid = itemPrice + commission;
        
        // Charge customer account using unified applyCharge function
        const customerForCommission = await db.getCustomerById(input.customerId);
        if (!customerForCommission) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        
        // applyCharge automatically creates ledger transaction and invoice
        // We'll create the order first to get the ID for reference
        const tempOrderCode = `CM-${Date.now().toString(36).toUpperCase()}`;
        
        // Note: We need to create order first, then charge, so we can reference the order ID
        // For now, use 0 as reference and update later, or restructure the flow
        await db.applyCharge(
          input.customerId,
          customerForCommission.customerCode,
          'COMMISSION',
          0, // Will be updated with actual order ID
          totalPrepaid,
          `Commission Purchase - ${input.productName} (Item: $${itemPrice}, Commission: $${commission})`,
          ctx.user.id,
          [
            {
              description: `${input.productName} - Item Price`,
              quantity: input.quantity || 1,
              unitPrice: itemPrice,
              total: itemPrice,
            },
            {
              description: 'Commission Fee',
              quantity: 1,
              unitPrice: commission,
              total: commission,
            },
          ]
        );
        
        // Create order
        const order = await db.createFullPackageOrder({
          ...input,
          orderCode,
          orderType: 'commission',
          status: 'pending',
          totalPrepaidUsd: totalPrepaid.toFixed(2),
          isPrepaid: true,
          prepaidAt: new Date(),
          isPaid: true,
          paidFromBalanceUsd: totalPrepaid.toFixed(2),
          grossProfitUsd: commission.toFixed(2), // Commission is our profit from the order itself
          createdById: ctx.user.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_commission_order",
          entityType: "full_package_order",
          entityId: order.id,
          newValues: input,
        });
        
        return order;
      }),
    
    // Get customer's purchase requests (for customer portal)
    getMyPurchaseRequests: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getFullPackageOrdersByCustomer(ctx.user.id, {
          orderType: 'purchase_request',
          status: input?.status,
        });
      }),
    
    // Get customer's full package orders (for customer portal)
    getMyOrders: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getFullPackageOrdersByCustomer(ctx.user.id, input);
      }),
    
    // ============ PROFIT REPORTS ============
    
    // Get detailed profit report for Full Package orders
    getProfitReport: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        orderType: z.enum(["full_package", "purchase_request", "commission"]).optional(),
        customerId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getFullPackageProfitReport(input);
      }),
    
    // Get monthly profit report
    getMonthlyProfitReport: adminProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getMonthlyProfitReport(input.year, input.month);
      }),
    
    // Get profit breakdown by order type
    getProfitByOrderType: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getProfitByOrderType(input?.startDate, input?.endDate);
      }),
  }),
  
  // ============ SUPPLIERS ============
  suppliers: router({
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
  }),

  // ============ VIP CUSTOMERS ============
  vip: router({
    list: staffProcedure.query(async () => {
      return db.getAllVipCustomers();
    }),
    
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getVipCustomerByCustomerId(input.customerId);
      }),
    
    create: adminProcedure
      .input(z.object({
        customerId: z.number(),
        tier: z.enum(["silver", "gold", "platinum"]),
        discountPercent: z.string().optional(),
        fixedPricePerKgAir: z.string().optional(),
        fixedPricePerKgSea: z.string().optional(),
        creditLimitUsd: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const vip = await db.createVipCustomer({
          ...input,
          createdById: ctx.user.id,
        });
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_vip_customer",
          entityType: "vip_customer",
          entityId: vip.id,
          newValues: input,
        });
        
        return vip;
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        tier: z.enum(["silver", "gold", "platinum"]).optional(),
        discountPercent: z.string().optional(),
        fixedPricePerKgAir: z.string().optional(),
        fixedPricePerKgSea: z.string().optional(),
        creditLimitUsd: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateVipCustomer(id, data);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_vip_customer",
          entityType: "vip_customer",
          entityId: id,
          newValues: data,
        });
        
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteVipCustomer(input.id);
        
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_vip_customer",
          entityType: "vip_customer",
          entityId: input.id,
        });
        
        return { success: true };
      }),
  }),

  // ============ QR CODES ============
  qrCodes: router({
    generate: staffProcedure
      .input(z.object({
        packageId: z.number(),
        packageType: z.enum(["regular", "full_package"]).default("regular"),
      }))
      .mutation(async ({ input }) => {
        // Check if QR already exists
        const existing = await db.getQrCodeByPackage(input.packageId, input.packageType);
        if (existing) {
          return existing;
        }
        
        // Generate unique QR code
        const qrCode = `WZN-${input.packageType === 'full_package' ? 'FP' : 'PK'}-${input.packageId}-${Date.now().toString(36).toUpperCase()}`;
        
        return db.createPackageQrCode({
          packageId: input.packageId,
          packageType: input.packageType,
          qrCode,
        });
      }),
    
    scan: staffProcedure
      .input(z.object({ qrCode: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const qr = await db.getQrCodeByCode(input.qrCode);
        if (!qr) {
          throw new TRPCError({ code: "NOT_FOUND", message: "QR code not found" });
        }
        
        await db.updateQrCodeScan(input.qrCode, ctx.user.id);
        
        // Get package details
        if (qr.packageType === 'regular') {
          const pkg = await db.getPackageById(qr.packageId);
          return { type: 'regular', package: pkg, qr };
        } else {
          const order = await db.getFullPackageOrderById(qr.packageId);
          return { type: 'full_package', order, qr };
        }
      }),
    
    getByPackage: staffProcedure
      .input(z.object({
        packageId: z.number(),
        packageType: z.enum(["regular", "full_package"]).default("regular"),
      }))
      .query(async ({ input }) => {
        return db.getQrCodeByPackage(input.packageId, input.packageType);
      }),
  }),

  // ============ BARCODE SCANNING ============
  scanning: router({
    // Search tracking number in all order types (full_package, purchase_request, commission, package)
    searchTrackingAllTypes: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        return db.searchTrackingInAllOrderTypes(input.trackingNumber);
      }),
    
    // Search package by tracking number or barcode
    searchByTracking: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await db.getPackageWithCustomerByTracking(input.trackingNumber);
        if (!result) {
          // Check if any scans exist for this tracking
          const scans = await db.getScansByTracking(input.trackingNumber);
          return { found: false, scans, package: null, customer: null };
        }
        
        // Get scan history
        const scans = await db.getPackageScans(result.package.id);
        const statusHistory = await db.getPackageStatusHistory(result.package.id);
        
        return { 
          found: true, 
          package: result.package, 
          customer: result.customer,
          scans,
          statusHistory
        };
      }),
    
    // Register a new scan
    registerScan: staffProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
        scanType: z.enum([
          "registered", "received_china", "in_batch", "in_transit",
          "received_local", "out_for_delivery", "delivered", "returned", "customs_hold"
        ]),
        packageId: z.number().optional(),
        warehouseId: z.number().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationName: z.string().optional(),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
        deviceIdentifier: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Create the scan record
        const scan = await db.createPackageScan({
          trackingNumber: input.trackingNumber,
          packageId: input.packageId,
          scanType: input.scanType,
          scannedById: ctx.user.id,
          warehouseId: input.warehouseId,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          locationName: input.locationName,
          notes: input.notes,
          photoUrl: input.photoUrl,
        });
        
        // If package exists, update its status
        if (input.packageId) {
          const statusMap: Record<string, string> = {
            'registered': 'Registered',
            'received_china': 'In China Warehouse',
            'in_batch': 'In Batch',
            'in_transit': 'In Transit',
            'received_local': 'In Local Warehouse',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'returned': 'Returned',
            'customs_hold': 'Customs Hold'
          };
          
          const newStatus = statusMap[input.scanType];
          if (newStatus) {
            await db.updatePackageStatusViaScan(
              input.packageId,
              newStatus,
              ctx.user.id,
              scan.id,
              {
                warehouseId: input.warehouseId,
                latitude: input.latitude,
                longitude: input.longitude
              }
            );
            
            // Send notification to customer if status is significant
            if (['received_local', 'delivered'].includes(input.scanType)) {
              const pkg = await db.getPackageById(input.packageId);
              if (pkg && pkg.customerId) {
                const customer = await db.getCustomerById(pkg.customerId);
                if (customer) {
                  const messages: Record<string, string> = {
                    'received_local': `پاکەتتان گەیشتە مەخزەنی هەولێر! کۆد: ${pkg.trackingNumber}`,
                    'delivered': `پاکەتتان گەیاندرا! سوپاس بۆ متمانەتان.`
                  };
                  console.log(`[SMS] Would send to ${customer.mobileNumber}: ${messages[input.scanType]}`);
                  
                  // Charge customer and create invoice when package arrives locally or is delivered
                  if (!pkg.isCharged) {
                    try {
                      // Get pricing
                      // Get batch pricing first, then check for customer-specific pricing
                      let pricePerKg = 15; // Default
                      let pricePerCbm = 100; // Default
                      
                      if (pkg.batchId) {
                        const batch = await db.getBatchById(pkg.batchId);
                        if (batch) {
                          // Check for customer-specific pricing
                          const customerPricing = await db.getCustomerPricingInBatch(pkg.batchId, pkg.customerId!);
                          if (customerPricing) {
                            pricePerKg = parseFloat(customerPricing.pricePerKg || '0');
                            pricePerCbm = parseFloat(customerPricing.pricePerCbm || '0');
                          } else {
                            pricePerKg = parseFloat(batch.pricePerKg || '0');
                            pricePerCbm = parseFloat(batch.pricePerCbm || '0');
                          }
                        }
                      }
                      // Determine pricing based on shipping type
                      const isSea = pkg.shippingType === 'sea';
                      const pricePerUnit = isSea ? pricePerCbm : pricePerKg;
                      const unit = isSea ? 'cbm' : 'kg';
                      const quantity = isSea ? parseFloat(pkg.volumeCbm || '0') : parseFloat(pkg.weightKg || '0');
                      
                      const chargeAmount = quantity * pricePerUnit;
                      
                      if (chargeAmount > 0) {
                        console.log(`[Scan] Charging customer ${customer.customerCode} for package ${pkg.packageCode}: $${chargeAmount}`);
                        
                        // Use unified applyCharge function
                        await db.applyCharge(
                          pkg.customerId!,
                          customer.customerCode,
                          'PACKAGE',
                          pkg.id,
                          chargeAmount,
                          `Package charge - ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                          ctx.user.id
                        );
                        
                        // Mark package as charged
                        await db.updatePackage(pkg.id, {
                          isCharged: true,
                          calculatedCostUsd: chargeAmount.toFixed(2),
                        });
                        
                        // Create revenue record
                        await db.createRevenueRecord({
                          recordDate: new Date(),
                          revenueType: 'package_delivery',
                          referenceType: 'package',
                          referenceId: pkg.id,
                          customerId: pkg.customerId,
                          amountUsd: chargeAmount,
                          description: `Package ${input.scanType === 'delivered' ? 'delivery' : 'arrival'} - ${pkg.packageCode}`,
                          createdById: ctx.user.id,
                        });
                        
                        // Update daily financial summary
                        await db.updateDailyFinancialSummary(new Date(), { addRevenue: chargeAmount, revenueType: 'package_delivery' });
                        
                        // Invoice is created at batch arrival, not individual delivery
                        // This prevents duplicate invoices
                        console.log(`[Scan] Package ${pkg.packageCode} charged - invoice already created at batch arrival`);
                      }
                    } catch (e) {
                      console.error('[Scan] Failed to charge customer:', e);
                    }
                  }
                }
              }
            }
          }
        }
        
        return scan;
      }),
    
    // Quick register package from scan (when package doesn't exist)
    quickRegisterPackage: staffProcedure
      .input(z.object({
        trackingNumber: z.string().min(1),
        customerId: z.number(),
        shippingType: z.enum(['air_regular', 'air_irregular', 'sea']).default('air_regular'),
        weight: z.number().optional(),
        dimensions: z.object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
        }).optional(),
        goodsType: z.string().optional(),
        warehouseId: z.number().optional(),
        batchId: z.number().optional(),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Generate package code
        const packageCode = `PKG-${Date.now().toString(36).toUpperCase()}`;
        
        // Calculate CBM for sea shipments
        let volumeCbm: string | undefined;
        if (input.shippingType === 'sea' && input.dimensions) {
          const cbm = (input.dimensions.length * input.dimensions.width * input.dimensions.height) / 1000000;
          volumeCbm = cbm.toFixed(4);
        }
        
        // Calculate estimated price
        let estimatedPriceCalc: string | undefined;
        const pricingRules = await db.getAllPricingRules();
        const rule = pricingRules.find((r: any) => r.shippingType === input.shippingType && r.isActive);
        if (rule) {
          const pricePerUnit = parseFloat(rule.pricePerUnit || '0');
          if (rule.unit === 'cbm' && volumeCbm) {
            estimatedPriceCalc = (parseFloat(volumeCbm) * pricePerUnit).toFixed(2);
          } else if (rule.unit === 'kg' && input.weight) {
            estimatedPriceCalc = (input.weight * pricePerUnit).toFixed(2);
          }
        }
        
        // Create the package
        const pkg = await db.createPackage({
          packageCode,
          trackingNumber: input.trackingNumber,
          customerId: input.customerId,
          originWarehouseId: input.warehouseId || 1,
          shippingType: input.shippingType,
          weightKg: input.weight?.toString(),
          volumeCbm,
          lengthCm: input.dimensions?.length?.toString(),
          widthCm: input.dimensions?.width?.toString(),
          heightCm: input.dimensions?.height?.toString(),
          // estimatedPriceUsd: estimatedPriceCalc, // Field doesn't exist yet
          description: input.goodsType,
          status: 'registered',
          batchId: input.batchId,
          registeredById: ctx.user.id,
          notes: input.notes,
        });
        
        // Create initial scan
        await db.createPackageScan({
          trackingNumber: input.trackingNumber,
          packageId: pkg.id,
          scanType: 'registered',
          scannedById: ctx.user.id,
          warehouseId: input.warehouseId,
          photoUrl: input.photoUrl,
          notes: 'Quick registered via barcode scan',
        });
        
        // Create status history
        await db.createStatusHistory({
          packageId: pkg.id,
          fromStatus: null,
          toStatus: 'Registered',
          changedById: ctx.user.id,
          changeMethod: 'scan',
          reason: 'Initial registration via barcode scan',
        });
        
        return pkg;
      }),
    
    // Get my recent scans (for employee)
    myRecentScans: staffProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        return db.getRecentScansByUser(ctx.user.id, input.limit);
      }),
    
    // Get today's scan statistics
    todayStats: staffProcedure
      .query(async ({ ctx }) => {
        const stats = await db.getTodayScanStats(ctx.user.id);
        return stats;
      }),
    
    // Get all today's scans for warehouse
    todayScans: staffProcedure
      .input(z.object({ warehouseId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getTodayScans(input.warehouseId);
      }),
    
    // Get package status history
    getStatusHistory: staffProcedure
      .input(z.object({ packageId: z.number() }))
      .query(async ({ input }) => {
        return db.getPackageStatusHistory(input.packageId);
      }),
    
    // Get packages missing info (for warehouse check)
    getMissingInfo: staffProcedure
      .query(async () => {
        return db.getPackagesMissingInfo();
      }),
    
    // Smart scan - auto-detect package type and return appropriate data
    smartScan: staffProcedure
      .input(z.object({ trackingNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const tracking = input.trackingNumber.trim();
        
        // First check Full Package Orders
        const fullPackageOrder = await db.getFullPackageOrderByTracking(tracking);
        if (fullPackageOrder) {
          const customer = await db.getCustomerById(fullPackageOrder.customerId);
          const scans = await db.getScansByTracking(tracking);
          return {
            found: true,
            type: 'full_package' as const,
            data: fullPackageOrder,
            customer,
            scans,
          };
        }
        
        // Then check regular Packages
        const packageResult = await db.getPackageWithCustomerByTracking(tracking);
        if (packageResult) {
          const scans = await db.getPackageScans(packageResult.package.id);
          const statusHistory = await db.getPackageStatusHistory(packageResult.package.id);
          return {
            found: true,
            type: 'package' as const,
            data: packageResult.package,
            customer: packageResult.customer,
            scans,
            statusHistory,
          };
        }
        
        // Not found - return empty for new registration
        return {
          found: false,
          type: 'new' as const,
          trackingNumber: tracking,
          data: null,
          customer: null,
          scans: [],
        };
      }),
    
    // Update package inline (for quick edits from scanner)
    updatePackageInline: staffProcedure
      .input(z.object({
        packageId: z.number(),
        status: z.string().optional(),
        weightKg: z.string().optional(),
        lengthCm: z.string().optional(),
        widthCm: z.string().optional(),
        heightCm: z.string().optional(),
        volumeCbm: z.string().optional(),
        notes: z.string().optional(),
        warehouseId: z.number().optional(),
        applyCharge: z.boolean().optional(), // For arrive workflow - calculate and charge price
        batchId: z.number().optional(), // For assigning package to batch during arrive
        shippingType: z.enum(['air_regular', 'air_irregular', 'sea']).optional(), // For updating shipping type
      }))
      .mutation(async ({ input, ctx }) => {
        const { packageId, status, applyCharge, batchId, shippingType, ...updateData } = input;
        
        // Update package fields including batchId and shippingType if provided
        const fieldsToUpdate = {
          ...updateData,
          ...(batchId !== undefined && { batchId }),
          ...(shippingType !== undefined && { shippingType }),
        };
        const updated = await db.updatePackageFields(packageId, fieldsToUpdate);
        
        // If status changed, create history and scan
        if (status) {
          const pkg = await db.getPackageById(packageId);
          if (pkg && pkg.status !== status) {
            await db.createStatusHistory({
              packageId,
              fromStatus: pkg.status,
              toStatus: status,
              changedById: ctx.user.id,
              changeMethod: 'scan',
              reason: 'Updated via warehouse operations',
            });
            
            await db.updatePackageStatus(packageId, status);
            
            // Create scan record
            const scanTypeMap: Record<string, string> = {
              'Registered': 'registered',
              'In China Warehouse': 'received_china',
              'In Batch': 'in_batch',
              'In Transit': 'in_transit',
              'In Local Warehouse': 'received_local',
              'Out for Delivery': 'out_for_delivery',
              'Delivered': 'delivered',
              'Returned': 'returned',
              'Customs Hold': 'customs_hold',
            };
            
            const scanType = (scanTypeMap[status] || 'registered') as 'registered' | 'received_china' | 'in_batch' | 'in_transit' | 'received_local' | 'out_for_delivery' | 'delivered' | 'returned' | 'customs_hold';
            await db.createPackageScan({
              trackingNumber: pkg.trackingNumber || '',
              packageId,
              scanType,
              scannedById: ctx.user.id,
              warehouseId: input.warehouseId,
              notes: `Status changed to ${status} via warehouse operations`,
            });
            
            // Send notification to customer about status change
            if (pkg.customerId && !pkg.isUnclaimed) {
              try {
                // Map warehouse operations status to notification status
                const notificationStatusMap: Record<string, string> = {
                  'Registered': 'registered',
                  'In China Warehouse': 'in_batch',
                  'In Batch': 'in_batch',
                  'In Transit': 'in_transit',
                  'In Local Warehouse': 'ready_for_delivery',
                  'Out for Delivery': 'out_for_delivery',
                  'Delivered': 'delivered',
                };
                const notificationStatus = notificationStatusMap[status];
                if (notificationStatus) {
                  await notifyPackageStatusChange(packageId, notificationStatus);
                }
              } catch (e) {
                console.error('[Notification] Failed to send package status notification:', e);
              }
            }
            
            // Apply charge on arrival (ready_for_delivery) if not already charged
            if ((status === 'ready_for_delivery' || applyCharge) && !pkg.isCharged && pkg.customerId && !pkg.isUnclaimed) {
              let chargeAmount = 0;
              let pricePerUnit = 0;
              let unit: 'kg' | 'cbm' = 'kg';
              let pricingSource = '';
              
              // First, try batch-based pricing if package is in a batch
              if (pkg.batchId) {
                const batch = await db.getBatchById(pkg.batchId);
                if (batch) {
                  unit = batch.shippingType === 'sea' ? 'cbm' : 'kg';
                  const customerTotal = await db.getCustomerTotalInBatch(pkg.batchId, pkg.customerId, unit);
                  
                  // Check if batch uses tiered pricing
                  if (batch.useTieredPricing) {
                    const tierPrice = await db.getApplicableTierPrice(pkg.batchId, customerTotal);
                    if (tierPrice !== null) {
                      pricePerUnit = tierPrice;
                      pricingSource = 'batch_tiered';
                    }
                  }
                  
                  // Check for customer-specific pricing (takes priority over batch default)
                  if (pricePerUnit === 0) {
                    const customerPricing = await db.getCustomerPricingInBatch(pkg.batchId, pkg.customerId);
                    if (customerPricing) {
                      pricePerUnit = unit === 'cbm'
                        ? Number(customerPricing.pricePerCbm) || 0
                        : Number(customerPricing.pricePerKg) || 0;
                      if (pricePerUnit > 0) {
                        pricingSource = 'customer_specific';
                      }
                    }
                  }
                  
                  // If no customer-specific price, use batch default price
                  if (pricePerUnit === 0) {
                    pricePerUnit = unit === 'cbm' 
                      ? Number(batch.pricePerCbm) || 0 
                      : Number(batch.pricePerKg) || 0;
                    pricingSource = 'batch_default';
                  }
                  
                  // Calculate charge based on unit
                  if (pricePerUnit > 0) {
                    if (unit === 'cbm' && pkg.volumeCbm) {
                      chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                    } else if (unit === 'kg') {
                      // Use chargeable weight (max of actual weight and volumetric weight)
                      const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                      const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                      const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                      const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                      const chargeableKg = Math.max(actualKg, volumetricKg);
                      chargeAmount = pricePerUnit * chargeableKg;
                    }
                  }
                }
              }
              
              // Fallback to global pricing rules if no batch pricing
              if (chargeAmount === 0 && pkg.weightKg) {
                const warehouse = await db.getWarehouseById(pkg.originWarehouseId);
                const destCountries = await db.getDestinationCountries();
                const destCountry = destCountries[0];
                
                if (warehouse && destCountry) {
                  const pricingRule = await db.getApplicablePricingRule(
                    warehouse.countryId,
                    destCountry.id,
                    pkg.shippingType
                  );
                  
                  if (pricingRule) {
                    pricePerUnit = parseFloat(pricingRule.pricePerUnit);
                    unit = pricingRule.unit;
                    pricingSource = 'global_rule';
                    
                    if (pricingRule.unit === "kg") {
                      // Use chargeable weight (max of actual weight and volumetric weight)
                      const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                      const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                      const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                      const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                      const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                      const chargeableKg = Math.max(actualKg, volumetricKg);
                      chargeAmount = pricePerUnit * chargeableKg;
                    } else if (pricingRule.unit === "cbm" && pkg.volumeCbm) {
                      chargeAmount = pricePerUnit * parseFloat(pkg.volumeCbm);
                    }
                  }
                }
              }
              
              if (chargeAmount > 0) {
                // Use unified applyCharge function - use chargeable weight for kg unit
                let quantity: string | null;
                if (unit === 'cbm') {
                  quantity = pkg.volumeCbm;
                } else {
                  // Calculate chargeable weight for description
                  const actualKg = parseFloat(pkg.weightKg?.toString() || '0');
                  const lengthCm = parseFloat(pkg.lengthCm?.toString() || '0');
                  const widthCm = parseFloat(pkg.widthCm?.toString() || '0');
                  const heightCm = parseFloat(pkg.heightCm?.toString() || '0');
                  const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
                  const chargeableKg = Math.max(actualKg, volumetricKg);
                  quantity = chargeableKg.toFixed(2);
                }
                const customerForCharge = await db.getCustomerById(pkg.customerId);
                if (customerForCharge) {
                  await db.applyCharge(
                    pkg.customerId,
                    customerForCharge.customerCode,
                    'PACKAGE',
                    pkg.id,
                    chargeAmount,
                    `Arrival charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                    ctx.user.id
                  );
                }
                
                // Mark package as charged
                await db.updatePackage(pkg.id, {
                  isCharged: true,
                  calculatedCostUsd: chargeAmount.toFixed(2),
                });
                
                // Create revenue record for finance tracking
                try {
                  await db.createRevenueRecord({
                    recordDate: new Date(),
                    revenueType: 'package_delivery',
                    referenceType: 'package',
                    referenceId: pkg.id,
                    customerId: pkg.customerId,
                    amountUsd: chargeAmount,
                    description: `Package arrival - ${pkg.packageCode}`,
                    createdById: ctx.user.id,
                  });
                  
                  // Update daily financial summary
                  await db.updateDailyFinancialSummary(new Date(), { addRevenue: chargeAmount, revenueType: 'package_delivery' });
                } catch (e) {
                  console.error('[Finance] Failed to create revenue record:', e);
                }
                
                // Create ledger transaction for new accounting system
                try {
                  const customer = await db.getCustomerById(pkg.customerId);
                  if (customer) {
                    await db.recordPackageCharge(
                      pkg.customerId,
                      customer.customerCode,
                      pkg.id,
                      chargeAmount,
                      `Arrival charge - Package ${pkg.packageCode} (${quantity}${unit} × $${pricePerUnit}/${unit})`,
                      ctx.user.id
                    );
                  }
                } catch (e) {
                  console.error('[Ledger] Failed to create ledger transaction:', e);
                }
                
                // Invoice is created at batch arrival, not individual package update
                // This prevents duplicate invoices
                console.log('[Invoice-WH] Package charged - invoice already created at batch arrival');
                
                return { ...updated, chargedAmount: chargeAmount.toFixed(2), pricingSource };
              }
            }
          }
        }
        
        return updated;
      }),
    
    // Update full package order inline
    updateFullPackageInline: staffProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.string().optional(),
        actualWeightKg: z.string().optional(),
        actualLengthCm: z.string().optional(),
        actualWidthCm: z.string().optional(),
        actualHeightCm: z.string().optional(),
        actualCbm: z.string().optional(),
        notes: z.string().optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { orderId, status, warehouseId, ...updateData } = input;
        
        // Update full package order
        const updated = await db.updateFullPackageOrder(orderId, {
          ...updateData,
          status: status as any,
        }, ctx.user.id);
        
        // If status changed, create scan record
        if (status && updated && updated.trackingNumber) {
          const scanTypeMap: Record<string, string> = {
            'pending': 'registered',
            'received_china': 'received_china',
            'in_batch': 'in_batch',
            'in_transit': 'in_transit',
            'arrived': 'received_local',
            'delivered': 'delivered',
            'cancelled': 'returned',
          };
          
          const scanType = (scanTypeMap[status] || 'registered') as 'registered' | 'received_china' | 'in_batch' | 'in_transit' | 'received_local' | 'out_for_delivery' | 'delivered' | 'returned' | 'customs_hold';
          await db.createPackageScan({
            trackingNumber: updated.trackingNumber,
            scanType,
            scannedById: ctx.user.id,
            warehouseId,
            notes: `Full package status changed to ${status} via smart scanner`,
          });
        }
        
        return updated;
      }),
    
    // AI-powered OCR for package labels
    aiOcr: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { performOCR } = await import('./aiService');
        return performOCR(input.imageUrl);
      }),
    
    // AI-powered package image analysis
    aiAnalyzePackage: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { analyzePackageImage } = await import('./aiService');
        return analyzePackageImage(input.imageUrl);
      }),
    
    // AI-powered full package info extraction
    aiExtractPackageInfo: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { extractPackageInfo } = await import('./aiService');
        return extractPackageInfo(input.imageUrl);
      }),
    
    // AI-powered translation
    aiTranslate: staffProcedure
      .input(z.object({
        text: z.string(),
        targetLanguage: z.enum(['ku', 'ar', 'en']).default('ku')
      }))
      .mutation(async ({ input }) => {
        const { translateText } = await import('./aiService');
        return translateText(input.text, input.targetLanguage);
      }),
    
    // Detect carrier from tracking number
    detectCarrier: staffProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => {
        const { detectCarrier, validateTrackingNumber } = await import('./aiService');
        const carrier = detectCarrier(input.trackingNumber);
        const validation = validateTrackingNumber(input.trackingNumber);
        return { carrier, validation };
      }),
    
    // Enhanced AI-powered package label scanning
    // Extracts customer code (AZ###), tracking number, product info
    aiScanLabel: staffProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        const { scanPackageLabel } = await import('./aiService');
        const scanResult = await scanPackageLabel(input.imageUrl);
        
        if (!scanResult.success) {
          return { success: false, error: scanResult.error };
        }
        
        // Try to find customer by code
        let customer = null;
        let existingPackage = null;
        
        // Get all customers for searching
        const customers = await db.getAllCustomers();
        
        // Try multiple search strategies
        if (scanResult.customerCode) {
          const codeToFind = scanResult.customerCode.toUpperCase();
          
          // 1. Exact match on customer code
          customer = customers.find((c: any) => 
            c.customerCode?.toUpperCase() === codeToFind
          );
          
          // 2. Partial match on customer code (contains)
          if (!customer) {
            customer = customers.find((c: any) => 
              c.customerCode?.toUpperCase().includes(codeToFind) ||
              codeToFind.includes(c.customerCode?.toUpperCase() || '')
            );
          }
        }
        
        // 3. Search by customer name if code didn't match
        if (!customer && scanResult.customerName) {
          const nameToFind = scanResult.customerName.toLowerCase();
          customer = customers.find((c: any) => 
            c.fullName?.toLowerCase().includes(nameToFind) ||
            nameToFind.includes(c.fullName?.toLowerCase() || '')
          );
        }
        
        // 4. Search by phone number if still not found
        if (!customer && scanResult.customerPhone) {
          const phoneToFind = scanResult.customerPhone.replace(/\D/g, '');
          customer = customers.find((c: any) => {
            const customerPhone = c.mobileNumber?.replace(/\D/g, '') || '';
            return customerPhone.includes(phoneToFind) || phoneToFind.includes(customerPhone);
          });
        }
        
        // Try to find existing package by tracking number
        if (scanResult.trackingNumber) {
          existingPackage = await db.searchPackageByTracking(scanResult.trackingNumber);
        }
        
        return {
          success: true,
          scanResult,
          customer: customer ? {
            id: customer.id,
            customerCode: customer.customerCode,
            name: customer.fullName || customer.customerCode,
            phone: customer.mobileNumber
          } : null,
          existingPackage: existingPackage ? {
            id: existingPackage.id,
            trackingNumber: existingPackage.trackingNumber,
            status: existingPackage.status,
            customerId: existingPackage.customerId,
            description: existingPackage.description
          } : null,
          action: existingPackage ? 'update_status' : 'register_new'
        };
      }),
    
    // Get customer by code for smart scanner
    findCustomerByCode: staffProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const customers = await db.getAllCustomers();
        const normalizedCode = input.code.toUpperCase();
        
        // Find exact match first
        let customer = customers.find((c: any) => 
          c.customerCode?.toUpperCase() === normalizedCode
        );
        
        // If not found, try partial match
        if (!customer) {
          customer = customers.find((c: any) => 
            c.customerCode?.toUpperCase().includes(normalizedCode) ||
            normalizedCode.includes(c.customerCode?.toUpperCase() || '')
          );
        }
        
        if (!customer) return null;
        
        return {
          id: customer.id,
          customerCode: customer.customerCode,
          name: customer.fullName || customer.customerCode,
          phone: customer.mobileNumber,
          email: customer.email
        };
      }),
  }),

  // ============ CUSTOMER LEDGER ============
  ledger: router({
    // Get financial summary
    getSummary: staffProcedure
      .query(async () => {
        return db.getFinancialSummary();
      }),
    
    // Get all customer accounts with info
    getAllAccounts: staffProcedure
      .query(async () => {
        return db.getAllCustomerAccountsWithInfo();
      }),
    
    // Get customer account by customer ID
    getAccountByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerAccountByCustomerId(input.customerId);
      }),
    
    // Get or create customer account
    getOrCreateAccount: staffProcedure
      .input(z.object({ customerId: z.number(), customerCode: z.string() }))
      .mutation(async ({ input }) => {
        return db.getOrCreateCustomerAccount(input.customerId, input.customerCode);
      }),
    
    // Get account transactions
    getTransactions: staffProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getAccountLedgerTransactions(input.accountId, input.limit);
      }),
    
    // Get account payments
    getPayments: staffProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getAccountPaymentRecords(input.accountId, input.limit);
      }),
    
    // Get debtors list
    getDebtors: staffProcedure
      .input(z.object({ minBalanceUsd: z.number().default(0) }))
      .query(async ({ input }) => {
        return db.getDebtors(input.minBalanceUsd);
      }),
    
    // Get total debt
    getTotalDebt: staffProcedure
      .query(async () => {
        return db.getTotalDebtAmount();
      }),
    
    // Get recent transactions
    getRecentTransactions: staffProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return db.getRecentTransactions(input.limit);
      }),
    
    // Record payment
    recordPayment: staffProcedure
      .input(z.object({
        customerId: z.number(),
        customerCode: z.string(),
        amountUsd: z.number().default(0),
        amountIqd: z.number().default(0),
        paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'FIB', 'FASTPAY', 'ZAINCASH', 'ASIAHAWALA', 'CARD', 'OTHER']),
        notes: z.string().optional(),
        receiptNumber: z.string().optional(),
        cashAccountId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.recordPaymentReceived(
          input.customerId,
          input.customerCode,
          input.amountUsd,
          input.amountIqd,
          input.paymentMethod,
          ctx.user.id,
          input.notes,
          input.receiptNumber
        );
        
        // If a cash account is selected, record the deposit to that account
        if (input.cashAccountId && (input.amountUsd > 0 || input.amountIqd > 0)) {
          try {
            await db.createCashTransaction({
              accountId: input.cashAccountId,
              transactionType: 'customer_payment',
              amount: (input.amountUsd || 0).toFixed(2),
              relatedEntityType: 'customer',
              relatedEntityId: input.customerId,
              description: `پارەدانی کڕیار: ${input.customerCode}${input.notes ? ' - ' + input.notes : ''}`,
              transactionDate: new Date(),
              referenceNumber: input.receiptNumber,
              createdById: ctx.user.id,
            });
          } catch (e) {
            console.error('Failed to record cash transaction:', e);
          }
        }
        
        return result;
      }),
    
    // Record package charge (manual)
    recordCharge: staffProcedure
      .input(z.object({
        customerId: z.number(),
        customerCode: z.string(),
        packageId: z.number(),
        amountUsd: z.number(),
        description: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.recordPackageCharge(
          input.customerId,
          input.customerCode,
          input.packageId,
          input.amountUsd,
          input.description,
          ctx.user.id
        );
      }),
    
    // Create payment reminder
    createReminder: staffProcedure
      .input(z.object({
        accountId: z.number(),
        reminderType: z.enum(['sms', 'whatsapp', 'email', 'call']),
        scheduledAt: z.date(),
        customMessage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createPaymentReminder({
          accountId: input.accountId,
          reminderType: input.reminderType,
          scheduledAt: input.scheduledAt,
          customMessage: input.customMessage,
          createdById: ctx.user.id,
        });
      }),
    
    // Get pending reminders
    getPendingReminders: staffProcedure
      .query(async () => {
        return db.getPendingReminders();
      }),
    
    // Balance validation
    validateAccount: staffProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return db.validateAccountBalance(input.accountId);
      }),
    
    repairAccount: adminProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        return db.repairAccountBalance(input.accountId);
      }),
    
    validateAllAccounts: adminProcedure
      .query(async () => {
        return db.validateAllAccounts();
      }),
    
    getAccountBreakdown: staffProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return db.calculateAccountBreakdown(input.accountId);
      }),
    
    // ============ INVOICES ============
    
    // Generate invoice for package
    generatePackageInvoice: staffProcedure
      .input(z.object({
        packageId: z.number(),
        customerId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        
        // Generate invoice number
        const invoiceNumber = await db.getNextInvoiceNumber();
        
        // Generate PDF
        const { generatePackageInvoice } = await import('./invoiceGenerator');
        const pdfBuffer = await generatePackageInvoice({
          invoiceNumber,
          customerName: customer.fullName || 'Unknown',
          customerCode: customer.customerCode || '',
          packageTracking: pkg.trackingNumber || '',
          weight: parseFloat(pkg.weightKg || '0'),
          priceUsd: parseFloat(pkg.calculatedCostUsd || '0'),
          currency: 'USD',
        });
        
        // Upload to S3
        const { storagePut } = await import('./storage');
        const fileKey = `invoices/${invoiceNumber}.pdf`;
        const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
        
        // Create invoice record
        const invoice = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          packageId: input.packageId,
          subtotalUsd: pkg.calculatedCostUsd || '0',
          totalUsd: pkg.calculatedCostUsd || '0',
          status: 'issued',
          pdfUrl,
          lineItems: [{
            description: `Package Delivery - ${pkg.trackingNumber}`,
            quantity: 1,
            unitPrice: parseFloat(pkg.calculatedCostUsd || '0'),
            total: parseFloat(pkg.calculatedCostUsd || '0'),
          }],
          createdById: ctx.user.id,
        });
        
        return { invoice, pdfUrl };
      }),
    
    // Generate receipt for payment - uses paymentRecords from ledger system
    generatePaymentReceipt: staffProcedure
      .input(z.object({
        paymentRecordId: z.number(),
        customerId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const paymentRecord = await db.getPaymentRecordById(input.paymentRecordId);
        if (!paymentRecord) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment record not found' });
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        
        const account = await db.getCustomerAccountByCustomerId(input.customerId);
        const balanceAfter = parseFloat(account?.currentBalanceUsd || '0');
        
        // Generate invoice number
        const invoiceNumber = await db.getNextInvoiceNumber();
        
        // Generate PDF
        const { generatePaymentReceipt } = await import('./invoiceGenerator');
        const pdfBuffer = await generatePaymentReceipt({
          invoiceNumber,
          customerName: customer.fullName || 'Unknown',
          customerCode: customer.customerCode || '',
          amountUsd: parseFloat(paymentRecord.amountUsd || '0'),
          currency: 'USD',
          paymentMethod: paymentRecord.paymentMethod || 'CASH',
          referenceNumber: paymentRecord.receiptNumber || paymentRecord.paymentNumber || `PAY-${paymentRecord.id}`,
          balanceAfter,
        });
        
        // Upload to S3
        const { storagePut } = await import('./storage');
        const fileKey = `receipts/${invoiceNumber}.pdf`;
        const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, 'application/pdf');
        
        // Create invoice record
        const invoice = await db.createInvoice({
          invoiceNumber,
          customerId: input.customerId,
          subtotalUsd: paymentRecord.amountUsd || '0',
          totalUsd: paymentRecord.amountUsd || '0',
          status: 'paid',
          pdfUrl,
          lineItems: [{
            description: 'Payment Received',
            quantity: 1,
            unitPrice: parseFloat(paymentRecord.amountUsd || '0'),
            total: parseFloat(paymentRecord.amountUsd || '0'),
          }],
          notes: paymentRecord.notes ?? undefined,
          createdById: ctx.user.id,
        });
        
        return { invoice, pdfUrl };
      }),
    
    // Get all invoices with filters
    getInvoices: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.getAllInvoices(input.limit);
      }),
    
    // Get invoice by ID
    getInvoice: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoiceById(input.id);
      }),
    
    // Balance validation procedures removed
  }),

  // ============ PRODUCT CATEGORIES (جۆرەکانی کاڵا) ============
  productCategories: router({
    list: staffProcedure.query(async () => {
      return db.getAllProductCategories();
    }),
    listActive: publicProcedure.query(async () => {
      return db.getActiveProductCategories();
    }),
    getById: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductCategoryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const category = await db.createProductCategory({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_product_category",
          entityType: "productCategory",
          entityId: category.id,
          newValues: input,
        });
        return category;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateProductCategory(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_product_category",
          entityType: "productCategory",
          entityId: id,
          newValues: data,
        });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProductCategory(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_product_category",
          entityType: "productCategory",
          entityId: input.id,
        });
        return { success: true };
      }),
    // Seed default categories
    seedDefaults: adminProcedure.mutation(async ({ ctx }) => {
      const defaults = [
        { nameEn: "Clothing", nameAr: "ملابس", nameKu: "جل و بەرگ", icon: "👔", color: "#3B82F6", sortOrder: 1 },
        { nameEn: "Shoes", nameAr: "أحذية", nameKu: "پێڵاو", icon: "👟", color: "#8B5CF6", sortOrder: 2 },
        { nameEn: "Bags", nameAr: "حقائب", nameKu: "جانتا", icon: "👜", color: "#EC4899", sortOrder: 3 },
        { nameEn: "Electronics", nameAr: "إلكترونيات", nameKu: "ئەلیکترۆنیات", icon: "📱", color: "#10B981", sortOrder: 4 },
        { nameEn: "Medical", nameAr: "طبي", nameKu: "پزیشکی", icon: "💊", color: "#EF4444", sortOrder: 5 },
        { nameEn: "Cosmetics", nameAr: "مستحضرات تجميل", nameKu: "کۆسمەتیک", icon: "💄", color: "#F472B6", sortOrder: 6 },
        { nameEn: "Home Items", nameAr: "أدوات منزلية", nameKu: "کەلوپەلی ماڵ", icon: "🏠", color: "#F59E0B", sortOrder: 7 },
        { nameEn: "Games", nameAr: "ألعاب", nameKu: "یاری", icon: "🎮", color: "#6366F1", sortOrder: 8 },
        { nameEn: "Books", nameAr: "كتب", nameKu: "کتێب", icon: "📚", color: "#84CC16", sortOrder: 9 },
        { nameEn: "Tools", nameAr: "أدوات", nameKu: "ئامراز", icon: "🔧", color: "#64748B", sortOrder: 10 },
        { nameEn: "Food", nameAr: "طعام", nameKu: "خواردن", icon: "🍔", color: "#F97316", sortOrder: 11 },
        { nameEn: "Other", nameAr: "أخرى", nameKu: "هیتر", icon: "📦", color: "#94A3B8", sortOrder: 12 },
      ];
      for (const cat of defaults) {
        await db.createProductCategory({ ...cat, createdById: ctx.user.id });
      }
      return { success: true, count: defaults.length };
    }),
  }),

  // ============ NOTIFICATIONS SETTINGS ============
  notifications: router({
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
  }),

  // ============ COMPANY FINANCIAL MANAGEMENT ============
  
  // Expense Categories
  expenseCategories: router({
    list: accountantProcedure.query(async () => {
      return db.getAllExpenseCategories();
    }),
    listActive: accountantProcedure.query(async () => {
      return db.getActiveExpenseCategories();
    }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseCategoryById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        isRecurring: z.boolean().default(false),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        return db.createExpenseCategory(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().optional(),
        nameAr: z.string().optional(),
        nameKu: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        isRecurring: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpenseCategory(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpenseCategory(input.id);
        return { success: true };
      }),
  }),

  // Expenses
  expenses: router({
    list: accountantProcedure
      .input(z.object({
        categoryId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllExpenses(input);
      }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseById(input.id);
      }),
    getSummary: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getExpensesSummary(input.startDate, input.endDate);
      }),
    create: accountantProcedure
      .input(z.object({
        categoryId: z.number(),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        exchangeRate: z.string().optional(),
        amountUsd: z.string(),
        description: z.string().optional(),
        expenseDate: z.date(),
        receiptUrl: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
        cashAccountId: z.number().optional(),
        isRecurring: z.boolean().default(false),
        recurringDay: z.number().optional(),
        vendor: z.string().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const expense = await db.createExpense({ ...input, createdById: ctx.user.id });
        
        // Update daily financial summary with expense
        try {
          await db.updateDailyFinancialSummary(input.expenseDate, { addExpense: parseFloat(input.amountUsd), expenseType: input.categoryId?.toString() || 'other' });
        } catch (e) {
          console.error('[Finance] Failed to update daily summary for expense:', e);
        }
        
        // Check expense alert thresholds
        try {
          const { alertsTriggered } = await db.checkExpenseThresholds(
            parseFloat(input.amountUsd),
            input.categoryId
          );
          
          if (alertsTriggered.length > 0) {
            const { notifyOwner } = await import('./_core/notification');
            for (const triggered of alertsTriggered) {
              const currencySymbol = triggered.alert.currency === 'USD' ? '$' : 'د.ع';
              await notifyOwner({
                title: `⚠️ ئاگادارکردنەوەی خەرجی - سنوور تێپەڕا!`,
                content: `خەرجییەکان لە سنوورەکە تێپەڕیوە:\n\nماوە: ${triggered.periodLabel}\nکۆی خەرجی: ${currencySymbol}${triggered.totalExpenses.toLocaleString()}\nسنوور: ${currencySymbol}${triggered.thresholdAmount.toLocaleString()}\n${triggered.alert.description ? `تێبینی: ${triggered.alert.description}` : ''}`,
              });
            }
          }
        } catch (e) {
          console.error('[ExpenseAlert] Failed to check thresholds:', e);
        }
        
        return expense;
      }),
    update: accountantProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        amount: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).optional(),
        exchangeRate: z.string().optional(),
        amountUsd: z.string().optional(),
        description: z.string().optional(),
        expenseDate: z.date().optional(),
        receiptUrl: z.string().optional(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).optional(),
        cashAccountId: z.number().optional(),
        isRecurring: z.boolean().optional(),
        recurringDay: z.number().optional(),
        vendor: z.string().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpense(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpense(input.id);
        return { success: true };
      }),
   }),

  // Expense Alerts
  expenseAlerts: router({
    list: adminProcedure.query(async () => {
      return db.getExpenseAlerts();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getExpenseAlertById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        alertType: z.enum(['daily', 'weekly', 'monthly', 'per_transaction']),
        thresholdAmount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        categoryId: z.number().nullable().optional(),
        isEnabled: z.boolean().default(true),
        notifyMethod: z.enum(['system', 'email', 'both']).default('system'),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createExpenseAlert({ ...input, createdById: ctx.user.id });
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        alertType: z.enum(['daily', 'weekly', 'monthly', 'per_transaction']).optional(),
        thresholdAmount: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).optional(),
        categoryId: z.number().nullable().optional(),
        isEnabled: z.boolean().optional(),
        notifyMethod: z.enum(['system', 'email', 'both']).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExpenseAlert(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteExpenseAlert(input.id);
      }),
    toggle: adminProcedure
      .input(z.object({ id: z.number(), isEnabled: z.boolean() }))
      .mutation(async ({ input }) => {
        return db.toggleExpenseAlert(input.id, input.isEnabled);
      }),
    logs: adminProcedure
      .input(z.object({ alertId: z.number().optional(), limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return db.getExpenseAlertLogs(input?.alertId, input?.limit);
      }),
  }),

  // Partners
  partners: router({
    list: adminProcedure.query(async () => {
      return db.getAllPartners();
    }),
    listActive: adminProcedure.query(async () => {
      return db.getActivePartners();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPartnerById(input.id);
      }),
    getTransactions: adminProcedure
      .input(z.object({ partnerId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getPartnerTransactions(input.partnerId, input.limit);
      }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        nameKu: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        ownershipPercentage: z.string(),
        initialCapital: z.string().default('0'),
        joinDate: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createPartner(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameKu: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        ownershipPercentage: z.string().optional(),
        initialCapital: z.string().optional(),
        joinDate: z.date().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updatePartner(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePartner(input.id);
        return { success: true };
      }),
    // Partner transactions
    addTransaction: adminProcedure
      .input(z.object({
        partnerId: z.number(),
        transactionType: z.enum(['capital_contribution', 'profit_share', 'withdrawal', 'loan_to_company', 'loan_repayment', 'adjustment']),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        amountUsd: z.string(),
        description: z.string().optional(),
        transactionDate: z.date(),
        periodMonth: z.number().optional(),
        periodYear: z.number().optional(),
        cashAccountId: z.number().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createPartnerTransaction({ ...input, createdById: ctx.user.id });
      }),
  }),

  // Company Debts
  companyDebts: router({
    list: adminProcedure.query(async () => {
      return db.getAllCompanyDebts();
    }),
    listActive: adminProcedure.query(async () => {
      return db.getActiveCompanyDebts();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompanyDebtById(input.id);
      }),
    getPayments: adminProcedure
      .input(z.object({ debtId: z.number() }))
      .query(async ({ input }) => {
        return db.getDebtPayments(input.debtId);
      }),
    create: adminProcedure
      .input(z.object({
        creditorName: z.string().min(1),
        creditorType: z.enum(['personal', 'bank', 'supplier', 'other']),
        creditorPhone: z.string().optional(),
        creditorEmail: z.string().optional(),
        principalAmount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        principalAmountUsd: z.string(),
        interestRate: z.string().default('0'),
        totalInterest: z.string().default('0'),
        totalAmount: z.string(),
        remainingAmount: z.string(),
        startDate: z.date(),
        dueDate: z.date().optional(),
        installmentCount: z.number().optional(),
        installmentAmount: z.string().optional(),
        purpose: z.string().optional(),
        collateral: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createCompanyDebt({ ...input, paidAmount: '0', createdById: ctx.user.id });
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        creditorName: z.string().optional(),
        creditorType: z.enum(['personal', 'bank', 'supplier', 'other']).optional(),
        creditorPhone: z.string().optional(),
        creditorEmail: z.string().optional(),
        interestRate: z.string().optional(),
        dueDate: z.date().optional(),
        installmentCount: z.number().optional(),
        installmentAmount: z.string().optional(),
        status: z.enum(['active', 'paid', 'overdue', 'restructured']).optional(),
        purpose: z.string().optional(),
        collateral: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCompanyDebt(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCompanyDebt(input.id);
        return { success: true };
      }),
    // Record debt payment
    recordPayment: adminProcedure
      .input(z.object({
        debtId: z.number(),
        amount: z.string(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        amountUsd: z.string(),
        principalPaid: z.string(),
        interestPaid: z.string().default('0'),
        paymentDate: z.date(),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
        cashAccountId: z.number().optional(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createDebtPayment({ ...input, createdById: ctx.user.id });
      }),
  }),

  // Cash Accounts
  cashAccounts: router({
    list: accountantProcedure.query(async () => {
      return db.getAllCashAccounts();
    }),
    listActive: accountantProcedure.query(async () => {
      return db.getActiveCashAccounts();
    }),
    getSummary: accountantProcedure.query(async () => {
      return db.getCashAccountsSummary();
    }),
    getById: accountantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCashAccountById(input.id);
      }),
    getTransactions: accountantProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getCashTransactions(input.accountId, input.limit);
      }),
    create: adminProcedure
      .input(z.object({
        accountName: z.string().min(1),
        accountNameKu: z.string().optional(),
        accountType: z.enum(['cash', 'bank', 'mobile_wallet']),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        currency: z.enum(['USD', 'IQD']).default('USD'),
        initialBalance: z.string().default('0'),
        description: z.string().optional(),
        isPrimary: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return db.createCashAccount(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        accountName: z.string().optional(),
        accountNameKu: z.string().optional(),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        isPrimary: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCashAccount(id, data);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCashAccount(input.id);
        return { success: true };
      }),
    // Record transaction
    recordTransaction: accountantProcedure
      .input(z.object({
        accountId: z.number(),
        transactionType: z.enum(['deposit', 'withdrawal', 'adjustment']),
        amount: z.string(),
        description: z.string().optional(),
        transactionDate: z.date(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createCashTransaction({ ...input, createdById: ctx.user.id });
      }),
    // Transfer between accounts
    transfer: accountantProcedure
      .input(z.object({
        fromAccountId: z.number(),
        toAccountId: z.number(),
        amount: z.number(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.transferBetweenAccounts(
          input.fromAccountId,
          input.toAccountId,
          input.amount,
          input.description || 'Transfer between accounts',
          ctx.user.id
        );
      }),
  }),

  // Financial Reports
  financialReports: router({
    getOverview: accountantProcedure.query(async () => {
      return db.getCompanyFinancialOverview();
    }),
    getProfitAndLoss: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getProfitAndLoss(input.startDate, input.endDate);
      }),
    getMonthlyTrend: accountantProcedure
      .input(z.object({ year: z.number() }))
      .query(async ({ input }) => {
        return db.getMonthlyProfitTrend(input.year);
      }),
    // PDF Generation endpoints
    generateProfitLossPDF: accountantProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateProfitLossPDF } = await import("./pdf-generator");
        const startDate = new Date(input.year, getMonthNumber(input.month), 1);
        const endDate = new Date(input.year, getMonthNumber(input.month) + 1, 0);
        const pnlData = await db.getProfitAndLoss(startDate, endDate);
        
        const pdfUrl = await generateProfitLossPDF({
          month: input.month,
          year: input.year,
          revenue: {
            packagePayments: pnlData.revenue.packageRevenue,
            fullPackageProfit: pnlData.revenue.fullPackageRevenue,
            otherRevenue: pnlData.revenue.otherRevenue,
            total: pnlData.revenue.totalRevenue,
          },
          expenses: {
            byCategory: pnlData.expenses.byCategory.map(c => ({ category: c.categoryName, amount: c.total })),
            total: pnlData.expenses.totalExpenses,
          },
          netProfit: pnlData.netProfit,
        });
        return { url: pdfUrl };
      }),
    generateBalanceSheetPDF: accountantProcedure
      .mutation(async () => {
        const { generateBalanceSheetPDF } = await import("./pdf-generator");
        const overview = await db.getCompanyFinancialOverview();
        const debts = await db.getAllCompanyDebts();
        const partners = await db.getAllPartners();
        
        // Get customer receivables from ledger
        const totalReceivables = 0; // Would need to query customer accounts separately
        
        const pdfUrl = await generateBalanceSheetPDF({
          date: new Date().toLocaleDateString(),
          assets: {
            cash: overview.totalCash,
            bank: 0, // Bank is included in totalCash
            receivables: totalReceivables,
            total: overview.totalCash + totalReceivables,
          },
          liabilities: {
            debts: debts.map(d => ({ name: d.creditorName, amount: parseFloat(d.remainingAmount) })),
            total: overview.totalDebt,
          },
          equity: {
            partnerCapital: partners.reduce((sum, p) => sum + parseFloat(p.initialCapital), 0),
            retainedEarnings: partners.reduce((sum, p) => sum + parseFloat(p.currentBalance), 0),
            total: partners.reduce((sum, p) => sum + parseFloat(p.initialCapital) + parseFloat(p.currentBalance), 0),
          },
        });
        return { url: pdfUrl };
      }),
    generatePartnerReportPDF: accountantProcedure
      .input(z.object({
        partnerId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
      }))
      .mutation(async ({ input }) => {
        const { generatePartnerReportPDF } = await import("./pdf-generator");
        const partner = await db.getPartnerById(input.partnerId);
        if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });
        
        const transactions = await db.getPartnerTransactions(input.partnerId);
        const filteredTxns = transactions.filter(t => {
          const txnDate = new Date(t.transactionDate);
          return txnDate >= input.startDate && txnDate <= input.endDate;
        });
        
        let balance = parseFloat(partner.initialCapital);
        const txnsWithBalance = filteredTxns.map(t => {
          const amount = t.transactionType === 'withdrawal' ? -parseFloat(t.amount) : parseFloat(t.amount);
          balance += amount;
          return {
            date: new Date(t.transactionDate).toLocaleDateString(),
            type: t.transactionType,
            description: t.description || '',
            amount,
            balance,
          };
        });
        
        const pdfUrl = await generatePartnerReportPDF({
          partner: {
            name: partner.name,
            ownershipPercentage: parseFloat(partner.ownershipPercentage),
          },
          startDate: input.startDate.toLocaleDateString(),
          endDate: input.endDate.toLocaleDateString(),
          openingBalance: parseFloat(partner.initialCapital),
          transactions: txnsWithBalance,
          closingBalance: parseFloat(partner.currentBalance),
          profitShare: 0,
        });
        return { url: pdfUrl };
      }),
    generateExpenseReportPDF: accountantProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateExpenseReportPDF } = await import("./pdf-generator");
        const startDate = new Date(input.year, getMonthNumber(input.month), 1);
        const endDate = new Date(input.year, getMonthNumber(input.month) + 1, 0);
        
        const expenses = await db.getAllExpenses({ startDate, endDate });
        const categories = await db.getAllExpenseCategories();
        
        type ExpenseType = typeof expenses[number];
        type CategoryType = typeof categories[number];
        
        const byCategory = categories.map((cat: CategoryType) => {
          const catExpenses = expenses.filter((exp: ExpenseType) => exp.categoryId === cat.id);
          const amount = catExpenses.reduce((sum: number, exp: ExpenseType) => sum + parseFloat(exp.amountUsd), 0);
          return {
            category: cat.nameEn,
            color: cat.color || '#64748b',
            amount,
            percentage: 0,
          };
        }).filter((c) => c.amount > 0);
        
        const total = byCategory.reduce((sum, c) => sum + c.amount, 0);
        byCategory.forEach(c => c.percentage = total > 0 ? (c.amount / total) * 100 : 0);
        
        const pdfUrl = await generateExpenseReportPDF({
          month: input.month,
          year: input.year,
          totalExpenses: total,
          byCategory,
          expenses: expenses.map((exp: ExpenseType) => ({
            date: new Date(exp.expenseDate).toLocaleDateString(),
            category: categories.find((c: CategoryType) => c.id === exp.categoryId)?.nameEn || 'Other',
            description: exp.description || '',
            vendor: exp.vendor || '',
            amount: parseFloat(exp.amountUsd),
          })),
        });
        return { url: pdfUrl };
      }),
    generateDebtSchedulePDF: accountantProcedure
      .mutation(async () => {
        const { generateDebtSchedulePDF } = await import("./pdf-generator");
        const debts = await db.getAllCompanyDebts();
        
        const pdfUrl = await generateDebtSchedulePDF({
          totalDebt: debts.reduce((sum, d) => sum + parseFloat(d.remainingAmount), 0),
          debts: debts.map(d => ({
            creditor: d.creditorName,
            type: d.creditorType,
            originalAmount: parseFloat(d.principalAmountUsd),
            remainingAmount: parseFloat(d.remainingAmount),
            interestRate: parseFloat(d.interestRate || '0'),
            dueDate: d.dueDate ? new Date(d.dueDate).toLocaleDateString() : 'N/A',
            monthlyPayment: parseFloat(d.installmentAmount || '0'),
          })),
        });
        return { url: pdfUrl };
      }),
  }),

  // ============ SCAN HISTORY DASHBOARD ============
  scanHistory: router({
    // Get scan history with filters
    list: staffProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        scanType: z.string().optional(),
        customerId: z.number().optional(),
        scannedById: z.number().optional(),
        status: z.string().optional(),
        trackingNumber: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return db.getScanHistory({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          scanType: input.scanType,
          customerId: input.customerId,
          scannedById: input.scannedById,
          status: input.status,
          trackingNumber: input.trackingNumber,
          limit: input.limit,
          offset: input.offset,
        });
      }),
    
    // Get scan statistics for a date range
    statistics: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanStatistics(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get today's scan summary
    todaySummary: staffProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getTodayScanSummary(input.userId);
      }),
    
    // Record a scan (called from WarehouseOperations)
    record: staffProcedure
      .input(z.object({
        packageId: z.number().optional(),
        fullPackageOrderId: z.number().optional(),
        trackingNumber: z.string(),
        scanType: z.enum(['register', 'receive', 'ship', 'arrive', 'deliver', 'return', 'other']),
        status: z.enum(['success', 'error', 'not_found']).default('success'),
        errorMessage: z.string().optional(),
        customerName: z.string().optional(),
        customerId: z.number().optional(),
        weightKg: z.number().optional(),
        shippingType: z.string().optional(),
        batchId: z.number().optional(),
        batchCode: z.string().optional(),
        calculatedCost: z.number().optional(),
        deviceType: z.string().optional(),
        warehouseId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createScanRecord({
          ...input,
          weightKg: input.weightKg?.toString(),
          calculatedCost: input.calculatedCost?.toString(),
          scannedById: ctx.user.id,
          scannedByName: ctx.user.name || 'Unknown',
        });
      }),
  }),

  // ============ SCAN REPORTS ============
  scanReports: router({
    // Get scans by date range
    getByDateRange: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        scanType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getScansByDateRange(
          new Date(input.startDate),
          new Date(input.endDate),
          input.scanType
        );
      }),
    
    // Get scan statistics by date range
    getStatsByDateRange: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanStatsByDateRange(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get daily scan summary
    getDailySummary: staffProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        return db.getDailyScanSummary(new Date(input.date));
      }),
    
    // Get monthly scan summary
    getMonthlySummary: staffProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) => {
        return db.getMonthlyScanSummary(input.year, input.month);
      }),
    
    // Get scan totals by type
    getTotalsByType: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScanTotalsByType(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
    
    // Get scans by employee
    getByEmployee: staffProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getScansByEmployee(
          new Date(input.startDate),
          new Date(input.endDate)
        );
      }),
  }),

  // ============ EXTRA SERVICES (خزمەتگوزاری زیادە) ============
  extraServices: router({
    // Get all service types
    getServiceTypes: staffProcedure.query(async () => {
      return db.getAllServiceTypes();
    }),
    
    // Get active service types
    getActiveServiceTypes: staffProcedure.query(async () => {
      return db.getActiveServiceTypes();
    }),
    
    // Create service type
    createServiceType: adminProcedure
      .input(z.object({
        nameEn: z.string().min(1),
        nameKu: z.string().optional(),
        nameAr: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        defaultCost: z.string().optional(),
        defaultPrice: z.string().optional(),
        requiresCustomer: z.boolean().default(true),
        addToCustomerBalance: z.boolean().default(true),
        sortOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createServiceType({
          ...input,
          createdById: ctx.user.id,
        });
      }),
    
    // Update service type
    updateServiceType: adminProcedure
      .input(z.object({
        id: z.number(),
        nameEn: z.string().min(1).optional(),
        nameKu: z.string().optional(),
        nameAr: z.string().optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        defaultCost: z.string().optional(),
        defaultPrice: z.string().optional(),
        requiresCustomer: z.boolean().optional(),
        addToCustomerBalance: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateServiceType(id, data);
      }),
    
    // Delete service type
    deleteServiceType: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteServiceType(input.id);
        return { success: true };
      }),
    
    // Get extra services for a customer
    getByCustomer: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getExtraServicesWithDetails(input.customerId);
      }),
    
    // Get all extra services with filters
    list: staffProcedure
      .input(z.object({
        customerId: z.number().optional(),
        serviceTypeId: z.number().optional(),
        isPaid: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAllExtraServices({
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
      }),
    
    // Create extra service
    create: staffProcedure
      .input(z.object({
        serviceTypeId: z.number(),
        customerId: z.number().optional(),
        description: z.string().min(1),
        costAmount: z.string(),
        priceAmount: z.string(),
        currency: z.enum(["USD", "IQD", "CNY"]).default("USD"),
        exchangeRate: z.string().optional(),
        notes: z.string().optional(),
        addToBalance: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const service = await db.createExtraService({
          serviceTypeId: input.serviceTypeId,
          customerId: input.customerId,
          description: input.description,
          costAmount: input.costAmount,
          priceAmount: input.priceAmount,
          currency: input.currency,
          exchangeRate: input.exchangeRate,
          notes: input.notes,
          createdById: ctx.user.id,
        });
        
        // Add to customer balance if requested and customer exists
        if (input.addToBalance && input.customerId) {
          const account = await db.getCustomerAccountByCustomerId(input.customerId);
          if (account) {
            const currentBalance = Number(account.currentBalanceUsd);
            const newBalance = currentBalance + Number(input.priceAmount);
            
            // Create ledger transaction
            const txnNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            await db.createLedgerTransaction({
              accountId: account.id,
              transactionNumber: txnNumber,
              transactionType: "DEBIT_SERVICE",
              amountUsd: input.priceAmount,
              balanceBeforeUsd: currentBalance.toFixed(2),
              balanceAfterUsd: newBalance.toFixed(2),
              balanceBeforeIqd: account.currentBalanceIqd,
              balanceAfterIqd: account.currentBalanceIqd,
              referenceType: "service",
              referenceId: service.id,
              description: `Extra service: ${input.description}`,
              createdById: ctx.user.id,
            });
            
            // Update account balance
            await db.updateCustomerAccountBalance(
              account.id,
              newBalance.toFixed(2),
              account.currentBalanceIqd,
              { debitUsd: input.priceAmount }
            );
            
            // Mark service as added to balance
            await db.updateExtraService(service.id, { addedToBalance: true });
            
            // Create professional invoice for extra service
            try {
              const serviceType = await db.getServiceTypeById(input.serviceTypeId);
              const customer = await db.getCustomerById(input.customerId);
              const invoiceNumber = `INV-SVC-${Date.now()}-${service.id}`;
              const priceAmount = Number(input.priceAmount);
              
              // Get current exchange rates
              const iqdRate = await db.getCurrentExchangeRate("IQD");
              const rmbRate = await db.getCurrentExchangeRate("RMB");
              
              const lineItems = [{
                description: `${serviceType?.nameKu || serviceType?.nameEn || 'خزمەتگوزاری'}: ${input.description}`,
                quantity: 1,
                unitPrice: priceAmount,
                total: priceAmount,
              }];
              
              const invoice = await db.createInvoice({
                invoiceNumber,
                customerId: input.customerId,
                subtotalUsd: priceAmount.toFixed(2),
                totalUsd: priceAmount.toFixed(2),
                exchangeRateIqd: iqdRate?.rate,
                exchangeRateRmb: rmbRate?.rate,
                totalIqd: iqdRate ? (priceAmount * parseFloat(iqdRate.rate)).toFixed(0) : undefined,
                totalRmb: rmbRate ? (priceAmount * parseFloat(rmbRate.rate)).toFixed(2) : undefined,
                lineItems: lineItems,
                status: 'issued' as const,
                issuedAt: new Date(),
                notes: `وەسڵی خزمەتگوزاری - ${customer?.fullName || ''} - ${input.description}`,
                createdById: ctx.user.id,
              });
              
              // Link invoice to extra service
              if (invoice) {
                await db.linkExtraServiceToInvoice(service.id, invoice.id);
              }
              
              console.log('[Invoice-SVC] Created invoice for extra service:', invoice?.id);
            } catch (e) {
              console.error('[Invoice-SVC] Failed to create invoice for extra service:', e);
            }
          }
        }
        
        return service;
      }),
    
    // Update extra service
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        costAmount: z.string().optional(),
        priceAmount: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateExtraService(id, data);
      }),
    
    // Delete extra service
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExtraService(input.id);
        return { success: true };
      }),
    
    // Mark as paid
    markAsPaid: staffProcedure
      .input(z.object({
        id: z.number(),
        paymentMethod: z.enum(["cash", "card", "transfer", "balance"]),
        paidAmount: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.markExtraServiceAsPaid(input.id, input.paymentMethod, input.paidAmount);
      }),
    
    // Get summary for reports
    getSummary: staffProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getExtraServicesSummary(
          input.startDate ? new Date(input.startDate) : undefined,
          input.endDate ? new Date(input.endDate) : undefined
        );
      }),
    
    // Get unpaid services for customer
    getUnpaid: staffProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getUnpaidExtraServices(input.customerId);
      }),
  }),

  // ============ NOTIFICATION TEMPLATES ============
  notificationTemplates: router({
    list: adminProcedure.query(async () => {
      return db.getNotificationTemplates();
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getNotificationTemplateById(input.id);
      }),
    
    getByEvent: adminProcedure
      .input(z.object({ eventType: z.string() }))
      .query(async ({ input }) => {
        return db.getNotificationTemplateByEvent(input.eventType);
      }),
    
    create: adminProcedure
      .input(z.object({
        eventType: z.enum(["package_received", "package_shipped", "package_arrived", "package_delivered", "payment_received", "invoice_created", "batch_shipped", "batch_arrived", "custom"]),
        name: z.string().min(1),
        isActive: z.boolean().optional(),
        smsTemplate: z.string().optional(),
        smsTemplateAr: z.string().optional(),
        smsTemplateKu: z.string().optional(),
        whatsappTemplate: z.string().optional(),
        whatsappTemplateAr: z.string().optional(),
        whatsappTemplateKu: z.string().optional(),
        emailSubject: z.string().optional(),
        emailSubjectAr: z.string().optional(),
        emailSubjectKu: z.string().optional(),
        emailTemplate: z.string().optional(),
        emailTemplateAr: z.string().optional(),
        emailTemplateKu: z.string().optional(),
        pushTitle: z.string().optional(),
        pushTitleAr: z.string().optional(),
        pushTitleKu: z.string().optional(),
        pushTemplate: z.string().optional(),
        pushTemplateAr: z.string().optional(),
        pushTemplateKu: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createNotificationTemplate(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        smsTemplate: z.string().optional(),
        smsTemplateAr: z.string().optional(),
        smsTemplateKu: z.string().optional(),
        whatsappTemplate: z.string().optional(),
        whatsappTemplateAr: z.string().optional(),
        whatsappTemplateKu: z.string().optional(),
        emailSubject: z.string().optional(),
        emailSubjectAr: z.string().optional(),
        emailSubjectKu: z.string().optional(),
        emailTemplate: z.string().optional(),
        emailTemplateAr: z.string().optional(),
        emailTemplateKu: z.string().optional(),
        pushTitle: z.string().optional(),
        pushTitleAr: z.string().optional(),
        pushTitleKu: z.string().optional(),
        pushTemplate: z.string().optional(),
        pushTemplateAr: z.string().optional(),
        pushTemplateKu: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateNotificationTemplate(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNotificationTemplate(input.id);
        return { success: true };
      }),
    
    ensureDefaults: adminProcedure.mutation(async () => {
      await db.ensureDefaultNotificationTemplates();
      return { success: true };
    }),
  }),

  // ============ LABEL TEMPLATES ============
  labelTemplates: router({
    list: adminProcedure.query(async () => {
      return db.getLabelTemplates();
    }),
    
    getDefault: adminProcedure.query(async () => {
      return db.getDefaultLabelTemplate();
    }),
    
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getLabelTemplateById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        isDefault: z.boolean().optional(),
        size: z.enum(["10x15", "10x10", "A6", "A5", "custom"]).optional(),
        widthMm: z.number().optional(),
        heightMm: z.number().optional(),
        showQrCode: z.boolean().optional(),
        qrCodeSize: z.number().optional(),
        qrCodePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
        showBarcode: z.boolean().optional(),
        barcodeType: z.enum(["code128", "code39", "ean13", "qr"]).optional(),
        showLogo: z.boolean().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        showTrackingNumber: z.boolean().optional(),
        showCustomerName: z.boolean().optional(),
        showCustomerCode: z.boolean().optional(),
        showCustomerPhone: z.boolean().optional(),
        showDestinationCity: z.boolean().optional(),
        showWeight: z.boolean().optional(),
        showDimensions: z.boolean().optional(),
        showShippingType: z.boolean().optional(),
        showBatchNumber: z.boolean().optional(),
        showDate: z.boolean().optional(),
        showPrice: z.boolean().optional(),
        primaryColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createLabelTemplate(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        isDefault: z.boolean().optional(),
        size: z.enum(["10x15", "10x10", "A6", "A5", "custom"]).optional(),
        widthMm: z.number().optional(),
        heightMm: z.number().optional(),
        showQrCode: z.boolean().optional(),
        qrCodeSize: z.number().optional(),
        qrCodePosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"]).optional(),
        showBarcode: z.boolean().optional(),
        barcodeType: z.enum(["code128", "code39", "ean13", "qr"]).optional(),
        showLogo: z.boolean().optional(),
        logoUrl: z.string().optional(),
        logoWidth: z.number().optional(),
        showTrackingNumber: z.boolean().optional(),
        showCustomerName: z.boolean().optional(),
        showCustomerCode: z.boolean().optional(),
        showCustomerPhone: z.boolean().optional(),
        showDestinationCity: z.boolean().optional(),
        showWeight: z.boolean().optional(),
        showDimensions: z.boolean().optional(),
        showShippingType: z.boolean().optional(),
        showBatchNumber: z.boolean().optional(),
        showDate: z.boolean().optional(),
        showPrice: z.boolean().optional(),
        primaryColor: z.string().optional(),
        fontFamily: z.string().optional(),
        fontSize: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateLabelTemplate(id, data);
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLabelTemplate(input.id);
        return { success: true };
      }),
    
    setDefault: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.setDefaultLabelTemplate(input.id);
      }),
    
    ensureDefault: adminProcedure.mutation(async () => {
      return db.ensureDefaultLabelTemplate();
    }),
  }),

  // ============ ALERTS ============
  alerts: router({
    // Get alert summary for dashboard
    getSummary: staffProcedure.query(async () => {
      return db.getAlertSummary();
    }),

    // Get packages with alerts
    getPackages: staffProcedure
      .input(z.object({
        alertStatus: z.enum(["normal", "warning", "high_risk"]).optional(),
        status: z.string().optional(),
        customerId: z.number().optional(),
        batchId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getPackagesWithAlerts(input);
      }),

    // Get batches with alerts
    getBatches: staffProcedure
      .input(z.object({
        alertStatus: z.enum(["normal", "warning", "high_risk"]).optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getBatchesWithAlerts(input);
      }),
  }),
  
  // ============ FINANCE INTEGRATION ============
  financeIntegration: router({
    // Revenue Records
    revenue: router({
      // Create revenue record
      create: accountantProcedure
        .input(z.object({
          recordDate: z.date(),
          revenueType: z.enum(['package_delivery', 'full_package_sale', 'full_package_commission', 'service_fee', 'extra_service', 'shipping_fee', 'other']),
          amountUsd: z.number().positive(),
          amountIqd: z.number().optional(),
          exchangeRate: z.number().optional(),
          costUsd: z.number().optional(),
          referenceType: z.enum(['package', 'fullPackageOrder', 'invoice', 'service', 'manual']).optional(),
          referenceId: z.number().optional(),
          customerId: z.number().optional(),
          description: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          return db.createRevenueRecord({
            ...input,
            createdById: ctx.user.id,
          });
        }),
      
      // List revenue records
      list: accountantProcedure
        .input(z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          revenueType: z.string().optional(),
          customerId: z.number().optional(),
          referenceType: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional())
        .query(async ({ input }) => {
          return db.listRevenueRecords(input || {});
        }),
      
      // Get revenue by type
      byType: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.getRevenueByType(input.startDate, input.endDate);
        }),
    }),
    
    // Daily Summary
    dailySummary: router({
      // Get summary for a date
      get: accountantProcedure
        .input(z.object({ date: z.date() }))
        .query(async ({ input }) => {
          return db.getDailyFinancialSummary(input.date);
        }),
      
      // Get summary for date range
      range: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.getFinancialSummaryRange(input.startDate, input.endDate);
        }),
    }),
    
    // Profit & Loss
    profitLoss: router({
      // Calculate P&L for period
      calculate: accountantProcedure
        .input(z.object({
          startDate: z.date(),
          endDate: z.date(),
        }))
        .query(async ({ input }) => {
          return db.calculateProfitLoss(input.startDate, input.endDate);
        }),
    }),
    
    // Dashboard Stats (Comprehensive P&L)
    dashboardStats: accountantProcedure
      .input(z.object({
        period: z.enum(['today', 'week', 'month', 'year']).optional(),
      }).optional())
      .query(async ({ input }) => {
        const now = new Date();
        let startDate: Date;
        let endDate = now;
        
        switch (input?.period || 'month') {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'month':
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const comprehensive = await db.getComprehensiveDashboardStats(startDate, endDate);
        
        return {
          period: input?.period || 'month',
          startDate,
          endDate,
          ...comprehensive,
        };
      }),
  }),
  
  // ============ BLOG POSTS (بلۆگ و ڕاگەیاندنەکان) ============
  blog: router({
    // Get all blog posts (admin)
    list: staffProcedure.query(async () => {
      return db.getAllBlogPosts();
    }),
    
    // Get published posts (public)
    published: publicProcedure.query(async () => {
      return db.getPublishedBlogPosts();
    }),
    
    // Get featured posts (public)
    featured: publicProcedure.query(async () => {
      return db.getFeaturedBlogPosts();
    }),
    
    // Get by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const post = await db.getBlogPostById(input.id);
        if (post) {
          // Increment view count
          await db.incrementBlogViewCount(input.id);
        }
        return post;
      }),
    
    // Get by slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const post = await db.getBlogPostBySlug(input.slug);
        if (post) {
          await db.incrementBlogViewCount(post.id);
        }
        return post;
      }),
    
    // Get by category
    getByCategory: publicProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ input }) => {
        return db.getBlogPostsByCategory(input.category);
      }),
    
    // Create blog post
    create: staffProcedure
      .input(z.object({
        titleEn: z.string().optional(),
        titleKu: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentKu: z.string().optional(),
        contentAr: z.string().optional(),
        summaryEn: z.string().optional(),
        summaryKu: z.string().optional(),
        summaryAr: z.string().optional(),
        coverImageUrl: z.string().optional(),
        category: z.enum(['announcement', 'news', 'promotion', 'update', 'guide']).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        isFeatured: z.boolean().optional(),
        publishedAt: z.date().optional(),
        expiresAt: z.date().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Validate at least one language has title and content
        const hasTitle = input.titleEn || input.titleKu || input.titleAr;
        const hasContent = input.contentEn || input.contentKu || input.contentAr;
        if (!hasTitle || !hasContent) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one language must have title and content' });
        }
        return db.createBlogPost({
          titleEn: input.titleEn || '',
          contentEn: input.contentEn || '',
          titleKu: input.titleKu,
          titleAr: input.titleAr,
          contentKu: input.contentKu,
          contentAr: input.contentAr,
          summaryEn: input.summaryEn,
          summaryKu: input.summaryKu,
          summaryAr: input.summaryAr,
          coverImageUrl: input.coverImageUrl,
          category: input.category,
          status: input.status,
          isFeatured: input.isFeatured,
          expiresAt: input.expiresAt,
          slug: input.slug,
          authorId: ctx.user.id,
          publishedAt: input.status === 'published' ? (input.publishedAt || new Date()) : undefined,
        });
      }),
    
    // Update blog post
    update: staffProcedure
      .input(z.object({
        id: z.number(),
        titleEn: z.string().optional(),
        titleKu: z.string().optional(),
        titleAr: z.string().optional(),
        contentEn: z.string().optional(),
        contentKu: z.string().optional(),
        contentAr: z.string().optional(),
        summaryEn: z.string().optional(),
        summaryKu: z.string().optional(),
        summaryAr: z.string().optional(),
        coverImageUrl: z.string().optional(),
        category: z.enum(['announcement', 'news', 'promotion', 'update', 'guide']).optional(),
        status: z.enum(['draft', 'published', 'archived']).optional(),
        isFeatured: z.boolean().optional(),
        publishedAt: z.date().optional(),
        expiresAt: z.date().optional(),
        slug: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        // If publishing for first time, set publishedAt
        if (data.status === 'published') {
          const existing = await db.getBlogPostById(id);
          if (existing && existing.status !== 'published' && !data.publishedAt) {
            data.publishedAt = new Date();
          }
        }
        return db.updateBlogPost(id, data);
      }),
    
    // Delete blog post
    delete: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteBlogPost(input.id);
      }),
    
    // Upload cover image
    uploadCoverImage: staffProcedure
      .input(z.object({
        fileData: z.string(), // base64 encoded file data
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const { nanoid } = await import("nanoid");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        
        // Generate unique filename
        const ext = input.fileName.split(".").pop() || "jpg";
        const uniqueFileName = `blog-covers/${nanoid(12)}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(uniqueFileName, buffer, input.mimeType);
        
        return { success: true, url };
      }),
  }),


  // Storage Router for image uploads
  storage: router({
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const { nanoid } = await import("nanoid");
        
        // Decode base64 to buffer
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // Generate unique filename
        const ext = input.fileName.split(".").pop() || "jpg";
        const uniqueFileName = `uploads/${nanoid(12)}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(uniqueFileName, buffer, input.contentType);
        
        return { success: true, url };
      }),
  }),

  // ============ BACKUP MANAGEMENT ============
  backup: router({
    // Create a new backup
    create: adminProcedure
      .input(z.object({
        backupType: z.enum(["manual", "scheduled"]).default("manual"),
        backupContent: z.enum(["database_only", "files_only", "full"]).default("database_only"),
        schedule: z.enum(["daily", "weekly", "monthly"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log('[BACKUP] Create backup called:', input, 'User:', ctx.user.id, ctx.user.name);
        
        // Use new ZIP backup system for full backups
        if (input.backupContent === "full") {
          const { createZipBackup } = await import("./zipBackupService.js");
          return await createZipBackup({
            backupType: input.backupType,
            schedule: input.schedule,
            createdById: ctx.user.id,
            createdByName: ctx.user.name || undefined,
          });
        }
        
        // Use original backup service for database-only and files-only
        const { createBackup } = await import("./backupService.js");
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
        const { getDb } = await import("./db.js");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const { backups } = await import("../drizzle/schema.js");
        const { eq, desc } = await import("drizzle-orm");
        
        let query = db.select().from(backups);
        
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
        const { getDb } = await import("./db.js");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const { backups } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        
        const [backup] = await db.select().from(backups).where(eq(backups.id, input.id));
        
        if (!backup) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Backup not found" });
        }
        
        return backup;
      }),

    // Delete a backup
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db.js");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const { backups } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        
        await db.delete(backups).where(eq(backups.id, input.id));
        
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
        const { getDb } = await import("./db.js");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        
        const { backups } = await import("../drizzle/schema.js");
        const { eq } = await import("drizzle-orm");
        
        const [backup] = await db.select().from(backups).where(eq(backups.id, input.id));
        
        if (!backup) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Backup not found" });
        }
        
        // Check if it's a ZIP backup (filename ends with .zip)
        if (backup.filename?.endsWith('.zip')) {
          const { restoreFromZipBackup } = await import("./zipBackupService.js");
          return await restoreFromZipBackup(input.id, input.clearExisting);
        }
        
        // Use original restore for JSON backups
        const { restoreBackup } = await import("./backupService.js");
        return await restoreBackup(input.id);
      }),

    // Get schedule configuration
    getScheduleConfig: adminProcedure.query(async () => {
      const { getScheduleConfig } = await import("./scheduledBackups.js");
      return getScheduleConfig();
    }),

    // Update schedule configuration
    updateSchedule: adminProcedure
      .input(z.object({
        schedule: z.enum(["daily", "weekly", "monthly"]),
        enabled: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const { updateScheduleConfig } = await import("./scheduledBackups.js");
        const success = updateScheduleConfig(input.schedule, input.enabled);
        return { success };
      }),
  }),

  // ============================================
  // PERMISSIONS MANAGEMENT
  // ============================================
  permissions: router({
    // Get user permissions
    getUserPermissions: protectedProcedure
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
    checkPermission: protectedProcedure
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
    checkSubPermission: protectedProcedure
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
    setPermission: protectedProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        canView: z.boolean(),
        canCreate: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
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
    setSubPermission: protectedProcedure
      .input(z.object({
        userId: z.number(),
        module: z.string(),
        permissionKey: z.string(),
        isAllowed: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
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
    bulkUpdate: protectedProcedure
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
        // Check role hierarchy
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        
        // Super Admin can manage all roles
        if (ctx.user.role === "super_admin") {
          // Allow
        }
        // Admin can only manage Employee and Accountant
        else if (ctx.user.role === "admin") {
          if (targetUser.role !== "employee" && targetUser.role !== "accountant") {
            throw new TRPCError({ 
              code: "FORBIDDEN", 
              message: "Admin can only manage Employee and Accountant roles" 
            });
          }
        }
        // Employee and Accountant cannot manage anyone
        else {
          throw new TRPCError({ 
            code: "FORBIDDEN", 
            message: "You do not have permission to manage user permissions" 
          });
        }
        
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
    deletePermissions: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
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
  }),

  // ============ ADVANCED SETTINGS ROUTER ============
  advancedSettings: router({
    // ===== SYSTEM SETTINGS =====
    getAllSettings: adminProcedure.query(async () => {
      return await db.getAllSystemSettings();
    }),

    getSetting: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await db.getSystemSetting(input.key);
      }),

    setSetting: adminProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          type: z.string().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.setSystemSetting({
          ...input,
          updatedById: ctx.user.id,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_setting",
          entityType: "system_setting",
          entityId: result?.id,
        });

        return result;
      }),

    // ===== CURRENCY MANAGEMENT =====
    getAllCurrencies: staffProcedure.query(async () => {
      return await db.getAllCurrencies();
    }),

    getActiveCurrencies: staffProcedure.query(async () => {
      return await db.getActiveCurrencies();
    }),

    createCurrency: adminProcedure
      .input(
        z.object({
          code: z.string().min(2).max(10),
          name: z.string().min(1).max(100),
          symbol: z.string().min(1).max(10),
          exchangeRate: z.string(),
          isBaseCurrency: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createCurrency({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_currency",
          entityType: "currency",
          entityId: result?.id,
        });

        return result;
      }),

    updateCurrency: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          symbol: z.string().optional(),
          exchangeRate: z.string().optional(),
          isBaseCurrency: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateCurrency(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_currency",
          entityType: "currency",
          entityId: id,
        });

        return result;
      }),

    deleteCurrency: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCurrency(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_currency",
          entityType: "currency",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== TAX RATE MANAGEMENT =====
    getAllTaxRates: staffProcedure.query(async () => {
      return await db.getAllTaxRates();
    }),

    getActiveTaxRates: staffProcedure.query(async () => {
      return await db.getActiveTaxRates();
    }),

    createTaxRate: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          rate: z.string(),
          isDefault: z.boolean().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createTaxRate({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_tax_rate",
          entityType: "tax_rate",
          entityId: result?.id,
        });

        return result;
      }),

    updateTaxRate: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          rate: z.string().optional(),
          isDefault: z.boolean().optional(),
          isActive: z.boolean().optional(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateTaxRate(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_tax_rate",
          entityType: "tax_rate",
          entityId: id,
        });

        return result;
      }),

    deleteTaxRate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteTaxRate(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_tax_rate",
          entityType: "tax_rate",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== EMAIL TEMPLATE MANAGEMENT =====
    getAllEmailTemplates: adminProcedure.query(async () => {
      return await db.getAllEmailTemplates();
    }),

    getEmailTemplateByName: adminProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return await db.getEmailTemplateByName(input.name);
      }),

    createEmailTemplate: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          subject: z.string().min(1).max(255),
          body: z.string(),
          variables: z.string().optional(),
          category: z.enum(["notification", "invoice", "report", "alert"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.createEmailTemplate({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "create_email_template",
          entityType: "email_template",
          entityId: result?.id,
        });

        return result;
      }),

    updateEmailTemplate: adminProcedure
      .input(
        z.object({
          id: z.number(),
          subject: z.string().optional(),
          body: z.string().optional(),
          variables: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const [result] = await db.updateEmailTemplate(id, data);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "update_email_template",
          entityType: "email_template",
          entityId: id,
        });

        return result;
      }),

    deleteEmailTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteEmailTemplate(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "delete_email_template",
          entityType: "email_template",
          entityId: input.id,
        });

        return { success: true };
      }),

    // ===== IP WHITELIST MANAGEMENT =====
    getAllIpWhitelist: adminProcedure.query(async () => {
      return await db.getAllIpWhitelist();
    }),

    getActiveIpWhitelist: adminProcedure.query(async () => {
      return await db.getActiveIpWhitelist();
    }),

    isIpWhitelisted: protectedProcedure
      .input(z.object({ ip: z.string() }))
      .query(async ({ input }) => {
        return await db.isIpWhitelisted(input.ip);
      }),

    addIpToWhitelist: adminProcedure
      .input(
        z.object({
          ipAddress: z.string().min(7).max(45),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const [result] = await db.addIpToWhitelist({
          ...input,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || undefined,
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "add_ip_whitelist",
          entityType: "ip_whitelist",
          entityId: result?.id,
        });

        return result;
      }),

    removeIpFromWhitelist: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removeIpFromWhitelist(input.id);

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "remove_ip_whitelist",
          entityType: "ip_whitelist",
          entityId: input.id,
        });

        return { success: true };
      }),
  }),

  // Support Chat Router
  supportChat: router({
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
        messageType: z.enum(['text', 'image', 'file']).optional(),
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
  }),

  // ============ PUBLIC ENDPOINTS (No Auth Required) ============
  public: router({
    // Get portal theme setting
    getPortalTheme: publicProcedure
      .query(async () => {
        const theme = await db.getSetting('portalTheme');
        return theme || 'classic';
      }),
  }),
});

// Helper function to convert month name to number
function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3,
    'May': 4, 'June': 5, 'July': 6, 'August': 7,
    'September': 8, 'October': 9, 'November': 10, 'December': 11,
    'کانوونی دووەم': 0, 'شوبات': 1, 'ئازار': 2, 'نیسان': 3,
    'ئایار': 4, 'حوزەیران': 5, 'تەممووز': 6, 'ئاب': 7,
    'ئەیلوول': 8, 'تشرینی یەکەم': 9, 'تشرینی دووەم': 10, 'کانوونی یەکەم': 11,
  };
  return months[month] ?? 0;
}

export type AppRouter = typeof appRouter;
// Force rebuild Wed Dec 24 14:19:48 EST 2025
