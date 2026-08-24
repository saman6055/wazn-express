import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { explainFigure, explainCashOnHand } from "@shared/financeExplain";
import { partnerAccounts, reconcile, ownershipCheck, partnershipTotals, statement } from "@shared/partnerLedger";
import { buildBatchInvoice } from "@shared/batchInvoice";
import { buildBoxInvoice } from "@shared/boxInvoice";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { appLogger } from "../utils/logger";
import { staffProcedure, adminProcedure, accountantProcedure } from "../middleware/auth";
import * as db from "../db";
import { cacheGetOrSet, CACHE_TTL } from "../db/cache";
import { phoneSchema, emailSchema, idSchema, amountSchema, packageCodeSchema, batchCodeSchema } from "./schemas";

export const exchangeRatesRouter = router({
    list: staffProcedure.query(async () => {
      return cacheGetOrSet("exchangeRates:all", CACHE_TTL.EXCHANGE_RATES_MS, () => db.getAllExchangeRates());
    }),
    getCurrent: staffProcedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return cacheGetOrSet(`exchangeRate:${input.currency}`, CACHE_TTL.EXCHANGE_RATES_MS, () => db.getCurrentExchangeRate(input.currency));
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
});

export const ledgerRouter = router({
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
    
    // Get account transactions (cursor-based pagination)
    getTransactions: staffProcedure
      .input(z.object({ accountId: z.number(), limit: z.number().min(1).max(100).default(50), cursor: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAccountLedgerTransactions(input.accountId, { limit: input.limit, cursor: input.cursor });
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

    // Get recent payments with customer name (for accountant dashboard)
    getRecentPayments: accountantProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return db.getRecentPayments(input.limit);
      }),

    // Balance distribution: debt / credit / zero counts (for accountant dashboard)
    getBalanceDistribution: accountantProcedure.query(async () => {
      return db.getBalanceDistribution();
    }),

    // Unpaid invoices summary (for accountant dashboard)
    getUnpaidInvoicesSummary: accountantProcedure.query(async () => {
      const summary = await db.getInvoiceSummary();
      return { unpaidInvoices: summary.unpaidInvoices, unpaidAmountUsd: summary.unpaidAmountUsd };
    }),

    // Record payment (cash account deposit, when provided, is done inside the same transaction — no silent failure)
    recordPayment: staffProcedure
      .input(z.object({
        customerId: idSchema,
        customerCode: z.string().max(50),
        amountUsd: amountSchema.default(0),
        amountIqd: amountSchema.default(0),
        paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'FIB', 'FASTPAY', 'ZAINCASH', 'ASIAHAWALA', 'CARD', 'OTHER']),
        notes: z.string().max(1000).optional(),
        receiptNumber: z.string().max(100).optional(),
        cashAccountId: idSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if ((input.amountUsd ?? 0) <= 0 && (input.amountIqd ?? 0) <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Payment amount must be greater than zero",
          });
        }
        const cashDescription = input.notes
          ? `پارەدانی کڕیار: ${input.customerCode} - ${input.notes}`
          : `پارەدانی کڕیار: ${input.customerCode}`;
        const result = await db.recordPaymentReceived(
          input.customerId,
          input.customerCode,
          input.amountUsd,
          input.amountIqd,
          input.paymentMethod,
          ctx.user.id,
          input.notes,
          input.receiptNumber,
          input.cashAccountId,
          cashDescription
        );
        return result;
      }),
    
    /**
     * Reverse a previously-recorded customer payment because it was
     * entered by mistake (typo / wrong customer / wrong amount). NO
     * cash physically leaves the cashbox — only the ledger is corrected.
     *
     * Restricted to accountantProcedure: this is a financially sensitive
     * operation that staff-tier users must not perform.
     */
    reversePayment: accountantProcedure
      .input(z.object({
        paymentId: idSchema,
        amountUsd: amountSchema.optional(), // omit ⇒ reverse the full remaining
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const payment = await db.getPaymentRecordById(input.paymentId);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "پارەدان نەدۆزرایەوە" });
        }
        if (payment.transactionId == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ئەم پارەدانە لینکی ledger transaction-ـی نییە، ناتوانرێت بگەڕێنرێتەوە",
          });
        }
        const original = parseFloat(payment.amountUsd || '0');
        const alreadyReversed = parseFloat(payment.reversedAmountUsd || '0');
        const remaining = original - alreadyReversed;
        if (remaining <= 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم پارەدانە پێشتر گەڕێنراوەتەوە" });
        }
        const requested = input.amountUsd ?? remaining;
        if (requested > remaining + 0.005) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `بڕی داواکراو ($${requested.toFixed(2)}) لە ماوە ($${remaining.toFixed(2)}) زیاترە`,
          });
        }

        const account = await db.getCustomerAccountById(payment.accountId);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "حسابی کڕیار نەدۆزرایەوە" });
        }
        const customer = await db.getCustomerById(account.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });
        }

        const result = await db.reverseAdvancePayment(
          account.customerId,
          customer.customerCode || `C${account.customerId}`,
          requested,
          `[هەڵە] ${input.reason}`,
          ctx.user.id,
          payment.transactionId,
        );

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "reverse_payment",
          entityType: "payment",
          entityId: input.paymentId,
          newValues: {
            reversedAmountUsd: requested,
            reason: input.reason,
            reversalTransactionId: result.transaction.id,
          },
        });

        return result;
      }),

    /**
     * Refund a customer's prior payment by handing real cash back from
     * one of our cashboxes. Updates BOTH the customer ledger (mirror of
     * reversePayment) AND the chosen cashbox (withdrawal).
     *
     * Restricted to accountantProcedure for the same reason as reverse.
     */
    refundPayment: accountantProcedure
      .input(z.object({
        paymentId: idSchema,
        amountUsd: amountSchema, // explicit — refund must always state the amount
        cashAccountId: idSchema,
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.amountUsd <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "بڕی Refund پێویستە لە سفر زیاتر بێت" });
        }
        const payment = await db.getPaymentRecordById(input.paymentId);
        if (!payment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "پارەدان نەدۆزرایەوە" });
        }
        if (payment.transactionId == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ئەم پارەدانە لینکی ledger transaction-ـی نییە، ناتوانرێت refund بکرێت",
          });
        }
        const original = parseFloat(payment.amountUsd || '0');
        const alreadyReversed = parseFloat(payment.reversedAmountUsd || '0');
        const remaining = original - alreadyReversed;
        if (remaining <= 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ئەم پارەدانە پێشتر گەڕێنراوەتەوە" });
        }
        if (input.amountUsd > remaining + 0.005) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `بڕی داواکراو ($${input.amountUsd.toFixed(2)}) لە ماوە ($${remaining.toFixed(2)}) زیاترە`,
          });
        }

        const account = await db.getCustomerAccountById(payment.accountId);
        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "حسابی کڕیار نەدۆزرایەوە" });
        }
        const customer = await db.getCustomerById(account.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کڕیار نەدۆزرایەوە" });
        }

        let result;
        try {
          result = await db.refundPaymentToCustomer(
            account.customerId,
            customer.customerCode || `C${account.customerId}`,
            input.amountUsd,
            input.reason,
            input.cashAccountId,
            ctx.user.id,
            payment.transactionId,
          );
        } catch (e) {
          // Insufficient-funds and missing-account errors are user-fixable —
          // surface them as BAD_REQUEST instead of an opaque 500.
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes('insufficient') || msg.includes('not found')) {
            throw new TRPCError({ code: "BAD_REQUEST", message: msg });
          }
          throw e;
        }

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "refund_payment",
          entityType: "payment",
          entityId: input.paymentId,
          newValues: {
            refundedAmountUsd: input.amountUsd,
            cashAccountId: input.cashAccountId,
            reason: input.reason,
            reversalTransactionId: result.transaction.id,
            cashTransactionId: result.cashTransactionId,
          },
        });

        return result;
      }),

    /**
     * Manual balance adjustment — posts an ADJUSTMENT_DEBIT or
     * ADJUSTMENT_CREDIT directly without reference to any payment, order,
     * or cashbox. Use ONLY when a balance is orphaned (e.g. payment record
     * was hard-deleted before we had reversal tooling) and the standard
     * reverse / refund flow can't be applied. Reason is mandatory and
     * stored on the ledger transaction so the correction is traceable.
     *
     * Restricted to accountantProcedure for the same reason as reverse /
     * refund: it directly mutates the customer's balance.
     */
    adjustBalance: accountantProcedure
      .input(z.object({
        customerId: idSchema,
        direction: z.enum(['debit', 'credit']),
        amountUsd: amountSchema,
        reason: z.string().min(5).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.amountUsd <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "بڕی ڕێکخستن پێویستە لە سفر زیاتر بێت" });
        }
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "کریار نەدۆزرایەوە" });
        }

        const result = await db.adjustCustomerBalance(
          input.customerId,
          customer.customerCode || `C${input.customerId}`,
          input.amountUsd,
          input.direction,
          input.reason,
          ctx.user.id,
        );

        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "adjust_balance",
          entityType: "customer_account",
          entityId: input.customerId,
          newValues: {
            direction: input.direction,
            amountUsd: input.amountUsd,
            reason: input.reason,
            adjustmentTransactionId: result.transaction.id,
            newBalanceUsd: result.newBalanceUsd,
          },
        });

        return result;
      }),

    // Record package charge (manual)
    recordCharge: staffProcedure
      .input(z.object({
        customerId: idSchema,
        customerCode: z.string().max(50),
        packageId: idSchema,
        amountUsd: amountSchema,
        description: z.string().min(1).max(1000),
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
        accountId: idSchema,
        reminderType: z.enum(['sms', 'whatsapp', 'email', 'call']),
        scheduledAt: z.date(),
        customMessage: z.string().max(1000).optional(),
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
        packageId: idSchema,
        customerId: idSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const pkg = await db.getPackageById(input.packageId);
        if (!pkg) throw new TRPCError({ code: 'NOT_FOUND', message: 'Package not found' });
        
        const customer = await db.getCustomerById(input.customerId);
        if (!customer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
        
        // Generate invoice number
        const invoiceNumber = await db.getNextInvoiceNumber();
        
        // Generate PDF
        const { generatePackageInvoice } = await import('../services/invoice.service');
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
        const { storagePut } = await import('../services/storage.service');
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
        const { generatePaymentReceipt } = await import('../services/invoice.service');
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
        const { storagePut } = await import('../services/storage.service');
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
        const page = input.limit > 0 ? Math.floor(input.offset / input.limit) + 1 : 1;
        return db.getAllInvoices({ limit: input.limit, page });
      }),
    
    // Get invoice by ID
    getInvoice: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInvoiceById(input.id);
      }),
    
    // Balance validation procedures removed
});

