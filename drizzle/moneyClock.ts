/**
 * The day money was paid, when it is entered later (owner, 2026-11-12: Sayf
 * paid on the 8th and was entered on the 12th - «تاریخی پارەدان و تاریخی
 * داخل کردنیش هەبێ»).
 *
 * The office records the payment inside `withPaidAt(moment, ...)`. While that
 * runs, every money row written - the ledger rows, the payment record, the box
 * receipt and its lines - takes the paid moment as its date (createdAt) and
 * the real moment of entry as `enteredAt`. So every report, statement and the
 * bell put the money on the day it was paid, and nobody can type the entry
 * moment: it is the clock's.
 *
 * Outside that scope nothing changes: the database stamps createdAt as before
 * and enteredAt stays empty (empty = entered when dated).
 *
 * Server only (node:async_hooks); the schema reads it through $defaultFn.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const scope = new AsyncLocalStorage<{ paidAt: Date }>();

/** Run `fn` with its money dated `paidAt`; null runs it as today. */
export function withPaidAt<T>(paidAt: Date | null, fn: () => Promise<T>): Promise<T> {
  return paidAt ? scope.run({ paidAt }, fn) : fn();
}

/** The paid moment of the payment being recorded, or null when it is today. */
export function moneyMoment(): Date | null {
  return scope.getStore()?.paidAt ?? null;
}
