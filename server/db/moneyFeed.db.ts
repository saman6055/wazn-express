import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { customerAccounts, customers, deliveryBoxes, ledgerTransactions, users } from "../../drizzle/schema";
import { groupMovements, type MoneyMovement } from "@shared/moneyFeed";

/**
 * The newest money movements, read from the ledger itself (shared/moneyFeed
 * says why), with who made each one and whose account it was.
 *
 * Read only. The rule that folds and flags the rows is shared and tested;
 * this only fetches the last rows and puts names on them.
 */

export interface MoneyFeedLine extends MoneyMovement {
  customerId: number | null;
  customerCode: string;
  customerName: string;
  byName: string;
  /** The box a receipt was for, so the line can open it. */
  boxId: number | null;
}

/** How many of the newest ledger rows the feed looks at. */
export const MONEY_FEED_ROWS = 600;

export async function getMoneyFeed(): Promise<{ lines: MoneyFeedLine[]; newestId: number }> {
  const db = await getDb();
  if (!db) return { lines: [], newestId: 0 };

  const rows = await db
    .select({
      id: ledgerTransactions.id,
      accountId: ledgerTransactions.accountId,
      transactionType: ledgerTransactions.transactionType,
      referenceType: ledgerTransactions.referenceType,
      amountUsd: ledgerTransactions.amountUsd,
      balanceBeforeUsd: ledgerTransactions.balanceBeforeUsd,
      balanceAfterUsd: ledgerTransactions.balanceAfterUsd,
      description: ledgerTransactions.description,
      createdById: ledgerTransactions.createdById,
      createdAt: ledgerTransactions.createdAt,
    })
    .from(ledgerTransactions)
    .orderBy(desc(ledgerTransactions.id))
    .limit(MONEY_FEED_ROWS);
  if (rows.length === 0) return { lines: [], newestId: 0 };

  const movements = groupMovements(rows);

  const accountIds = Array.from(new Set(movements.map((m) => m.accountId)));
  const owners = await db
    .select({
      accountId: customerAccounts.id,
      customerId: customers.id,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(customerAccounts)
    .innerJoin(customers, eq(customers.id, customerAccounts.customerId))
    .where(inArray(customerAccounts.id, accountIds));
  const ownerOf = new Map(owners.map((o) => [o.accountId, o]));

  const staffIds = Array.from(new Set(movements.map((m) => m.createdById).filter((id): id is number => id !== null)));
  const staff = staffIds.length
    ? await db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(inArray(users.id, staffIds))
    : [];
  const nameOf = new Map(staff.map((s) => [s.id, String(s.name ?? s.username ?? `#${s.id}`)]));

  const boxCodes = Array.from(new Set(movements.map((m) => m.boxCode).filter((code): code is string => !!code)));
  const boxes = boxCodes.length
    ? await db.select({ id: deliveryBoxes.id, boxCode: deliveryBoxes.boxCode }).from(deliveryBoxes).where(inArray(deliveryBoxes.boxCode, boxCodes))
    : [];
  const boxIdOf = new Map(boxes.map((b) => [b.boxCode, b.id]));

  const lines = movements.map((m): MoneyFeedLine => {
    const owner = ownerOf.get(m.accountId);
    return {
      ...m,
      customerId: owner?.customerId ?? null,
      customerCode: String(owner?.customerCode ?? ""),
      customerName: String(owner?.customerName ?? ""),
      byName: m.createdById !== null ? nameOf.get(m.createdById) ?? `#${m.createdById}` : "—",
      boxId: m.boxCode ? boxIdOf.get(m.boxCode) ?? null : null,
    };
  });
  return { lines, newestId: lines[0]?.id ?? 0 };
}
