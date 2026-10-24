/**
 * The dispatch check in China (owner, 2026-10-24).
 *
 * «پاش ئەوەی باچ دروست کرا رۆژانە پارچەکان یەک یەک تۆماری خێرایی بۆ کرا لە
 * چین, پاشان کە دەخرێتە ناو کارتۆن دووبارە بە سکان بخرێتە ناو کارتۆن» - so a
 * parcel that was never registered, or was registered on another batch, is
 * caught in China instead of in Erbil. Every parcel of the batch is scanned
 * into a numbered carton; the batch is finished when none is left out, or by
 * an admin working in China (or the main admin) with a reason. Erbil is told
 * on the bell and gets the cartons' list; its arrival check then knows which
 * carton a missing parcel was in.
 *
 * Money is never moved here. «Move it into this batch» only moves a parcel
 * whose account stays right: not charged yet, or charged at the same rate the
 * new batch charges its owner.
 */
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { batches, batchCartons, batchCartonItems, packages, customers, users, countries } from "../../drizzle/schema";
import { getBatchById, getBatchRateForCustomer } from "./batches.db";
import { withFix } from "@shared/fixAdvice";

export type DispatchScan =
  | { kind: "added"; packageId: number; trackingNumber: string; customerCode: string | null; cartonNo: number }
  | { kind: "already_here"; trackingNumber: string; cartonNo: number }
  | { kind: "in_other_carton"; trackingNumber: string; cartonNo: number }
  | { kind: "not_registered"; code: string }
  | { kind: "other_batch"; packageId: number; trackingNumber: string; batchId: number | null; batchCode: string | null; customerCode: string | null };

async function need() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** Is this member of staff working in China? Their country, as set on the staff list. */
export async function worksInChina(userId: number): Promise<boolean> {
  const db = await need();
  const [row] = await db
    .select({ iso: countries.isoCode })
    .from(users)
    .leftJoin(countries, eq(countries.id, users.workCountryId))
    .where(eq(users.id, userId))
    .limit(1);
  return String(row?.iso ?? "").toUpperCase() === "CN";
}

/** May this person finish a batch's dispatch with parcels left out? */
export async function mayFinishDispatchShort(user: { id: number; role: string }): Promise<boolean> {
  if (user.role === "super_admin") return true;
  return user.role === "admin" && (await worksInChina(user.id));
}

