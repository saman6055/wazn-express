import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
import { appLogger } from "../utils/logger";
import * as db from "../db";

// ---------------------------------------------------------------------------
// Prohibited packages router
//   Staff: quick-register a prohibited item, list them, charge a resolution
//          fee (posts a debt), progress status.
//   Customer: see their prohibited packages, mark viewed, pick a resolution.
// ---------------------------------------------------------------------------

/** Resolve the current customer id from a portal session (merged user model). */
async function currentCustomerId(ctx: any): Promise<number | null> {
  if (ctx.user?.isCustomer) return ctx.user.id;
  const c = await db.getCustomerByUserId(ctx.user.id);
  return c?.id ?? null;
}

/** Reverse a charged prohibited fee: credit the balance back + void the fee
 *  invoice (reverseCharge), clear the fee on the record, notify the customer.
 *  Idempotent and safe to call whatever the current status is. */
async function reverseProhibitedFee(record: any, staffId: number): Promise<number> {
  if (!record.chargedAt || !record.ledgerTransactionId) return 0;
  const amount = Number(record.feeUsd || 0);
  await db.reverseCharge(
    record.ledgerTransactionId,
    `گەڕاندنەوەی کرێی کەل و پەلی قەدەغە - ${record.trackingNumber}`,
    staffId,
  );
  await db.clearProhibitedFee(record.id);
  await db.createCustomerNotification({
    customerId: record.customerId,
    type: "success",
    title: "Fee reversed",
    titleKu: "کولفە گەڕێندرایەوە",
    titleAr: "تم إلغاء الرسوم",
    message: `The $${amount.toFixed(2)} fee for ${record.trackingNumber} was removed from your balance.`,
    messageKu: `کولفەی $${amount.toFixed(2)} بۆ ${record.trackingNumber} لەسەر باڵانسەکەت لابرا.`,
    messageAr: `تمت إزالة رسوم $${amount.toFixed(2)} الخاصة بـ ${record.trackingNumber} من رصيدك.`,
    relatedType: "payment",
    actionUrl: "/portal/financial",
  } as any).catch(() => null);
  return amount;
}

export const prohibitedRouter = router({
  // ---- Staff: quick register ---------------------------------------------
  register: staffProcedure
    .input(z.object({
      trackingNumber: z.string().min(1).max(100),
      customerCode: z.string().min(1).max(50),
      photos: z.array(z.string().max(2048)).optional(),
      reasonId: z.string().max(120).optional(),
      reasonNote: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const customer = await db.getCustomerByCode(input.customerCode.trim());
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer code not found" });

      const created = await db.createProhibitedPackage({
        customerId: customer.id,
        trackingNumber: input.trackingNumber.trim(),
        photos: input.photos && input.photos.length ? input.photos : null,
        reasonId: input.reasonId || null,
        reasonNote: input.reasonNote?.trim() || null,
        createdById: ctx.user.id,
      });

      // Notify the customer (DB row + live SSE + web push in one call).
      await db.createCustomerNotification({
        customerId: customer.id,
        type: "warning",
        title: "Prohibited item",
        titleKu: "کەلوپەلی قەدەغە",
        titleAr: "بضاعة ممنوعة",
        message: `A package (${created.trackingNumber}) can't be shipped. Please choose what to do with it.`,
        messageKu: `پاکێجێک (${created.trackingNumber}) ناتوانرێت بگوازرێتەوە. تکایە هەڵبژێرە چی لێبکرێت.`,
        messageAr: `طرد (${created.trackingNumber}) لا يمكن شحنه. الرجاء اختيار ما يجب فعله به.`,
        relatedType: "package",
        relatedId: created.id,
        actionUrl: "/portal/prohibited-packages",
      } as any);

      appLogger.info("[Prohibited] registered", { id: created.id, customerId: customer.id, tracking: created.trackingNumber });
      return created;
    }),

  // ---- Staff: admin listing ----------------------------------------------
  listAdmin: staffProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listProhibitedWithCustomer(input ?? {});
    }),

  // ---- Staff: post the resolution fee as a debt --------------------------
  chargeFee: staffProcedure
    .input(z.object({ id: z.number(), feeUsd: z.number().positive() }))
    .mutation(async ({ input, ctx }) => {
      const record = await db.getProhibitedPackageById(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      if (record.chargedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Fee already charged" });
      const customer = await db.getCustomerById(record.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

      const desc = `کرێی خزمەتگوزاری کەل و پەلی قەدەغە - ${record.trackingNumber}${record.resolutionChoice ? ` (${record.resolutionChoice})` : ""}`;
      const { transaction } = await db.applyCharge(
        customer.id,
        customer.customerCode,
        "SERVICE",
        record.id,
        input.feeUsd,
        desc,
        ctx.user.id,
      );
      const updated = await db.setProhibitedFee(record.id, input.feeUsd.toFixed(2), transaction?.id ?? null);

      // Let the customer know a fee was added to their balance.
      await db.createCustomerNotification({
        customerId: customer.id,
        type: "payment",
        title: "Fee added",
        titleKu: "کولفە زیادکرا",
        titleAr: "تمت إضافة رسوم",
        message: `A fee of $${input.feeUsd.toFixed(2)} was added to your balance for prohibited package ${record.trackingNumber}.`,
        messageKu: `کولفەی $${input.feeUsd.toFixed(2)} بۆ پاکێجی قەدەغەی ${record.trackingNumber} خرایە سەر باڵانسەکەت.`,
        messageAr: `تمت إضافة رسوم بقيمة $${input.feeUsd.toFixed(2)} إلى رصيدك للطرد الممنوع ${record.trackingNumber}.`,
        relatedType: "payment",
        actionUrl: "/portal/financial",
      } as any).catch(() => null);

      return updated;
    }),

  // ---- Staff: reverse a charged fee directly -----------------------------
  reverseFee: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const record = await db.getProhibitedPackageById(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      if (!record.chargedAt || !record.ledgerTransactionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fee to reverse" });
      }
      await reverseProhibitedFee(record, ctx.user.id);
      return db.getProhibitedPackageById(input.id);
    }),

  // ---- Staff: progress status --------------------------------------------
  setStatus: staffProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "chosen", "resolved", "cancelled"]) }))
    .mutation(async ({ input, ctx }) => {
      const record = await db.getProhibitedPackageById(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });

      // Cancelling a charged item reverses the fee automatically.
      if (input.status === "cancelled") {
        try {
          await reverseProhibitedFee(record, ctx.user.id);
        } catch (e) {
          appLogger.error("[Prohibited] reverse on cancel failed", { id: record.id, err: String(e) });
        }
      }

      const updated = await db.updateProhibitedStatus(input.id, input.status);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      return updated;
    }),

  // ---- Customer: my prohibited packages ----------------------------------
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const customerId = await currentCustomerId(ctx);
    if (!customerId) return [];
    return db.getProhibitedPackagesByCustomer(customerId);
  }),

  markViewed: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const customerId = await currentCustomerId(ctx);
      if (!customerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No customer" });
      return db.markProhibitedViewed(input.id, customerId);
    }),

  chooseResolution: protectedProcedure
    .input(z.object({
      id: z.number(),
      choice: z.enum(["return", "reship", "destroy"]),
      reshipAddress: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const customerId = await currentCustomerId(ctx);
      if (!customerId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No customer" });
      if (input.choice === "reship" && !input.reshipAddress?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A new address is required for reshipping" });
      }
      const updated = await db.chooseProhibitedResolution(input.id, customerId, input.choice, input.reshipAddress?.trim() || null);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      return updated;
    }),
});
