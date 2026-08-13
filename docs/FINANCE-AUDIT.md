# Finance audit — 13 August 2026

A careful read of the Company Finance section: dashboard, balance sheet, bank
accounts, expenses, expense alerts, partners, treasury, company debts.

No existing logic or stored record was changed. One field-name bug was fixed
because it was a plain typo, not a decision — the page was already trying to
show cash and reading a column that does not exist. Everything else is
reported here for you to decide on.

---

## Fixed

### The balance sheet reported zero cash, always

`BalanceSheet.tsx` summed `acc.balance`. The account row has no such column —
it is `currentBalance`. So the sum was `parseFloat(undefined || '0')` for every
account, and **total cash came out as $0 no matter how much money was in the
Treasury**.

Treasury and Bank Accounts both read `currentBalance` correctly, which is why
they showed real figures while the balance sheet did not.

---

## Open — needs your decision

### 1. The balance sheet is not a balance sheet

Three lines decide everything on that page:

```
totalCash        = sum of account balances       (was broken, now fixed)
totalReceivables = dashboardStats.netProfit      ← this is profit, not receivables
totalPayables    = 0                             ← hardcoded
equity           = assets − liabilities
```

Two of the three are wrong, and the data to make them right already exists:

| Line | Shows | Should read |
|---|---|---|
| Receivables | net profit for the period | `ledger.getTotalDebt` — what customers actually owe |
| Payables | hardcoded `0` | `companyDebts` — what the company actually owes |

Because payables is zero, `equity = assets`, and the statement balances by
construction rather than by being true. The equity ratio also prints **100%**
when assets are zero, which reads as perfect health on an empty company.

This is not something to change quietly — the figures on that page move
materially once corrected — so it is left exactly as it was, minus the cash
typo.

### 2. Dinars are added to dollars

Every cash total is a plain `SUM(currentBalance)` with no grouping by currency
and no conversion:

- `getCashAccountsSummary` — totalCash, totalBank, totalBalance
- Treasury's own client-side totals
- Bank Accounts' wallet total

The account form offers **USD and IQD**. One dinar account is enough to make
the headline meaningless: a million dinars adds a million to a dollar total.

Rather than silently changing a number the office may be quoting, the
drill-down now lists every account **with its currency** and says outright
when a total spans more than one. The fix — convert at a rate, or total per
currency — is a decision about which rate and as of when, so it is yours.

### 3. Two limiters still defined and never mounted

Unchanged from the earlier pass, repeated here because it touches money:
`mutationLimiter` and `fileUploadLimiter` exist and are mounted nowhere, so
the only protection is the global 1000/min per IP. Recorded in
`RATE_LIMIT_REPORT.md`.

---

## Verified correct

Worth stating, because these are the ones that would hurt most:

- **`createCashTransaction`** locks the account row (`FOR UPDATE`), checks the
  balance, writes `balanceBefore`/`balanceAfter`, and updates the balance
  inside one transaction. Correct, and now used by expenses.
- **Expense reversal** posts an opposing entry rather than deleting history,
  so every later statement line keeps a balance the account really had.
- **Profit and loss** reads the `expenses` table directly, so expenses reach
  the reports even when the daily summary drifts.
- **Partner equity** — `capital + retained` — is consistent.
- **Company debts** — total, paid and remaining all come from the same rows.

---

## What the drill-down now covers

Clicking a figure opens the calculation in words, its parts, and a link to the
records behind each. Two rules keep it honest: the explanation is derived from
the very object the page renders, never re-queried; and the parts must add up
to the whole, which the panel states in green or red and the tests assert.

| Figure | Breaks down into |
|---|---|
| Gross profit | seven revenue sources, each with its record count |
| Total expenses | every category the money was filed under |
| Net profit | gross profit minus expenses, shown as a subtraction |
| Cash on hand | every active account, with its currency |

That last one is how finding 2 becomes visible rather than theoretical.
