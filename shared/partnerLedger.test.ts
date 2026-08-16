import { describe, it, expect } from "vitest";
import {
  ENTRY_RULES,
  partnerAccounts,
  reconcile,
  ownershipCheck,
  partnershipTotals,
  statement,
  type PartnerTx,
} from "./partnerLedger";

const tx = (transactionType: string, amountUsd: number): PartnerTx => ({ transactionType, amountUsd });

describe("every kind of movement is classified", () => {
  it("puts each type in exactly one book", () => {
    // The rulebook is the only place a type is classified. If a type were
    // missing here it would silently fall into `unclassified` and vanish from
    // both accounts — money on no page at all.
    const types = Object.keys(ENTRY_RULES);
    expect(types).toHaveLength(6);
    for (const [type, rule] of Object.entries(ENTRY_RULES)) {
      expect(["capital", "loan"], `${type} is in no book`).toContain(rule.book);
      expect([1, -1], `${type} has no direction`).toContain(rule.sign);
    }
  });

  it("counts a type it has never seen rather than swallowing it", () => {
    const accounts = partnerAccounts([tx("some_future_type", 500)]);
    expect(accounts.unclassified).toBe(1);
    expect(accounts.capital.closing).toBe(0);
    expect(accounts.loan.outstanding).toBe(0);
  });
});

describe("the capital account", () => {
  it("adds what was put in and takes off what was drawn", () => {
    const accounts = partnerAccounts(
      [
        tx("capital_contribution", 10000),
        tx("profit_share", 2500),
        tx("withdrawal", 3000),
      ],
      5000,
    );

    expect(accounts.capital.opening).toBe(5000);
    expect(accounts.capital.contributed).toBe(10000);
    expect(accounts.capital.profitShare).toBe(2500);
    expect(accounts.capital.drawings).toBe(3000);
    expect(accounts.capital.closing).toBe(14500);
  });

  it("holds drawings as a positive figure", () => {
    // A drawing is money out. It reads as 3,000 taken, not as −3,000 taken,
    // and only the closing line subtracts it. Storing it negative would mean
    // every screen had to remember to flip it.
    const accounts = partnerAccounts([tx("withdrawal", 3000)]);
    expect(accounts.capital.drawings).toBe(3000);
    expect(accounts.capital.closing).toBe(-3000);
  });

  it("lets a correction go either way", () => {
    const up = partnerAccounts([tx("adjustment", 200)]);
    const down = partnerAccounts([tx("adjustment", -200)]);
    expect(up.capital.closing).toBe(200);
    expect(down.capital.closing).toBe(-200);
  });
});

describe("the loan account", () => {
  it("is kept apart from capital", () => {
    // The whole point. A partner who lends the company money owns no more of
    // it than before, and the single stored balance cannot say that.
    const accounts = partnerAccounts([tx("capital_contribution", 10000), tx("loan_to_company", 10000)]);

    expect(accounts.capital.closing).toBe(10000);
    expect(accounts.loan.outstanding).toBe(10000);
  });

  it("falls as the company repays", () => {
    const accounts = partnerAccounts([tx("loan_to_company", 8000), tx("loan_repayment", 3000)]);

    expect(accounts.loan.lent).toBe(8000);
    expect(accounts.loan.repaid).toBe(3000);
    expect(accounts.loan.outstanding).toBe(5000);
  });

  it("never touches the capital account when it moves", () => {
    const accounts = partnerAccounts([tx("loan_to_company", 8000), tx("loan_repayment", 8000)], 4000);
    expect(accounts.capital.closing).toBe(4000);
    expect(accounts.loan.outstanding).toBe(0);
  });
});

describe("money arithmetic", () => {
  it("does not drift on amounts that break binary floats", () => {
    // 0.1 + 0.2 is 0.30000000000000004. A statement that prints $0.30 while
    // its own reconciliation says the books are off by a fraction of a cent
    // would be dismissed as broken — and it would be right to dismiss it.
    const accounts = partnerAccounts([tx("capital_contribution", 0.1), tx("capital_contribution", 0.2)]);
    expect(accounts.capital.closing).toBe(0.3);
  });

  it("survives a long run of awkward thirds", () => {
    const txs = Array.from({ length: 300 }, () => tx("capital_contribution", 0.07));
    expect(partnerAccounts(txs).capital.closing).toBe(21);
  });

  it("reads amounts stored as decimal strings", () => {
    // MySQL DECIMAL comes back as a string through Drizzle. Treating it as a
    // number without saying so is how a total becomes "010000".
    const accounts = partnerAccounts([
      { transactionType: "capital_contribution", amountUsd: "10000.00" },
      { transactionType: "withdrawal", amountUsd: "250.50" },
    ]);
    expect(accounts.capital.closing).toBe(9749.5);
  });

  it("treats a missing or unreadable amount as nothing", () => {
    const accounts = partnerAccounts([
      { transactionType: "capital_contribution", amountUsd: "" },
      { transactionType: "capital_contribution", amountUsd: "not a number" },
      { transactionType: "capital_contribution", amountUsd: 100 },
    ]);
    expect(accounts.capital.closing).toBe(100);
  });
});

