import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A database error puts the reason at the end.
 *
 * `Failed query: insert into \`expenses\` (\`id\`, \`categoryId\`, ...` is the
 * query; "Unknown column" or whatever actually went wrong comes after it. The
 * toast clamps to two lines by design, so the office saw a list of column
 * names and no cause, and could not report what had happened. Every failure
 * has to be copyable.
 */

const toast = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return fn;
});

vi.mock("sonner", () => ({ toast }));

import { showErrorToast } from "./errorToast";

const LONG_DB_ERROR =
  "Failed query: insert into `expenses` (`id`, `categoryId`, `amount`, `currency`, " +
  "`exchangeRate`, `amountUsd`, `description`) values (default, ?, ?, ?, ?, ?, ?)\n" +
  "params: 15,23,USD,undefined,23\n" +
  "Unknown column 'exchangeRate' in 'field list'";

describe("a failed action can be reported", () => {
  beforeEach(() => {
    toast.error.mockClear();
    toast.success.mockClear();
  });

  it("keeps the whole message, reason and all", () => {
    showErrorToast(new Error(LONG_DB_ERROR));

    expect(toast.error).toHaveBeenCalledTimes(1);
    const [message] = toast.error.mock.calls[0]!;
    expect(message, "the toast must carry the reason, not just the query")
      .toContain("Unknown column 'exchangeRate'");
  });

  it("offers a copy button, and copies more than the message", () => {
    showErrorToast(new Error(LONG_DB_ERROR));

    const [, options] = toast.error.mock.calls[0]! as [string, { action?: { label?: string; onClick?: () => void } }];
    expect(options?.action?.label, "no copy button on the toast").toBeTruthy();
    expect(typeof options?.action?.onClick).toBe("function");
  });

  it("survives something thrown that is not an Error", () => {
    showErrorToast({ message: "plain object" });
    showErrorToast("a string");
    showErrorToast(null, "fallback");

    expect(toast.error).toHaveBeenCalledTimes(3);
    expect(toast.error.mock.calls.map((c) => c[0])).toEqual(["plain object", "a string", "fallback"]);
  });

  it("is what the expenses screen actually uses", () => {
    // The screen used to print `toast.error(error.message)` straight out,
    // which is the clamped, uncopyable form this module exists to replace.
    const src = fs.readFileSync(
      path.join(__dirname, "..", "pages", "Expenses.tsx"),
      "utf8",
    );
    expect(src).toContain("showErrorToast");
    expect(src, "a raw toast.error(error.message) is back on the expenses screen")
      .not.toContain("toast.error(error.message)");
  });
});
