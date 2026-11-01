import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/** Owner, 2026-10-21: the money bell names the customer's first name beside the code. */
describe("the money bell says who, not only the code", () => {
  it("every line with a code has the first name beside it", () => {
    const bell = fs.readFileSync(path.resolve(__dirname, "components/MoneyBell.tsx"), "utf8");
    expect(bell).toContain("function firstNameOf(name: string | null | undefined): string {");
    expect(bell.split('data-testid="money-first-name"').length - 1).toBe(3);
  });
});
