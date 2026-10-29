/**
 * What a batch is inside its carrier group, said in one word (owner,
 * 2026-10-29: «حەق وایە باچی ئۆریجنال بە جۆرێک دیاربێت کە ئۆریجنالە، لەگەڵ
 * باچی وابەستە جیا بکرێتەوە»).
 *
 *   original - the China batch an Erbil twin was made from
 *   twin     - that Erbil twin
 *   partial  - a batch only part of which came on this load
 *   shared   - any other batch carrying the same carrier number
 */
export type BatchRole = "original" | "twin" | "partial" | "shared";

export function batchRole(m: { batchId: number; twinOfBatchId: number | null; partial?: boolean }, members: ReadonlyArray<{ twinOfBatchId: number | null }>): BatchRole {
  if (m.twinOfBatchId != null) return "twin";
  if (members.some((x) => x.twinOfBatchId === m.batchId)) return "original";
  if (m.partial) return "partial";
  return "shared";
}

export const BATCH_ROLE_LABEL: Record<BatchRole, { ku: string; en: string; ar: string; zh: string }> = {
  original: { ku: "ئەسڵی", en: "Original", ar: "الأصل", zh: "原批次" },
  twin: { ku: "توین", en: "Twin", ar: "توأم", zh: "孪生" },
  partial: { ku: "بەشێکی", en: "Part", ar: "جزء", zh: "部分" },
  shared: { ku: "هاوبەش", en: "Shared", ar: "مشترك", zh: "共用" },
};

/** Original stands out (solid); the batches that hang on it are outlined. */
export const BATCH_ROLE_TONE: Record<BatchRole, string> = {
  original: "bg-amber-500 text-white dark:bg-amber-500 dark:text-amber-950",
  twin: "border border-violet-400 text-violet-700 dark:border-violet-500 dark:text-violet-300",
  partial: "border border-sky-400 text-sky-700 dark:border-sky-500 dark:text-sky-300",
  shared: "border border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300",
};
