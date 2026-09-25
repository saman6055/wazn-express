import { z } from "zod";
import { router } from "../_core/trpc";
import { staffProcedure } from "../middleware/auth";
import * as db from "../db";
import { TASK_ABOUT_TYPES } from "@shared/tasks";

/**
 * Tasks — the one thing in this system a person closes rather than a query.
 *
 * Every read and write goes through the db layer's visibility clause
 * (server/db/tasks.db.ts): a task belongs to whoever wrote it and whoever it
 * is for, and to nobody else. The owner's rule, 2026-09-25 — his own personal
 * reminders are his.
 */
export const tasksRouter = router({
  /** What is waiting for me, and what I sent somebody. */
  mine: staffProcedure.query(async ({ ctx }) => {
    return db.tasksFor(ctx.user.id);
  }),

  /** Just the number, for the icon in the top bar. */
  count: staffProcedure.query(async ({ ctx }) => {
    return { awake: await db.awakeTaskCount(ctx.user.id) };
  }),

  /** The colleagues a task can be handed to. */
  staff: staffProcedure.query(async () => {
    return db.assignableStaff();
  }),

  create: staffProcedure
    .input(z.object({
      text: z.string().trim().min(1).max(1000),
      /** Absent means "for myself". */
      assignedToId: z.number().nullable().optional(),
      aboutType: z.enum(TASK_ABOUT_TYPES).optional(),
      aboutId: z.number().nullable().optional(),
      aboutLabel: z.string().max(255).nullable().optional(),
      aboutHref: z.string().max(500).nullable().optional(),
      dueAt: z.date().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createTask(input, ctx.user.id);
    }),

  setDone: staffProcedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      return db.setTaskDone(input.id, input.done, ctx.user.id);
    }),

  snooze: staffProcedure
    .input(z.object({ id: z.number(), until: z.date() }))
    .mutation(async ({ input, ctx }) => {
      return db.snoozeTask(input.id, input.until, ctx.user.id);
    }),
});
