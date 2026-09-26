import { z } from "zod";
import { router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
import * as db from "../db";

/**
 * The office talking to itself.
 *
 * The owner, 2026-09-26: «گرنگە پەیام ناردن هەبێ لە نێوان ئادمینەکان، چات
 * کردن هەبێ وەکو مەسنجەر، کە چاتی نوێ هات دەنگی بێت وەکو نۆتفکەیشن.»
 *
 * Every read is bounded by the pair in the db layer (server/db/staffChat.db),
 * never here: a conversation belongs to the two people in it.
 */
export const staffChatRouter = router({
  /** Everybody to write to, the last thing said, and what is unread. */
  inbox: staffProcedure.query(async ({ ctx }) => {
    return db.staffInbox(ctx.user.id);
  }),

  /** Just the number, for the badge on the bubble. */
  unread: staffProcedure.query(async ({ ctx }) => {
    return { count: await db.staffUnreadCount(ctx.user.id) };
  }),

  /** One conversation, oldest first. */
  with: staffProcedure
    .input(z.object({ userId: z.number().int().positive(), limit: z.number().int().min(1).max(200).optional() }))
    .query(async ({ input, ctx }) => {
      return db.staffConversation(ctx.user.id, input.userId, input.limit ?? 80);
    }),

  send: staffProcedure
    .input(z.object({
      toId: z.number().int().positive(),
      text: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.sendStaffMessage(ctx.user.id, input.toId, input.text);
    }),

  /** Opening a conversation is reading it. */
  markRead: staffProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return db.markStaffMessagesRead(ctx.user.id, input.userId);
    }),
});
