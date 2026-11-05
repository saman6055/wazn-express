import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { companyStock } from "../../drizzle/schema";
import { customerStanding, customers, users } from "../../drizzle/schema/users.schema";
import { withFix } from "@shared/fixAdvice";
import {
  STANDING_REASON_WORDS,
  mayOrderFor,
  standingOf,
  standingTextFault,
  type Standing,
  type StandingEvent,
  type StandingReason,
} from "@shared/customerStanding";
import { appLogger } from "../utils/logger";

async function rowsFor(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: customerStanding.id,
      event: customerStanding.event,
      reason: customerStanding.reason,
      text: customerStanding.text,
      createdAt: customerStanding.createdAt,
      by: users.name,
    })
    .from(customerStanding)
    .leftJoin(users, eq(users.id, customerStanding.createdById))
    .where(eq(customerStanding.customerId, customerId))
    .orderBy(desc(customerStanding.createdAt), desc(customerStanding.id));
}

/** Everything the office should know before doing something for this customer. */
export async function getCustomerStanding(customerId: number) {
  const db = await getDb();
  const rows = await rowsFor(customerId);
  let refusals = 0;
  // Named, so a page opened from a link says whose standing it is.
  let customerCode: string | null = null;
  let customerName: string | null = null;
  if (db) {
    const [c] = await db
      .select({ customerCode: customers.customerCode, fullName: customers.fullName })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    customerCode = c?.customerCode ?? null;
    customerName = c?.fullName ?? null;
    const [r] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(companyStock)
      .where(and(eq(companyStock.customerId, customerId), eq(companyStock.fault, "customer")));
    refusals = Number(r?.n) || 0;
  }
  const standing: Standing = standingOf(rows);
  // What put them where they are: the row that set the present standing.
  const current = standing === "ok" ? null : rows.find((r) => r.event === standing) ?? null;
  return {
    customerId,
    customerCode,
    customerName,
    standing,
    current,
    cautions: rows.filter((r) => r.event === "caution").length,
    refusals,
    rows,
  };
}

