import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { desc, isNotNull } from "drizzle-orm";
import { router } from "../_core/trpc";
import { superAdminProcedure } from "../middleware/auth";
import * as db from "../db";
import { customers } from "../../drizzle/schema";
import { withFix } from "@shared/fixAdvice";
import {
  acceptPrint,
  approveDevice,
  describeAgent,
  recordDetails,
  pendingLive,
  removeDevice,
  type OfficeDevices,
} from "@shared/officeDevices";
import type { SecurityHoldReport } from "@shared/securityWatch";
import { cleanTraits, describeTraits, plateOf } from "@shared/devicePlate";
import { printFrom } from "../lib/officeDeviceStep";
import {
  deviceIdFrom,
  ensureDeviceMark,
  loadOfficeDevices,
  officeDevicesKillSwitch,
  saveOfficeDevices,
  updateOfficeDevices,
} from "../lib/officeDevicesStore";
import { clearCustomerHold } from "../lib/securityWatch";

const deviceIdSchema = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * The main admin's own page: which devices open the office system, and which
 * customers were held for what their sessions did (owner, 2026-11-05).
 * Nobody else reaches any of it.
 */
export const officeSecurityRouter = router({
  overview: superAdminProcedure.query(async ({ ctx }) => {
    const state = await loadOfficeDevices();
    const now = new Date();
    const thisDevice = deviceIdFrom(ctx.req);
    const database = await db.getDb();
    const held = database
      ? await database
          .select({
            id: customers.id,
            customerCode: customers.customerCode,
            fullName: customers.fullName,
            mobileNumber: customers.mobileNumber,
            securityBlockedAt: customers.securityBlockedAt,
            securityBlockReport: customers.securityBlockReport,
          })
          .from(customers)
          .where(isNotNull(customers.securityBlockedAt))
          .orderBy(desc(customers.securityBlockedAt))
          .limit(100)
      : [];
    const approvedIds = new Set(state.approved.map((d) => d.id));
    const seenOf = (id: string) => state.seen.find((s) => s.id === id);
    const card = (d: { id: string; agent?: string; ip?: string; traits?: import("@shared/devicePlate").DeviceTraits; mismatch?: import("@shared/officeDevices").PrintMismatch }) => ({
      plate: plateOf(d.id),
      details: describeTraits(d.traits ?? seenOf(d.id)?.traits),
      ip: d.ip ?? seenOf(d.id)?.ip ?? null,
      firstSeenAt: seenOf(d.id)?.firstSeenAt ?? null,
      mismatch: d.mismatch ?? seenOf(d.id)?.mismatch ?? null,
      mismatchKind: (d.mismatch ?? seenOf(d.id)?.mismatch) ? describeAgent((d.mismatch ?? seenOf(d.id)?.mismatch)!.agent) : null,
    });
    return {
      enforced: state.enforced,
      enforcedAt: state.enforcedAt ?? null,
      killSwitch: officeDevicesKillSwitch(),
      thisDevice,
      thisDeviceApproved: !!thisDevice && approvedIds.has(thisDevice),
      approved: state.approved.map((d) => ({ ...d, ...card(d), kind: describeAgent(d.agent ?? ""), isThis: d.id === thisDevice })),
      waiting: state.seen
        .filter((d) => pendingLive(d, now) && !approvedIds.has(d.id))
        .map((d) => ({ ...d, ...card(d), kind: describeAgent(d.agent) })),
      seen: state.seen
        .filter((d) => !approvedIds.has(d.id) && !pendingLive(d, now))
        .slice(0, 20)
        .map((d) => ({ ...d, ...card(d), kind: describeAgent(d.agent), isThis: d.id === thisDevice })),
      held: held.map((h) => {
        let report: SecurityHoldReport | null = null;
        try {
          report = h.securityBlockReport ? (JSON.parse(h.securityBlockReport) as SecurityHoldReport) : null;
        } catch {
          report = null;
        }
        return { id: h.id, customerCode: h.customerCode, fullName: h.fullName, mobileNumber: h.mobileNumber, at: h.securityBlockedAt, report };
      }),
    };
  }),

  /**
   * Switch the rule on or off. Switching it on approves the device it is done
   * from, in the same write - the owner can never lock himself out this way.
   */
  setEnforced: superAdminProcedure
    .input(z.object({ on: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      let state: OfficeDevices = await loadOfficeDevices();
      if (input.on) {
        const id = ensureDeviceMark(ctx.req, ctx.res);
        if (!state.approved.some((d) => d.id === id)) {
          state = approveDevice(state, id, `${ctx.user.name ?? "ئادمینی سەرەکی"} — ئەم ئامێرە`, ctx.user.id, new Date());
          state = {
            ...state,
            approved: state.approved.map((d) => (d.id === id ? { ...d, agent: String(ctx.req.headers["user-agent"] ?? "").slice(0, 300) } : d)),
          };
        }
      }
      // The moment it goes on: every session signed in before it stays open.
      const enforcedAt = input.on ? (state.enforced && state.enforcedAt ? state.enforcedAt : new Date().toISOString()) : undefined;
      state = { ...state, enforced: input.on, enforcedAt };
      await saveOfficeDevices(state, ctx.user.id);
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: input.on ? "office_devices_on" : "office_devices_off", entityType: "setting" });
      return { enforced: state.enforced };
    }),

  /**
   * Name the device the main admin is on now, whether the rule is on or off.
   * A device signed in before the guard existed has no mark and is in no list;
   * this gives it one and approves it in the same write.
   */
  approveThisDevice: superAdminProcedure
    .input(z.object({ label: z.string().trim().min(1).max(80), device: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = ensureDeviceMark(ctx.req, ctx.res);
      let state: OfficeDevices = approveDevice(await loadOfficeDevices(), id, input.label, ctx.user.id, new Date());
      state = recordDetails(state, id, { traits: cleanTraits(input.device), print: printFrom(ctx.req), ip: String(ctx.req.ip ?? "") });
      state = {
        ...state,
        approved: state.approved.map((d) => (d.id === id ? { ...d, agent: String(ctx.req.headers["user-agent"] ?? "").slice(0, 300) } : d)),
      };
      await saveOfficeDevices(state, ctx.user.id);
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: "office_device_approved", entityType: "setting", newValues: { label: input.label, thisDevice: true } });
      return { approved: true };
    }),

  approve: superAdminProcedure
    .input(z.object({ id: deviceIdSchema, label: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadOfficeDevices();
      if (!state.seen.some((d) => d.id === input.id) && !state.approved.some((d) => d.id === input.id)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: withFix("ئەم ئامێرە لە لیستەکەدا نەماوە.", ["لاپەڕەکە نوێ بکەرەوە", "با کەسەکە دووبارە هەوڵی چوونەژوورەوە بداتەوە"]),
        });
      }
      await saveOfficeDevices(approveDevice(state, input.id, input.label, ctx.user.id, new Date()), ctx.user.id);
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: "office_device_approved", entityType: "setting", newValues: { label: input.label } });
      return { approved: true };
    }),

  /**
   * "That is the same device": its mark came from a machine whose print the
   * page had not seen - a new graphics driver, a repaired laptop. The new
   * print is kept and the warning goes.
   */
  acceptPrint: superAdminProcedure
    .input(z.object({ id: deviceIdSchema }))
    .mutation(async ({ ctx, input }) => {
      await updateOfficeDevices((s) => acceptPrint(s, input.id), ctx.user.id);
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: "office_device_print_accepted", entityType: "setting" });
      return { accepted: true };
    }),

  /** Say no to a waiting device: its request goes; it can ask again. */
  refuse: superAdminProcedure
    .input(z.object({ id: deviceIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadOfficeDevices();
      await saveOfficeDevices(
        { ...state, seen: state.seen.map((d) => (d.id === input.id ? { ...d, code: undefined, requestedAt: undefined } : d)) },
        ctx.user.id,
      );
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: "office_device_refused", entityType: "setting" });
      return { refused: true };
    }),

  remove: superAdminProcedure
    .input(z.object({ id: deviceIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const state = await loadOfficeDevices();
      if (state.enforced && input.id === deviceIdFrom(ctx.req)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: withFix("ئەمە ئەو ئامێرەیە کە ئێستا لەسەری کار دەکەیت — لابردنی دەتکاتە دەرەوە.", [
            "لە ئامێرێکی تری ناسراوەوە لای ببە",
            "یان سەرەتا ڕێساکە بکوژێنەوە",
          ]),
        });
      }
      await saveOfficeDevices(removeDevice(state, input.id), ctx.user.id);
      await db.createAuditLog({ userId: ctx.user.id, userRole: ctx.user.role, action: "office_device_removed", entityType: "setting" });
      return { removed: true };
    }),

  /** Lift a customer's security hold, after asking them. */
  clearHold: superAdminProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await clearCustomerHold(input.customerId, { id: ctx.user.id, role: ctx.user.role });
      return { cleared: true };
    }),
});
