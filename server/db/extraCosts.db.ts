import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { boxExtraCosts, deliveryBoxItems, deliveryBoxes, packages } from "../../drizzle/schema";
import { customers } from "../../drizzle/schema/users.schema";
import { users } from "../../drizzle/schema";
import { withFix } from "@shared/fixAdvice";
import {
  extraCostChargeText,
  extraCostProblem,
  extraCostProfitUsd,
  type ExtraCostReason,
} from "@shared/extraCosts";
import { appLogger } from "../utils/logger";
import { applyCharge, reverseCharge } from "./finance.db";

const num = (v: unknown) => Number(v ?? 0) || 0;
const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** One line as the screens read it. */
export interface ExtraCostRow {
  id: number;
  customerId: number;
  boxId: number | null;
  packageId: number | null;
  trackingNumber: string | null;
  reason: ExtraCostReason;
  note: string | null;
  costUsd: number;
  priceUsd: number;
  ledgerTransactionId: number | null;
  settlementId: number | null;
  createdById: number;
  createdByName: string | null;
  createdAt: Date | string;
}

const toRow = (r: typeof boxExtraCosts.$inferSelect, createdByName: string | null = null): ExtraCostRow => ({
  id: Number(r.id),
  customerId: Number(r.customerId),
  boxId: r.boxId == null ? null : Number(r.boxId),
  packageId: r.packageId == null ? null : Number(r.packageId),
  trackingNumber: r.trackingNumber ?? null,
  reason: r.reason as ExtraCostReason,
  note: r.note ?? null,
  costUsd: num(r.costUsd),
  priceUsd: num(r.priceUsd),
  ledgerTransactionId: r.ledgerTransactionId == null ? null : Number(r.ledgerTransactionId),
  settlementId: r.settlementId == null ? null : Number(r.settlementId),
  createdById: Number(r.createdById),
  createdByName,
  createdAt: r.createdAt,
});

/**
 * Write one line. The customer's price is put on the account at once, by the
 * same charge door every other debt goes through; a line that stays on the
 * company writes nothing on the account.
 */
