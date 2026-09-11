import { lockState, registerFailure, type AfterFailure, type LockState } from "@shared/loginLockout";

/**
 * Wrong-password runs for staff accounts.
 *
 * The owner's decision (2026-09-11): five wrong passwords on a staff account
 * shut it for fifteen minutes — the same rule the customer portal has had
 * (shared/loginLockout.ts) — and the super admin can open it early.
 *
 * A customer's run is kept on their row. The staff table has no such columns
 * and the database's shape is not to be touched for this, so the run lives
 * here, in the one server process that answers every sign-in. What that
 * costs: a restart (a redeploy) forgets every run and lifts every lock early.
 * Nobody outside can cause a restart, and ending a lock early is the safe way
 * for this to fail.
 *
 * Names that match no account are counted too, under their own key. If only
 * real accounts could lock, the lock message would tell a stranger which
 * usernames exist.
 */
interface Run {
  failedAttempts: number;
  lastFailedAt: Date;
  lockedUntil: Date | null;
}

const runs = new Map<string, Run>();

/** A ceiling, so a flood of made-up names cannot grow this without end. */
const MAX_RUNS = 5000;

export function staffLockKey(userId: number): string {
  return `user:${userId}`;
}

export function unknownLockKey(identifier: string): string {
  return `name:${identifier.trim().toLowerCase()}`;
}

export function staffLockState(key: string, now: Date): LockState {
  return lockState({ lockedUntil: runs.get(key)?.lockedUntil ?? null, now });
}

/** One more wrong password. Tells the caller whether it just locked. */
export function recordStaffFailure(key: string, now: Date): AfterFailure {
  const run = runs.get(key);
  const after = registerFailure({
    failedAttempts: run?.failedAttempts ?? 0,
    lastFailedAt: run?.lastFailedAt ?? null,
    now,
  });
  // Delete and re-add, so the map's first entries are the longest untouched.
  runs.delete(key);
  runs.set(key, { failedAttempts: after.failedAttempts, lastFailedAt: now, lockedUntil: after.lockedUntil });
  forgetOld(now);
  return after;
}

/** A good password ends the run. */
export function clearStaffFailures(key: string): void {
  runs.delete(key);
}

export interface StaffLoginLock {
  userId: number;
  failedAttempts: number;
  lockedUntil: Date;
  remainingMinutes: number;
}

/** Staff accounts locked right now, for the super admin's list. */
export function lockedStaff(now: Date): StaffLoginLock[] {
  const locked: StaffLoginLock[] = [];
  runs.forEach((run, key) => {
    if (!key.startsWith("user:") || !run.lockedUntil) return;
    const state = lockState({ lockedUntil: run.lockedUntil, now });
    if (!state.locked) return;
    locked.push({
      userId: Number(key.slice("user:".length)),
      failedAttempts: run.failedAttempts,
      lockedUntil: run.lockedUntil,
      remainingMinutes: state.remainingMinutes,
    });
  });
  return locked;
}

/** The super admin opens an account early. True if it was locked. */
export function unlockStaff(userId: number, now: Date = new Date()): boolean {
  const key = staffLockKey(userId);
  const wasLocked = staffLockState(key, now).locked;
  runs.delete(key);
  return wasLocked;
}

/** Drop runs nobody will ask about again, and the oldest past the ceiling. */
function forgetOld(now: Date): void {
  const quiet = 60 * 60 * 1000;
  runs.forEach((run, key) => {
    const lockOver = !run.lockedUntil || run.lockedUntil.getTime() <= now.getTime();
    if (lockOver && now.getTime() - run.lastFailedAt.getTime() > quiet) runs.delete(key);
  });
  for (const key of Array.from(runs.keys())) {
    if (runs.size <= MAX_RUNS) break;
    runs.delete(key);
  }
}

/** Tests only. */
export function resetStaffLoginLocks(): void {
  runs.clear();
}
