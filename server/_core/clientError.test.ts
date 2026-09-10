import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { clientErrorMessage, isValidationError, newErrorRef } from "./clientError";
import { INPUT_FAULT_TEXT, SERVER_FAULT_TEXT } from "@shared/errorMessages";

const SQL = "Failed query: insert into `packages` (`id`) values (?)\n\nDuplicate entry 'EB16' for key 'packageCode'";

describe("what the caller of a failed call is told", () => {
  it("a customer never sees the database's words — one sentence and a reference", () => {
    const out = clientErrorMessage({
      code: "INTERNAL_SERVER_ERROR", message: SQL, isStaff: false, lang: "ku", validation: false, ref: "7F3A9C21",
    });
    expect(out).toContain(SERVER_FAULT_TEXT.ku);
    expect(out).toContain("7F3A9C21");
    expect(out).not.toMatch(/Failed query|Duplicate entry|packages/);
  });

  it("someone not signed in is treated like a customer", () => {
    const out = clientErrorMessage({
      code: "INTERNAL_SERVER_ERROR", message: SQL, isStaff: false, lang: undefined, validation: false, ref: "AB12CD34",
    });
    expect(out).toContain(SERVER_FAULT_TEXT.ku);
  });

  it("the office keeps the whole cause, with the same reference", () => {
    // The owner's rule (diagnose before fixing): the reason must reach the screen.
    const out = clientErrorMessage({
      code: "INTERNAL_SERVER_ERROR", message: SQL, isStaff: true, lang: "ku", validation: false, ref: "7F3A9C21",
    });
    expect(out).toContain("Duplicate entry 'EB16'");
    expect(out).toContain("7F3A9C21");
  });

  it("speaks the reader's language", () => {
    for (const lang of ["ar", "en", "zh"] as const) {
      const out = clientErrorMessage({
        code: "INTERNAL_SERVER_ERROR", message: SQL, isStaff: false, lang, validation: false, ref: "X",
      });
      expect(out, lang).toContain(SERVER_FAULT_TEXT[lang]);
    }
    const unknown = clientErrorMessage({
      code: "INTERNAL_SERVER_ERROR", message: SQL, isStaff: false, lang: ["fr"], validation: false, ref: "X",
    });
    expect(unknown).toContain(SERVER_FAULT_TEXT.ku);
  });

  it("a customer's rejected form reads as a sentence, not a zod issue list", () => {
    const zod = '[{"code":"too_big","maximum":100,"path":["trackingNumber"]}]';
    expect(clientErrorMessage({ code: "BAD_REQUEST", message: zod, isStaff: false, lang: "ar", validation: true }))
      .toBe(INPUT_FAULT_TEXT.ar);
    expect(clientErrorMessage({ code: "BAD_REQUEST", message: zod, isStaff: true, lang: "ar", validation: true }))
      .toBe(zod);
  });

  it("a message written on purpose passes through untouched", () => {
    for (const code of ["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "CONFLICT", "UNAUTHORIZED", "TOO_MANY_REQUESTS"]) {
      expect(clientErrorMessage({ code, message: "ئەم کۆدە بەکارهاتووە", isStaff: false, lang: "ku", validation: false }))
        .toBe("ئەم کۆدە بەکارهاتووە");
    }
  });

  it("a validation error is recognised by its zod cause only", () => {
    expect(isValidationError("BAD_REQUEST", { name: "ZodError" })).toBe(true);
    expect(isValidationError("BAD_REQUEST", new Error("x"))).toBe(false);
    expect(isValidationError("INTERNAL_SERVER_ERROR", { name: "ZodError" })).toBe(false);
  });

  it("a reference is eight Latin characters", () => {
    expect(newErrorRef()).toMatch(/^[0-9A-F]{8}$/);
    expect(newErrorRef()).not.toBe(newErrorRef());
  });
});

describe("the wiring", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

  it("the formatter logs every server fault with its reference, and hands the reference on", () => {
    const src = read("trpc.ts");
    const start = src.indexOf("errorFormatter(");
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, start + 1600);
    expect(body).toContain("newErrorRef()");
    expect(body).toMatch(/appLogger\.error\(`\[\$\{ref\}\]/);
    expect(body).toContain("data: { ...shape.data, ref }");
    expect(body).toContain("ctx.user.isCustomer");
  });

  it("the public health check does not repeat the driver's error", () => {
    const src = read("health.ts");
    expect(src).not.toMatch(/error:\s*message/);
    expect(src).toContain('appLogger.error("Database ping failed"');
  });
});