export async function addExtraCost(
  input: { boxId?: number | null; packageId?: number | null; reason: ExtraCostReason; note?: string | null; costUsd: number; priceUsd: number },
  userId: number,
): Promise<ExtraCostRow> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const problem = extraCostProblem(input);
  if (problem) throw new Error(withFix(problem, ["خانەکان ڕاست بکەرەوە", "دووبارە «زیادکردن» لێبدە"]));
  if (!input.boxId && !input.packageId) {
    throw new Error(withFix("تێچووی تر دەبێت لەسەر بۆکسێک یان پاکەتێک بێت.", ["بۆکسەکە یان پاکەتەکە بکەوە و لەوێ زیادی بکە"]));
  }

  // Whose it is, from the thing it is written on.
  let customerId: number | null = null;
  let boxCode: string | null = null;
  let trackingNumber: string | null = null;
  if (input.boxId) {
    const [box] = await db.select({ customerId: deliveryBoxes.customerId, boxCode: deliveryBoxes.boxCode, status: deliveryBoxes.status }).from(deliveryBoxes).where(eq(deliveryBoxes.id, input.boxId)).limit(1);
    if (!box) throw new Error(withFix("ئەم بۆکسە نەدۆزرایەوە.", ["پەڕەکە نوێ بکەوە"]));
    if (box.status === "cancelled") throw new Error(withFix(`بۆکسی ${box.boxCode} هەڵوەشێنراوەتەوە.`, ["تێچووەکە لەسەر بۆکسە نوێیەکە بنووسە"]));
    customerId = Number(box.customerId);
    boxCode = box.boxCode;
  }
  if (input.packageId) {
    const [pkg] = await db.select({ customerId: packages.customerId, trackingNumber: packages.trackingNumber }).from(packages).where(eq(packages.id, input.packageId)).limit(1);
    if (!pkg) throw new Error(withFix("ئەم پاکەتە نەدۆزرایەوە.", ["پەڕەکە نوێ بکەوە"]));
    if (!pkg.customerId) throw new Error(withFix("ئەم پاکەتە خاوەنی نییە — تێچووەکە لەسەر کێ بنووسرێت؟", ["سەرەتا خاوەنی پاکەتەکە دیاری بکە", "ئینجا تێچووەکە زیاد بکە"]));
    if (customerId !== null && customerId !== Number(pkg.customerId)) {
      throw new Error(withFix("ئەم پاکەتە هی کڕیارێکی ترە، نەک هی خاوەنی ئەم بۆکسە.", ["تێچووەکە لەسەر پاکەتی خۆی یان بۆکسی خۆی بنووسە"]));
    }
    customerId = Number(pkg.customerId);
    trackingNumber = pkg.trackingNumber ?? null;
  }
  const [customer] = await db.select({ id: customers.id, customerCode: customers.customerCode }).from(customers).where(eq(customers.id, customerId!)).limit(1);
  if (!customer) throw new Error(withFix("کڕیاری ئەمە نەدۆزرایەوە.", ["پەڕەکە نوێ بکەوە"]));

  const costUsd = cents(input.costUsd);
  const priceUsd = cents(input.priceUsd);
  const inserted = await db.insert(boxExtraCosts).values({
    customerId: customer.id,
    boxId: input.boxId ?? null,
    packageId: input.packageId ?? null,
    trackingNumber,
    reason: input.reason,
    note: (input.note ?? "").trim() || null,
    costUsd: costUsd.toFixed(2),
    priceUsd: priceUsd.toFixed(2),
    createdById: userId,
  });
  const id = Number(inserted[0].insertId);

  if (priceUsd > 0) {
    try {
      const where = [boxCode, trackingNumber].filter(Boolean).join(" · ") || null;
      const charge = await applyCharge(
        customer.id,
        customer.customerCode ?? String(customer.id),
        "SERVICE",
        id,
        priceUsd,
        extraCostChargeText(input.reason, input.note, where),
        userId,
      );
      await db.update(boxExtraCosts).set({ ledgerTransactionId: Number(charge.transaction.id) }).where(eq(boxExtraCosts.id, id));
    } catch (err) {
      // No price on the account means no line: it is struck, not left half-written.
      await db.update(boxExtraCosts).set({ status: "removed", removedAt: new Date(), removedById: userId, removeReason: "charge failed" }).where(eq(boxExtraCosts.id, id));
      appLogger.error("[ExtraCosts] the customer's price could not be charged", { id, error: err instanceof Error ? err.message : String(err) });
      throw new Error(withFix("نرخەکە لەسەر حیسابی کڕیار نەنووسرا — هیچ شتێک تۆمار نەکرا.", ["دووبارە هەوڵ بدەوە", "ئەگەر دووبارە بوو، ڕاپۆرتەکە کۆپی بکە و بینێرە"]));
    }
  }
  appLogger.info("[ExtraCosts] written", { id, customerId: customer.id, boxId: input.boxId, packageId: input.packageId, costUsd, priceUsd, userId });
  const [row] = await db.select().from(boxExtraCosts).where(eq(boxExtraCosts.id, id)).limit(1);
  return toRow(row);
}

/**
 * Take a line off. Before a receipt took its money, it goes as if it was
 * never written: the price comes back off the account with a line that says
 * why. After a receipt, the receipt is undone first.
 */
