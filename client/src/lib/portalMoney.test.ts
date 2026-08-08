import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  INVOICE_STATE_PRINT,
  invoiceState,
  isCreditTx,
  isDebt,
  isInvoiceOutstanding,
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
