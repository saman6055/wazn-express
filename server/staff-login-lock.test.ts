import { describe, it, expect, vi, beforeEach } from "vitest";

// The sign-in signs a session token; the server loads its settings at start-up,
// which a test never does, so it gets a key of its own.
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    getConfig: () => ({ jwtSecret: "staff-login-lock-test-secret-0123456789" }) as ReturnType<typeof actual.getConfig>,
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByUsername: vi.fn(),
    getUserByMobile: vi.fn(),
    updateUserLastSignIn: vi.fn(async () => undefined),
    createAuditLog: vi.fn(async () => undefined),
  };
});

import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  clearStaffFailures,
  lockedStaff,
  recordStaffFailure,
  resetStaffLoginLocks,
  staffLockKey,
  staffLockState,
  unknownLockKey,
  unlockStaff,
} from "./lib/staffLoginLocks";

/**
 * The owner's decision (2026-09-11): five wrong passwords on a staff account
 * shut it for fifteen minutes, like the customer portal, and the super admin
 * can open it early.
 */

const MINUTE = 60 * 1000;

describe("the count behind the lock", () => {
  beforeEach(() => resetStaffLoginLocks());

  it("shuts the account on the fifth wrong password, for fifteen minutes", () => {
    const key = staffLockKey(7);
    const t0 = new Date("2026-09-11T08:00:00Z");
    for (let i = 1; i <= 4; i++) {
      expect(recordStaffFailure(key, new Date(t0.getTime() + i * 1000)).justLocked).toBe(false);
    }
    expect(staffLockState(key, t0).locked).toBe(false);

    const fifth = recordStaffFailure(key, new Date(t0.getTime() + 5000));
    expect(fifth.justLocked).toBe(true);

    const soon = new Date(t0.getTime() + 6000);
    expect(staffLockState(key, soon)).toMatchObject({ locked: true, remainingMinutes: 15 });
    expect(staffLockState(key, new Date(t0.getTime() + 5000 + 15 * MINUTE + 1)).locked).toBe(false);
  });

  it("forgets a run after a quiet hour", () => {
    const key = staffLockKey(7);
    const t0 = new Date("2026-09-11T08:00:00Z");
    for (let i = 0; i < 4; i++) recordStaffFailure(key, t0);
    const muchLater = recordStaffFailure(key, new Date(t0.getTime() + 61 * MINUTE));
    expect(muchLater).toMatchObject({ failedAttempts: 1, justLocked: false });
  });

  it("lists locked staff accounts for the super admin, not guessed names", () => {
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      recordStaffFailure(staffLockKey(7), now);
      recordStaffFailure(unknownLockKey("Ghost"), now);
    }
    expect(staffLockState(unknownLockKey("ghost "), now).locked).toBe(true);
    expect(lockedStaff(now).map((lock) => lock.userId)).toEqual([7]);
  });

  it("opens early for the super admin, and says whether it was shut", () => {
    const now = new Date();
    for (let i = 0; i < 5; i++) recordStaffFailure(staffLockKey(7), now);
    expect(unlockStaff(7, now)).toBe(true);
    expect(staffLockState(staffLockKey(7), now).locked).toBe(false);
    expect(unlockStaff(7, now)).toBe(false);
  });

  it("starts again from nothing after a good password", () => {
    const now = new Date();
    for (let i = 0; i < 4; i++) recordStaffFailure(staffLockKey(7), now);
    clearStaffFailures(staffLockKey(7));
    expect(recordStaffFailure(staffLockKey(7), now).failedAttempts).toBe(1);
  });
});

function contextFor(role: string | null): TrpcContext {
  return {
    user: role
      ? ({
          id: 1,
          openId: `lock-test-${role}`,
          email: null,
          name: role,
          loginMethod: "password",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as unknown as TrpcContext["user"])
      : null,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function messageOf(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
    return "SIGNED IN";
  } catch (error) {
    return error instanceof TRPCError ? error.message : String(error);
  }
}

describe("the staff sign-in", () => {
  const sara = {
    id: 7,
    username: "sara",
    name: "Sara",
    role: "employee",
    isActive: true,
    passwordHash: bcrypt.hashSync("right password", 4),
  };
  const visitor = appRouter.createCaller(contextFor(null));
  const signIn = (identifier: string, password: string) => () => visitor.auth.staffLogin({ identifier, password });

  beforeEach(() => {
    resetStaffLoginLocks();
    vi.mocked(db.getUserByUsername).mockImplementation((async (name: string) =>
      name === "sara" ? sara : undefined) as typeof db.getUserByUsername);
    vi.mocked(db.getUserByMobile).mockResolvedValue(undefined as never);
    vi.mocked(db.createAuditLog).mockClear();
  });

  it("locks after five wrong passwords and then refuses even the right one", async () => {
    for (let i = 0; i < 4; i++) {
      expect(await messageOf(signIn("sara", "wrong"))).toContain("وشەی نهێنی هەڵەیە");
    }
    const locked = await messageOf(signIn("sara", "wrong"));
    expect(locked).toContain("15 خولەک");
    expect(await messageOf(signIn("sara", "right password"))).toBe(locked);
    expect(vi.mocked(db.createAuditLog)).toHaveBeenCalledWith(expect.objectContaining({ action: "staff_login_locked", entityId: 7 }));
  });

  it("gives a made-up name the same five tries and the same answer", async () => {
    for (let i = 0; i < 4; i++) await messageOf(signIn("ghost", "wrong"));
    const ghost = await messageOf(signIn("ghost", "wrong"));
    for (let i = 0; i < 5; i++) await messageOf(signIn("sara", "wrong"));
    expect(ghost).toBe(await messageOf(signIn("sara", "wrong")));
  });

  it("only the super admin can open it early, and it is written down", async () => {
    for (let i = 0; i < 5; i++) await messageOf(signIn("sara", "wrong"));

    for (const role of ["admin", "employee", "accountant"]) {
      const caller = appRouter.createCaller(contextFor(role));
      await expect(caller.users.unlockLogin({ userId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.users.loginLocks()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    const owner = appRouter.createCaller(contextFor("super_admin"));
    expect((await owner.users.loginLocks()).map((lock) => lock.userId)).toEqual([7]);
    expect(await owner.users.unlockLogin({ userId: 7 })).toEqual({ success: true, wasLocked: true });
    expect(vi.mocked(db.createAuditLog)).toHaveBeenCalledWith(expect.objectContaining({ action: "unlock_staff_login", entityId: 7 }));

    expect(await messageOf(signIn("sara", "right password"))).toBe("SIGNED IN");
  });
});
