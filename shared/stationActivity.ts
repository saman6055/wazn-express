/**
 * The four scan stations, counted from what each one actually leaves behind
 * (owner, 2026-11-07: «داتاکانی سەتا سەت دروست ببێت»).
 *
 * The scan dashboard used to count `packageScans`, which only the arrival
 * check writes: Quick Register, the batch station and box delivery never did,
 * so three of its four stations read 0 while the work was being done. Each
 * station is now counted from its own event:
 *
 *   registered      the parcel's registration      packages.registeredAt / registeredById
 *   in_batch        the batch station's record     auditLogs 'assign_package_to_batch'
 *   received_local  the arrival scan               packageScans received_local
 *   delivered       the parcel handed over         packages.deliveredAt / deliveredById
 *
 * Days are Erbil days. Iraq keeps UTC+3 all year, so a fixed offset is exact.
 */
export const STATIONS = ["registered", "in_batch", "received_local", "delivered"] as const;
export type Station = (typeof STATIONS)[number];

export const ERBIL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The Erbil calendar day of a moment, as YYYY-MM-DD. */
export function erbilDay(at: Date | number): string {
  const t = typeof at === "number" ? at : at.getTime();
  return new Date(t + ERBIL_OFFSET_MS).toISOString().slice(0, 10);
}

/** The moment an Erbil day starts, in UTC milliseconds. */
export function erbilDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) - ERBIL_OFFSET_MS;
}

export interface StationEvent {
  station: Station;
  at: Date;
  userId: number | null;
}

export interface StationDay {
  date: string;
  registered: number;
  in_batch: number;
  received_local: number;
  delivered: number;
  total: number;
}

export interface StationSummary {
  days: StationDay[];
  today: Record<Station, number>;
  todayTotal: number;
  /** Yesterday from midnight up to this same time of day: a fair comparison mid-morning. */
  yesterdaySoFar: number;
  byUser: Array<{ userId: number; count: number }>;
}

/** Bucket events into the last `days` Erbil days ending today; pure, so it can be tested. */
export function summarizeStations(events: StationEvent[], now: number, days: number): StationSummary {
  const todayKey = erbilDay(now);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(erbilDay(erbilDayStart(todayKey) - i * 86_400_000 + 3_600_000));
  const byDay = new Map<string, StationDay>(keys.map((k) => [k, { date: k, registered: 0, in_batch: 0, received_local: 0, delivered: 0, total: 0 }]));
  const today: Record<Station, number> = { registered: 0, in_batch: 0, received_local: 0, delivered: 0 };
  const users = new Map<number, number>();
  const todayStart = erbilDayStart(todayKey);
  const yStart = todayStart - 86_400_000;
  const yUntil = yStart + (now - todayStart);
  let yesterdaySoFar = 0;
  for (const e of events) {
    const t = e.at.getTime();
    if (Number.isNaN(t) || t > now) continue;
    const row = byDay.get(erbilDay(t));
    if (row) {
      row[e.station] += 1;
      row.total += 1;
    }
    if (t >= todayStart) {
      today[e.station] += 1;
      if (e.userId != null) users.set(e.userId, (users.get(e.userId) ?? 0) + 1);
    } else if (t >= yStart && t <= yUntil) {
      yesterdaySoFar += 1;
    }
  }
  return {
    days: keys.map((k) => byDay.get(k)!),
    today,
    todayTotal: STATIONS.reduce((n, s) => n + today[s], 0),
    yesterdaySoFar,
    byUser: Array.from(users, ([userId, count]) => ({ userId, count })).sort((a, b) => b.count - a.count),
  };
}
