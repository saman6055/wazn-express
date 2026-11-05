/**
 * "These parcels have no price because batch X has no selling price yet."
 *
 * The box payment refuses a parcel whose batch is still waiting for its
 * selling price (server/db/boxSettlement.db.ts). The cure is on the batch, so
 * the refusal has to open it (owner, 2026-11-05: «خۆشە لینکی کێشە هەبێت و
 * بچێتە سەر خوودی کێشەکە»). The sentence is written here and read back here,
 * so the window that shows it can always find the batch codes it names.
 */
import { withFix } from "./fixAdvice";

const JOIN = "، ";
const LEAD = "ئەم پاکەتانە نرخیان نییە، چونکە باچی ";
const TAIL = " هێشتا نرخی فرۆشتنی نییە: ";

export function unpricedBatchRefusal(codes: readonly string[], trackings: readonly string[]): string {
  const named = codes.join(JOIN);
  return withFix(
    `${LEAD}${named}${TAIL}${trackings.join(JOIN)} — بەم شێوەیە بە خۆڕایی دەدرێن.`,
    [
      `نرخی فرۆشتن بۆ باچی ${named} بنووسە، ئینجا دووبارە واصڵ بکە`,
      "یان ئەم پاکەتانە «تەحدید» بکە (بمێننەوە) و پاکەتەکانی تر واصڵ بکە",
    ],
  );
}

/** The batch codes an unpriced-batch refusal names; empty for any other message. */
export function batchCodesInRefusal(message: string | null | undefined): string[] {
  const text = message ?? "";
  const start = text.indexOf(LEAD);
  if (start < 0) return [];
  const from = start + LEAD.length;
  const end = text.indexOf(TAIL, from);
  if (end < 0) return [];
  return text.slice(from, end).split(JOIN).map((c) => c.trim()).filter(Boolean);
}

/** Opens the batch's edit window, where the selling price is written. */
export function batchEditHref(code: string): string {
  return `/batches?edit=${encodeURIComponent(code)}`;
}
