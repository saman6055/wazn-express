import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { adminProcedure } from "../middleware/auth";
import * as db from "../db";

/**
 * Portal tutorials — the "how do I…" videos customers see, managed from
 * Portal Center.
 *
 * Reads are `protectedProcedure` because customers need them; writes are
 * admin-only, matching how the rest of the portal's content is curated.
 */

// A YouTube link, checked loosely: the id extractor is the real gate, and
// rejecting anything it can't read gives a clear error at save time rather
// than a broken card later.
const videoUrlSchema = z.string().min(5).max(500).refine(
  (u) => db.youTubeVideoId(u) !== null,
  { message: "لینکی یوتوب نادروستە | Not a valid YouTube link" },
);

const tutorialInput = {
  category: z.string().min(1).max(100),
  titleKu: z.string().min(1).max(300),
  titleEn: z.string().max(300).optional(),
  titleAr: z.string().max(300).optional(),
  summaryKu: z.string().max(2000).optional(),
  summaryEn: z.string().max(2000).optional(),
  summaryAr: z.string().max(2000).optional(),
  videoUrl: videoUrlSchema,
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
};

export const tutorialsRouter = router({
  /** Published tutorials — what the customer portal renders. */
  list: protectedProcedure
    .input(z.object({ category: z.string().max(100).optional() }).optional())
    .query(async ({ input }) => {
      return db.getPublishedTutorials(input?.category);
    }),

  /** Section names that actually have published videos. */
  categories: protectedProcedure.query(async () => {
    return db.getTutorialCategories(true);
  }),

  /** Everything including drafts — the Portal Center table. */
  listAll: adminProcedure.query(async () => {
    return db.getAllTutorials();
  }),

  create: adminProcedure
    .input(z.object(tutorialInput))
    .mutation(async ({ input, ctx }) => {
      const created = await db.createTutorial({ ...input, createdById: ctx.user.id });
      if (!created) throw new Error("نەتوانرا دروست بکرێت | Could not create");
      return created;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      category: z.string().min(1).max(100).optional(),
      titleKu: z.string().min(1).max(300).optional(),
      titleEn: z.string().max(300).optional(),
      titleAr: z.string().max(300).optional(),
      summaryKu: z.string().max(2000).optional(),
      summaryEn: z.string().max(2000).optional(),
      summaryAr: z.string().max(2000).optional(),
      videoUrl: videoUrlSchema.optional(),
      durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
      sortOrder: z.number().int().optional(),
      isPublished: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTutorial(id, data as any);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await db.deleteTutorial(input.id);
      return { success: true };
    }),

  /**
   * Watch / helpfulness counters. Best-effort and fire-and-forget from the
   * portal: a failed count must never interrupt someone watching a video.
   */
  recordEvent: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      event: z.enum(["view", "completed", "helpful", "notHelpful"]),
    }))
    .mutation(async ({ input }) => {
      await db.recordTutorialEvent(input.id, input.event);
      return { success: true };
    }),
});