export const expenseCategoriesRouter = router({
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
        code: z.string().optional(),
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
        code: z.string().optional(),
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
});

export const expensesRouter = router({
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
    /**
     * Everything the expenses screen reports, for one window and the window
     * before it.
     *
     * Composed, not recalculated: the totals come from getExpensesSummary and
     * the profit figures from calculateProfitLoss, the same functions the
     * finance screens use. Nothing here decides what an expense is or what it
     * costs — it reads the same rows the list reads and adds them up along a
     * few more axes.
     *
     * The comparison window is the same length as the chosen one and ends the
     * day before it starts, so "18% more than last time" compares a week with
     * a week and a quarter with a quarter. Comparing against a calendar month
     * would make the first days of a month look like a collapse.
     */
    /** What the office means to spend. Reading is for anyone who can see the
     *  screen; setting one is an owner's decision, so it is admin-only. */
    /** Suggested next receipt number for a category. A suggestion, not a
     *  reservation — the field stays editable. */
    nextReference: accountantProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input }) => {
        return { referenceNumber: await db.getNextExpenseReference(input.categoryId) };
      }),

    listBudgets: accountantProcedure.query(async () => {
      return db.getExpenseBudgets();
    }),
    setBudget: adminProcedure
      .input(z.object({
        // null = one budget covering every variable category together.
        categoryId: z.number().nullable(),
        monthlyAmountUsd: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setExpenseBudget({
          categoryId: input.categoryId,
          monthlyAmountUsd: input.monthlyAmountUsd,
          notes: input.notes ?? null,
          createdById: ctx.user.id,
        });
        return { success: true };
      }),

    getDashboard: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const { startDate, endDate } = input;
        const DAY = 86_400_000;
        const spanMs = Math.max(0, endDate.getTime() - startDate.getTime());
        const previousEnd = new Date(startDate.getTime() - DAY);
        const previousStart = new Date(previousEnd.getTime() - spanMs);

        // A budget is a monthly promise, so it is answered for the calendar
        // month the chosen window ends in — not for the window itself. A
        // budget measured over eleven days would report every month as
        // comfortably under.
        const monthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        const monthEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59);

        const [current, previous, daily, previousDaily, byVendor, paymentSplit, profitLoss, budgets] =
          await Promise.all([
            db.getExpensesSummary(startDate, endDate),
            db.getExpensesSummary(previousStart, previousEnd),
            db.getExpensesDailyTotals(startDate, endDate),
            db.getExpensesDailyTotals(previousStart, previousEnd),
            db.getExpensesByVendor(startDate, endDate, 5),
            db.getExpensesPaymentSplit(startDate, endDate),
            // Revenue and cost for the same window, so the share of profit is
            // a share of *this* period's profit and not of the year's.
            db.calculateProfitLoss(startDate, endDate),
            db.getExpenseBudgetStatus(monthStart, monthEnd, endDate),
          ]);

        return {
          period: { startDate, endDate },
          previousPeriod: { startDate: previousStart, endDate: previousEnd },
          budgetMonth: { startDate: monthStart, endDate: monthEnd },
          budgets,
          current,
          previous,
          daily,
          previousDaily,
          byVendor,
          paymentSplit,
          profit: {
            grossProfit: profitLoss.grossProfit,
            netProfit: profitLoss.netProfit,
            // Deliberately the expenses figure this screen owns, so the panel
            // sums to the card above it. calculateProfitLoss counts costs the
            // expenses table knows nothing about, and mixing the two would
            // print a subtraction that does not work out.
            expensesInPeriod: current.totalAmount,
          },
        };
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

        // Take the money out of the account that paid it. The screen has
        // always asked which account, stored the answer and done nothing with
        // it, so the Treasury went on showing money that had already left.
        let cashWarning: string | null = null;
        if (input.cashAccountId) {
          try {
            const { wentNegative, newBalance } = await db.recordExpenseCashMovement({
              expenseId: expense.id,
              accountId: input.cashAccountId,
              amountUsd: input.amountUsd,
              expenseDate: input.expenseDate,
              description: input.description ?? input.vendor ?? null,
              createdById: ctx.user.id,
            });
            // Recorded either way — the money is already gone, and refusing to
            // write it down would not bring it back. But a negative balance
            // means something is wrong and somebody should look.
            if (wentNegative) {
              cashWarning = `باڵانسی حساب بووە ${newBalance.toFixed(2)} — لە سفر کەمترە`;
            }
          } catch (e) {
            appLogger.error('[Finance] Expense recorded but cash movement failed', { expenseId: expense.id, error: e instanceof Error ? e.message : String(e) });
            cashWarning = 'خەرجییەکە تۆمارکرا بەڵام پارەکە لە حسابەکە کەم نەکرایەوە';
          }
        }

        // Update daily financial summary with expense
        try {
          await db.updateDailyFinancialSummary(input.expenseDate, { addExpense: parseFloat(input.amountUsd), expenseType: input.categoryId?.toString() || 'other' });
        } catch (e) {
          appLogger.error('[Finance] Failed to update daily summary for expense', { error: e instanceof Error ? e.message : String(e) });
        }
        
        // Check expense alert thresholds
        try {
          const { alertsTriggered } = await db.checkExpenseThresholds(
            parseFloat(input.amountUsd),
            input.categoryId
          );
          
          if (alertsTriggered.length > 0) {
            const { notifyOwner } = await import('../_core/notification');
            for (const triggered of alertsTriggered) {
              const currencySymbol = triggered.alert.currency === 'USD' ? '$' : 'د.ع';
              await notifyOwner({
                title: `⚠️ ئاگادارکردنەوەی خەرجی - سنوور تێپەڕا!`,
                content: `خەرجییەکان لە سنوورەکە تێپەڕیوە:\n\nماوە: ${triggered.periodLabel}\nکۆی خەرجی: ${currencySymbol}${triggered.totalExpenses.toLocaleString()}\nسنوور: ${currencySymbol}${triggered.thresholdAmount.toLocaleString()}\n${triggered.alert.description ? `تێبینی: ${triggered.alert.description}` : ''}`,
              });
            }
          }
        } catch (e) {
          appLogger.error('[ExpenseAlert] Failed to check thresholds', { error: e instanceof Error ? e.message : String(e) });
        }

        // The warning travels back with the expense so the screen can say so.
        // The expense itself is saved either way.
        return { ...expense, cashWarning };
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
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        // Read it before the change: the daily summary is a running total, so
        // reversing the old figure needs the old figure. Creating an expense
        // added to that total and nothing ever took anything back out — edit
        // 100 down to 50 and the day still counted 100, delete it and the day
        // still counted it at all.
        const before = await db.getExpenseById(id);
        const updated = await db.updateExpense(id, data);

        // If the amount, the date or the paying account moved, the cash
        // movement has to move with it. Reversing then re-posting rather than
        // editing the old row: the running balance on every later statement
        // line was computed against the original, and rewriting it would
        // leave them all describing a balance the account never had.
        try {
          const amountChanged = before && before.amountUsd !== updated.amountUsd;
          const accountChanged = before && before.cashAccountId !== updated.cashAccountId;
          const dateChanged =
            before &&
            new Date(before.expenseDate).getTime() !== new Date(updated.expenseDate).getTime();

          if (before && (amountChanged || accountChanged || dateChanged)) {
            await db.reverseExpenseCashMovement({
              expenseId: id,
              createdById: ctx.user.id,
              reason: `ڕاستکردنەوەی خەرجی #${id}`,
            });
            if (updated.cashAccountId) {
              await db.recordExpenseCashMovement({
                expenseId: id,
                accountId: updated.cashAccountId,
                amountUsd: updated.amountUsd,
                expenseDate: updated.expenseDate,
                description: updated.description ?? updated.vendor ?? null,
                createdById: ctx.user.id,
              });
            }
          }
        } catch (e) {
          appLogger.error('[Finance] Failed to adjust cash after expense edit', { expenseId: id, error: e instanceof Error ? e.message : String(e) });
        }

        try {
          if (before) {
            const oldAmount = parseFloat(before.amountUsd);
            const newAmount = parseFloat(updated.amountUsd);
            const sameDay =
              new Date(before.expenseDate).toDateString() ===
              new Date(updated.expenseDate).toDateString();

            if (sameDay) {
              const delta = newAmount - oldAmount;
              if (delta !== 0) {
                await db.updateDailyFinancialSummary(updated.expenseDate, {
                  addExpense: delta,
                  expenseType: String(updated.categoryId ?? 'other'),
                });
              }
            } else {
              // Moved to another day: take it off the old one and put it on
              // the new, or both days are wrong from here on.
              await db.updateDailyFinancialSummary(before.expenseDate, {
                addExpense: -oldAmount,
                expenseType: String(before.categoryId ?? 'other'),
              });
              await db.updateDailyFinancialSummary(updated.expenseDate, {
                addExpense: newAmount,
                expenseType: String(updated.categoryId ?? 'other'),
              });
            }
          }
        } catch (e) {
          appLogger.error('[Finance] Failed to adjust daily summary after expense edit', { error: e instanceof Error ? e.message : String(e) });
        }

        return updated;
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const expense = await db.getExpenseById(input.id);

        // Put the money back before the expense is gone — after it, there is
        // nothing left to say what should be reversed or why.
        if (expense?.cashAccountId) {
          try {
            await db.reverseExpenseCashMovement({
              expenseId: input.id,
              createdById: ctx.user.id,
              reason: `سڕینەوەی خەرجی #${input.id}`,
            });
          } catch (e) {
            appLogger.error('[Finance] Failed to return cash after expense delete', { expenseId: input.id, error: e instanceof Error ? e.message : String(e) });
          }
        }

        await db.deleteExpense(input.id);

        // Take it back out of the day it was counted in.
        if (expense) {
          try {
            await db.updateDailyFinancialSummary(expense.expenseDate, {
              addExpense: -parseFloat(expense.amountUsd),
              expenseType: String(expense.categoryId ?? 'other'),
            });
          } catch (e) {
            appLogger.error('[Finance] Failed to adjust daily summary after expense delete', { error: e instanceof Error ? e.message : String(e) });
          }

          // Money leaving the books is worth a record of who took it out.
          await db.createAuditLog({
            userId: ctx.user.id,
            userRole: ctx.user.role,
            action: 'delete_expense',
            entityType: 'expense',
            entityId: input.id,
            oldValues: expense,
          });
        }

        return { success: true };
      }),
});

