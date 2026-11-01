import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A ledger row's sign is the side it moved the balance — never the first word
 * of its type.
 *
 * ADJUSTMENT_DEBIT raises what a customer owes (a payment undone, a box
 * receipt reversed, a price raised) and starts with neither DEBIT nor CREDIT.
 * Every screen that asked `startsWith('DEBIT')` drew it as money taken off:
 * a green "−$22.24" on the staff profile beside a balance that had just gone
 * up by $22.24, and in the printout, the spreadsheet, the accounting ledger,
 * the transaction dialog and the customer tab the same way (owner's audit,
 * 2026-09-16). The two lists in shared/ledgerTypes.ts answer it for every
 * one of the fourteen types; this walks the client so no screen asks the
 * prefix again.
 */
const ROOT = path.join(__dirname);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("ledger rows are signed by the side they moved the balance", () => {
  const files = sourceFiles(ROOT);

  it("finds the client at all", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("no screen reads the sign from the start of the type's name", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("*") || code.startsWith("//")) return; // comments may quote the old way
        if (/startsWith\(\s*['"`](DEBIT|CREDIT)/.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders, "use isChargeTx / isPaymentTx from @shared/ledgerTypes").toEqual([]);
  });

  it("the portal's order cards count a correction against its order", () => {
    const cards = fs.readFileSync(path.join(ROOT, "components/portal/OrderBillingGroups.tsx"), "utf8");
    expect(cards).toContain("const effect = chargeEffect(tx);");
    expect(cards).toContain("fmtUsd(chargeEffect(line) * (Number(line.amountUsd) || 0))");
  });
});
