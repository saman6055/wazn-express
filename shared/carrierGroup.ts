/**
 * One carrier shipment, several of our batches (owner, 2026-10-28).
 *
 * ANC's "Batch 169" - 276 kg, $2,428.80 - can hold two China batches and an
 * Erbil one. The batches that carry the same carrier batch number are one
 * group; the invoice is written once, and:
 *
 *   - ours is the kilos our customers were charged on: the China batches'
 *     parcels as registered in China, the Erbil batch's as Quick Register
 *     weighed them (the owner: «بە گوێرەی کێشی کریار پارە وەردەگرم»);
 *   - ours against the carrier's says whether the carrier billed us for
 *     more than we billed our customers;
 *   - the invoice is shared out by those same kilos, so each batch's cost
 *     and profit stand on the measure its revenue stands on.
 */

/** "anc 169", "ANC-169", " ANC169 " -> "ANC 169": the same number however it was typed. */
export function normalizeCarrierBatchNo(input: string | null | undefined): string | null {
  const t = String(input ?? "").trim().toUpperCase().replace(/[\s\-_]+/g, " ");
  if (!t) return null;
  // Letters then digits with nothing between them: "ANC169" -> "ANC 169".
  return t.replace(/^([A-Z]+)\s?(\d+)$/, "$1 $2").slice(0, 64);
}

/** The Erbil twin's code: the China batch's own, with "Erbil" after it. */
export function twinBatchCode(chinaCode: string): string {
  return `${chinaCode.trim()} Erbil`.slice(0, 50);
}

const cents = (n: number) => Math.round(n * 100) / 100;

export interface GroupMember {
  batchId: number;
  /** What its customers were charged on, all its parcels. */
  kg: number;
}

/**
 * The invoice shared by kilos. Rounded to cents with the leftover cent on
 * the largest share, so the shares always add up to the invoice exactly.
 */
export function splitGroupInvoice(members: GroupMember[], billedKg: number, costUsd: number) {
  const total = members.reduce((s, m) => s + Math.max(0, m.kg), 0);
  if (!(total > 0)) return members.map((m) => ({ batchId: m.batchId, costUsd: 0, billedKg: 0, share: 0 }));
  const rows = members.map((m) => {
    const share = Math.max(0, m.kg) / total;
    return { batchId: m.batchId, share, costUsd: cents(costUsd * share), billedKg: cents(billedKg * share) };
  });
  const fix = (field: "costUsd" | "billedKg", target: number) => {
    const diff = cents(target - rows.reduce((s, r) => s + r[field], 0));
    if (diff !== 0) {
      const biggest = rows.reduce((a, b) => (b.share > a.share ? b : a));
      biggest[field] = cents(biggest[field] + diff);
    }
  };
  fix("costUsd", cents(costUsd));
  fix("billedKg", cents(billedKg));
  return rows;
}

/** Below this the two weights agree - rounding, a carton weighed a little differently. */
export const GROUP_KG_TOLERANCE = 0.5;

export type GroupVerdict = "no-invoice" | "waiting" | "even" | "ahead" | "short";

/**
 * Ours against the carrier's. "waiting" while goods are still to arrive or be
 * registered; then "short" when the carrier billed more than our customers
 * were charged on, "ahead" when less.
 */
export function groupVerdict(f: { billedKg: number | null; oursKg: number; stillComing: number }): GroupVerdict {
  if (!(Number(f.billedKg) > 0)) return "no-invoice";
  const diff = f.oursKg - Number(f.billedKg);
  if (f.stillComing > 0 && diff < -GROUP_KG_TOLERANCE) return "waiting";
  if (diff < -GROUP_KG_TOLERANCE) return "short";
  if (diff > GROUP_KG_TOLERANCE) return "ahead";
  return "even";
}

/** What the difference is worth, at the invoice's own rate per kilo. */
export function groupDifferenceUsd(f: { billedKg: number; costUsd: number; oursKg: number }): number {
  if (!(f.billedKg > 0)) return 0;
  return cents((f.oursKg - f.billedKg) * (f.costUsd / f.billedKg));
}
