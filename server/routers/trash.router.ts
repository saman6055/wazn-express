import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { staffProcedure, adminProcedure } from "../middleware/auth";
import * as db from "../db";
import { RESTORE_BLOCKED_MESSAGE, type RestoreBlockedReason } from "@shared/trash";

const idSchema = z.number().int().positive();
const entityTypeSchema = z.enum(["batch", "full_package_order"]);

/** Refuse a restore with the reason spelled out, in the reader's language. */
function blocked(reason: RestoreBlockedReason): never {
  throw new TRPCError({
    code: "CONFLICT",
    message: RESTORE_BLOCKED_MESSAGE[reason].ku,
  });
}

/**
 * The recycle bin.
 *
 * Restoring is deliberately not treated as the reverse of deleting. While a
 * record sat in the bin the world moved on: its code may have been reused,
 * it may already have been put back, the thing it belonged to may itself be
 * gone. Each of those is checked and named, because a restore that ignores
 * them produces a duplicate or a dangling reference — quietly, and much
 * later.
 */
export const trashRouter = router({
    list: staffProcedure.query(async () => {
      return db.listTrash();
    }),

    restore: staffProcedure
      .input(z.object({ entityType: entityTypeSchema, entityId: idSchema }))
      .mutation(async ({ input, ctx }) => {
        if (input.entityType === "batch") {
          const entry = await db.getDeletedRecord("batch", input.entityId);
          if (!entry) blocked("already_present");
          if (await db.batchExists(input.entityId)) blocked("already_present");

          const snapshot = entry!.snapshot as Record<string, unknown>;
          const code = String(snapshot.batchCode ?? "");
          // Somebody may have created a new batch under this code while the
          // old one was in the bin. Batch codes are unique, so putting it
          // back would fail at the database — better to say why here.
          if (code && !(await db.isBatchCodeFree(code))) blocked("label_taken");

          await db.restoreBatchFromSnapshot(snapshot);
          await db.removeDeletedRecord("batch", input.entityId);

          await db.createAuditLog({
            userId: ctx.user.id,
            userRole: ctx.user.role,
            action: "restore_batch",
            entityType: "batch",
            entityId: input.entityId,
            newValues: snapshot,
          });
          return { success: true, label: code };
        }

        const order = await db.getDeletedFullPackageOrder(input.entityId);
        if (!order) blocked("already_present");
        // An order belongs to a customer. If that customer has gone, putting
        // the order back leaves it pointing at nobody.
        if (order!.customerId) {
          const customer = await db.getCustomerById(order!.customerId);
          if (!customer) blocked("owner_missing");
        }

        await db.restoreFullPackageOrder(input.entityId);
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "restore_full_package_order",
          entityType: "full_package_order",
          entityId: input.entityId,
        });
        return { success: true, label: order!.orderCode ?? `#${input.entityId}` };
      }),

    /**
     * Remove something for good. Admin only, and there is no way back — the
     * audit entry is written first so the record of the deletion outlives
     * what it deleted.
     */
    purge: adminProcedure
      .input(z.object({ entityType: entityTypeSchema, entityId: idSchema }))
      .mutation(async ({ input, ctx }) => {
        await db.createAuditLog({
          userId: ctx.user.id,
          userRole: ctx.user.role,
          action: "purge_from_trash",
          entityType: input.entityType,
          entityId: input.entityId,
        });

        if (input.entityType === "batch") {
          const entry = await db.getDeletedRecord("batch", input.entityId);
          if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "لە سەبەتەکەدا نییە" });
          await db.removeDeletedRecord("batch", input.entityId);
          return { success: true };
        }

        const order = await db.getDeletedFullPackageOrder(input.entityId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "لە سەبەتەکەدا نییە" });
        await db.purgeFullPackageOrder(input.entityId);
        return { success: true };
      }),
});