describe("reconciliation against the stored balance", () => {
  const txs = [
    tx("capital_contribution", 10000),
    tx("profit_share", 2000),
    tx("withdrawal", 1500),
    tx("loan_to_company", 5000),
    tx("loan_repayment", 2000),
  ];

  it("agrees when the ledger and the stored figure tell the same story", () => {
    // currentBalance sums every movement from zero: 10000 + 2000 − 1500
    // + 5000 − 2000. The opening capital was never part of it.
    const accounts = partnerAccounts(txs, 4000);
    const check = reconcile(accounts, 13500);

    expect(check.agrees).toBe(true);
    expect(check.difference).toBe(0);
  });

  it("reports the gap rather than hiding it", () => {
    const accounts = partnerAccounts(txs, 4000);
    const check = reconcile(accounts, 12000);

    expect(check.agrees).toBe(false);
    expect(check.difference).toBe(1500);
    expect(check.computed).toBe(13500);
    expect(check.stored).toBe(12000);
  });

  it("does not count the opening capital twice", () => {
    // The bug this replaces: the old statement started its running balance at
    // initialCapital while the stored balance started at zero, so the two
    // disagreed by exactly the opening figure from the first row onward.
    const accounts = partnerAccounts([tx("capital_contribution", 1000)], 9000);
    expect(accounts.capital.closing).toBe(10000);
    expect(reconcile(accounts, 1000).agrees).toBe(true);
  });

  it("holds for a partner with no movements at all", () => {
    const accounts = partnerAccounts([], 7500);
    expect(accounts.capital.closing).toBe(7500);
    expect(reconcile(accounts, 0).agrees).toBe(true);
  });
});

describe("ownership shares", () => {
  it("passes when the active partners hold the whole company", () => {
    const check = ownershipCheck([
      { ownershipPercentage: "60.00" },
      { ownershipPercentage: "40.00" },
    ]);
    expect(check.total).toBe(100);
    expect(check.agrees).toBe(true);
  });

  it("catches a company that is only 96% owned", () => {
    // Four percent of every profit distribution going nowhere, and nothing
    // else in the system would ever mention it.
    const check = ownershipCheck([
      { ownershipPercentage: "48.00" },
      { ownershipPercentage: "48.00" },
    ]);
    expect(check.agrees).toBe(false);
    expect(check.total).toBe(96);
  });

  it("ignores partners who have left", () => {
    const check = ownershipCheck([
      { ownershipPercentage: "100.00", isActive: true },
      { ownershipPercentage: "50.00", isActive: false },
    ]);
    expect(check.agrees).toBe(true);
  });

  it("catches thirds that were rounded down", () => {
    const check = ownershipCheck([
      { ownershipPercentage: "33.33" },
      { ownershipPercentage: "33.33" },
      { ownershipPercentage: "33.33" },
    ]);
    expect(check.agrees).toBe(false);
    expect(check.total).toBe(99.99);
  });
});

describe("the company's side", () => {
  it("keeps equity and liability apart in the totals too", () => {
    // The balance sheet added initialCapital and currentBalance together and
    // called the result equity. Every dollar a partner had lent the company
    // was counted as ownership.
    const a = partnerAccounts([tx("capital_contribution", 10000), tx("loan_to_company", 4000)]);
    const b = partnerAccounts([tx("capital_contribution", 6000), tx("withdrawal", 1000)], 2000);
    const totals = partnershipTotals([{ accounts: a }, { accounts: b }]);

    expect(totals.equity).toBe(17000);
    expect(totals.liability).toBe(4000);
    expect(totals.contributed).toBe(18000);
    expect(totals.drawings).toBe(1000);
  });

  it("is zero for a company with no partners yet", () => {
    const totals = partnershipTotals([]);
    expect(totals.equity).toBe(0);
    expect(totals.liability).toBe(0);
  });
});

describe("the running statement", () => {
  it("carries the two balances down the page separately", () => {
    const lines = statement(
      [tx("capital_contribution", 1000), tx("loan_to_company", 500), tx("withdrawal", 200), tx("loan_repayment", 500)],
      0,
    );

    expect(lines.map((l) => l.capitalBalance)).toEqual([1000, 1000, 800, 800]);
    expect(lines.map((l) => l.loanBalance)).toEqual([0, 500, 500, 0]);
  });

  it("signs each movement the way its book moves", () => {
    const lines = statement([tx("capital_contribution", 1000), tx("withdrawal", 200)]);
    expect(lines[0].movement).toBe(1000);
    expect(lines[1].movement).toBe(-200);
  });

  it("starts the capital balance at the opening figure", () => {
    const lines = statement([tx("profit_share", 500)], 3000);
    expect(lines[0].capitalBalance).toBe(3500);
  });

  it("ends where the accounts say it ends", () => {
    // The statement and the summary are computed by different functions, and
    // a reader who adds up the rows must land on the headline figure.
    const txs = [tx("capital_contribution", 9000), tx("profit_share", 1200), tx("withdrawal", 400), tx("loan_to_company", 2000)];
    const lines = statement(txs, 1500);
    const accounts = partnerAccounts(txs, 1500);

    expect(lines[lines.length - 1].capitalBalance).toBe(accounts.capital.closing);
    expect(lines[lines.length - 1].loanBalance).toBe(accounts.loan.outstanding);
  });

  it("marks a row it cannot classify instead of guessing", () => {
    const lines = statement([tx("mystery", 900)]);
    expect(lines[0].book).toBe("unknown");
    expect(lines[0].movement).toBe(0);
    expect(lines[0].capitalBalance).toBe(0);
  });
});