export async function removeExtraCost(id: number, reason: string, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.select().from(boxExtraCosts).where(eq(boxExtraCosts.id, id)).limit(1);
  if (!row || row.status !== "active") throw new Error(withFix("ئەم تێچووە نەماوە.", ["پەڕەکە نوێ بکەوە"]));
  if (row.settlementId) {
    throw new Error(withFix(
      "پارەی ئەم تێچووە بە وەسڵێک وەرگیراوە — بە سڕینەوە لاناچێت.",
      ["سەرەتا وەسڵەکەی بۆکسەکە هەڵبوەشێنەوە", "ئینجا تێچووەکە لاببە", "ئەگەر پێویست بوو بۆکسەکە دووبارە واسڵ بکە"],
    ));
  }
  const why = (reason ?? "").trim() || "لابرا";
  if (row.ledgerTransactionId) {
    await reverseCharge(Number(row.ledgerTransactionId), `تێچووی تر لابرا — ${why}`, userId);
  }
  await db.update(boxExtraCosts).set({ status: "removed", removedAt: new Date(), removedById: userId, removeReason: why }).where(eq(boxExtraCosts.id, id));
  appLogger.info("[ExtraCosts] removed", { id, userId, why });
}

/** The packages a box holds. */
async function packagesInBoxes(boxIds: number[]): Promise<Map<number, number>> {
  const db = await getDb();
  const out = new Map<number, number>();
  if (!db || boxIds.length === 0) return out;
  const rows = await db
    .select({ boxId: deliveryBoxItems.boxId, packageId: deliveryBoxItems.packageId })
    .from(deliveryBoxItems)
    .where(inArray(deliveryBoxItems.boxId, boxIds));
  for (const r of rows) if (r.packageId != null) out.set(Number(r.packageId), Number(r.boxId));
  return out;
}

/**
 * Every live line on these boxes - written on the box, or on a parcel the
 * box now holds - keyed by box.
 */
export async function extraCostsForBoxes(boxIds: number[]): Promise<Map<number, ExtraCostRow[]>> {
  const db = await getDb();
  const out = new Map<number, ExtraCostRow[]>();
  if (!db || boxIds.length === 0) return out;
  const byPackage = await packagesInBoxes(boxIds);
  const pkgIds = Array.from(byPackage.keys());
  const rows = await db
    .select({ row: boxExtraCosts, name: users.name })
    .from(boxExtraCosts)
    .leftJoin(users, eq(users.id, boxExtraCosts.createdById))
    .where(and(
      eq(boxExtraCosts.status, "active"),
      or(
        inArray(boxExtraCosts.boxId, boxIds),
        pkgIds.length > 0 ? and(isNull(boxExtraCosts.boxId), inArray(boxExtraCosts.packageId, pkgIds)) : sql`1 = 0`,
      ),
    ))
    .orderBy(boxExtraCosts.id);
  for (const { row, name } of rows) {
    const boxId = row.boxId != null ? Number(row.boxId) : byPackage.get(Number(row.packageId));
    if (boxId == null) continue;
    const list = out.get(boxId) ?? [];
    list.push(toRow(row, name ?? null));
    out.set(boxId, list);
  }
  return out;
}

/** What each box still asks for in other costs: the prices no receipt has taken. */
export async function unpaidExtraCostsByBox(boxIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (const [boxId, rows] of Array.from((await extraCostsForBoxes(boxIds)).entries())) {
    const due = cents(rows.filter((r) => r.priceUsd > 0 && r.settlementId === null).reduce((s, r) => s + r.priceUsd, 0));
    if (due > 0) out.set(boxId, due);
  }
  return out;
}

/** Inside a receipt's transaction: these lines are paid by it. */
export async function markExtraCostsSettled(tx: any, ids: number[], settlementId: number): Promise<void> {
  if (ids.length === 0) return;
  await tx.update(boxExtraCosts).set({ settlementId }).where(and(inArray(boxExtraCosts.id, ids), isNull(boxExtraCosts.settlementId)));
}

/** Inside a reversal's transaction: the receipt is undone, so the lines are owed again. */
export async function clearExtraCostsSettlement(tx: any, settlementId: number): Promise<void> {
  await tx.update(boxExtraCosts).set({ settlementId: null }).where(eq(boxExtraCosts.settlementId, settlementId));
}

