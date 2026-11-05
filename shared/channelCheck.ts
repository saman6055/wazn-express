/**
 * The weekly look at FIB and Qi Card (owner, 2026-11-05): no spending typed
 * one by one. Each check is the two balances the apps show, in dinars,
 * turned into dollars at the last box receipt's rate. Between two checks:
 *
 *   went out = balance before + money received there − balance now
 *
 * "Received there" is the box payments marked FIB or Qi Card (CARD) in that
 * stretch. What went out is spending the books may or may not hold; it is
 * shown, never written anywhere.
 */
export const CHANNEL_CHECKS_KEY = "workingCapital.channelChecks";
export const CHANNEL_CHECKS_KEEP = 60;

export interface ChannelCheck {
  at: string;
  rate: number;
  fibIqd: number;
  qiIqd: number;
  fibUsd: number;
  qiUsd: number;
  /** Money received there since the check before; null for the first. */
  fibInUsd: number | null;
  qiInUsd: number | null;
  /** What went out there since the check before; null for the first. */
  fibOutUsd: number | null;
  qiOutUsd: number | null;
}

const cents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function makeChannelCheck(
  input: { at: string; rate: number; fibIqd: number; qiIqd: number },
  before: ChannelCheck | null,
  received: { fibUsd: number; qiUsd: number } | null,
): ChannelCheck {
  const fibUsd = input.rate > 0 ? cents(input.fibIqd / input.rate) : 0;
  const qiUsd = input.rate > 0 ? cents(input.qiIqd / input.rate) : 0;
  const first = !before || !received;
  return {
    at: input.at,
    rate: input.rate,
    fibIqd: input.fibIqd,
    qiIqd: input.qiIqd,
    fibUsd,
    qiUsd,
    fibInUsd: first ? null : cents(received!.fibUsd),
    qiInUsd: first ? null : cents(received!.qiUsd),
    fibOutUsd: first ? null : cents(before!.fibUsd + received!.fibUsd - fibUsd),
    qiOutUsd: first ? null : cents(before!.qiUsd + received!.qiUsd - qiUsd),
  };
}

export function parseChannelChecks(raw: string | null | undefined): ChannelCheck[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v.filter((c) => c && typeof c.at === "string" && Number.isFinite(Number(c.fibUsd))) as ChannelCheck[]) : [];
  } catch {
    return [];
  }
}