export async function getCustomerStandingByCode(code: string) {
  const db = await getDb();
  const q = code.trim();
  if (!db || !q) return null;
  // The code as typed, or the short form before the name in "AZ018(Kara)";
  // then the phone, then the name (owner, 2026-11-05: finding the customer
  // must be easy). A code wins over a phone, a phone over a name.
  const digits = q.replace(/\D/g, "");
  const [customer] = await db
    .select({ id: customers.id, customerCode: customers.customerCode, fullName: customers.fullName, mobileNumber: customers.mobileNumber })
    .from(customers)
    .where(sql`${customers.customerCode} = ${q} OR ${customers.customerCode} LIKE ${`${q}(%`}
      OR (${digits.length >= 7} AND ${customers.mobileNumber} LIKE ${`%${digits.slice(-9)}`})
      OR (${q.length >= 3} AND ${customers.fullName} LIKE ${`%${q}%`})`)
    .orderBy(sql`CASE WHEN ${customers.customerCode} = ${q} OR ${customers.customerCode} LIKE ${`${q}(%`} THEN 0
      WHEN ${customers.mobileNumber} LIKE ${`%${digits.slice(-9) || "-"}`} THEN 1 ELSE 2 END`, customers.id)
    .limit(1);
  if (!customer) return null;
  return { customer, ...(await getCustomerStanding(Number(customer.id))) };
}

/** Everyone with a caution or on the blacklist, the blacklist first. */
export async function listFlaggedCustomers() {
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select({ customerId: customerStanding.customerId, event: customerStanding.event, reason: customerStanding.reason, text: customerStanding.text, createdAt: customerStanding.createdAt, id: customerStanding.id })
    .from(customerStanding)
    .orderBy(desc(customerStanding.createdAt), desc(customerStanding.id));
  const byCustomer = new Map<number, typeof all>();
  for (const r of all) {
    const list = byCustomer.get(Number(r.customerId)) ?? [];
    list.push(r);
    byCustomer.set(Number(r.customerId), list);
  }
  const flagged = Array.from(byCustomer.entries())
    .map(([customerId, rows]) => ({ customerId, standing: standingOf(rows), last: rows.find((r) => r.event !== "cleared") ?? rows[0], cautions: rows.filter((r) => r.event === "caution").length }))
    .filter((c) => c.standing !== "ok");
  if (flagged.length === 0) return [];
  const names = await db
    .select({ id: customers.id, customerCode: customers.customerCode, fullName: customers.fullName })
    .from(customers)
    .where(inArray(customers.id, flagged.map((f) => f.customerId)));
  return flagged
    .map((f) => {
      const c = names.find((n) => Number(n.id) === f.customerId);
      return { ...f, customerCode: c?.customerCode ?? null, customerName: c?.fullName ?? null };
    })
    .sort((a, b) => Number(b.standing === "blocked") - Number(a.standing === "blocked") || new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());
}

/** A note, a block, or a release — one row, never an edit. */
export async function recordCustomerStanding(
  input: { customerId: number; event: StandingEvent; reason?: StandingReason | null; text?: string | null },
  userId: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const fault = standingTextFault(input.event, input.reason, input.text);
  if (fault === "reason") throw new Error(withFix("هۆکارەکە هەڵنەبژێردراوە.", ["هۆکارێک هەڵبژێرە"]));
  if (fault === "text") {
    throw new Error(input.event === "cleared"
      ? withFix("مەرجی دەرکردن لە لیستی ڕەش نەنووسراوە.", ["بنووسە بە چ مەرجێک دەگەڕێتەوە، بۆ نموونە: «پێشەکی پارەی تەواو دەدات»"])
      : withFix("هۆکارەکە نەنووسراوە.", ["لە خانەی تێبینی بنووسە چی ڕوویداوە"]));
  }
  const now = await getCustomerStanding(input.customerId);
  if (input.event === "cleared" && now.standing === "ok") {
    throw new Error(withFix("ئەم کڕیارە هیچ ئاگادارییەکی لەسەر نییە.", ["پەڕەکە نوێ بکەوە"]));
  }
  if (input.event === "blocked" && now.standing === "blocked") {
    throw new Error(withFix("ئەم کڕیارە پێشتر لە لیستی ڕەشدایە.", ["پەڕەکە نوێ بکەوە"]));
  }
  await db.insert(customerStanding).values({
    customerId: input.customerId,
    event: input.event,
    reason: input.event === "cleared" ? null : input.reason ?? null,
    text: (input.text ?? "").trim() || null,
    createdById: userId,
  });
  appLogger.info("[CustomerStanding] recorded", { customerId: input.customerId, event: input.event, reason: input.reason ?? null, userId });
  return getCustomerStanding(input.customerId);
}

/**
 * The one check every door that buys for a customer goes through
 * (fullPackage.db createFullPackageOrder). The refusal names the reason and
 * the way out, so nobody has to ask why the order would not save.
 */
export async function assertMayOrderFor(customerId: number | null | undefined): Promise<void> {
  const id = Number(customerId) || 0;
  if (id <= 0) return;
  const now = await getCustomerStanding(id);
  if (mayOrderFor(now.standing)) return;
  const why = now.current?.reason ? STANDING_REASON_WORDS[now.current.reason as StandingReason]?.ku : null;
  const said = [why, now.current?.text].filter(Boolean).join(" — ");
  throw new Error(withFix(
    `ئەم کڕیارە لە لیستی ڕەشدایە${said ? `: ${said}` : ""}. هیچ داواکارییەکی نوێی بۆ ناکڕدرێت.`,
    ["ئەگەر هەڵەیە یان کڕیارەکە مەرجەکەی قبوڵ کردووە، ئادمینی سەرەکی لە «لیستی ڕەش» دەری دەکات و مەرجەکە دەنووسێت", "ئینجا داواکارییەکە دووبارە هەڵبگرە"],
  ));
}
