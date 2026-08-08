import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  INVOICE_STATE_PRINT,
  invoiceState,
  isCreditTx,
  LEDGER_TYPE_LABEL,
  isDebt,
  isInvoiceOutstanding,
  formatIqdAmount,
} from "./portalMoney";

/**
 * The portal tells a customer what they owe. Getting it backwards costs more
 * than a bug report: it either chases someone who is paid up, or tells someone
 * who owes money that they are clear.
 *
 * Each case below is a mistake that was live on a real screen.
 */

describe("who owes whom", () => {
  it("treats a positive balance as money the customer owes", () => {
    // finance.db subtracts a payment from the balance, and the debtors report
    // counts `> 0`. The modern and skin3 home screens had this inverted, so
    // the debt badge appeared for customers in credit and hid from debtors.
    expect(isDebt(320)).toBe(true);
    expect(isDebt(-50)).toBe(false);
    expect(isDebt(0)).toBe(false);
    expect(isDebt(null)).toBe(false);
    expect(isDebt(undefined)).toBe(false);
  });
});

describe("money in versus money out", () => {
  it("recognises both spellings of a credit", () => {
    // The enum has two shapes. Testing only the first meant a manual credit
    // adjustment was shown to the customer as another charge — on the classic
    // page too, which everyone believed was correct.
    expect(isCreditTx("CREDIT_PAYMENT")).toBe(true);
    expect(isCreditTx("CREDIT_REFUND")).toBe(true);
    expect(isCreditTx("ADJUSTMENT_CREDIT")).toBe(true);
  });

  it("treats every charge as a charge", () => {
    expect(isCreditTx("DEBIT_PACKAGE")).toBe(false);
    expect(isCreditTx("DEBIT_COMMISSION")).toBe(false);
    expect(isCreditTx("ADJUSTMENT_DEBIT")).toBe(false);
  });

  it("does not answer to values the database never produces", () => {
    // Both new skins filtered on these, so their credit/debit tabs were
    // permanently empty and every payment rendered red.
    expect(isCreditTx("payment")).toBe(false);
    expect(isCreditTx("credit")).toBe(false);
    expect(isCreditTx(null)).toBe(false);
  });
});

describe("whether an invoice is settled", () => {
  it("only calls it paid when it is paid", () => {
    expect(invoiceState("paid")).toBe("paid");
    expect(invoiceState("draft")).toBe("unpaid");
    expect(invoiceState("issued")).toBe("unpaid");
    expect(invoiceState("partially_paid")).toBe("partial");
    expect(invoiceState("cancelled")).toBe("cancelled");
    expect(invoiceState("refunded")).toBe("refunded");
  });

  it("assumes unpaid for anything it does not recognise", () => {
    // A future status must never default to telling a customer they are clear.
    expect(invoiceState("some_new_status")).toBe("unpaid");
    expect(invoiceState(null)).toBe("unpaid");
  });

  it("never prints PAID across an unpaid invoice", () => {
    // The document a customer downloads and keeps. It branched on `cancelled`
    // alone, so a draft, issued or half-paid invoice printed PAID — every
    // reason to stop paying, in writing, on company letterhead.
    for (const status of ["draft", "issued", "partially_paid", "refunded"]) {
      expect(INVOICE_STATE_PRINT[invoiceState(status)]).not.toBe("PAID");
    }
    expect(INVOICE_STATE_PRINT[invoiceState("paid")]).toBe("PAID");
  });

  it("counts a half-paid invoice as still owing", () => {
    expect(isInvoiceOutstanding("issued")).toBe(true);
    expect(isInvoiceOutstanding("partially_paid")).toBe(true);
    expect(isInvoiceOutstanding("paid")).toBe(false);
    expect(isInvoiceOutstanding("cancelled")).toBe(false);
  });
});

describe("every ledger line has a name the customer can read", () => {
  // The map knew five of fourteen. The rest printed the raw column —
  // "DEBIT FULL PACKAGE", "ADJUSTMENT CREDIT" — in Latin capitals, in the
  // middle of an Arabic statement about the customer's own money.
  const SCHEMA = path.resolve(__dirname, "../../../drizzle/schema/finance.schema.ts");

  it("covers every value the database can store", () => {
    const src = fs.readFileSync(SCHEMA, "utf8");
    const block = src.slice(src.indexOf('mysqlEnum("transactionType"'));
    const values = [...block.slice(0, block.indexOf("])")).matchAll(/"([A-Z_]+)"/g)]
      .map((m) => m[1])
      .filter((v) => v !== "transactionType");

    expect(values.length, "the enum should have been found").toBeGreaterThan(5);

    const missing = values.filter((v) => !LEDGER_TYPE_LABEL[v]);
    expect(missing, `add these to LEDGER_TYPE_LABEL:\n${missing.join("\n")}`).toEqual([]);
  });

  it("names them in all four languages", () => {
    for (const [type, label] of Object.entries(LEDGER_TYPE_LABEL)) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(label[lang], `${type} is missing ${lang}`).toBeTruthy();
      }
    }
  });
});

