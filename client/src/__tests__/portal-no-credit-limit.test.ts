import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A customer is never shown their credit limit (owner, 2026-10-06: "a customer
 * who sees the limit uses it and pays late — the aim is a debt of zero").
 * The limit stays the office's: it is not sent to the portal at all, so no
 * skin can show it by accident.
 *
 * What would undo it: the summary carrying the figure again, or any portal
 * screen naming it.
 */

const SRC = __dirname;
const readRoot = (p: string) => fs.readFileSync(path.resolve(SRC, "../..", p), "utf8").replace(/\r\n/g, "\n");

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return filesUnder(full);
    return /\.(tsx|ts)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
  });
}

describe("the portal never shows a credit limit", () => {
  const screens = [...filesUnder(path.join(SRC, "pages/portal")), ...filesUnder(path.join(SRC, "components/portal"))];

  it("there are portal screens to check", () => {
    expect(screens.length).toBeGreaterThan(10);
  });

  it("no portal screen reads or names the limit", () => {
    const naming = screens.filter((f) => /creditLimit|Credit limit|سنووری قەرز|سنوری قەرز|حد الائتمان|信用额度/i.test(fs.readFileSync(f, "utf8")));
    expect(naming.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the server does not send it to the customer's summary", () => {
    const db = readRoot("server/db/portal.db.ts");
    const from = db.indexOf("export async function getCustomerFinancialSummary");
    expect(from).toBeGreaterThan(-1);
    const fn = db.slice(from, db.indexOf("\nexport ", from + 10));
    expect(fn.length).toBeGreaterThan(400);
    expect(fn).not.toContain("creditLimit");
  });
});
