import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withFix } from "@shared/fixAdvice";
import { STAFF_ATTACHMENT_MAX_BYTES, staffAttachmentAllowed } from "@shared/staffChatAttachment";
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
/** Keep the file where the system keeps every upload: object storage, else the uploads folder. */
async function storeStaffAttachment(name: string, type: string, base64: string): Promise<db.StaffAttachment> {
  if (!staffAttachmentAllowed(type, name)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: withFix("ئەم جۆرە فایلە نانێردرێت.", [
        "وێنە (PNG / JPG)، PDF، Word، Excel یان ZIP بنێرە",
        "ئەگەر پێویستە، فایلەکە بکە بە PDF یان ZIP پاشان بینێرەوە",
      ]),
    });
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: withFix("فایلەکە بەتاڵە.", ["فایلەکە دووبارە هەڵبژێرە"]) });
  }
  if (buffer.length > STAFF_ATTACHMENT_MAX_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: withFix("فایلەکە لە 10 MB گەورەترە.", [
        "وێنەکە بچووکتر بکەرەوە یان تەنها بەشێکی شاشەکە بگرە (Win+Shift+S)",
        "فایلی گەورە بکە بە ZIP",
      ]),
    });
  }
  const { nanoid } = await import("nanoid");
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const { ENV } = await import("../_core/env");
  const hasForge = Boolean(ENV.forgeApiUrl?.trim() && ENV.forgeApiKey?.trim());
  if (hasForge) {
    const { storagePut } = await import("../services/storage.service");
    const { url } = await storagePut(`staff-chat/${nanoid(16)}.${ext}`, buffer, type || "application/octet-stream");
    return { url, name, type };
  }
  const { localUpload } = await import("../services/localUpload");
  const { url } = localUpload(`file.${ext}`, buffer, type);
  return { url, name, type };
}

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
      // Empty is allowed when a file goes with it: a screenshot is a message.
      text: z.string().trim().max(2000).default(""),
      attachment: z.object({
        name: z.string().trim().min(1).max(255),
        type: z.string().trim().max(100),
        /** The file, base64 without the data: prefix. */
        base64: z.string().min(1),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const stored = input.attachment
        ? await storeStaffAttachment(input.attachment.name, input.attachment.type, input.attachment.base64)
        : null;
      return db.sendStaffMessage(ctx.user.id, input.toId, input.text, stored);
    }),

  /**
   * Take a message out of the conversation — for both people, at once.
   *
   * Which messages may go, and what is left behind, is decided in the db
   * layer with the rest of the pair's rules (server/db/staffChat.db).
   */
  remove: staffProcedure
    .input(z.object({ messageId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return db.deleteStaffMessage(ctx.user.id, input.messageId);
    }),

  /** The same, for everything in one conversation. */
  clearWith: staffProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return db.clearStaffConversation(ctx.user.id, input.userId);
    }),

  /** Opening a conversation is reading it. */
  markRead: staffProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      return db.markStaffMessagesRead(ctx.user.id, input.userId);
    }),
});
