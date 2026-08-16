/**
 * A partner's money, kept in the two books it actually belongs in.
 *
 * The system stores one number per partner, `currentBalance`, and every
 * movement lands in it: capital put in, profit earned, money drawn out, money
 * lent to the company, money the company paid back. Five different meanings
 * summed into one figure. From it you cannot answer the only two questions an
 * owner ever asks — how much has this partner invested, and how much have they
 * taken — because a partner who put in $10,000 and one who lent the company
 * $10,000 read identically, and the second is not an owner of anything: the
 * company owes it back.
 *
 * Partnership accounting has separated these for a century, and this does the
 * same:
 *
 *   Capital account — what the partner OWNS.
 *     opening capital + contributions + share of profit ± adjustments
 *     − drawings = closing capital
 *
 *   Loan account — what the company OWES them, a liability like any other.
 *     lent to company − repaid = outstanding
 *
 * Nothing here is written to the database. Both accounts are derived from the
 * transaction rows that already exist, each row already carrying the type that
 * says which book it belongs in. No stored figure is restated, and a wrong
 * number in the old single balance shows up as a reconciliation failure rather
 * than being quietly papered over.
 */

export type PartnerTxType =
  | "capital_contribution"
  | "profit_share"
  | "withdrawal"
  | "loan_to_company"
  | "loan_repayment"
  | "adjustment";

export type LedgerBook = "capital" | "loan";

/**
 * Which book each kind of movement belongs in, and which way it pushes.
 *
 * This table is the whole rulebook. Everything below reads it rather than
 * repeating a switch, so a new transaction type has exactly one place to be
 * declared and cannot be classified two different ways in two functions.
 */
export const ENTRY_RULES: Record<PartnerTxType, { book: LedgerBook; sign: 1 | -1 }> = {
  capital_contribution: { book: "capital", sign: 1 },
  profit_share: { book: "capital", sign: 1 },
  adjustment: { book: "capital", sign: 1 },
  withdrawal: { book: "capital", sign: -1 },
  loan_to_company: { book: "loan", sign: 1 },
  loan_repayment: { book: "loan", sign: -1 },
};

export interface PartnerTx {
  transactionType: string;
  amountUsd: string | number;
  transactionDate?: string | Date | null;
}

export interface CapitalAccount {
  /** Where the partner started, before any recorded movement. */
  opening: number;
  contributed: number;
  profitShare: number;
  /** Corrections. Can be negative — a correction that only ever added would be no correction at all. */
  adjustments: number;
  /** Money taken out. Held positive; it is subtracted in the closing figure. */
  drawings: number;
  closing: number;
}

export interface LoanAccount {
  lent: number;
  repaid: number;
  /** What the company still owes. Negative would mean it repaid more than it borrowed. */
  outstanding: number;
}

export interface PartnerAccounts {
  capital: CapitalAccount;
  loan: LoanAccount;
  /** Entries whose type this rulebook does not recognise, left out of both books. */
  unclassified: number;
}