export const expenseAlertsRouter = router({
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
});

export const partnersRouter = router({
    /**
     * Every partner, with both their books worked out.
     *
     * One call rather than one per partner, and the arithmetic happens here
     * rather than in the page. The screen has no business deciding what counts
     * as capital and what counts as a loan — that rule lives in
     * shared/partnerLedger.ts, and anything that renders these figures reads
     * the same answer.
     */
    overview: adminProcedure.query(async () => {
      const [partners, allTransactions] = await Promise.all([
        db.getAllPartners(),
        db.getAllPartnerTransactions(),
      ]);

      // Oldest first: a running balance that starts at the newest row counts
      // the account backwards.
      const byPartner = new Map<number, typeof allTransactions>();
      for (const tx of [...allTransactions].reverse()) {
        const list = byPartner.get(tx.partnerId);
        if (list) list.push(tx);
        else byPartner.set(tx.partnerId, [tx]);
      }

      const rows = partners.map((partner) => {
        const txs = byPartner.get(partner.id) ?? [];
        const accounts = partnerAccounts(txs, partner.initialCapital);

        return {
          partner,
          accounts,
          reconciliation: reconcile(accounts, partner.currentBalance),
          entryCount: txs.length,
          lastMovement: txs.length ? txs[txs.length - 1].transactionDate : null,
        };
      });

      return {
        rows,
        totals: partnershipTotals(rows),
        ownership: ownershipCheck(partners),
      };
    }),

    /** One partner's account, line by line, oldest first. */
    ledger: adminProcedure
      .input(z.object({ partnerId: idSchema }))
      .query(async ({ input }) => {
        const partner = await db.getPartnerById(input.partnerId);
        if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Partner not found" });

        const txs = (await db.getPartnerTransactions(input.partnerId, 500)).slice().reverse();
        const accounts = partnerAccounts(txs, partner.initialCapital);

        return {
          partner,
          accounts,
          reconciliation: reconcile(accounts, partner.currentBalance),
          // The statement lines carry the balances; the rows carry the detail
          // the lines do not (date, description, who entered it).
          lines: statement(txs, partner.initialCapital).map((line) => ({
            ...line,
            transactionDate: txs[line.index].transactionDate,
            description: txs[line.index].description,
            referenceNumber: txs[line.index].referenceNumber,
            amount: Number(txs[line.index].amountUsd),
          })),
        };
      }),

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
});