describe("one copy of the rules", () => {
  // Six screens asked these questions and answered them privately. The three
  // skins disagreed with each other about the same account. A test is the only
  // thing that keeps the seventh screen from doing it again.
  const PORTAL_DIRS = [
    path.resolve(__dirname, "../pages/portal"),
    path.resolve(__dirname, "../components/portal"),
  ];

  function tsxFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...tsxFiles(p));
      else if (entry.name.endsWith(".tsx")) out.push(p);
    }
    return out;
  }

  const FILES = PORTAL_DIRS.flatMap(tsxFiles);

  it("nobody re-tests the ledger type by hand", () => {
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /startsWith\(["']CREDIT_["']\)/.test(src) || /===\s*["']payment["']/.test(src);
    }).map((f) => path.basename(f));

    expect(offenders, `import isCreditTx from lib/portalMoney instead:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("nobody decides an invoice is paid by ruling out 'cancelled'", () => {
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      // The exact shape that printed PAID on unpaid invoices.
      return /status\s*===\s*["']cancelled["']\s*\?[^:]*:\s*["']?PAID/i.test(src)
        || /status\s*===\s*["']unpaid["']/.test(src);
    }).map((f) => path.basename(f));

    expect(offenders, `use invoiceState/isInvoiceOutstanding:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("nobody compares a balance by hand", () => {
    // Both directions are named in portalMoney now, so a bare comparison in a
    // portal file is always a mistake — including the one this very test
    // caught while the negative-zero render was being fixed.
    const offenders = FILES.filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return /\bbalance\w*\s*[<>]\s*0\b/.test(src);
    }).map((f) => path.basename(f));

    expect(
      offenders,
      `use isDebt / isCredit from lib/portalMoney — positive means owed:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("the dinar a customer actually pays in", () => {
  const SKIN_ROOT = path.resolve(__dirname, "../pages/portal");
  const SKINS = [
    "PortalFinancial.tsx",
    "modern/ModernPortalFinancial.tsx",
    "skin3/Skin3PortalFinancial.tsx",
  ];

  /**
   * The books have carried IQD all along — `invoices.totalIqd` written against
   * the rate on the day the invoice was raised, `ledgerTransactions.amountIqd`
   * against the rate on the day the line was posted. Only the classic skin
   * showed the invoice figure; the other two dropped it, and none of the three
   * showed it on a transaction. A customer in Erbil pays in dinar and was
   * being handed dollars to convert in their head at whatever rate they last
   * heard, which is how someone arrives at the counter short.
   */
  for (const skin of SKINS) {
    const src = fs.readFileSync(path.join(SKIN_ROOT, skin), "utf8");

    it(`${skin} shows the dinar on invoices and transactions`, () => {
      expect(src, "must use the shared formatter").toContain("formatIqdAmount");
      expect(src, "the invoice's own dinar figure").toMatch(/formatIqdAmount\((?:inv|invoice)\.totalIqd\)/);
      expect(src, "the transaction's own dinar figure").toMatch(/formatIqdAmount\(tx\.amountIqd\)/);
    });

    /**
     * The one thing worse than showing dollars alone is showing a dinar figure
     * that disagrees with the paper receipt in the customer's hand. Today's
     * rate applied to an invoice raised in March is exactly that. Nothing here
     * may multiply by a rate — the number is read, never derived.
     */
    it(`${skin} never recomputes the dinar from a live rate`, () => {
      expect(src).not.toMatch(/(totalUsd|amountUsd|balanceUsd)[^\n]{0,40}\*\s*\w*[Rr]ate/);
      expect(src).not.toMatch(/\*\s*(iqdRate|exchangeRate|usdToIqd)\b/);
    });
  }

  it("returns nothing rather than a bare zero", () => {
    // A row booked in dollars has no dinar figure, and "0 IQD" beside a real
    // dollar amount reads as a price of nothing.
    expect(formatIqdAmount(null)).toBeNull();
    expect(formatIqdAmount(undefined)).toBeNull();
    expect(formatIqdAmount("")).toBeNull();
    expect(formatIqdAmount(0)).toBeNull();
    expect(formatIqdAmount("0")).toBeNull();
    expect(formatIqdAmount("not a number")).toBeNull();
  });

  it("prints a grouped, unsigned figure", () => {
    // The sign is already carried by the +/- beside the dollar amount; a
    // second minus in front of the dinar reads as a different transaction.
    expect(formatIqdAmount(374500)).toBe("374,500 IQD");
    expect(formatIqdAmount("-374500")).toBe("374,500 IQD");
    expect(formatIqdAmount(1250000)).toBe("1,250,000 IQD");
  });
});
