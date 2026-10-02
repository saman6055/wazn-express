import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { customers, pendingCredits, users } from "../../drizzle/schema";
import { recordPaymentReceived } from "./finance.db";
import { vanishedFix, withFix } from "@shared/fixAdvice";

/**
 * The extra a customer handed over, waiting for the main admin.
 *
 * Owner, 2026-10-02: anyone at the till may enter a payment larger than the
 * debt, "but it goes onto the account only once the main admin has
 * confirmed it" (shared/creditGuard). The owed part is posted at once; the
 * extra is one row here and touches nothing — not the ledger, not the
 * balance, not the payment records.
 *
 * Confirming posts it as an ordinary payment, through the same function
 * every other payment takes, in one transaction with the row's own change
 * of state. Refusing posts nothing. Either way the row keeps who asked, who
 * decided and when, and a row already decided cannot be decided again.
 */

type DbTx = Parameters<Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]>[0];

export interface NewPendingCredit {
  customerId: number;
  amountUsd: number;
  /** Where it was entered: a payment screen, or a box receipt. */
  source: "payment" | "box";
  boxId?: number | null;
  boxCode?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
  requestedById: number;
}

export async function createPendingCredit(input: NewPendingCredit, existingTx?: DbTx): Promise<number> {
  const db = existingTx ?? (await getDb());
  if (!db) throw new Error("Database not available");
  const amount = Math.round(input.amountUsd * 100) / 100;
  if (!(amount > 0)) throw new Error("createPendingCredit: amount must be above zero");
  const [result] = await db.insert(pendingCredits).values({
    customerId: input.customerId,
    amountUsd: amount.toFixed(2),
    source: input.source,
    boxId: input.boxId ?? null,
    boxCode: input.boxCode ?? null,
    paymentMethod: input.paymentMethod ?? "CASH",
    note: input.note ?? null,
    requestedById: input.requestedById,
  });
  return Number(result.insertId);
}

export interface PendingCreditRow {
  id: number;
  customerId: number;
  customerCode: string;
  customerName: string;
  amountUsd: number;
  source: string;
  boxId: number | null;
  boxCode: string | null;
  note: string | null;
  requestedById: number;
  requestedByName: string;
  createdAt: Date;
}

/** Still waiting, oldest first — the order they should be answered in. */
export async function listPendingCredits(): Promise<PendingCreditRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: pendingCredits.id,
      customerId: pendingCredits.customerId,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      amountUsd: pendingCredits.amountUsd,
      source: pendingCredits.source,
      boxId: pendingCredits.boxId,
      boxCode: pendingCredits.boxCode,
      note: pendingCredits.note,
      requestedById: pendingCredits.requestedById,
      requestedByName: users.name,
      createdAt: pendingCredits.createdAt,
    })
    .from(pendingCredits)
    .innerJoin(customers, eq(customers.id, pendingCredits.customerId))
    .leftJoin(users, eq(users.id, pendingCredits.requestedById))
    .where(eq(pendingCredits.status, "pending"))
    .orderBy(pendingCredits.id);
  return rows.map((r) => ({
    ...r,
    customerCode: String(r.customerCode ?? ""),
    customerName: String(r.customerName ?? ""),
    amountUsd: Number(r.amountUsd ?? 0),
    requestedByName: String(r.requestedByName ?? `#${r.requestedById}`),
  }));
}

export interface PendingCreditDecision {
  id: number;
  status: "approved" | "rejected";
  amountUsd: number;
  customerId: number;
}

/**
 * The main admin's answer. Approving posts the payment; rejecting posts
 * nothing. A row that is no longer pending is refused, so two clicks — or
 * two people — cannot post the same extra twice.
 */
export async function decidePendingCredit(
  id: number,
  approve: boolean,
  decidedById: number,
  reason?: string,
): Promise<PendingCreditDecision> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(pendingCredits)
      .where(eq(pendingCredits.id, id))
      .for("update")
      .limit(1);
    if (!row) throw new Error(vanishedFix("ئەم داواکارییەی پارەی زیادە"));
    if (row.status !== "pending") {
      throw new Error(withFix(
        "ئەم داواکارییە پێشتر بڕیاری لەسەر دراوە — دووبارە تۆمار ناکرێت، بۆ ئەوەی هەمان پارە دوو جار نەچێتە سەر حیساب.",
        [
          "لیستەکە نوێ بکەرەوە — ئەم داواکارییە ئیتر تێیدا نامێنێت",
          "بۆ بینینی ئەنجامەکەی، پەڕەی دارایی کڕیارەکە بکەرەوە",
        ],
      ));
    }
    const amountUsd = Number(row.amountUsd);

    let ledgerTransactionId: number | null = null;
    if (approve) {
      const [customer] = await tx
        .select({ customerCode: customers.customerCode })
        .from(customers)
        .where(eq(customers.id, row.customerId))
        .limit(1);
      const posted = await recordPaymentReceived(
        row.customerId,
        String(customer?.customerCode ?? row.customerId),
        amountUsd,
        0,
        (row.paymentMethod ?? "CASH") as Parameters<typeof recordPaymentReceived>[4],
        decidedById,
        `پارەی زیادە — پەسەندکراو لەلایەن ئادمینی سەرەکی${row.boxCode ? ` — ${row.boxCode}` : ""}${row.note ? ` — ${row.note}` : ""}`,
        undefined,
        undefined,
        undefined,
        tx,
      );
      ledgerTransactionId = posted.transaction.id;
    }

    await tx
      .update(pendingCredits)
      .set({
        status: approve ? "approved" : "rejected",
        decidedById,
        decidedAt: new Date(),
        decisionReason: reason?.trim() || null,
        ledgerTransactionId,
      })
      .where(and(eq(pendingCredits.id, id), eq(pendingCredits.status, "pending")));

    return { id, status: approve ? "approved" : "rejected", amountUsd, customerId: row.customerId };
  });
}

/** The last ones decided, for the record under the waiting list. */
export async function recentPendingCreditDecisions(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pendingCredits).orderBy(desc(pendingCredits.id)).limit(limit);
}
