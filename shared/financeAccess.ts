/**
 * Who may see every customer's account at once.
 *
 * The owner's decision (2026-09-11): an employee takes money at the counter —
 * a payment from the customer in front of them, recorded against the parcels
 * or the box it pays for — and that is all. The list of every account, the
 * debtors, the company's totals, a manual charge or a debt reminder belong to
 * the people who answer for the books: the admins and the accountant, plus the
 * auditor, who reads them and can change nothing (shared/readOnlyRole.ts).
 *
 * The server enforces it: those procedures are `accountantProcedure`, whose
 * list of roles is this one (pinned by server/finance-access.test.ts). The
 * screens read it from here so an employee is never shown a door that will
 * not open.
 */
export const ALL_ACCOUNTS_ROLES = ["super_admin", "admin", "accountant", "auditor"] as const;

export function canSeeAllAccounts(role: string | null | undefined): boolean {
  return !!role && (ALL_ACCOUNTS_ROLES as readonly string[]).includes(role);
}

/**
 * Screens built from every account's figures. Nothing on them works for an
 * employee, so the layout shows the "no access" panel instead of a page of
 * failed requests — whatever module an employee has been granted.
 */
export const ALL_ACCOUNTS_PATHS: readonly string[] = [
  "/accounting",
  "/finance",
  "/finance/debtors",
  "/finance/debt-reminders",
  "/finance/balance-sheet",
  "/finance/company-dashboard",
  "/finance/bank-accounts",
  "/business-analytics",
];

export function isAllAccountsPath(path: string): boolean {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return ALL_ACCOUNTS_PATHS.includes(clean);
}