/**
 * The office's copy of what the customer sees.
 *
 * Same rule, same function, same figures — buildBatchInvoice in shared/ — so
 * a customer on the phone and the member of staff answering are reading one
 * document rather than two that agree most of the time. Every earlier attempt
 * at "the same thing, on the other screen" in this system drifted, which is
 * why this one is a call rather than a copy.
 *
 * Staff see one extra thing the customer does not: which batch a customer is
 * in at all, so they can pick. What each line costs is identical.
 */
export const customerBatchInvoiceRouter = router({
  forCustomer: staffProcedure
    .input(z.object({ batchId: idSchema, customerId: idSchema }))
    .query(async ({ input }) => {
      const batch = await db.getBatchById(input.batchId);
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "باچ نەدۆزرایەوە" });

      const [orders, customer] = await Promise.all([
        db.getCustomerOrdersInBatch(input.batchId, input.customerId),
        db.getCustomerById(input.customerId),
      ]);

      return {
        batch: {
          id: batch.id,
          batchCode: batch.batchCode,
          shippingType: batch.shippingType,
          status: batch.status,
          actualArrival: batch.actualArrival,
          createdAt: batch.createdAt,
        },
        customer: customer ? { id: customer.id, customerCode: customer.customerCode, fullName: customer.fullName } : null,
        invoice: buildBatchInvoice(orders, 0),
      };
    }),

  /** The customer's delivery boxes, newest first. */
  boxesForCustomer: staffProcedure
    .input(z.object({ customerId: idSchema }))
    .query(async ({ input }) => {
      return db.getCustomerVisibleBoxes(input.customerId, 200);
    }),

  /** One box, itemised. Same rule and same shape as the customer's own copy. */
  boxForCustomer: staffProcedure
    .input(z.object({ boxId: idSchema, customerId: idSchema }))
    .query(async ({ input }) => {
      const boxes = await db.getCustomerVisibleBoxes(input.customerId, 200);
      const box = boxes.find((b) => b.id === input.boxId);
      if (!box) throw new TRPCError({ code: "NOT_FOUND", message: "سندوق نەدۆزرایەوە" });

      const items = await db.getBoxItems(box.id);
      return { box, invoice: buildBoxInvoice(items, box.deliveryChargeUsd) };
    }),
  /** Which batches this customer has anything in, newest first. */
  batchesForCustomer: staffProcedure
    .input(z.object({ customerId: idSchema }))
    .query(async ({ input }) => {
      return db.getCustomerBatches(input.customerId);
    }),
});
export const companyDebtsRouter = router({
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
});