/** The batch, its cartons with their parcels, and the parcels in no carton. */
export async function getDispatchState(batchId: number) {
  const db = await need();
  const batch = await getBatchById(batchId);
  if (!batch) return null;

  const cartons = await db.select().from(batchCartons).where(eq(batchCartons.batchId, batchId)).orderBy(asc(batchCartons.cartonNo));
  const items = await db
    .select({
      id: batchCartonItems.id,
      cartonId: batchCartonItems.cartonId,
      packageId: batchCartonItems.packageId,
      trackingNumber: batchCartonItems.trackingNumber,
      scannedAt: batchCartonItems.scannedAt,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(batchCartonItems)
    .leftJoin(packages, eq(packages.id, batchCartonItems.packageId))
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(eq(batchCartonItems.batchId, batchId))
    .orderBy(asc(batchCartonItems.scannedAt));

  const parcels = await db
    .select({
      id: packages.id,
      packageCode: packages.packageCode,
      trackingNumber: packages.trackingNumber,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
    })
    .from(packages)
    .leftJoin(customers, eq(customers.id, packages.customerId))
    .where(and(eq(packages.batchId, batchId), ne(packages.status, "cancelled")));
  const packed = new Set(items.map((i) => i.packageId));
  const unpacked = parcels.filter((p) => !packed.has(p.id));

  const checkedBy = batch.dispatchCheckedById
    ? (await db.select({ name: users.name }).from(users).where(eq(users.id, batch.dispatchCheckedById)).limit(1))[0]?.name ?? null
    : null;

  return {
    batch: {
      id: batch.id,
      batchCode: batch.batchCode,
      shippingType: batch.shippingType,
      status: batch.status,
      dispatchCheckedAt: batch.dispatchCheckedAt ?? null,
      dispatchCheckedBy: checkedBy,
      dispatchNote: batch.dispatchNote ?? null,
    },
    cartons: cartons.map((c) => ({
      id: c.id,
      cartonNo: c.cartonNo,
      status: c.status,
      weightKg: c.weightKg,
      items: items.filter((i) => i.cartonId === c.id),
    })),
    unpacked,
    totalParcels: parcels.length,
    packedParcels: parcels.length - unpacked.length,
  };
}

/** A new carton, numbered after the batch's last one. */
export async function openCarton(batchId: number, userId: number) {
  const db = await need();
  const batch = await getBatchById(batchId);
  if (!batch) throw new Error(withFix("ئەم باچە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]));
  const [last] = await db
    .select({ n: sql<number>`COALESCE(MAX(${batchCartons.cartonNo}), 0)` })
    .from(batchCartons)
    .where(eq(batchCartons.batchId, batchId));
  const cartonNo = Number(last?.n ?? 0) + 1;
  const res = await db.insert(batchCartons).values({ batchId, cartonNo, createdById: userId });
  return { id: Number((res as any)[0]?.insertId), cartonNo };
}

async function cartonOf(cartonId: number) {
  const db = await need();
  const [c] = await db.select().from(batchCartons).where(eq(batchCartons.id, cartonId)).limit(1);
  return c ?? null;
}

async function findParcel(code: string) {
  const db = await need();
  const clean = code.trim();
  const [byTracking] = await db.select().from(packages).where(eq(packages.trackingNumber, clean)).limit(1);
  if (byTracking) return byTracking;
  const [byCode] = await db.select().from(packages).where(eq(packages.packageCode, clean)).limit(1);
  return byCode ?? null;
}

/** One parcel scanned into a carton: the four answers the screen shows. */
export async function scanIntoCarton(input: { cartonId: number; code: string }, userId: number): Promise<DispatchScan> {
  const db = await need();
  const carton = await cartonOf(input.cartonId);
  if (!carton) throw new Error(withFix("ئەم کارتۆنە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]));
  if (carton.status !== "open") {
    throw new Error(withFix(`کارتۆنی ${carton.cartonNo} داخراوە.`, ["کارتۆنەکە بکەرەوە، یان کارتۆنێکی نوێ دەست پێ بکە"]));
  }

  const pkg = await findParcel(input.code);
  if (!pkg) return { kind: "not_registered", code: input.code.trim() };
  const trackingNumber = pkg.trackingNumber || pkg.packageCode;

  if (pkg.batchId !== carton.batchId) {
    const other = pkg.batchId ? await getBatchById(pkg.batchId) : null;
    const [owner] = pkg.customerId
      ? await db.select({ code: customers.customerCode }).from(customers).where(eq(customers.id, pkg.customerId)).limit(1)
      : [];
    return { kind: "other_batch", packageId: pkg.id, trackingNumber, batchId: pkg.batchId ?? null, batchCode: other?.batchCode ?? null, customerCode: owner?.code ?? null };
  }

  let [existing] = await db
    .select({ id: batchCartonItems.id, cartonId: batchCartonItems.cartonId, cartonNo: batchCartons.cartonNo, batchId: batchCartonItems.batchId })
    .from(batchCartonItems)
    .innerJoin(batchCartons, eq(batchCartons.id, batchCartonItems.cartonId))
    .where(eq(batchCartonItems.packageId, pkg.id))
    .limit(1);
  // Packed for a batch it has since left: that carton no longer holds it.
  if (existing && existing.batchId !== carton.batchId) {
    await db.delete(batchCartonItems).where(eq(batchCartonItems.id, existing.id));
    existing = undefined as unknown as typeof existing;
  }
  if (existing) {
    return existing.cartonId === carton.id
      ? { kind: "already_here", trackingNumber, cartonNo: existing.cartonNo }
      : { kind: "in_other_carton", trackingNumber, cartonNo: existing.cartonNo };
  }

  await db.insert(batchCartonItems).values({ cartonId: carton.id, batchId: carton.batchId, packageId: pkg.id, trackingNumber, scannedById: userId });
  const [owner] = pkg.customerId
    ? await db.select({ code: customers.customerCode }).from(customers).where(eq(customers.id, pkg.customerId)).limit(1)
    : [];
  return { kind: "added", packageId: pkg.id, trackingNumber, customerCode: owner?.code ?? null, cartonNo: carton.cartonNo };
}

/**
 * Whether a parcel can move into another batch from here without its account
 * going wrong: not charged yet, or charged at the rate the new batch charges
 * its owner. Anything else is the office's to move, by the parcel's edit.
 */
export async function batchMoveRefusal(packageId: number, toBatchId: number): Promise<string | null> {
  const db = await need();
  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) return withFix("ئەم پاکەتە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]);
  if (!pkg.isCharged || !pkg.customerId || !pkg.batchId) return null;
  const from = await getBatchById(pkg.batchId);
  const to = await getBatchById(toBatchId);
  if (!from || !to) return null;
  const unit = (b: typeof from) => (b.shippingType === "sea" ? "cbm" : "kg") as "kg" | "cbm";
  if (unit(from) !== unit(to)) {
    return withFix(`پاکەتەکە لەسەر ${from.batchCode} حیساب کراوە و ${to.batchCode} جۆرێکی تری گواستنەوەیە (ئاسمانی/دەریایی).`, [
      "ئۆفیسی هەولێر ئاگادار بکە با لە «هەموو پاکەتەکان» بیگوازێتەوە",
    ]);
  }
  const [a, b] = await Promise.all([
    getBatchRateForCustomer(from.id, pkg.customerId, { unit: unit(from) }),
    getBatchRateForCustomer(to.id, pkg.customerId, { unit: unit(to) }),
  ]);
  if (Math.abs(Number(a.rate) - Number(b.rate)) > 0.0001) {
    return withFix(
      `پاکەتەکە بە نرخی ${from.batchCode} ($${Number(a.rate).toFixed(2)}) حیساب کراوە؛ ${to.batchCode} نرخێکی ترە ($${Number(b.rate).toFixed(2)}). گواستنەوەی لێرە حیسابی کڕیار هەڵە دەکات.`,
      ["پاکەتەکە لاوە دابنێ", "ئۆفیسی هەولێر ئاگادار بکە با لە «هەموو پاکەتەکان» بیگوازێتەوە"],
    );
  }
  return null;
}

export async function getDispatchCarton(cartonId: number) {
  return cartonOf(cartonId);
}

/** A parcel leaving its batch leaves the batch's cartons with it. */
export async function removeParcelFromCartons(packageId: number) {
  const db = await need();
  await db.delete(batchCartonItems).where(eq(batchCartonItems.packageId, packageId));
}

export async function removeFromCarton(itemId: number) {
  const db = await need();
  await db.delete(batchCartonItems).where(eq(batchCartonItems.id, itemId));
  return { success: true };
}

export async function closeCarton(cartonId: number, weightKg: number | null, userId: number) {
  const db = await need();
  await db.update(batchCartons).set({
    status: "closed",
    closedAt: new Date(),
    closedById: userId,
    weightKg: weightKg !== null && weightKg > 0 ? weightKg.toFixed(2) : null,
  }).where(eq(batchCartons.id, cartonId));
  return { success: true };
}

export async function reopenCarton(cartonId: number) {
  const db = await need();
  await db.update(batchCartons).set({ status: "open", closedAt: null, closedById: null }).where(eq(batchCartons.id, cartonId));
  return { success: true };
}

/**
 * The batch's dispatch finished. Every parcel in a carton - or, when some
 * are left out, an admin working in China (or the main admin) and a reason.
 */
export async function finishDispatch(input: { batchId: number; note?: string | null }, user: { id: number; role: string }) {
  const db = await need();
  const state = await getDispatchState(input.batchId);
  if (!state) throw new Error(withFix("ئەم باچە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە"]));
  if (state.cartons.length === 0) {
    throw new Error(withFix("هیچ کارتۆنێک بۆ ئەم باچە نییە.", ["کارتۆنێک بکەرەوە و پاکێجەکان سکان بکە"]));
  }
  const note = String(input.note ?? "").trim();
  if (state.unpacked.length > 0) {
    if (!(await mayFinishDispatchShort(user))) {
      throw new Error(withFix(
        `${state.unpacked.length} پاکێج لەسەر ئەم باچەن بەڵام لە هیچ کارتۆنێکدا نین.`,
        ["هەر پاکێجێک بدۆزەوە و سکانی بکە بۆ ناو کارتۆن", "یان بیگوازەوە بۆ باچی داهاتوو", "یان ئادمینی چین ئاگادار بکە"],
      ));
    }
    if (note.length < 3) {
      throw new Error(withFix(
        `${state.unpacked.length} پاکێج لە هیچ کارتۆنێکدا نین - هۆکارێک بنووسە.`,
        ["بنووسە بۆچی باچەکە بەبێ ئەوان دەڕوات (بۆ نموونە: بۆ باچی داهاتوو دەمێنن)"],
      ));
    }
  }
  // Every carton still open is closed with it.
  await db.update(batchCartons).set({ status: "closed", closedAt: new Date(), closedById: user.id })
    .where(and(eq(batchCartons.batchId, input.batchId), eq(batchCartons.status, "open")));
  await db.update(batches).set({
    dispatchCheckedAt: new Date(),
    dispatchCheckedById: user.id,
    dispatchNote: state.unpacked.length > 0 ? note : null,
  }).where(eq(batches.id, input.batchId));
  return { cartons: state.cartons.length, parcels: state.packedParcels, leftOut: state.unpacked.length };
}

/** The batch whose dispatch check was finished last - where the bell's notice opens. */
export async function latestDispatchedBatchId(): Promise<number | null> {
  const db = await need();
  const [row] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(isNotNull(batches.dispatchCheckedAt))
    .orderBy(sql`${batches.dispatchCheckedAt} DESC`)
    .limit(1);
  return row ? Number(row.id) : null;
}

/** Batches whose dispatch was finished in the last hours - the bell's notice. */
export async function countRecentDispatches(hours = 48): Promise<number> {
  const db = await need();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(batches)
    .where(and(isNotNull(batches.dispatchCheckedAt), sql`${batches.dispatchCheckedAt} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${hours} HOUR)`));
  return Number(row?.n ?? 0);
}

/** The carton each parcel of these batches went in - for the arrival check in Erbil. */
export async function cartonsOfBatches(batchIds: number[]): Promise<Array<{ packageId: number; batchId: number; cartonNo: number }>> {
  if (batchIds.length === 0) return [];
  const db = await need();
  return db
    .select({ packageId: batchCartonItems.packageId, batchId: batchCartonItems.batchId, cartonNo: batchCartons.cartonNo })
    .from(batchCartonItems)
    .innerJoin(batchCartons, eq(batchCartons.id, batchCartonItems.cartonId))
    .where(inArray(batchCartonItems.batchId, batchIds));
}
