import { sql, type SQL } from "drizzle-orm";
import { customerAccounts } from "../../drizzle/schema";

/**
 * Not the company's own account (customers.isHouseAccount, owner 2026-11-05).
 * Every figure of what customers owe passes through this, so the office's own
 * purchases never read as a customer's debt or a debtor to remind.
 */
export const NOT_HOUSE_ACCOUNT: SQL = sql`${customerAccounts.customerId} NOT IN (SELECT id FROM customers WHERE isHouseAccount = 1)`;