/** Every line ever written, newest first - the main admin's watch. */
export async function listExtraCosts(opts: { sinceDays?: number } = {}): Promise<Array<ExtraCostRow & { customerCode: string | null; boxCode: string | null; status: string; removeReason: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - Math.max(1, Math.min(3650, opts.sinceDays ?? 90)) * 86_400_000);
  const rows = await db
    .select({ row: boxExtraCosts, name: users.name, customerCode: customers.customerCode, boxCode: deliveryBoxes.boxCode })
    .from(boxExtraCosts)
    .leftJoin(users, eq(users.id, boxExtraCosts.createdById))
    .leftJoin(customers, eq(customers.id, boxExtraCosts.customerId))
    .leftJoin(deliveryBoxes, eq(deliveryBoxes.id, boxExtraCosts.boxId))
    .where(gte(boxExtraCosts.createdAt, since))
    .orderBy(desc(boxExtraCosts.id))
    .limit(1000);
  return rows.map(({ row, name, customerCode, boxCode }) => ({
    ...toRow(row, name ?? null),
    customerCode: customerCode ?? null,
    boxCode: boxCode ?? null,
    status: String(row.status),
    removeReason: row.removeReason ?? null,
  }));
}

/** For the bell: lines written in the last day. */
export async function countExtraCostsSince(hours = 24): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [r] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(boxExtraCosts)
    .where(and(eq(boxExtraCosts.status, "active"), gte(boxExtraCosts.createdAt, new Date(Date.now() - hours * 3_600_000))));
  return Number(r?.n ?? 0);
}

/** What the lines written in a period did to the profit: prices taken less costs paid. */
export async function getExtraCostProfitBetween(start: Date, end: Date): Promise<{ count: number; priceUsd: number; costUsd: number; profitUsd: number }> {
  const db = await getDb();
  if (!db) return { count: 0, priceUsd: 0, costUsd: 0, profitUsd: 0 };
  const rows = await db
    .select({ costUsd: boxExtraCosts.costUsd, priceUsd: boxExtraCosts.priceUsd })
    .from(boxExtraCosts)
    .where(and(eq(boxExtraCosts.status, "active"), gte(boxExtraCosts.createdAt, start), lte(boxExtraCosts.createdAt, end)));
  const priceUsd = cents(rows.reduce((s, r) => s + num(r.priceUsd), 0));
  const costUsd = cents(rows.reduce((s, r) => s + num(r.costUsd), 0));
  const profitUsd = cents(rows.reduce((s, r) => s + extraCostProfitUsd({ costUsd: num(r.costUsd), priceUsd: num(r.priceUsd) }), 0));
  return { count: rows.length, priceUsd, costUsd, profitUsd };
}

/**
 * For the debt rule: each customer's price on the ledger, and where its
 * money stands - taken by a receipt, waiting in a box not receipted, or
 * written on a parcel not boxed yet.
 */
export async function extraChargeStates(customerId: number): Promise<Map<number, "paid" | "openBox" | "parcel">> {
  const db = await getDb();
  const out = new Map<number, "paid" | "openBox" | "parcel">();
  if (!db) return out;
  const rows = await db
    .select()
    .from(boxExtraCosts)
    .where(and(eq(boxExtraCosts.customerId, customerId), eq(boxExtraCosts.status, "active")));
  const pkgIds = rows.filter((r) => r.boxId == null && r.packageId != null).map((r) => Number(r.packageId));
  const boxed = pkgIds.length > 0
    ? await db
        .select({ packageId: deliveryBoxItems.packageId })
        .from(deliveryBoxItems)
        .innerJoin(deliveryBoxes, eq(deliveryBoxes.id, deliveryBoxItems.boxId))
        .where(and(inArray(deliveryBoxItems.packageId, pkgIds), sql`${deliveryBoxes.status} <> 'cancelled'`))
    : [];
  const inABox = new Set(boxed.map((b) => Number(b.packageId)));
  for (const r of rows) {
    if (r.ledgerTransactionId == null) continue;
    const state = r.settlementId != null ? "paid" : (r.boxId != null || inABox.has(Number(r.packageId)) ? "openBox" : "parcel");
    out.set(Number(r.ledgerTransactionId), state);
  }
  return out;
}
