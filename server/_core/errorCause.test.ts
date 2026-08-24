import { describe, expect, it } from "vitest";
import { withCause } from "./trpc";

/**
 * The reason travels with the error, and has to arrive.
 *
 * A failed database call reaches the client as a drizzle error whose message
 * is the SQL it tried to run. What MySQL objected to sits on `cause`, and
 * tRPC serializes the message and nothing else — so the expenses screen
 * showed a list of column names for three days while the sentence explaining
 * it was one property away.
 */
describe("an error arrives with its reason", () => {
  const drizzleShaped = () => {
    const cause = new Error("Unknown column 'exchangeRate' in 'field list'");
    const err = new Error(
      "Failed query: select `id`, `categoryId`, `exchangeRate` from `expenses`\nparams: ",
    );
    (err as Error & { cause?: unknown }).cause = cause;
    return err;
  };

  it("appends what the database actually said", () => {
    const out = withCause(drizzleShaped().message, drizzleShaped());
    expect(out).toContain("Failed query: select");
    expect(out, "the reason never reached the screen").toContain(
      "Unknown column 'exchangeRate' in 'field list'",
    );
  });

  it("follows a cause more than one deep", () => {
    const root = new Error("Table 'default.expenses' doesn't exist");
    const middle = new Error("driver failure") as Error & { cause?: unknown };
    middle.cause = root;
    const top = new Error("Failed query: insert into `expenses`") as Error & { cause?: unknown };
    top.cause = middle;

    const out = withCause(top.message, top);
    expect(out).toContain("driver failure");
    expect(out).toContain("Table 'default.expenses' doesn't exist");
  });

  it("does not repeat a reason the message already carries", () => {
    const err = new Error("Unknown column 'x'") as Error & { cause?: unknown };
    err.cause = new Error("Unknown column 'x'");
    expect(withCause(err.message, err)).toBe("Unknown column 'x'");
  });

  it("leaves an error with no cause exactly as it is", () => {
    expect(withCause("Not allowed", new Error("Not allowed"))).toBe("Not allowed");
    expect(withCause("Not allowed", null)).toBe("Not allowed");
  });

  it("is wired into the tRPC error formatter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.join(__dirname, "trpc.ts"), "utf8");
    expect(src, "errorFormatter is not using withCause").toMatch(
      /errorFormatter[\s\S]{0,300}withCause/,
    );
  });
});
