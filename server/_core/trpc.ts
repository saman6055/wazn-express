import { UNAUTHED_ERR_MSG } from '@shared/const';
import { mayPerform, READ_ONLY_REFUSAL } from '@shared/readOnlyRole';
import { viewAsMayPerform, VIEW_AS_REFUSAL } from '@shared/viewAsCustomer';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { LANG_HEADER } from "@shared/errorMessages";
import { appLogger } from "../utils/logger";
import { clientErrorMessage, isValidationError, newErrorRef } from "./clientError";
import type { TrpcContext } from "./context";
import { STAFF_DOOR_MESSAGES, type SuspiciousKind } from "@shared/securityWatch";
import { noteSuspicious } from "../lib/securityWatch";
import { dropFreshFigures } from "../db/cache";

/**
 * The reason an error happened travels with it. It has to arrive.
 *
 * A failed database call reaches here as a drizzle error whose message is the
 * SQL it tried to run — `Failed query: select \`id\`, \`categoryId\`, ...` —
 * while what MySQL actually objected to ("Unknown column", "Table doesn't
 * exist", "Field has no default value") sits on `cause`. tRPC serializes the
 * message and nothing else, so the screen showed a list of column names and
 * the office had no way to learn, or report, what was wrong. Three deploys
 * were spent guessing at a sentence that existed the whole time.
 *
 * Walks the chain, because drizzle wraps mysql2 and something may yet wrap
 * drizzle. Deduplicated, so an error that already carries its cause in the
 * message does not say it twice.
 */
function causeChain(error: unknown, depth = 0): string[] {
  if (!error || depth > 4) return [];
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { message?: string }).message ?? "");
  const cause = (error as { cause?: unknown }).cause;
  return [message, ...causeChain(cause, depth + 1)].filter(Boolean);
}

export function withCause(message: string, error: unknown): string {
  const reasons = causeChain(error)
    .slice(1)
    .filter((reason) => !message.includes(reason));
  return reasons.length ? `${message}\n\n${reasons.join("\n")}` : message;
}

/**
 * A server fault gets a reference, one log line with the whole cause under
 * that reference, and — for anyone who is not staff — a plain sentence in the
 * reader's language instead of the cause. See clientError.ts.
 */
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx, path }) {
    const message = withCause(shape.message, error.cause ?? error);
    const isStaff = Boolean(ctx?.user && !ctx.user.isCustomer);
    const validation = isValidationError(error.code, error.cause);
    const lang = ctx?.req?.headers?.[LANG_HEADER];
    watchCustomerSession(ctx, error, path, validation);

    if (error.code !== "INTERNAL_SERVER_ERROR") {
      return {
        ...shape,
        message: clientErrorMessage({ code: error.code, message, isStaff, lang, validation }),
      };
    }

    const ref = newErrorRef();
    appLogger.error(`[${ref}] ${path ?? "unknown"} failed: ${message}`, {
      ref,
      path,
      userId: ctx?.user?.id,
      role: ctx?.user?.role,
    });
    return {
      ...shape,
      message: clientErrorMessage({ code: error.code, message, isStaff, lang, validation, ref }),
      data: { ...shape.data, ref },
    };
  },
});

/**
 * A customer's session doing what the portal never does is noted here - the
 * one place every refusal passes (shared/securityWatch). An admin looking at a
 * customer's portal is never counted.
 */
function watchCustomerSession(
  ctx: TrpcContext | undefined,
  error: { code: string; message: string },
  path: string | undefined,
  validation: boolean,
): void {
  const user = ctx?.user;
  if (!user?.isCustomer || ctx?.viewAs) return;
  let kind: SuspiciousKind | null = null;
  if (error.code === "FORBIDDEN" && STAFF_DOOR_MESSAGES.has(error.message)) kind = "staff_door";
  else if (error.code === "NOT_FOUND" && error.message.startsWith("No procedure found on path")) kind = "unknown_procedure";
  else if (validation) kind = "malformed_input";
  if (kind) noteSuspicious(user.id, kind, path ?? "?", ctx?.req as { ip?: string; headers?: Record<string, unknown> });
}

export const router = t.router;

/**
 * Any save that succeeds drops the remembered finance figures
 * (server/db/cache.ts, freshGetOrSet): a payment, a box, an order, an expense,
 * a switch on an account — whatever it touched, the next card worked out
 * after it reads the records again. Every procedure is built on this one, so
 * a mutation written next year is covered before it is written.
 */
const dropFreshAfterSave = t.middleware(async ({ type, next }) => {
  const result = await next();
  if (type === "mutation" && result.ok) dropFreshFigures();
  return result;
});

export const publicProcedure = t.procedure.use(dropFreshAfterSave);

const requireUser = t.middleware(async opts => {
  const { ctx, next, type, path } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  /**
   * The read-only account stops here, and only here.
   *
   * `type` is "query" or "mutation" — tRPC has already decided which, for
   * every call, without anyone declaring it a second time. That is what makes
   * this one line instead of two hundred and seventy-nine, and what makes a
   * router written next year covered by it before it is written.
   *
   * The alternative — an allowlist of blocked endpoints — was the reason for
   * doing it this way. The first mutation somebody forgets to add would be the
   * one that lets an auditor delete a batch, and nothing would report it.
   */
  if (!mayPerform(ctx.user.role, type)) {
    throw new TRPCError({ code: "FORBIDDEN", message: READ_ONLY_REFUSAL });
  }

  /*
   * And the same question for an admin looking at a customer's portal.
   *
   * It rides on the auditor's rule rather than beside it: one place where
   * "is this a write?" is asked, so a look-only session cannot leave a
   * declaration, a claim or a rating on a real customer's account, and a
   * router written next year is covered before it is written
   * (shared/viewAsCustomer).
   */
  if (!viewAsMayPerform(!!ctx.viewAs, type, path)) {
    throw new TRPCError({ code: "FORBIDDEN", message: VIEW_AS_REFUSAL });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireUser);

/**
 * The admin procedures live in server/middleware/auth.ts.
 *
 * There used to be a second `adminProcedure` here, built on `t.procedure`
 * rather than on `protectedProcedure`. It behaved identically, so nothing ever
 * looked wrong — but it skipped `requireUser`, which means it would have
 * skipped the check above too, and the three system-settings mutations that
 * used it would have stayed open to a read-only account. One door, checked
 * once, is the only arrangement that can be reasoned about.
 */
