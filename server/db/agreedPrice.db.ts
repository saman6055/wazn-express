import { eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import { packages } from "../../drizzle/schema";
import { shippingChargeDueNow } from "./batchCharging.db";
import { parcelMoneyHold } from "./parcelCorrection.db";
import { repriceOne } from "./smallParcelRebalance.db";
import { createAuditLog } from "./admin.db";
import { createStatusHistory } from "./scanning.db";
import { resolveParcelCost } from "../services/parcelPricing.service";
import { agreedUsd, agreedPriceView, type AgreedPriceView } from "@shared/agreedShipping";
import { withFix } from "@shared/fixAdvice";

/**
 * «نرخی ڕێککەوتوو» — the shipping agreed with the customer for one parcel
 * (owner-approved 2026-11-07, shared/agreedShipping).
 *
 * Set at registration (Quick Register), or later from the parcel or its box
 * line while the box is not receipted. A change re-prices that parcel alone,
 * in place on its own ledger row, through the one correction there is
 * (repriceOne → applyParcelCorrection). Who set it and when goes to the audit
 * log and to the parcel's own history.
 */

type Actor = { id: number; role?: string | null; name?: string | null };

export async function setAgreedShipping(
  packageId: number,
  agreed: number | null,
  actor: Actor,
): Promise<{ changed: boolean; wasUsd: number; nowUsd: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [pkg] = await db.select().from(packages).where(eq(packages.id, packageId)).limit(1);
  if (!pkg) throw new Error(withFix("ئەم پاکەتە نەدۆزرایەوە.", ["لاپەڕەکە نوێ بکەرەوە", "بە تراکەکەی بگەڕێ"]));
  const name = pkg.trackingNumber || pkg.packageCode;
  const next = agreedUsd(agreed);
  const before = agreedUsd(pkg.agreedShippingUsd);
  const wasUsd = Number(pkg.calculatedCostUsd ?? 0) || 0;
  if (next === before) return { changed: false, wasUsd, nowUsd: wasUsd };

  // Box receipted = settled (HARD rule).
  const hold = await parcelMoneyHold(packageId);
  if (hold?.kind === "receipt") {
    throw new Error(withFix(
      `نرخی ڕێککەوتووی پاکەتی ${name} ناگۆڕدرێت: پارەکەی لە وەسڵی ${hold.settlementNumber} ـی بۆکسی ${hold.boxCode ?? ""} وەرگیراوە، و بۆکسی واسڵکراو تەواو بووە.`,
      [
        "ئەگەر بەڕاستی دەبێت بگۆڕدرێت، ئادمینی سەرەکی بۆکسەکە بە هۆکارەوە دەکاتەوە",
        "ئینجا نرخەکە لێرە بگۆڕە و بۆکسەکە دووبارە واسڵ بکەرەوە",
      ],
    ));
  }

  // A charged parcel whose batch would not charge it now cannot be moved from here:
  // its charge came another way, and a correction would take it off whole.
  const fresh = { ...pkg, agreedShippingUsd: next === null ? null : next.toFixed(2) };
  const due = await shippingChargeDueNow(fresh);
  if (pkg.isCharged && !due.due) {
    throw new Error(withFix(
      `نرخی ڕێککەوتووی پاکەتی ${name} لێرە ناگۆڕدرێت: پارەکەی بە ڕێگایەکی کۆن نووسراوە کە ئەم باچە نایناسێتەوە.`,
      [
        "پاکەتەکە بخە ناو بۆکسەکەی و نرخەکە لە شاشەی پارەدانی بۆکس بە «ڕاستکردنەوە» دابنێ",
        "یان ئادمینی سەرەکی ئاگادار بکە",
      ],
    ));
  }

  await db.update(packages).set({ agreedShippingUsd: fresh.agreedShippingUsd }).where(eq(packages.id, packageId));
  try {
    const reason = next === null
      ? `نرخی ڕێککەوتووی پاکەتی ${name} لابرا — دەگەڕێتەوە سەر حیسابی سیستەم`
      : `نرخی ڕێککەوتوو بۆ پاکەتی ${name}: $${next.toFixed(2)}`;
    if (due.due) {
      await repriceOne(fresh, actor, reason);
    } else {
      // Not charged and nothing to charge yet: the stored price follows, no money moves.
      const priced = await resolveParcelCost({
        packageId: pkg.id,
        customerId: pkg.customerId,
        batchId: pkg.batchId,
        originWarehouseId: pkg.originWarehouseId,
        shippingType: pkg.shippingType,
        weightKg: pkg.weightKg,
        lengthCm: pkg.lengthCm,
        widthCm: pkg.widthCm,
        heightCm: pkg.heightCm,
        volumeCbm: pkg.volumeCbm,
        billedWeightKg: pkg.billedWeightKg,
        agreedShippingUsd: next,
      });
      if (priced.costUsd) await db.update(packages).set({ calculatedCostUsd: priced.costUsd }).where(eq(packages.id, packageId));
    }
  } catch (e) {
    await db.update(packages).set({ agreedShippingUsd: pkg.agreedShippingUsd ?? null }).where(eq(packages.id, packageId));
    throw e;
  }

  const [after] = await db.select({ c: packages.calculatedCostUsd }).from(packages).where(eq(packages.id, packageId)).limit(1);
  const nowUsd = Number(after?.c ?? 0) || 0;
  await recordAgreedChange(pkg, before, next, wasUsd, nowUsd, actor);
  return { changed: Math.abs(nowUsd - wasUsd) >= 0.005, wasUsd, nowUsd };
}

/** Who set it and when: the audit log, and the parcel's own history. Never stops the change. */
export async function recordAgreedChange(
  pkg: { id: number; packageCode: string; trackingNumber: string | null; status: string },
  before: number | null,
  next: number | null,
  wasUsd: number,
  nowUsd: number,
  actor: Actor,
): Promise<void> {
  const words = next === null
    ? `نرخی ڕێککەوتوو لابرا (پێشتر $${(before ?? 0).toFixed(2)})`
    : `نرخی ڕێککەوتوو: $${next.toFixed(2)}${before !== null ? ` (پێشتر $${before.toFixed(2)})` : ""}`;
  try {
    await createAuditLog({
      userId: actor.id,
      userName: actor.name ?? null,
      userRole: actor.role ?? null,
      action: "agreed_shipping_price",
      actionLabel: "نرخی ڕێککەوتوو",
      category: "package",
      entityType: "package",
      entityId: pkg.id,
      entityCode: pkg.trackingNumber || pkg.packageCode,
      oldValues: { agreedShippingUsd: before, calculatedCostUsd: wasUsd },
      newValues: { agreedShippingUsd: next, calculatedCostUsd: nowUsd },
      changedFields: ["agreedShippingUsd"],
      description: words,
    });
  } catch { /* the log must not undo the price */ }
  try {
    await createStatusHistory({
      packageId: pkg.id,
      fromStatus: pkg.status,
      toStatus: pkg.status,
      changedById: actor.id,
      changeMethod: "manual",
      reason: "agreed_shipping_price",
      notes: words,
    });
  } catch { /* nor the history line */ }
}

/**
 * The office's line for parcels with an agreed price: agreed, the system's
 * own (the same charge line, with the agreement left out) and the difference.
 * Never sent to a customer.
 */
export async function agreedPriceViewFor(packageIds: number[]): Promise<Map<number, AgreedPriceView & { packageId: number }>> {
  const out = new Map<number, AgreedPriceView & { packageId: number }>();
  const ids = Array.from(new Set(packageIds.filter((id) => id > 0)));
  const db = await getDb();
  if (!db || ids.length === 0) return out;
  const rows = await db.select().from(packages).where(inArray(packages.id, ids));
  for (const pkg of rows) {
    if (agreedUsd(pkg.agreedShippingUsd) === null) continue;
    const due = await shippingChargeDueNow({ ...pkg, agreedShippingUsd: null });
    const view = agreedPriceView(pkg.agreedShippingUsd, due.due ? due.amount : 0);
    if (view) out.set(pkg.id, { ...view, packageId: pkg.id });
  }
  return out;
}
