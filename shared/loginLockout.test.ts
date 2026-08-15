import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MINUTES,
  LOCKED_MESSAGE,
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  lockState,
  registerFailure,
} from "./loginLockout";

/**
 * The attack this exists for: one account, tried from many addresses. The
 * per-IP limiter sees a handful of tries from each and lets them all through;
 * the account sees hundreds.
 *
 * The failure mode on the other side matters just as much. Lock too eagerly,
 * or forget too slowly, and a customer who mistypes once a month is shut out
 * of their own parcels.
 */

const at = (iso: string) => new Date(iso);
const NOW = at("2026-08-16T12:00:00Z");
const mins = (n: number) => n * 60 * 1000;

describe("counting wrong passwords", () => {
  it("starts a run at one", () => {
    const after = registerFailure({ now: NOW });
    expect(after).toEqual({ failedAttempts: 1, lockedUntil: null, justLocked: false });
  });

  it("keeps counting while the tries keep coming", () => {
    let attempts = 0;
    for (let i = 1; i < MAX_LOGIN_ATTEMPTS; i++) {
      const after = registerFailure({
        failedAttempts: attempts,
        lastFailedAt: new Date(NOW.getTime() - mins(1)),
        now: NOW,
      });
      attempts = after.failedAttempts;
      expect(after.justLocked, `try ${i}`).toBe(false);
    }
    expect(attempts).toBe(MAX_LOGIN_ATTEMPTS - 1);
  });

  it("locks on the fifth", () => {
    const after = registerFailure({
      failedAttempts: MAX_LOGIN_ATTEMPTS - 1,
      lastFailedAt: new Date(NOW.getTime() - mins(1)),
      now: NOW,
    });
    expect(after.justLocked).toBe(true);
    expect(after.lockedUntil?.getTime()).toBe(NOW.getTime() + mins(LOCK_MINUTES));
  });

  it("forgets a run after a quiet hour", () => {
    // Four wrong tries in January and one in March must not lock anybody.
    const after = registerFailure({
      failedAttempts: MAX_LOGIN_ATTEMPTS - 1,
      lastFailedAt: new Date(NOW.getTime() - mins(ATTEMPT_WINDOW_MINUTES + 1)),
      now: NOW,
    });
    expect(after.failedAttempts).toBe(1);
    expect(after.justLocked).toBe(false);
  });

  it("counts a try just inside the window against the run", () => {
    const after = registerFailure({
      failedAttempts: MAX_LOGIN_ATTEMPTS - 1,
      lastFailedAt: new Date(NOW.getTime() - mins(ATTEMPT_WINDOW_MINUTES - 1)),
      now: NOW,
    });
    expect(after.justLocked).toBe(true);
  });

  it("survives a nonsense counter", () => {
    // A negative or missing count is a storage problem, not a licence to skip
    // the lock.
    for (const bad of [null, undefined, -3, NaN]) {
      const after = registerFailure({
        failedAttempts: bad as number,
        lastFailedAt: new Date(NOW.getTime() - mins(1)),
        now: NOW,
      });
      expect(after.failedAttempts, String(bad)).toBe(1);
    }
  });
});

describe("whether the door is shut", () => {
  it("is open when nothing was ever recorded", () => {
    expect(lockState({ now: NOW })).toEqual({ locked: false, remainingMs: 0, remainingMinutes: 0 });
  });

  it("is shut until the time passes", () => {
    const state = lockState({ lockedUntil: new Date(NOW.getTime() + mins(9)), now: NOW });
    expect(state.locked).toBe(true);
    expect(state.remainingMinutes).toBe(9);
  });

  it("opens the moment the lock expires", () => {
    expect(lockState({ lockedUntil: NOW, now: NOW }).locked).toBe(false);
    expect(lockState({ lockedUntil: new Date(NOW.getTime() - 1), now: NOW }).locked).toBe(false);
  });

  it("rounds the wait up, so nobody is told to wait zero minutes", () => {
    const state = lockState({ lockedUntil: new Date(NOW.getTime() + 30_000), now: NOW });
    expect(state.remainingMinutes).toBe(1);
  });

  it("treats an unreadable timestamp as unlocked", () => {
    // Refusing entry because a date could not be parsed would lock a customer
    // out of their own account over a storage fault.
    expect(lockState({ lockedUntil: "not a date", now: NOW }).locked).toBe(false);
  });
});

describe("what the customer is told", () => {
  it("does not name the field, the account, or the lock", () => {
    // Saying "wrong password" teaches a guesser which field to keep changing;
    // saying "locked" confirms the account exists.
    for (const lang of ["ku", "en", "ar", "zh"] as const) {
      const message = LOCKED_MESSAGE[lang];
      expect(message?.trim(), lang).toBeTruthy();
      expect(message.toLowerCase()).not.toContain("password");
      expect(message.toLowerCase()).not.toContain("locked");
    }
  });

  it("tells them what to do instead", () => {
    expect(LOCKED_MESSAGE.en.toLowerCase()).toContain("contact us");
  });
});