export const cashAccountsRouter = router({
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
});

export const financialReportsRouter = router({
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
    getDetailedPnL: accountantProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getDetailedProfitAndLoss(input.startDate, input.endDate);
      }),
    // PDF Generation endpoints
    generateProfitLossPDF: accountantProcedure
      .input(z.object({
        month: z.string(),
        year: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateProfitLossPDF } = await import("../services/pdf.service");
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
        const { generateBalanceSheetPDF } = await import("../services/pdf.service");
        const overview = await db.getCompanyFinancialOverview();
        const debts = await db.getAllCompanyDebts();
        const partners = await db.getAllPartners();
        const partnerTxs = await db.getAllPartnerTransactions();
        const partnerBooks = partnershipTotals(
          partners.map((p) => ({
            accounts: partnerAccounts(
              partnerTxs.filter((t) => t.partnerId === p.id).reverse(),
              p.initialCapital,
            ),
          })),
        );

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
          // Taking partner loans out of equity means putting them where they
          // belong rather than letting them fall off the sheet — money that
          // vanishes from one side and appears on neither is a worse error
          // than the one being corrected.
          liabilities: {
            debts: [
              ...debts.map(d => ({ name: d.creditorName, amount: parseFloat(d.remainingAmount) })),
              ...partners
                .map((p) => ({
                  name: p.nameKu || p.name,
                  amount: partnerAccounts(
                    partnerTxs.filter((t) => t.partnerId === p.id).reverse(),
                    p.initialCapital,
                  ).loan.outstanding,
                }))
                .filter((row) => row.amount !== 0),
            ],
            total: overview.totalDebt + partnerBooks.liability,
          },
          // Equity is what the partners own, and a loan they made to the
          // company is not that — it is a debt the company has to repay.
          // Adding initialCapital to currentBalance counted every such loan as
          // ownership, and put money on the wrong side of the sheet.
          equity: {
            partnerCapital: partnerBooks.contributed,
            retainedEarnings: partnerBooks.profitShare - partnerBooks.drawings,
            total: partnerBooks.equity,
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
        const { generatePartnerReportPDF } = await import("../services/pdf.service");
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
        const { generateExpenseReportPDF } = await import("../services/pdf.service");
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
        const { generateDebtSchedulePDF } = await import("../services/pdf.service");
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
});

export const financeIntegrationRouter = router({
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

    /**
     * Where one figure on the dashboard came from.
     *
     * Read-only, and deliberately derived from the same stats object the
     * dashboard renders rather than re-querying. A second query would be a
     * second answer, and the two would eventually disagree — which is the
     * problem this is meant to solve, not a new one to introduce.
     *
     * The decomposition itself is a pure function in shared/, so it is tested
     * without a database, including the rule that matters: the parts must add
     * up to the whole.
     */
    explainFigure: accountantProcedure
      .input(z.object({
        figure: z.enum(['totalRevenue', 'totalExpenses', 'netProfit', 'cashOnHand']),
        period: z.enum(['today', 'week', 'month', 'year']).optional(),
      }))
      .query(async ({ input }) => {
        const now = new Date();
        let startDate: Date;
        const endDate = now;

        switch (input.period || 'month') {
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

        // Cash is a balance, not a period figure: it is whatever is in the
        // accounts right now, so it reads a different source and ignores the
        // date range rather than pretending to honour it.
        if (input.figure === 'cashOnHand') {
          const summary = await db.getCashAccountsSummary();
          return { ...explainCashOnHand(summary as never), startDate, endDate };
        }

        const stats = await db.getComprehensiveDashboardStats(startDate, endDate);
        return {
          ...explainFigure(input.figure, stats as never),
          startDate,
          endDate,
        };
      }),
});

export const financeRouters = {
  exchangeRates: exchangeRatesRouter,
  ledger: ledgerRouter,
  expenseCategories: expenseCategoriesRouter,
  expenses: expensesRouter,
  expenseAlerts: expenseAlertsRouter,
  partners: partnersRouter,
  companyDebts: companyDebtsRouter,
  cashAccounts: cashAccountsRouter,
  financialReports: financialReportsRouter,
  financeIntegration: financeIntegrationRouter,
  customerBatchInvoice: customerBatchInvoiceRouter,
};

function getMonthNumber(month: string): number {
  const months: Record<string, number> = {
    "January": 0, "February": 1, "March": 2, "April": 3,
    "May": 4, "June": 5, "July": 6, "August": 7,
    "September": 8, "October": 9, "November": 10, "December": 11,
    "کانوونی دووەم": 0, "شوبات": 1, "ئازار": 2, "نیسان": 3,
    "ئایار": 4, "حوزەیران": 5, "تەممووز": 6, "ئاب": 7,
    "ئەیلوول": 8, "تشرینی یەکەم": 9, "تشرینی دووەم": 10, "کانوونی یەکەم": 11,
  };
  return months[month] ?? 0;
}
