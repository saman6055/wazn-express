import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
import * as db from "../db";
import { appLogger } from "../utils/logger";
import { idSchema } from "./schemas";
import { notifyStaffAlert } from "../_core/notifyStaff";
import { sendWecomMarkdown } from "../lib/wecomBot";
import { dispatchWecomMarkdown } from "@shared/dispatchMessage";

const fail = (err: unknown): never => {
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) });
};

/**
 * Move a parcel into a batch: the same steps the batch scanner's assignment
 * takes (packages.assignToBatch), with the old batch's count put back too.
 * Only when its account stays right (db/dispatch: batchMoveRefusal).
 */
async function moveParcelToBatch(packageId: number, batchId: number, user: { id: number; role: string }) {
  const refusal = await db.batchMoveRefusal(packageId, batchId);
  if (refusal) throw new TRPCError({ code: "BAD_REQUEST", message: refusal });
  const pkg = await db.getPackageById(packageId);
  if (!pkg) throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
  const fromBatchId = pkg.batchId ?? null;
  if (fromBatchId === batchId) return;
  // Out of any carton of the batch it leaves.
  await db.removeParcelFromCartons(packageId);
  await db.updatePackage(packageId, { batchId, status: "in_batch" });
  const to = await db.getBatchById(batchId);
  if (to) await db.updateBatch(batchId, { totalPackages: (to.totalPackages ?? 0) + 1 });
  if (fromBatchId) {
    const from = await db.getBatchById(fromBatchId);
    if (from) await db.updateBatch(fromBatchId, { totalPackages: Math.max(0, (from.totalPackages ?? 0) - 1) });
  }
  await db.createAuditLog({
    userId: user.id, userRole: user.role, action: "assign_package_to_batch", entityType: "package", entityId: packageId,
    oldValues: { batchId: fromBatchId }, newValues: { batchId, via: "dispatch_check" },
  });
  try {
    await db.chargeBatchShippingIfDue(batchId, user.id);
  } catch (e) {
    appLogger.error("[Dispatch] charge after move failed", { batchId, error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * The dispatch check in China (owner, 2026-10-24): every parcel scanned into
 * a carton before the batch leaves. See server/db/dispatch.db.ts.
 */
export const dispatchRouter = router({
  state: staffProcedure
    .input(z.object({ batchId: idSchema }))
    .query(async ({ input, ctx }) => {
      const state = await db.getDispatchState(input.batchId);
      if (!state) return null;
      return { ...state, mayFinishShort: await db.mayFinishDispatchShort({ id: ctx.user.id, role: ctx.user.role }) };
    }),

  /** The carton each parcel of these batches left China in - for the arrival check. */
  cartonsFor: staffProcedure
    .input(z.object({ batchIds: z.array(idSchema).max(50) }))
    .query(async ({ input }) => db.cartonsOfBatches(input.batchIds)),

  /** The batch whose dispatch check was finished last (the bell's link). */
  latest: staffProcedure.query(async () => ({ batchId: await db.latestDispatchedBatchId() })),
  /** The batches the page offers: only those made in China (owner, 2026-10-26). */
  batches: staffProcedure.query(async () => db.dispatchableBatches()),
  /** Every batch packed into cartons, newest first - the page's way back to them. */
  history: staffProcedure.query(async () => db.getDispatchOverview()),
  /** One batch in figures, opened from its card (owner, 2026-10-26). */
  details: staffProcedure
    .input(z.object({ batchId: idSchema }))
    .query(async ({ input }) => db.getDispatchDetails(input.batchId)),
  /** "Where is my parcel?" - a tracking or a customer's code. */
  find: staffProcedure
    .input(z.object({ query: z.string().min(3).max(100) }))
    .query(async ({ input }) => db.findInDispatch(input.query)),

  /** Whether the person is working in China - the screens open the Chinese way for them. */
  me: staffProcedure.query(async ({ ctx }) => ({ inChina: await db.worksInChina(ctx.user.id) })),

  openCarton: staffProcedure
    .input(z.object({ batchId: idSchema }))
    .mutation(async ({ input, ctx }) => db.openCarton(input.batchId, ctx.user.id).catch(fail)),

  scan: staffProcedure
    .input(z.object({ cartonId: idSchema, code: z.string().min(1).max(120) }))
    .mutation(async ({ input, ctx }) => db.scanIntoCarton(input, ctx.user.id).catch(fail)),

  /** A parcel of another batch, moved into this one and into the carton. */
  moveHere: staffProcedure
    .input(z.object({ packageId: idSchema, cartonId: idSchema }))
    .mutation(async ({ input, ctx }) => {
      const carton = await db.getDispatchCarton(input.cartonId);
      if (!carton) throw new TRPCError({ code: "NOT_FOUND", message: "Carton not found" });
      await moveParcelToBatch(input.packageId, carton.batchId, { id: ctx.user.id, role: ctx.user.role });
      const pkg = await db.getPackageById(input.packageId);
      return db.scanIntoCarton({ cartonId: input.cartonId, code: pkg?.trackingNumber || pkg?.packageCode || "" }, ctx.user.id).catch(fail);
    }),

  /** A parcel left out, sent on with another batch. */
  moveToBatch: staffProcedure
    .input(z.object({ packageId: idSchema, batchId: idSchema }))
    .mutation(async ({ input, ctx }) => {
      await moveParcelToBatch(input.packageId, input.batchId, { id: ctx.user.id, role: ctx.user.role });
      return { success: true };
    }),

  removeItem: staffProcedure
    .input(z.object({ itemId: idSchema }))
    .mutation(async ({ input }) => db.removeFromCarton(input.itemId)),

  closeCarton: staffProcedure
    .input(z.object({ cartonId: idSchema, weightKg: z.number().min(0).max(100000).nullable() }))
    .mutation(async ({ input, ctx }) => db.closeCarton(input.cartonId, input.weightKg, ctx.user.id)),

  reopenCarton: staffProcedure
    .input(z.object({ cartonId: idSchema }))
    .mutation(async ({ input }) => db.reopenCarton(input.cartonId)),

  finish: staffProcedure
    .input(z.object({ batchId: idSchema, note: z.string().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const done = await db.finishDispatch(input, { id: ctx.user.id, role: ctx.user.role }).catch(fail);
      const batch = await db.getBatchById(input.batchId);
      await db.createAuditLog({
        userId: ctx.user.id, userRole: ctx.user.role, action: "batch_dispatch_checked", entityType: "batch", entityId: input.batchId,
        newValues: { ...done, note: input.note ?? null },
      });
      // Every member of staff is told (owner, 2026-10-24); the bell carries it too.
      await notifyStaffAlert({
        action: "batch_dispatch_checked",
        category: "batches",
        severity: done.leftOut > 0 ? "warning" : "info",
        title: `باچی ${batch?.batchCode ?? input.batchId} پشکنینی ناردنی بۆ کرا`,
        content: `${done.cartons} کارتۆن، ${done.parcels} پاکێج${done.leftOut > 0 ? ` - ${done.leftOut} پاکێج نەخراونەتە ناو کارتۆن: ${input.note ?? ""}` : ""}`,
      });
      // Every customer whose goods are in the cartons, on the portal - once,
      // no arrival date (owner, 2026-10-26). Not awaited.
      void db.notifyLeftChina(input.batchId).catch(() => undefined);
      // And the WeCom group, by itself when a robot is set (owner, 2026-10-26).
      // Not awaited: the check is saved whether or not WeCom answers.
      const host = ctx.req?.get?.("host");
      const secure = host && !/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
      void sendWecomMarkdown(dispatchWecomMarkdown({
        batchCode: batch?.batchCode ?? String(input.batchId),
        cartons: done.cartons,
        parcels: done.parcels,
        leftOut: done.leftOut,
        note: input.note ?? null,
        by: ctx.user.name ?? null,
        reportUrl: host ? `${secure ? "https" : "http"}://${host}/dispatch-check/${input.batchId}/report` : null,
      }));
      return done;
    }),
});
