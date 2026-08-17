import { z } from "zod";
import { router } from "../_core/trpc";
import { auditorProcedure } from "../middleware/auth";
import { CHECKS, headline, rankResults, summarise } from "@shared/auditSweep";
import { movementsSince, runSweep } from "../services/auditSweep.service";

/**
 * One call that reads the whole system.
 *
 * Opening sixty screens to find out whether anything is wrong is not an audit
 * — it is a tour, and whoever takes it will visit six pages and assume the
 * rest. Worse, the findings that matter most are on no page at all: a balance
 * that disagrees with its own history renders as a perfectly ordinary number.
 *
 * So the checks run server-side and come back as one answer, worst first,
 * each carrying enough rows to go and look. Every procedure here is a query
 * on auditorProcedure — the read-only account reaches them, and the blanket
 * mutation refusal in _core/trpc.ts guarantees they can never become
 * anything else.
 */
export const auditRouter = router({
  /**
   * What every check is and what it means. Static, so a report can name a
   * finding properly without the caller inventing wording of its own.
   */
  catalogue: auditorProcedure.query(() => CHECKS),

  /**
   * Run everything. This is the daily call.
   *
   * The summary and the headline are computed here rather than left to the
   * reader, because the one judgement that must not be improvised is whether
   * the sweep is entitled to say "nothing to report" — and it is not, if any
   * check failed to run.
   */
  sweep: auditorProcedure.query(async () => {
    const results = rankResults(await runSweep());
    const summary = summarise(results);

    return {
      ranAt: new Date(),
      results,
      summary,
      headline: headline(summary),
    };
  }),

  /**
   * Everything that changed since a moment, newest first.
   *
   * The audit log is the only record of who moved a figure and when, which
   * makes "what happened since yesterday" one query instead of a diff of the
   * whole database. Default is the last 24 hours; the cap is there because
   * the honest unbounded answer on a busy day is the entire table.
   */
  movements: auditorProcedure
    .input(
      z.object({
        since: z.date().optional(),
        limit: z.number().min(1).max(2000).default(500),
      }),
    )
    .query(async ({ input }) => {
      const since = input.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      const movements = await movementsSince(since, input.limit);

      return {
        since,
        // Said plainly so a caller that hit the ceiling knows it saw a
        // window rather than the period it asked for.
        truncated: movements.length >= input.limit,
        movements,
      };
    }),
});