/** Money is counted in cents. 0.1 + 0.2 is not 0.3, and a balance sheet may not wobble. */
function cents(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const toMoney = (c: number): number => c / 100;

/**
 * Both books, built from the rows.
 *
 * `opening` is the partner's `initialCapital` column — the figure recorded
 * when the account was opened, which no transaction ever moved. It belongs at
 * the head of the capital account and nowhere else.
 */
export function partnerAccounts(txs: readonly PartnerTx[], opening: string | number = 0): PartnerAccounts {
  let contributed = 0;
  let profitShare = 0;
  let adjustments = 0;
  let drawings = 0;
  let lent = 0;
  let repaid = 0;
  let unclassified = 0;

  for (const tx of txs) {
    const rule = ENTRY_RULES[tx.transactionType as PartnerTxType];
    const amount = cents(tx.amountUsd);

    if (!rule) {
      unclassified += 1;
      continue;
    }

    switch (tx.transactionType as PartnerTxType) {
      case "capital_contribution":
        contributed += amount;
        break;
      case "profit_share":
        profitShare += amount;
        break;
      case "adjustment":
        adjustments += amount;
        break;
      case "withdrawal":
        drawings += amount;
        break;
      case "loan_to_company":
        lent += amount;
        break;
      case "loan_repayment":
        repaid += amount;
        break;
    }
  }

  const openingCents = cents(opening);
  const closing = openingCents + contributed + profitShare + adjustments - drawings;

  return {
    capital: {
      opening: toMoney(openingCents),
      contributed: toMoney(contributed),
      profitShare: toMoney(profitShare),
      adjustments: toMoney(adjustments),
      drawings: toMoney(drawings),
      closing: toMoney(closing),
    },
    loan: {
      lent: toMoney(lent),
      repaid: toMoney(repaid),
      outstanding: toMoney(lent - repaid),
    },
    unclassified,
  };
}

export interface Reconciliation {
  /** What the two books say the recorded movements came to. */
  computed: number;
  /** What the partners row has been carrying all along. */
  stored: number;
  difference: number;
  agrees: boolean;
}

/**
 * Does the ledger still agree with the stored balance?
 *
 * `currentBalance` accumulates every movement and starts from zero — it never
 * included `initialCapital`. So the figure to compare against is the movement
 * total: closing capital less the opening it started from, plus whatever loan
 * is outstanding.
 *
 * When these disagree the page says so. A statement that hides a discrepancy
 * behind a tidy layout is worse than no statement, because it is believed.
 */
export function reconcile(accounts: PartnerAccounts, storedBalance: string | number): Reconciliation {
  const movements =
    cents(accounts.capital.closing) - cents(accounts.capital.opening) + cents(accounts.loan.outstanding);
  const stored = cents(storedBalance);

  return {
    computed: toMoney(movements),
    stored: toMoney(stored),
    difference: toMoney(movements - stored),
    agrees: movements === stored,
  };
}

/**
 * Do the ownership shares add up to the whole company?
 *
 * Only active partners count — a partner who has left still holds their
 * historical rows but no longer owns a share of anything. Shares that total
 * 96% mean profit distributions have been quietly short by 4%, which nothing
 * else in the system would ever report.
 */
export function ownershipCheck(
  partners: readonly { ownershipPercentage: string | number; isActive?: boolean }[],
): { total: number; agrees: boolean } {
  const total = partners
    .filter((p) => p.isActive !== false)
    .reduce((sum, p) => sum + cents(p.ownershipPercentage), 0);

  return { total: toMoney(total), agrees: total === 10000 };
}

/**
 * The company's side of the same numbers.
 *
 * Partner capital is equity; partner loans are a liability. Adding them into
 * one "partner funds" figure — which the balance sheet did — overstates what
 * the owners actually hold by the size of the loans.
 */
export function partnershipTotals(
  rows: readonly { accounts: PartnerAccounts }[],
): { equity: number; liability: number; contributed: number; drawings: number; profitShare: number } {
  let equity = 0;
  let liability = 0;
  let contributed = 0;
  let drawings = 0;
  let profitShare = 0;

  for (const row of rows) {
    equity += cents(row.accounts.capital.closing);
    liability += cents(row.accounts.loan.outstanding);
    contributed += cents(row.accounts.capital.contributed) + cents(row.accounts.capital.opening);
    drawings += cents(row.accounts.capital.drawings);
    profitShare += cents(row.accounts.capital.profitShare);
  }

  return {
    equity: toMoney(equity),
    liability: toMoney(liability),
    contributed: toMoney(contributed),
    drawings: toMoney(drawings),
    profitShare: toMoney(profitShare),
  };
}

/** A row of the statement, with the capital balance carried down the page. */
export interface StatementLine {
  index: number;
  transactionType: PartnerTxType | string;
  book: LedgerBook | "unknown";
  /** Signed: what this entry did to its book. */
  movement: number;
  /** The capital account after this line. Unchanged by loan entries. */
  capitalBalance: number;
  /** The loan account after this line. Unchanged by capital entries. */
  loanBalance: number;
}

/**
 * The running statement, oldest first.
 *
 * Two balances are carried rather than one, because a loan repayment must not
 * make a partner's capital appear to shrink. That conflation is exactly what
 * the single stored balance does today.
 */
export function statement(txs: readonly PartnerTx[], opening: string | number = 0): StatementLine[] {
  let capital = cents(opening);
  let loan = 0;

  return txs.map((tx, index) => {
    const rule = ENTRY_RULES[tx.transactionType as PartnerTxType];
    const amount = cents(tx.amountUsd);
    const movement = rule ? rule.sign * amount : 0;

    if (rule?.book === "capital") capital += movement;
    if (rule?.book === "loan") loan += movement;

    return {
      index,
      transactionType: tx.transactionType,
      book: rule ? rule.book : "unknown",
      movement: toMoney(movement),
      capitalBalance: toMoney(capital),
      loanBalance: toMoney(loan),
    };
  });
}
