import { sql } from "drizzle-orm";
import { getDb } from "../db/connection";
import { appLogger } from "../utils/logger";
import { EMPTY_DAY, movementSignals, rankSignals, summarise, headline, type DaySnapshot, type Signal } from "@shared/dailyBrief";
import { CHECKS, checkDefinition, type CheckResult } from "@shared/auditSweep";
import { runSweep } from "./auditSweep.service";

/**
 * The morning brief, assembled.
 *
 * Everything this reads is already known somewhere in the system. What it adds
 * is comparison and rank: the same figures against yesterday and against last
 * week, the sweep's findings, and the work that has stopped moving — in one
 * list, worst first.
 *
 * It writes exactly one thing: a row in dailySnapshots, which is the memory
 * that makes "down 12%" possible tomorrow. Nothing else in this file changes a
 * record, computes a charge, or sends anything to anybody. The brief reports.
 */

type Row = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

/** Yesterday and today as YYYY-MM-DD, in the server's own timezone. */
function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * One day's figures, straight from the records.
 *
 * Each figure is its own guarded query. A business measured by eight numbers
 * should not lose all eight because one table was renamed — a missing figure
 * reads as zero and the brief simply has less to say, which is recoverable.
 */
async function measureDay(dateKey: string): Promise<DaySnapshot> {
  const db = await getDb();
  if (!db) return { ...EMPTY_DAY };

  const one = async (label: string, query: string): Promise<number> => {
    try {
      const [rows] = (await db.execute(sql.raw(query))) as unknown as [Row[]];
      return num(Array.isArray(rows) && rows[0] ? Object.values(rows[0])[0] : 0);
    } catch (error) {
      appLogger.warn(`Daily brief figure failed: ${label}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  };

  const d = `'${dateKey}'`;

  const [
    revenueUsd,
    expensesUsd,
    parcelsRegistered,
    parcelsDelivered,
    newCustomers,
    kilos,
    outstandingDebtUsd,
    openBatches,
  ] = await Promise.all([
    one("revenue", `SELECT COALESCE(SUM(CAST(amountUsd AS DECIMAL(14,2))),0) FROM paymentRecords WHERE DATE(createdAt) = ${d}`),
    one("expenses", `SELECT COALESCE(SUM(CAST(amountUsd AS DECIMAL(14,2))),0) FROM expenses WHERE DATE(expenseDate) = ${d}`),
    one("registered", `SELECT COUNT(*) FROM packages WHERE DATE(createdAt) = ${d}`),
    one("delivered", `SELECT COUNT(*) FROM packages WHERE DATE(deliveredAt) = ${d}`),
    one("customers", `SELECT COUNT(*) FROM customers WHERE DATE(createdAt) = ${d}`),
    one("kilos", `SELECT COALESCE(SUM(CAST(weightKg AS DECIMAL(14,3))),0) FROM packages WHERE DATE(createdAt) = ${d}`),
    // Debt is a standing total rather than a daily one: what is owed right
    // now, which is the figure that matters and the one worth watching move.
    one("debt", `SELECT COALESCE(SUM(CAST(currentBalanceUsd AS DECIMAL(14,2))),0) FROM customerAccounts WHERE CAST(currentBalanceUsd AS DECIMAL(14,2)) > 0`),
    one("openBatches", `SELECT COUNT(*) FROM batches WHERE status NOT IN ('delivered','closed')`),
  ]);

  return {
    revenueUsd,
    expensesUsd,
    parcelsRegistered,
    parcelsDelivered,
    newCustomers,
    kilos: Math.round(kilos * 1000) / 1000,
    outstandingDebtUsd,
    openBatches,
  };
}

/** Read a stored day, if there is one. */
async function storedDay(dateKey: string): Promise<DaySnapshot | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [rows] = (await db.execute(
      sql.raw(`SELECT * FROM dailySnapshots WHERE snapshotDate = '${dateKey}' LIMIT 1`),
    )) as unknown as [Row[]];
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return null;

    return {
      revenueUsd: num(row.revenueUsd),
      expensesUsd: num(row.expensesUsd),
      parcelsRegistered: num(row.parcelsRegistered),
      parcelsDelivered: num(row.parcelsDelivered),
      newCustomers: num(row.newCustomers),
      kilos: num(row.kilos),
      outstandingDebtUsd: num(row.outstandingDebtUsd),
      openBatches: num(row.openBatches),
    };
  } catch (error) {
    appLogger.warn("Daily brief could not read a stored day", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Write yesterday down.
 *
 * The one write in this file, and it is a record of what was, never a change
 * to it. Idempotent on the date, so running twice on the same morning — or a
 * restart mid-run — leaves one row rather than two.
 */
export async function captureSnapshot(dateKey = dayKey(-1)): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const day = await measureDay(dateKey);

  try {
    await db.execute(
      sql`INSERT INTO dailySnapshots
        (snapshotDate, revenueUsd, expensesUsd, parcelsRegistered, parcelsDelivered, newCustomers, kilos, outstandingDebtUsd, openBatches)
        VALUES (${dateKey}, ${day.revenueUsd}, ${day.expensesUsd}, ${day.parcelsRegistered}, ${day.parcelsDelivered},
                ${day.newCustomers}, ${day.kilos}, ${day.outstandingDebtUsd}, ${day.openBatches})
        ON DUPLICATE KEY UPDATE
          revenueUsd = VALUES(revenueUsd),
          expensesUsd = VALUES(expensesUsd),
          parcelsRegistered = VALUES(parcelsRegistered),
          parcelsDelivered = VALUES(parcelsDelivered),
          newCustomers = VALUES(newCustomers),
          kilos = VALUES(kilos),
          outstandingDebtUsd = VALUES(outstandingDebtUsd),
          openBatches = VALUES(openBatches)`,
    );
    appLogger.info("Daily snapshot stored", { date: dateKey });
  } catch (error) {
    appLogger.error("Daily snapshot failed", {
      date: dateKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The sweep's findings, as brief signals.
 *
 * A check that could not run outranks one that found something: not knowing
 * whether the books balance is a worse state than knowing they do not, because
 * the reader cannot tell what it is hiding.
 */
function sweepSignals(results: readonly CheckResult[]): Signal[] {
  const out: Signal[] = [];

  for (const result of results) {
    if (result.status === "clean") continue;
    const def = checkDefinition(result.id);
    if (!def) continue;

    if (result.status === "failed") {
      out.push({
        id: `sweep:${result.id}`,
        kind: "risk",
        weight: "urgent",
        title: {
          ku: `پشکنین نەیتوانی کاربکات — ${def.title.ku}`,
          en: `A check could not run — ${def.title.en}`,
          ar: `تعذّر تنفيذ فحص — ${def.title.ar}`,
          zh: `一项检查无法运行——${def.title.zh}`,
        },
        detail: {
          ku: "ئەمە واتای ئەوە نییە هەموو شتێک ڕێکە — واتای ئەوەیە سەیر نەکراوە.",
          en: "This does not mean all is well. It means nothing looked.",
          ar: "هذا لا يعني أن كل شيء سليم، بل أن أحداً لم ينظر.",
          zh: "这不代表一切正常，而是根本没有检查。",
        },
        path: "/audit-sweep",
      });
      continue;
    }

    out.push({
      id: `sweep:${result.id}`,
      kind: "risk",
      // Money that contradicts itself needs somebody today. Stalled work needs
      // somebody this week.
      weight: def.severity === "critical" ? "urgent" : def.severity === "warning" ? "notable" : "quiet",
      title: def.title,
      value: String(result.count),
      detail: def.meaning,
      path: def.path ?? "/audit-sweep",
    });
  }

  return out;
}

export interface DailyBrief {
  ranAt: Date;
  headline: { ku: string; en: string; ar: string; zh: string };
  summary: ReturnType<typeof summarise>;
  signals: Signal[];
  today: DaySnapshot;
  yesterday: DaySnapshot | null;
  lastWeek: DaySnapshot | null;
  /** True when no stored day was found to compare against yet. */
  firstMorning: boolean;
}

/**
 * Everything, in one call.
 *
 * Today is measured live; yesterday and the same weekday last week come from
 * the snapshots. A first run has nothing to compare against and says so rather
 * than reporting every figure as a rise from nothing.
 */
export async function buildDailyBrief(): Promise<DailyBrief> {
  const todayKey = dayKey(0);

  const [today, yesterday, lastWeek, sweep] = await Promise.all([
    measureDay(todayKey),
    storedDay(dayKey(-1)),
    storedDay(dayKey(-7)),
    runSweep(),
  ]);

  const signals: Signal[] = [...sweepSignals(sweep)];

  // Against yesterday, and — where there is one — against the same weekday a
  // week ago. A Friday compared with a Thursday says more about the week than
  // about the business.
  if (yesterday) signals.push(...movementSignals(today, yesterday));

  if (lastWeek) {
    for (const s of movementSignals(today, lastWeek)) {
      // Only add the week-on-week view when the day-on-day one did not already
      // make the point, so the same metric is not reported twice.
      if (signals.some((existing) => existing.id === s.id)) continue;
      signals.push({
        ...s,
        id: `${s.id}:week`,
        weight: "quiet",
        detail: {
          ku: `${s.detail?.ku ?? ""} (بەراورد بە هەفتەی ڕابردوو)`,
          en: `${s.detail?.en ?? ""} (against last week)`,
          ar: `${s.detail?.ar ?? ""} (مقارنة بالأسبوع الماضي)`,
          zh: `${s.detail?.zh ?? ""}（与上周相比）`,
        },
      });
    }
  }

  const ranked = rankSignals(signals);
  const summary = summarise(ranked);

  return {
    ranAt: new Date(),
    headline: headline(summary),
    summary,
    signals: ranked,
    today,
    yesterday,
    lastWeek,
    firstMorning: !yesterday && !lastWeek,
  };
}

/* ─── the morning job ────────────────────────────────────────────────────── */

const HOUR = 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Write yesterday down, once a day.
 *
 * Checked hourly rather than scheduled for a precise minute: a server restart
 * must not cost a day of memory, and an hourly check catches up whenever it
 * comes back. Writing the same day twice is harmless — the insert is
 * idempotent on the date.
 */
export function startDailySnapshots(): void {
  if (timer) return;

  const tick = async () => {
    try {
      await captureSnapshot();
    } catch (error) {
      appLogger.error("Daily snapshot tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Once at boot, so a fresh deployment has a yesterday as soon as it can.
  void tick();
  timer = setInterval(() => void tick(), HOUR);
}

export function stopDailySnapshots(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
