import { randomBytes } from "node:crypto";
import {
  errorLang,
  INPUT_FAULT_TEXT,
  refLabel,
  SERVER_FAULT_TEXT,
} from "@shared/errorMessages";

/**
 * What the caller of a failed API call is told.
 *
 * The office keeps the database's own words — it needs the cause to fix
 * anything (see withCause) — plus a reference. A customer gets one sentence in
 * their language and the same reference, never our SQL, table names or a
 * stack. The full text is in the server log under that reference.
 */

/** Eight hex characters, e.g. 7F3A9C21 — Latin letters and digits only. */
export function newErrorRef(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

/** A request that failed input validation (zod), before any handler ran. */
export function isValidationError(code: string, cause: unknown): boolean {
  return code === "BAD_REQUEST" && (cause as { name?: string } | null | undefined)?.name === "ZodError";
}

export function clientErrorMessage(o: {
  code: string;
  /** The full text, cause included. */
  message: string;
  isStaff: boolean;
  /** The reader's language, from the request header. */
  lang: unknown;
  validation: boolean;
  ref?: string;
}): string {
  if (o.code === "INTERNAL_SERVER_ERROR") {
    const ref = refLabel(o.ref ?? "");
    return o.isStaff ? `${o.message}\n\n${ref}` : `${SERVER_FAULT_TEXT[errorLang(o.lang)]} (${ref})`;
  }
  // zod's own text is a JSON list of issues — useful to the office, noise to a customer.
  if (o.validation && !o.isStaff) return INPUT_FAULT_TEXT[errorLang(o.lang)];
  return o.message;
}
